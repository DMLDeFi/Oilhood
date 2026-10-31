import "server-only";
import { parseAbiItem, type Log } from "viem";
import { client, configuredPools, startBlock, token, burnSet } from "./chain";
import { getMeta, setMeta, sql } from "./db";
import { priceAt } from "./prices";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const ZERO = "0x0000000000000000000000000000000000000000";

/** Re-labels buys/sells when the pool list changes (e.g. DexScreener detects a new pool). */
export async function reclassify(pools: string[]) {
  const key = [...pools].sort().join(",");
  if ((await getMeta("pools.applied")) === key) return false;
  await sql()`
    update transfers set
      kind = case
        when from_addr = ${ZERO} then 'mint'
        when to_addr = any(${[...burnSet]}) then 'burn'
        when from_addr = any(${pools}) and not to_addr = any(${pools}) then 'buy'
        when to_addr = any(${pools}) and not from_addr = any(${pools}) then 'sell'
        else 'transfer' end,
      trader = case
        when from_addr = any(${pools}) and not to_addr = any(${pools}) then to_addr
        when to_addr = any(${pools}) and not from_addr = any(${pools}) then from_addr
        else null end`;
  await sql()`update transfers set price_usd = (
      select p.price_usd from prices p where p.ts <= transfers.ts and p.price_usd is not null order by p.ts desc limit 1)
    where kind in ('buy', 'sell') and price_usd is null`;
  await setMeta("pools.applied", key);
  return true;
}

export async function getPools(): Promise<string[]> {
  const detected = JSON.parse((await getMeta("pools.detected")) || "[]") as string[];
  return [...new Set([...configuredPools, ...detected])];
}

function classify(from: string, to: string, pools: Set<string>) {
  if (from === ZERO) return { kind: "mint", trader: to };
  if (burnSet.has(to)) return { kind: "burn", trader: from };
  if (pools.has(from) && !pools.has(to)) return { kind: "buy", trader: to };
  if (pools.has(to) && !pools.has(from)) return { kind: "sell", trader: from };
  return { kind: "transfer", trader: null };
}

type TransferLog = Log<bigint, number, false, typeof TRANSFER, true>;

async function timestamps(logs: TransferLog[]) {
  const out = new Map<bigint, Date>();
  const missing = new Set<bigint>();
  for (const l of logs) {
    // Newer nodes include blockTimestamp on logs; otherwise fetch the block.
    const ts = (l as unknown as { blockTimestamp?: string | bigint }).blockTimestamp;
    if (ts !== undefined && ts !== null) out.set(l.blockNumber, new Date(Number(BigInt(ts)) * 1000));
    else missing.add(l.blockNumber);
  }
  const blocks = [...missing].filter((b) => !out.has(b));
  for (let i = 0; i < blocks.length; i += 50) {
    const batch = await Promise.all(blocks.slice(i, i + 50).map((n) => client.getBlock({ blockNumber: n })));
    batch.forEach((b) => out.set(b.number, new Date(Number(b.timestamp) * 1000)));
  }
  return out;
}

/**
 * Indexes $OILHOOD Transfer events from the last indexed block up to the chain head,
 * in adaptive chunks, until `budgetMs` runs out. Returns how far it got.
 */
