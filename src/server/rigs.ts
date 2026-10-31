import "server-only";
import { formatUnits } from "viem";
import { pointsPerHour, tierFor } from "@/lib/rigs";
import { excluded, token, tokenDecimals } from "./chain";
import { getMeta, sql } from "./db";
import { getPools } from "./indexer";
import { priceAt, wtiAt } from "./prices";

const HOUR = 3600_000;
const floorHour = (d: Date) => new Date(Math.floor(d.getTime() / HOUR) * HOUR);

/**
 * Scores every completed hour that hasn't been scored yet (up to `maxEpochs` per run).
 * Balances are reconstructed as of the exact end of each hour from the transfer log,
 * so a late or missed sync never changes anyone's points.
 */
export async function processEpochs(now = new Date(), maxEpochs = 24) {
  if (!token) return { scored: 0 };
  const synced = await getMeta("index.synced_ts");
  if (!synced) return { scored: 0, reason: "index not caught up" };
  const syncedAt = new Date(synced);

  const cursor = await getMeta("rigs.last_epoch");
  let last: Date;
  if (cursor) last = new Date(cursor);
  else {
    const [first] = await sql()`select min(ts) as ts from transfers`;
    if (!first?.ts) return { scored: 0, reason: "no transfers yet" };
    last = floorHour(new Date(first.ts));
  }

  const dec = await tokenDecimals();
  const skip = excluded(await getPools());
  let scored = 0;

  for (let i = 0; i < maxEpochs; i++) {
    const epoch: Date = new Date(last.getTime() + HOUR);
    if (epoch > floorHour(now) || epoch > syncedAt) break;

    const [price, wtiClose, wtiOpen] = await Promise.all([priceAt(epoch), wtiAt(epoch), wtiAt(new Date(epoch.getTime() - HOUR))]);
    const gusher = wtiOpen !== null && wtiClose !== null && wtiClose > wtiOpen;

    await sql().begin(async (tx) => {
      // Idempotent: an hour is scored exactly once, and the cursor moves in the same transaction.
      const [done] = await tx`select 1 from epochs where ts = ${epoch}`;
      if (done) return;
      await tx`insert into meta (key, value) values ('rigs.last_epoch', ${epoch.toISOString()})
        on conflict (key) do update set value = excluded.value`;
      if (!price || !wtiClose) {
        await tx`insert into epochs (ts, price_usd, wti_open, wti_close, note)
          values (${epoch}, ${price}, ${wtiOpen}, ${wtiClose}, 'skipped: no price data') on conflict (ts) do nothing`;
        return;
      }

      const holders = await tx`
        with flows as (
          select to_addr as a, amount as d, null::timestamptz as out_ts, ts as in_ts from transfers where ts <= ${epoch}
          union all
          select from_addr, -amount, ts, null from transfers where ts <= ${epoch}
        )
        select a, sum(d)::text as bal, max(out_ts) as last_out, min(in_ts) as first_in
        from flows group by a having sum(d) > 0`;

      const rows: { address: string; points: number; last_rate: number; last_barrels: number; last_tier: number; updated_at: Date }[] = [];
      for (const h of holders) {
        const addr = h.a as string;
        if (skip.has(addr)) continue;
        const bal = Number(formatUnits(BigInt(h.bal), dec));
        const barrels = (bal * price) / wtiClose;
        const since = h.last_out ? new Date(h.last_out) : new Date(h.first_in);
        const holdHours = (epoch.getTime() - since.getTime()) / HOUR;
        const pts = pointsPerHour(barrels, holdHours, gusher);
        rows.push({ address: addr, points: pts, last_rate: pts, last_barrels: barrels, last_tier: tierFor(barrels).id, updated_at: epoch });
      }

      await tx`update rigs set last_rate = 0, last_barrels = 0, last_tier = 0 where updated_at is null or updated_at < ${epoch}`;
      for (let j = 0; j < rows.length; j += 1000) {
        const batch = rows.slice(j, j + 1000);
        await tx`
          insert into rigs ${tx(batch, "address", "points", "last_rate", "last_barrels", "last_tier", "updated_at")}
          on conflict (address) do update set
            points = rigs.points + excluded.points,
            last_rate = excluded.last_rate,
            last_barrels = excluded.last_barrels,
            last_tier = excluded.last_tier,
            updated_at = excluded.updated_at`;
      }
      const total = rows.reduce((s, r) => s + r.points, 0);
      await tx`insert into epochs (ts, price_usd, wti_open, wti_close, rigs, points, note)
        values (${epoch}, ${price}, ${wtiOpen}, ${wtiClose}, ${rows.filter((r) => r.points > 0).length}, ${total}, ${gusher ? "gusher" : null})
        on conflict (ts) do nothing`;
    });

    last = epoch;
    scored++;
  }
  return { scored, last: last.toISOString() };
}
