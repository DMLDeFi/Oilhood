import "server-only";
import { formatUnits } from "viem";
import { creatorWallet } from "@/config/site";
import { burnSet, tokenDecimals } from "./chain";
import { sql } from "./db";
import { getPools } from "./indexer";

const DAY = 86_400_000;

export interface Trade {
  id: string;
  kind: "buy" | "sell";
  ts: string;
  tx: string;
  trader: string;
  amount: number;
  usd: number | null;
  barrels: number | null;
}

async function latestWti() {
  const [r] = await sql()`select wti from prices where wti is not null order by ts desc limit 1`;
  return (r?.wti as number | undefined) ?? null;
}

export async function getTrades(limit = 40, before?: string): Promise<Trade[]> {
  const dec = await tokenDecimals();
  const wti = await latestWti();
  const rows = await sql()`
    select id::text, kind, ts, tx, trader, amount::text, price_usd from transfers
    where kind in ('buy', 'sell') ${before ? sql()`and id < ${before}` : sql()``}
    order by transfers.id desc limit ${limit}`;
  return rows.map((r) => {
    const amount = Number(formatUnits(BigInt(r.amount), dec));
    const usd = r.price_usd !== null ? amount * (r.price_usd as number) : null;
    return {
      id: r.id, kind: r.kind, ts: new Date(r.ts).toISOString(), tx: r.tx, trader: r.trader, amount, usd,
      barrels: usd !== null && wti ? usd / wti : null,
    };
  });
}

export async function getStats() {
  const dec = await tokenDecimals();
  const pools = await getPools();
  const skip = [...burnSet, ...pools];
  const since = new Date(Date.now() - DAY);
  const [day] = await sql()`
    select
      count(*) filter (where kind = 'buy')::int as buys,
      count(*) filter (where kind = 'sell')::int as sells,
      count(distinct trader)::int as traders,
      coalesce(sum(price_usd * amount::double precision), 0) as raw_volume
    from transfers where kind in ('buy', 'sell') and ts > ${since}`;
  const [h] = await sql()`select count(*)::int as n from balances where balance > 0 and not address = any(${skip})`;
  const [supply] = await sql()`select coalesce(sum(balance), 0)::text as s from balances where balance > 0`;
  const [burned] = await sql()`select coalesce(sum(balance), 0)::text as s from balances where address = any(${[...burnSet]})`;
  const [now] = await sql()`select price_usd, wti, ts from prices where price_usd is not null order by ts desc limit 1`;
  const [ago] = await sql()`select price_usd from prices where price_usd is not null and ts <= ${since} order by ts desc limit 1`;
  const [ath] = await sql()`select max(price_usd) as p from prices`;
  const unit = 10 ** dec;
  const price = (now?.price_usd as number | undefined) ?? null;
  const circulating = Number(formatUnits(BigInt(supply.s) - BigInt(burned.s), dec));
  return {
    price,
    change24h: price && ago?.price_usd ? ((price - ago.price_usd) / ago.price_usd) * 100 : null,
    ath: (ath?.p as number | undefined) ?? null,
    volume24h: Number(day.raw_volume) / unit,
    buys24h: day.buys,
    sells24h: day.sells,
    traders24h: day.traders,
    holders: h.n,
    marketCap: price ? circulating * price : null,
    pools,
  };
}

const FRAMES = { "5m": "5 minutes", "15m": "15 minutes", "1h": "1 hour", "4h": "4 hours", "1d": "1 day" } as const;
export type Timeframe = keyof typeof FRAMES;
export const isTimeframe = (v: string | null): v is Timeframe => !!v && v in FRAMES;

/** OHLC candles from price snapshots plus traded volume per bucket. */
export async function getCandles(tf: Timeframe, limit = 300) {
  const dec = await tokenDecimals();
  const interval = FRAMES[tf];
  const rows = await sql()`
    with p as (
      select date_bin(${interval}::interval, ts, timestamptz '2020-01-01') as b,
        (array_agg(price_usd order by ts))[1] as o, max(price_usd) as h, min(price_usd) as l,
        (array_agg(price_usd order by ts desc))[1] as c
      from prices where price_usd is not null group by 1
    ), v as (
      select date_bin(${interval}::interval, ts, timestamptz '2020-01-01') as b,
        sum(price_usd * amount::double precision) as vol
      from transfers where kind in ('buy', 'sell') group by 1
    )
    select p.b, p.o, p.h, p.l, p.c, coalesce(v.vol, 0) as vol from p left join v using (b)
    order by p.b desc limit ${limit}`;
  const unit = 10 ** dec;
  return rows.reverse().map((r) => ({
    time: Math.floor(new Date(r.b).getTime() / 1000),
    open: r.o as number, high: r.h as number, low: r.l as number, close: r.c as number,
    volume: Number(r.vol) / unit,
  }));
}

export async function getHolders(limit = 15) {
  const dec = await tokenDecimals();
  const pools = new Set(await getPools());
  const [supply] = await sql()`select coalesce(sum(balance), 0)::text as s from balances where balance > 0`;
  const total = Number(formatUnits(BigInt(supply.s), dec)) || 1;
  const rows = await sql()`select address, balance::text as bal from balances where balance > 0 order by balances.balance desc limit ${limit}`;
  return rows.map((r) => {
    const amount = Number(formatUnits(BigInt(r.bal), dec));
    const a = r.address as string;
    const label = pools.has(a) ? "Pool" : burnSet.has(a) ? "Burned" : creatorWallet?.toLowerCase() === a ? "Creator" : null;
    return { address: a, amount, pct: (amount / total) * 100, label };
  });
}

export async function getLeaderboard(limit = 50) {
  const rows = await sql()`
    select address, name, points, last_rate, last_barrels, last_tier from rigs
    where points > 0 order by points desc limit ${limit}`;
  const [count] = await sql()`select count(*) filter (where last_rate > 0)::int as active, count(*)::int as total from rigs where points > 0`;
  const [epoch] = await sql()`select ts, note from epochs order by ts desc limit 1`;
  return {
    rigs: rows.map((r, i) => ({ rank: i + 1, address: r.address, name: r.name, points: r.points, rate: r.last_rate, barrels: r.last_barrels, tier: r.last_tier })),
    active: count.active,
    total: count.total,
    lastEpoch: epoch ? { ts: new Date(epoch.ts).toISOString(), gusher: epoch.note === "gusher" } : null,
  };
}

export async function getRig(address: string) {
  const a = address.toLowerCase();
  const [rig] = await sql()`select address, name, points, last_rate, last_barrels, last_tier from rigs where address = ${a}`;
  const [bal] = await sql()`select balance::text, first_in, last_out from balances where address = ${a}`;
  const rank = rig ? (await sql()`select count(*)::int + 1 as r from rigs where points > ${rig.points}`)[0].r : null;
  const since = bal ? (bal.last_out ?? bal.first_in) : null;
  return {
    address: a,
    name: rig?.name ?? null,
    points: rig?.points ?? 0,
    rate: rig?.last_rate ?? 0,
    barrels: rig?.last_barrels ?? 0,
    tier: rig?.last_tier ?? 0,
    rank,
    holdingSince: since ? new Date(since).toISOString() : null,
  };
}