export async function indexTransfers(budgetMs = 8000) {
  if (!token) return { indexed: 0, head: null, done: true };
  const deadline = Date.now() + budgetMs;
  const pools = new Set(await getPools());
  const head = await client.getBlockNumber();
  let from = BigInt((await getMeta("index.next_block")) || startBlock.toString());
  let chunk = BigInt((await getMeta("index.chunk")) || "5000");
  let indexed = 0;

  while (from <= head && Date.now() < deadline) {
    const to = from + chunk - 1n > head ? head : from + chunk - 1n;
    let logs: TransferLog[];
    try {
      logs = (await client.getLogs({ address: token, event: TRANSFER, fromBlock: from, toBlock: to, strict: true })) as TransferLog[];
    } catch (e) {
      // Range too large or too many results: shrink the window and retry.
      if (chunk > 10n) {
        chunk = chunk / 2n;
        continue;
      }
      throw e;
    }

    if (logs.length) {
      const ts = await timestamps(logs);
      const rows = await Promise.all(
        logs.map(async (l) => {
          const f = l.args.from.toLowerCase();
          const t = l.args.to.toLowerCase();
          const { kind, trader } = classify(f, t, pools);
          const at = ts.get(l.blockNumber)!;
          return {
            block: l.blockNumber.toString(),
            ts: at,
            tx: l.transactionHash,
            log_index: l.logIndex,
            from_addr: f,
            to_addr: t,
            amount: l.args.value.toString(),
            kind,
            trader,
            price_usd: kind === "buy" || kind === "sell" ? await priceAt(at) : null,
          };
        }),
      );
      await applyTransfers(rows);
      indexed += rows.length;
    }

    from = to + 1n;
    await setMeta("index.next_block", from.toString());
    // Grow the window again after quiet, successful chunks.
    if (logs.length < 2000 && chunk < 50_000n) chunk = chunk * 2n;
    await setMeta("index.chunk", chunk.toString());
  }

  await setMeta("index.head", head.toString());
  // Everything up to this block's time is indexed; rig scoring only runs behind this mark.
  const doneBlock = from - 1n > head ? head : from - 1n;
  if (doneBlock >= startBlock && doneBlock >= 0n) {
    const lastDone = await client.getBlock({ blockNumber: doneBlock });
    await setMeta("index.synced_ts", new Date(Number(lastDone.timestamp) * 1000).toISOString());
  }
  return { indexed, head: head.toString(), next: from.toString(), done: from > head };
}

type Row = {
  block: string; ts: Date; tx: string; log_index: number; from_addr: string; to_addr: string;
  amount: string; kind: string; trader: string | null; price_usd: number | null;
};

/** Inserts transfers and updates the balance ledger in one transaction (idempotent on tx+log_index). */
async function applyTransfers(rows: Row[]) {
  await sql().begin(async (tx) => {
    const inserted = await tx<Row[]>`
      insert into transfers ${tx(rows, "block", "ts", "tx", "log_index", "from_addr", "to_addr", "amount", "kind", "trader", "price_usd")}
      on conflict (tx, log_index) do nothing
      returning block, ts, tx, log_index, from_addr, to_addr, amount, kind, trader, price_usd`;
    if (!inserted.length) return;

    const deltas = new Map<string, { delta: bigint; firstIn: Date | null; lastOut: Date | null }>();
    const bump = (addr: string, delta: bigint, at: Date, out: boolean) => {
      if (addr === ZERO) return;
      const d = deltas.get(addr) ?? { delta: 0n, firstIn: null, lastOut: null };
      d.delta += delta;
      if (out) d.lastOut = !d.lastOut || at > d.lastOut ? at : d.lastOut;
      else d.firstIn = !d.firstIn || at < d.firstIn ? at : d.firstIn;
      deltas.set(addr, d);
    };
    for (const r of inserted) {
      const amt = BigInt(r.amount);
      bump(r.from_addr, -amt, new Date(r.ts), true);
      bump(r.to_addr, amt, new Date(r.ts), false);
    }
    const upserts = [...deltas].map(([address, d]) => ({
      address,
      balance: d.delta.toString(),
      first_in: d.firstIn,
      last_out: d.lastOut,
    }));
    await tx`
      insert into balances ${tx(upserts, "address", "balance", "first_in", "last_out")}
      on conflict (address) do update set
        balance = balances.balance + excluded.balance,
        first_in = least(coalesce(balances.first_in, excluded.first_in), coalesce(excluded.first_in, balances.first_in)),
        last_out = greatest(coalesce(balances.last_out, excluded.last_out), coalesce(excluded.last_out, balances.last_out))`;
  });
}
