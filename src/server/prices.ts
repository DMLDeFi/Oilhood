import "server-only";
import { isAddress } from "viem";
import { fetchWithTimeout } from "@/lib/cache";
import { getMarket } from "@/lib/market";
import { token } from "./chain";
import { getMeta, setMeta, sql } from "./db";

interface Pair {
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  baseToken?: { address?: string };
}

/** Current $OILHOOD price and every pool DexScreener knows about for the token. */
async function dexscreener() {
  const address = token;
  if (!address) return null;
  try {
    const res = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const pairs = (((await res.json()) as { pairs?: Pair[] | null }).pairs ?? []).filter(
      (p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase(),
    );
    if (!pairs.length) return null;
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    return {
      price: pairs[0].priceUsd ? Number(pairs[0].priceUsd) : null,
      pools: pairs.map((p) => p.pairAddress ?? "").filter((a) => isAddress(a)).map((a) => a.toLowerCase()),
    };
  } catch {
    return null;
  }
}

/** Records one price row (at most one per minute) and refreshes detected pools. */
export async function snapshotPrice(now = new Date()) {
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const [dex, market] = await Promise.all([dexscreener(), getMarket()]);
  const fallback = Number(process.env.OILHOOD_FALLBACK_PRICE_USD) || null;
  const price = dex?.price ?? fallback;
  // Never store demo WTI: it would leak into rig scoring.
  const wti = market.quotes.wti && market.quotes.wti.source !== "demo" ? market.quotes.wti.price : null;

  if (dex?.pools.length) {
    const known = JSON.parse((await getMeta("pools.detected")) || "[]") as string[];
    const merged = [...new Set([...known, ...dex.pools])].sort();
    if (merged.join() !== [...known].sort().join()) await setMeta("pools.detected", JSON.stringify(merged));
  }

  await sql()`
    insert into prices (ts, price_usd, wti, source)
    values (${minute}, ${price}, ${wti}, ${dex?.price ? "dexscreener" : fallback ? "fallback" : "none"})
    on conflict (ts) do update set price_usd = coalesce(excluded.price_usd, prices.price_usd), wti = coalesce(excluded.wti, prices.wti)`;
  return { price, wti, demoWti: market.quotes.wti?.source === "demo" };
}

/** Latest known price at or before `at` (within 6h), else the first one after it (within 1h). */
export async function priceAt(at: Date): Promise<number | null> {
  const [before] = await sql()`
    select price_usd from prices where ts <= ${at} and ts > ${new Date(at.getTime() - 6 * 3600_000)} and price_usd is not null
    order by ts desc limit 1`;
  if (before) return before.price_usd as number;
  const [after] = await sql()`
    select price_usd from prices where ts > ${at} and ts < ${new Date(at.getTime() + 3600_000)} and price_usd is not null
    order by ts asc limit 1`;
  return (after?.price_usd as number | undefined) ?? null;
}

export async function wtiAt(at: Date): Promise<number | null> {
  const [row] = await sql()`
    select wti from prices where ts <= ${at} and ts > ${new Date(at.getTime() - 6 * 3600_000)} and wti is not null
    order by ts desc limit 1`;
  return (row?.wti as number | undefined) ?? null;
}
