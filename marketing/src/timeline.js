// Frame-accurate seeking for the renderer: pauses every CSS animation and
// jumps it to time t (ms). Pages can register extra JS-driven updates.
window.__updates = [];
window.onFrame = (fn) => window.__updates.push(fn);
window.seek = (ms) => {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; }
  for (const fn of window.__updates) fn(ms / 1000);
};
window.ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
window.prog = (t, start, dur) => window.ease((t - start) / dur);
