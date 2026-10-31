"use client";

import { useEffect, useRef, useState } from "react";
import { useLive, type LiveTrade } from "@/hooks/useData";
import { compact, num, shortAddr, timeAgo, usd } from "@/lib/format";
import { robinhood } from "@/lib/wagmi";
import { Change } from "./Change";
import { LiveDot } from "./DemoBadge";
import { PriceChart } from "./PriceChart";

const explorer = robinhood.blockExplorers.default.url;
const WHALE_USD = 1000;

export function LiveToken() {
  const { data } = useLive();
  if (!data) return <div className="panel h-[520px] animate-pulse" />;
  if (!data.enabled) return <Prelaunch reason={data.reason} />;
  const s = data.stats!;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold"><LiveDot /> Live $OILHOOD</h2>
        <p className="font-mono text-xs text-smoke">Indexed straight from Robinhood Chain · updates every 5s</p>
      </div>
      <div className="grid grid-cols-2 gap-3 font-mono sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Price" value={usd(s.price)} sub={<Change value={s.change24h} className="text-xs" />} gold />
        <Stat label="Market cap" value={compact(s.marketCap, "$")} sub={s.ath ? `ATH ${usd(s.ath)}` : undefined} />
        <Stat label="24h volume" value={compact(s.volume24h, "$")} />
        <Stat label="24h buys / sells" value={`${s.buys24h} / ${s.sells24h}`} sub={<BuySellBar buys={s.buys24h} sells={s.sells24h} />} />
        <Stat label="24h traders" value={num(s.traders24h, 0)} />
        <Stat label="Holders" value={num(s.holders, 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel h-[440px] p-5"><PriceChart /></div>
        <TradeFeed trades={data.trades ?? []} />
      </div>
      <Holders holders={data.holders ?? []} />
    </section>
  );
}

function Stat({ label, value, sub, gold }: { label: string; value: string; sub?: React.ReactNode; gold?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <p className="label !text-[10px]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${gold ? "text-gold" : "text-sand"}`}>{value}</p>
      {sub && <div className="mt-0.5 text-xs text-smoke">{sub}</div>}
    </div>
  );
}

function BuySellBar({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells || 1;
  return (
    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-rig">
      <div className="bg-up" style={{ width: `${(buys / total) * 100}%` }} />
      <div className="bg-down" style={{ width: `${(sells / total) * 100}%` }} />
    </div>
  );
}

function TradeFeed({ trades }: { trades: LiveTrade[] }) {
  // Highlight trades that arrived since the last poll.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(trades.map((t) => t.id));
    if (seen.current) {
      const prev = seen.current;
      const added = new Set([...ids].filter((id) => !prev.has(id)));
      if (added.size) {
        const timer = setTimeout(() => setFresh(added), 0);
        const clear = setTimeout(() => setFresh(new Set()), 2500);
        seen.current = ids;
        return () => { clearTimeout(timer); clearTimeout(clear); };
      }
    }
    seen.current = ids;
  }, [trades]);

  return (
    <div className="panel flex h-[440px] flex-col p-5">
      <p className="label mb-3">Trades</p>
      {trades.length === 0 ? (
        <p className="m-auto text-sm text-smoke">No trades yet.</p>
      ) : (
        <ul className="-mx-2 flex-1 space-y-0.5 overflow-y-auto font-mono text-xs">
          {trades.map((t) => {
            const whale = (t.usd ?? 0) >= WHALE_USD;
            return (
              <li key={t.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-700 ${fresh.has(t.id) ? (t.kind === "buy" ? "bg-up/15" : "bg-down/15") : ""}`}>
                <span className={`w-10 font-semibold uppercase ${t.kind === "buy" ? "text-up" : "text-down"}`}>{t.kind}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sand">
                    {whale && "🐋 "}{compact(t.amount)} <span className="text-smoke">·</span> {usd(t.usd, 2)}
                    {t.barrels !== null && <span className="text-gold"> · {num(t.barrels, t.barrels < 10 ? 2 : 0)} bbl</span>}
                  </span>
                  <a href={`${explorer}/address/${t.trader}`} target="_blank" rel="noreferrer" className="text-smoke hover:text-gold">{shortAddr(t.trader)}</a>
                </span>
                <a href={`${explorer}/tx/${t.tx}`} target="_blank" rel="noreferrer" className="text-right text-smoke hover:text-gold">{timeAgo(t.ts)} ↗</a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Holders({ holders }: { holders: { address: string; amount: number; pct: number; label: string | null }[] }) {
  return (
    <div className="panel p-5">
      <p className="label mb-3">Top holders</p>
      <ul className="grid gap-x-8 gap-y-2 font-mono text-xs md:grid-cols-2">
        {holders.map((h, i) => (
          <li key={h.address} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
            <span className="text-smoke">{i + 1}</span>
            <span className="min-w-0">
              <a href={`${explorer}/address/${h.address}`} target="_blank" rel="noreferrer" className="hover:text-gold">{shortAddr(h.address)}</a>
              {h.label && <span className="ml-2 rounded bg-pipe px-1.5 py-0.5 text-[10px] uppercase text-smoke">{h.label}</span>}
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-rig"><span className="block h-full bg-gold/70" style={{ width: `${Math.min(100, h.pct)}%` }} /></span>
            </span>
            <span className="text-right">{h.pct.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Prelaunch({ reason }: { reason?: string }) {
  return (
    <section className="panel oil-sheen p-6 md:p-8">
      <p className="label">Live $OILHOOD · on-chain</p>
      <h2 className="mt-2 text-2xl font-bold">Goes live the minute $OILHOOD launches.</h2>
      <p className="mt-2 max-w-2xl text-sm text-smoke">
        Every trade is read directly from Robinhood Chain and shown here: candlestick chart, live buy/sell feed with whale alerts,
        24h volume, holder count and top holders.
      </p>
      <div className="mt-5 grid gap-2 font-mono text-xs text-smoke sm:grid-cols-4">
        {["Price chart", "Trade feed", "Holder stats", "Whale alerts"].map((x) => (
          <div key={x} className="rounded-xl border border-dashed border-pipe px-3 py-4 text-center">{x}</div>
        ))}
      </div>
      {reason === "no-database" && <p className="mt-4 text-xs text-amber">Admin: set DATABASE_URL to enable the indexer.</p>}
    </section>
  );
}
