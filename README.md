# OilHood Terminal — $OILHOOD on Robinhood Chain

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdmldefi%2Foilhood&env=NEXT_PUBLIC_LAUNCH_DATE,NEXT_PUBLIC_X_URL,NEXT_PUBLIC_TELEGRAM_URL&envDescription=All%20optional%20%E2%80%94%20see%20.env.example&project-name=oilhood)

Marketing site + live **OilHood Terminal** for the $OILHOOD token on Robinhood Chain (chain ID 4663).

- `/` – landing page: hero with live oil preview, story, features, tokenomics, how to buy on Pons, roadmap, FAQ, disclaimers.
- `/terminal` – the daily-use dashboard:
  - Live **WTI** hero chart + Brent, Natural Gas, RBOB Gasoline, **USO** and **XOM**
  - **$OILHOOD** price, market cap, volume, holders, and "OILHOOD per barrel"
  - **Virtual Barrels** calculator (wallet balance or "what if" mode)
  - **Portfolio**: $OILHOOD + tokenized USO/XOM + ETH on Robinhood Chain (read-only)
  - **Price alerts** (saved in the browser, with desktop notifications)
  - **Energy news wire** (OilPrice.com, EIA, Rigzone RSS)
  - **Fee & burn tracker**: total/burned/circulating supply read from chain + creator-fee wallet + public fee log
- Scrolling price ticker, contract-address copy button, Buy on Pons buttons, OG share image, sitemap, robots.

- `/rigs` – **Virtual Rigs**: every holder runs a rig that earns points hourly (tiers, steady-hands multiplier, gusher hours), leaderboard, rig naming by wallet signature.
- **On-chain indexer**: every $OILHOOD transfer on Robinhood Chain goes into Postgres. That powers the live candlestick chart, buy/sell feed with whale alerts, holder count, top holders and 24h stats on the Terminal.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · wagmi 2 + viem (uses viem's built-in `robinhood` chain) · TanStack Query.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in what you have
npm run dev                  # http://localhost:3000
```

## Launch checklist

1. **Launch the token on Pons** (https://pons.family).
2. Set the env vars (Vercel → Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_OILHOOD_ADDRESS` – the contract address. This switches on price, holders, burns, wallet balances and the CA copy button.
   - `NEXT_PUBLIC_PONS_URL` – direct link to the $OILHOOD page on Pons.
   - `NEXT_PUBLIC_USO_TOKEN_ADDRESS`, `NEXT_PUBLIC_XOM_TOKEN_ADDRESS` – the tokenized stock contracts on Robinhood Chain. **Copy them from the official Robinhood / Blockscout explorer, never from a third party.**
   - `NEXT_PUBLIC_CREATOR_WALLET` – the wallet receiving Pons creator fees.
   - `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_TELEGRAM_URL`, `NEXT_PUBLIC_SITE_URL`.
   - `NEXT_PUBLIC_LAUNCH_DATE` – shows a countdown in the hero until the contract address is set.
   - Optional `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for mobile wallets (free at cloud.reown.com).
3. Edit `src/config/site.ts` for tokenomics, roadmap, FAQ, and add an entry to `feeLog` every time you spend/burn creator fees.
4. Deploy on Vercel: click the button above (or import the repo at vercel.com/new) and deploy. Env var changes need a redeploy.

## On-chain backend

```
Robinhood Chain RPC ──getLogs(Transfer)──▶ indexer ──▶ Postgres ◀── API routes ◀── Terminal / Rigs UI
DexScreener + oil feeds ──▶ price snapshots ─┘           ▲
GitHub Actions (every 5 min) / Vercel Cron / page traffic ──▶ /api/sync
```

- `src/server/indexer.ts` reads `Transfer` events in adaptive block chunks and labels each one buy / sell / transfer / burn based on the pool addresses. It keeps a balance ledger, and every write is idempotent.
- `src/server/prices.ts` stores a $OILHOOD + WTI price snapshot each sync and auto-detects pools from DexScreener.
- `src/server/rigs.ts` scores each completed hour exactly once. Balances are rebuilt from the transfer log as of the end of the hour, so late syncs never change results and sniping the snapshot doesn't work. Rules live in `src/lib/rigs.ts`.
- `src/server/sync.ts` runs it all under a lease, so cron and visitor-triggered syncs never overlap.
- Tables are created automatically on first run.

### Turning it on (launch day)

1. **Database:** Vercel → your project → Storage → Create Database → **Neon** (free tier) → connect to the project. This sets `DATABASE_URL`.
2. **Env vars** in Vercel:
   - `NEXT_PUBLIC_OILHOOD_ADDRESS`: the contract address.
   - `OILHOOD_START_BLOCK`: the block the contract was created in (shown on the explorer's contract page).
   - `CRON_SECRET`: any long random string.
   - `OILHOOD_POOLS` (optional): the Pons pool or curve address, if trades don't show as buys/sells.
3. **Scheduler:** GitHub repo → Settings → Secrets and variables → Actions. Add secret `CRON_SECRET` (same value) and variable `SITE_URL` (your site URL). `.github/workflows/sync.yml` then syncs every 5 minutes. Vercel Cron runs a daily backup sync, and page visits also trigger syncs.
4. Redeploy. Check `GET /api/sync` with header `Authorization: Bearer <CRON_SECRET>`; it returns what was indexed and scored.

## Data sources

| Data | Source | Fallback |
| --- | --- | --- |
| WTI, Brent, Nat Gas, RBOB, USO, XOM | Yahoo Finance chart API (server-side, 60s cache) | Stooq CSV → clearly-labelled demo data |
| $OILHOOD / tokenized USO & XOM on-chain price | DexScreener | "TBA / Indexing" |
| Holders | Robinhood Chain Blockscout API | — |
| Balances, supply, burns | Robinhood Chain RPC via wagmi/viem | — |
| News | OilPrice.com, EIA, Rigzone RSS | Curated links |

Market prices are free, delayed feeds. If you get serious traffic, move to a keyed provider (e.g. EIA API, Alpha Vantage, Polygon) in `src/lib/market.ts` — only that file needs to change.

## Legal

The footer and FAQ state that $OILHOOD is a memecoin, not backed by oil, not a security, and **not affiliated with Robinhood Markets, Inc.** Keep that wording — the name plays on "Robinhood", so avoid using Robinhood's logo or brand colors.
