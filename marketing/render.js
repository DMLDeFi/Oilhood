// Renders a motion post to MP4: node render.js <name> <seconds>
// Seeks every animation frame-by-frame, so output is smooth regardless of machine speed.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const [name, seconds = "10", fps = "30"] = process.argv.slice(2);
const src = path.join(__dirname, "src", `${name}.html`);
const out = path.join(__dirname, "videos", `${name}.mp4`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto("file://" + src);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", fps, "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });

  const frames = Math.round(Number(seconds) * Number(fps));
  for (let i = 0; i < frames; i++) {
    await page.evaluate((ms) => window.seek(ms), (i * 1000) / Number(fps));
    ff.stdin.write(await page.screenshot({ type: "png" }));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("wrote", out);
})();
