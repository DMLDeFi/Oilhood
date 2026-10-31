# $OILHOOD launch posts

Motion posts for X / Instagram / Telegram, 1080×1350 (4:5) MP4s, no audio, so they autoplay muted.

| # | File | Length | When to post |
|---|------|--------|--------------|
| 1 | `videos/01-teaser.mp4` | 10s | **First post.** Nothing exists yet, so just plant the name. |
| 2 | `videos/02-building.mp4` | 14.5s | A few hours later: what we're actually building. |
| 3 | `videos/03-live.mp4` | 10.5s | When you announce the website. |

`covers/` has a still frame of each one, for a thumbnail or a static post.

---

## Captions (copy-paste)

Keep it calm and factual: no price talk, no "100x", no promises. Let the product do the talking.

### Post 1 — Teaser
```
Something is being drilled on Robinhood Chain. 🛢

$OILHOOD
The oil of the people.

Coming soon.
```

### Post 2 — What we're building
```
$OILHOOD isn't just a ticker.

We're building the OilHood Terminal, a dashboard you'll actually open every day:

🛢 Live WTI, Brent & gas prices
📈 Tokenized USO + XOM next to $OILHOOD
🪙 Your bag measured in virtual barrels
🔥 Public fee & burn tracker, read from the chain

Launching on Pons · Robinhood Chain
```

### Post 3 — Website live
```
The OilHood Terminal is live 🛢

Live oil prices, tokenized USO & XOM, and your bag in virtual barrels, all on one screen.

👉 oilhood.vercel.app

$OILHOOD launches on Pons soon. The contract address will only ever be posted from this account and on the website.
```

### Text posts for the days in between (no video needed)
```
Why oil?

It's the most watched commodity on earth. Everyone checks the price at the pump.
Robinhood Chain already has tokenized USO and XOM.
$OILHOOD puts oil, energy stocks and your on-chain bag in one place.
```
```
What's a "virtual barrel"?

Your $OILHOOD value ÷ today's WTI price.
Hold $500 of $OILHOOD with oil at $100 → 5 virtual barrels.

Just a fun way to see your bag in oil terms. Not a claim on real oil.
```
```
⚠️ There is no $OILHOOD contract yet.

Any CA you see before launch is fake. The real one will be posted here and on oilhood.vercel.app only.
```
```
Launch day: [DATE] on Pons 🛢
[X] days to go.
```

---

## Suggested schedule

| When | Post |
|------|------|
| Day 1 | Post 1 (teaser) → a few hours later Post 2 (building) |
| Day 2 | "Why oil?" + the fake-CA warning (pin the warning) |
| Day 3 | Post 3 (website live) |
| Day 4 | "What's a virtual barrel?" + launch date / countdown |
| Launch day | CA announcement (contract address + Pons link + website) |

Pin the teaser first, then swap the pin to the website post on Day 3.

---

## Editing and re-rendering

Each post is an HTML file in `src/` animated with CSS. The renderer seeks it frame by frame and pipes the frames to ffmpeg.

```bash
cd marketing
node still.js 03-live 6.2          # grab a frame to check (writes to stills/)
node render.js 03-live 10.5        # render the MP4 to videos/
```

Requires Node, Playwright (Chromium) and ffmpeg. To change the URL in post 3 (e.g. a custom domain), edit `URL_TEXT` in `src/03-live.html` and re-render.
