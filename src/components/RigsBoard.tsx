"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useRigs, type RigsData } from "@/hooks/useData";
import { compact, num, shortAddr, timeAgo } from "@/lib/format";
import { GUSHER_BONUS, nextTier, rigNameMessage, STEADY_HOURS, steadyMultiplier, TIERS, validRigName } from "@/lib/rigs";
import { robinhood } from "@/lib/wagmi";
import { ConnectButton } from "./ConnectButton";
import { BuyButton } from "./BuyButton";
import { LiveDot } from "./DemoBadge";

const explorer = robinhood.blockExplorers.default.url;

export function RigsBoard() {
  const { address } = useAccount();
  const { data, dataUpdatedAt } = useRigs(address);
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <header className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <p className="label flex items-center gap-2">{data?.enabled && <LiveDot />} Virtual Rigs · season 1</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Hold $OILHOOD. <span className="gold-text">Run a rig.</span></h1>
          <p className="mt-3 max-w-xl text-smoke">
            Every wallet holding $OILHOOD runs a rig that produces points every hour. Bigger bags run bigger rigs, holding longer
            makes them more efficient, and when real oil prices rise, every rig gushes. No staking, no lockups: your tokens never leave your wallet.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 font-mono">
          <Mini label="Active rigs" value={data?.enabled ? num(data.active, 0) : "—"} />
          <Mini label="All-time rigs" value={data?.enabled ? num(data.total, 0) : "—"} />
          <Mini label="Last scored" value={data?.lastEpoch ? timeAgo(data.lastEpoch.ts) : "—"} sub={data?.lastEpoch?.gusher ? "🛢 gusher hour" : undefined} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <MyRig data={data} address={address} asOf={dataUpdatedAt} />
        <Rules />
      </div>

      <TierLadder current={data?.rig?.tier} />
      <Leaderboard data={data} me={address?.toLowerCase()} />

      <p className="text-xs leading-relaxed text-smoke/80">
        Points are a community scoreboard. They have no monetary value, are not a token, and are not a promise of any future reward.
        Pools, burn addresses and the creator wallet are excluded. Rules may be adjusted between seasons to keep things fair.
      </p>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="label !text-[10px]">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
      {sub && <p className="text-[11px] text-gold">{sub}</p>}
    </div>
  );
}

function MyRig({ data, address, asOf }: { data?: RigsData; address?: string; asOf: number }) {
  if (!address) {
    return (
      <div className="panel oil-sheen flex flex-col items-start justify-center gap-4 p-8">
        <span className="text-5xl">🛢</span>
        <h2 className="text-2xl font-bold">Find your rig</h2>
        <p className="text-sm text-smoke">Connect the wallet that holds your $OILHOOD. Read-only, nothing to approve.</p>
        <ConnectButton />
      </div>
    );
  }
  const rig = data?.rig;
  if (!data?.enabled || !rig || rig.points === 0) {
    return (
      <div className="panel flex flex-col items-start justify-center gap-4 p-8">
        <span className="text-5xl">🔍</span>
        <h2 className="text-2xl font-bold">No rig yet</h2>
        <p className="text-sm text-smoke">
          {data?.enabled
            ? "Rigs are scored at the top of every hour. Hold at least 0.1 virtual barrels of $OILHOOD and your rig shows up after the next scored hour."
            : "Rigs start producing at launch. Hold $OILHOOD and your rig appears after the first scored hour."}
        </p>
        <BuyButton />
      </div>
    );
  }
  const tier = TIERS[rig.tier] ?? TIERS[0];
  const next = nextTier(rig.barrels);
  const holdHours = rig.holdingSince ? (asOf - new Date(rig.holdingSince).getTime()) / 3600_000 : 0;
  const steady = steadyMultiplier(holdHours);
  const progress = next ? Math.min(1, rig.barrels / next.min) : 1;

  return (
    <div className="panel relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">Your rig {rig.rank ? `· rank #${rig.rank}` : ""}</p>
          <h2 className="mt-2 text-2xl font-bold">{rig.name ?? shortAddr(rig.address)}</h2>
          <p className="mt-1 text-sm text-gold">{tier.icon} {tier.name}</p>
        </div>
        <RigAnimation tier={rig.tier} active={rig.rate > 0} />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 font-mono">
        <div><p className="label !text-[10px]">Points</p><p className="mt-1 text-2xl font-bold gold-text">{compact(rig.points)}</p></div>
        <div><p className="label !text-[10px]">Per hour</p><p className="mt-1 text-2xl">{num(rig.rate, 2)}</p></div>
        <div><p className="label !text-[10px]">Barrels</p><p className="mt-1 text-2xl">{num(rig.barrels, 2)}</p></div>
      </div>
      <div className="mt-6 space-y-4 text-sm">
        <Meter label="Steady hands" value={`${steady.toFixed(2)}x`} fill={(steady - 1)} note={steady >= 2 ? "Maxed out" : `Hold ${Math.ceil(STEADY_HOURS - Math.min(holdHours, STEADY_HOURS))}h more without selling for 2x`} />
        <Meter label={next ? `Next: ${next.icon} ${next.name}` : "Top tier"} value={next ? `${num(rig.barrels, 2)} / ${next.min} bbl` : "🚢"} fill={progress} note={next ? `Base output ${tier.rate} → ${next.rate} per hour` : "You're running a supertanker."} />
      </div>
      <NameRig address={rig.address} current={rig.name} />
    </div>
  );
}

