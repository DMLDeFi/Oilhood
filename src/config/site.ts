import { isAddress, type Address } from "viem";

function addr(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? (value as Address) : undefined;
}

export const site = {
  name: "OilHood",
  ticker: "$OILHOOD",
  tagline: "The oil of the people on Robinhood Chain.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://oilhood.xyz",
  ponsUrl: process.env.NEXT_PUBLIC_PONS_URL || "https://pons.family",
  socials: {
    x: process.env.NEXT_PUBLIC_X_URL || "",
    telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || "",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
};

export const tokens = {
  oilhood: addr(process.env.NEXT_PUBLIC_OILHOOD_ADDRESS),
  uso: addr(process.env.NEXT_PUBLIC_USO_TOKEN_ADDRESS),
  xom: addr(process.env.NEXT_PUBLIC_XOM_TOKEN_ADDRESS),
};

// Saturday 7 Nov 2026, 12:00 WAT (Nigeria) = 11:00 UTC = 6:00 AM ET. Override with NEXT_PUBLIC_LAUNCH_DATE.
const launch = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE || "2026-11-07T11:00:00Z");
/** Pre-launch countdown target (ISO date with timezone, e.g. 2026-11-05T18:00:00Z). */
export const launchDate = launch && !isNaN(launch.getTime()) ? launch : null;

export const creatorWallet = addr(process.env.NEXT_PUBLIC_CREATOR_WALLET);

export const BURN_ADDRESSES: Address[] = [
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000000",
];

/** Edit to match the launch. Pons launches are fair launches with fixed supply. */
export const tokenomics = {
  totalSupply: "1,000,000,000",
  items: [
    { label: "Fair launch on Pons", value: "100%", note: "No presale, no team allocation" },
    { label: "Buy / sell tax", value: "0%", note: "Only the standard Pons pool fee" },
    { label: "Creator fees", value: "Public", note: "Every use is logged in the fee tracker" },
    { label: "Contract", value: "Pons standard", note: "No mint function after launch" },
  ],
};

/**
 * Public log of what was done with creator fees. Add an entry each time you
 * buy back, burn, or fund development so holders can verify it on-chain.
 */
export const feeLog: { date: string; action: string; amount: string; tx?: string }[] = [];

export const roadmap = [
  {
    phase: "Phase 1",
    title: "Strike oil",
    status: "live" as const,
    items: ["OilHood Terminal: live WTI, Brent, USO, XOM", "Virtual Barrels calculator", "Wallet portfolio, alerts, energy news"],
  },
  {
    phase: "Phase 2",
    title: "Drill",
    status: "next" as const,
    items: ["Launch $OILHOOD on Pons", "On-chain indexer: live chart, trade feed, holders", "Virtual Rigs season 1 + leaderboard"],
  },
  {
    phase: "Phase 3",
    title: "Refine",
    status: "later" as const,
    items: ["Rig seasons and upgrades", "Daily oil call game", "Telegram bot with buy alerts"],
  },
];

export const faq = [
  {
    q: "What is a virtual barrel?",
    a: "The dollar value of your $OILHOOD divided by the current WTI crude price. It is a fun way to see your bag in oil terms, not a claim on real oil.",
  },
  {
    q: "Is OilHood backed by oil or affiliated with Robinhood?",
    a: "No. $OILHOOD is a community memecoin on Robinhood Chain. It is not backed by oil, not a security, and not affiliated with or endorsed by Robinhood Markets, Inc.",
  },
  {
    q: "What are Virtual Rigs?",
    a: "Every wallet holding $OILHOOD runs a rig that earns points each hour based on bag size, how long you've held without selling, and whether oil rose that hour. Points are a scoreboard only, with no monetary value. Your tokens never leave your wallet.",
  },
  {
    q: "Where does the oil data come from?",
    a: "Futures and ETF prices come from public market data feeds and are delayed. If a feed is unavailable the Terminal clearly labels prices as demo data.",
  },
  {
    q: "How do I buy?",
    a: "Get ETH on Robinhood Chain, connect your wallet on Pons, search $OILHOOD, and swap. Always check the contract address shown on this site.",
  },
];
