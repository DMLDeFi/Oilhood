// Grab single frames for review / static posts: node still.js <name> <sec> [sec...]
const { chromium } = require("playwright");
const path = require("path");
const [name, ...times] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto("file://" + path.join(__dirname, "src", `${name}.html`));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  for (const t of times) {
    await p.evaluate((ms) => window.seek(ms), Number(t) * 1000);
    await p.screenshot({ path: path.join(__dirname, "stills", `${name}-${t}s.png`) });
  }
  await b.close();
})();