function Meter({ label, value, fill, note }: { label: string; value: string; fill: number; note: string }) {
  return (
    <div>
      <div className="flex justify-between font-mono text-xs"><span className="text-smoke">{label}</span><span>{value}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rig"><div className="h-full rounded-full bg-gradient-to-r from-amber to-gold" style={{ width: `${Math.max(2, fill * 100)}%` }} /></div>
      <p className="mt-1 text-xs text-smoke">{note}</p>
    </div>
  );
}

/** Pumpjack that nods while the rig is producing. Speed scales with tier. */
function RigAnimation({ tier, active }: { tier: number; active: boolean }) {
  const dur = `${Math.max(0.9, 2.6 - tier * 0.35)}s`;
  return (
    <svg viewBox="0 0 120 90" className="h-20 w-28 shrink-0" aria-hidden>
      <rect x="8" y="80" width="104" height="4" rx="2" fill="#24242e" />
      <path d="M40 80 L58 34 L76 80" fill="none" stroke="#8d8a99" strokeWidth="3" />
      <g style={{ transformOrigin: "58px 34px", animation: active ? `nod ${dur} ease-in-out infinite` : undefined }}>
        <rect x="18" y="30" width="84" height="8" rx="4" fill="#f5b83d" />
        <path d="M100 26 q12 8 0 16" fill="#f5b83d" />
        <line x1="104" y1="40" x2="104" y2="72" stroke="#ede4cf" strokeWidth="1.5" />
      </g>
      <circle cx="58" cy="34" r="4" fill="#ede4cf" />
      <rect x="14" y="56" width="16" height="24" rx="3" fill="#15151c" stroke="#24242e" />
      <style>{`@keyframes nod { 0%,100% { transform: rotate(-12deg) } 50% { transform: rotate(12deg) } }`}</style>
    </svg>
  );
}

function NameRig({ address, current }: { address: string; current: string | null }) {
  const [name, setName] = useState(current ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { signMessageAsync, isPending } = useSignMessage();
  const qc = useQueryClient();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validRigName(name)) return setMsg({ ok: false, text: "Use 3–20 letters, numbers, spaces, - or _" });
    try {
      const issuedAt = new Date().toISOString();
      const signature = await signMessageAsync({ message: rigNameMessage(address, name, issuedAt) });
      const res = await fetch("/api/rigs/name", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, name, issuedAt, signature }) });
      const json = await res.json();
      if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Could not save" });
      setMsg({ ok: true, text: `Your rig is now “${json.name}”` });
      qc.invalidateQueries({ queryKey: ["rigs"] });
    } catch {
      setMsg({ ok: false, text: "Signature cancelled" });
    }
  }

  return (
    <form onSubmit={save} className="mt-6 border-t border-pipe pt-5">
      <p className="label mb-2">Name your rig</p>
      <div className="flex gap-2">
        <input className="input !py-2.5" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Texas Tea" />
        <button className="btn-ghost !py-2.5 whitespace-nowrap" disabled={isPending}>{isPending ? "Sign in wallet…" : "Save"}</button>
      </div>
      <p className={`mt-2 text-xs ${msg ? (msg.ok ? "text-up" : "text-down") : "text-smoke"}`}>{msg?.text ?? "Free signature, no gas, no funds moved."}</p>
    </form>
  );
}

