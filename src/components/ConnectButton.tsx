"use client";

import { useEffect, useRef, useState } from "react";
import { useMounted } from "@/hooks/useMounted";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhood } from "@/lib/wagmi";
import { shortAddr } from "@/lib/format";

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!mounted) return <button className={`btn-ghost ${className}`} disabled>Connect</button>;

  const wrongChain = isConnected && chainId !== robinhood.id;
  const hasInjected = typeof window !== "undefined" && !!(window as { ethereum?: unknown }).ethereum;
  // EIP-6963 discovered wallets show by name; hide the generic "Injected" entry when a named one exists
  // or when the browser has no wallet at all (it would only fail with "Provider not found").
  const list = connectors.filter(
    (c, _, all) => !(c.id === "injected" && (!hasInjected || all.some((o) => o.type === "injected" && o.id !== "injected"))),
  );

  return (
    <div className="relative" ref={ref}>
      {isConnected && address ? (
        wrongChain ? (
          <button className={`btn-gold ${className}`} disabled={switching} onClick={() => switchChain({ chainId: robinhood.id })}>
            {switching ? "Switching…" : "Switch to Robinhood Chain"}
          </button>
        ) : (
          <button className={`btn-ghost font-mono ${className}`} onClick={() => setOpen((o) => !o)}>
            <span className="h-2 w-2 rounded-full bg-up" /> {shortAddr(address)}
          </button>
        )
      ) : (
        <button className={`btn-ghost ${className}`} onClick={() => setOpen((o) => !o)} disabled={isPending}>
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
      )}

      {open && (
        <div className="panel absolute right-0 z-50 mt-2 w-64 animate-rise !bg-well p-2 !backdrop-blur-none">
          {isConnected ? (
            <>
              <p className="px-3 py-2 label">Connected · Robinhood Chain</p>
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-rig"
                onClick={() => navigator.clipboard?.writeText(address!).catch(() => {})}
              >
                Copy address
              </button>
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-rig" onClick={() => { disconnect(); setOpen(false); }}>
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-2 label">Choose wallet</p>
              {list.map((c) => (
                <button
                  key={c.uid}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-rig"
                  onClick={() => connect({ connector: c, chainId: robinhood.id }, { onSuccess: () => setOpen(false) })}
                >
                  {c.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs
                    <img src={c.icon} alt="" className="h-5 w-5 rounded" />
                  ) : <span className="grid h-5 w-5 place-items-center text-base">{FALLBACK_ICON[c.id] ?? "👛"}</span>}
                  {c.id === "injected" ? "Browser wallet" : c.name}
                </button>
              ))}
              {error && <p className="px-3 py-2 text-xs text-down">{friendlyError(error.message)}</p>}
              {!hasInjected && <OpenInWallet />}
              <p className="px-3 pt-2 pb-1 text-[11px] text-smoke">Chain ID {robinhood.id} is added to your wallet automatically.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const FALLBACK_ICON: Record<string, string> = { metaMaskSDK: "🦊", coinbaseWalletSDK: "🔵", walletConnect: "🔗" };

function friendlyError(message: string) {
  if (/provider not found|no provider/i.test(message)) return "No wallet found in this browser. Open this page in your wallet app instead (below).";
  if (/rejected|denied/i.test(message)) return "Request cancelled in your wallet.";
  return message.split("\n")[0];
}

/** Phone browsers have no wallet: deep-link into the wallet apps' built-in browsers instead. */
function OpenInWallet() {
  const here = typeof window !== "undefined" ? window.location.href : "";
  const bare = here.replace(/^https?:\/\//, "");
  const links = [
    { name: "MetaMask app", href: `https://metamask.app.link/dapp/${bare}` },
    { name: "Trust Wallet app", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(here)}` },
    { name: "Coinbase Wallet app", href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here)}` },
  ];
  return (
    <div className="mt-1 border-t border-pipe pt-2">
      <p className="px-3 py-1 label !text-[10px]">Or open this site inside</p>
      {links.map((l) => (
        <a key={l.name} href={l.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-rig">
          {l.name} ↗
        </a>
      ))}
      <button
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-smoke hover:bg-rig"
        onClick={() => navigator.clipboard?.writeText(here).catch(() => {})}
      >
        Copy link for another wallet&apos;s browser
      </button>
    </div>
  );
}