function Rules() {
  const rules = [
    { k: "Rig size", v: "Your $OILHOOD value ÷ WTI price = virtual barrels. More barrels, bigger rig, higher base output." },
    { k: "Fair scaling", v: "Output grows with size, but only logarithmically, so a whale can't simply buy the leaderboard." },
    { k: "Steady hands", v: `Every hour you hold without selling or sending tokens out raises your multiplier, up to 2x after ${STEADY_HOURS / 24} days. Selling resets it.` },
    { k: "Gusher hours", v: `When WTI crude closes the hour higher than it opened, every rig produces +${Math.round((GUSHER_BONUS - 1) * 100)}%.` },
    { k: "Snapshot-proof", v: "Balances are rebuilt from the chain at the exact end of each hour. Buying a minute before scoring and selling after does nothing for you." },
  ];
  return (
    <div className="panel p-6 md:p-8">
      <p className="label">How rigs score</p>
      <dl className="mt-4 space-y-4">
        {rules.map((r) => (
          <div key={r.k} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
            <dt className="font-semibold text-gold">{r.k}</dt>
            <dd className="text-sm text-smoke">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 rounded-xl border border-pipe bg-crude/60 p-4 font-mono text-xs text-smoke">
        points/hour = tier rate × (1 + ¼·log₁₀(1 + barrels)) × steady (1–2x) × gusher (1.25x)
      </p>
    </div>
  );
}

function TierLadder({ current }: { current?: number }) {
  return (
    <section>
      <p className="label mb-3">Rig tiers</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TIERS.map((t) => (
          <div key={t.id} className={`panel p-4 ${current === t.id ? "border-gold/60" : ""}`}>
            <span className="text-3xl">{t.icon}</span>
            <p className="mt-2 font-semibold">{t.name}</p>
            <p className="font-mono text-xs text-smoke">{t.min ? `≥ ${t.min} bbl` : "< 0.1 bbl"}</p>
            <p className="mt-1 font-mono text-xs text-gold">{t.rate ? `${t.rate} pts/h base` : "no output"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Leaderboard({ data, me }: { data?: RigsData; me?: string }) {
  const rows = data?.rigs ?? [];
  return (
    <section className="panel p-5 md:p-6">
      <p className="label mb-4">Leaderboard</p>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-smoke">{data?.enabled ? "The first rigs appear after the first scored hour." : "The leaderboard opens at launch."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] font-mono text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-smoke">
                <th className="pb-3 pr-3 font-normal">#</th><th className="pb-3 pr-3 font-normal">Rig</th><th className="pb-3 pr-3 font-normal">Tier</th>
                <th className="pb-3 pr-3 text-right font-normal">Barrels</th><th className="pb-3 pr-3 text-right font-normal">Per hour</th><th className="pb-3 text-right font-normal">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pipe">
              {rows.map((r) => {
                const t = TIERS[r.tier] ?? TIERS[0];
                return (
                  <tr key={r.address} className={r.address === me ? "bg-gold/10" : ""}>
                    <td className="py-2.5 pr-3 text-smoke">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                    <td className="py-2.5 pr-3">
                      <a href={`${explorer}/address/${r.address}`} target="_blank" rel="noreferrer" className="hover:text-gold">{r.name ?? shortAddr(r.address)}</a>
                      {r.address === me && <span className="ml-2 text-[10px] text-gold">YOU</span>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{t.icon} <span className="text-smoke">{t.name}</span></td>
                    <td className="py-2.5 pr-3 text-right">{num(r.barrels, 2)}</td>
                    <td className="py-2.5 pr-3 text-right">{num(r.rate, 2)}</td>
                    <td className="py-2.5 text-right text-gold">{compact(r.points)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
