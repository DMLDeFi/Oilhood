"""Music + sound design for videos/03-live.mp4 (10.5s), synced to src/03-live.html."""
import sys
from synth import Track, pad, groove, pluck, ping, whoosh, riser, boom, tick, click, sweep, env, SR, rng

T = Track(10.5)

# Bed: uplifting C → G → Am → F, groove from the moment the site loads.
pad(T, [(0.0, ["C3", "G3", "C4", "E4"]), (1.4, ["G2", "D3", "B3", "D4"]),
        (3.9, ["A2", "E3", "C4", "E4"]), (5.3, ["F2", "C3", "A3", "C4"]),
        (7.2, ["C3", "G3", "E4", "G4", "C5"]), (8.8, ["F2", "C3", "A3", "F4"])], gain=0.04)
groove(T, 3.9, 6.9, bpm=100, bass=[(3.9, "A1"), (5.3, "F1")])
groove(T, 7.2, 10.2, bpm=100, bass=[(7.2, "C2"), (8.8, "F1")])

# Headline lands.
T.add(pluck("C5", 0.3), 0.3); T.add(pluck("G5", 0.35), 0.6)
T.add(ping("C6"), 0.65, 0.05)

# Browser slides up, URL types, page loads.
T.add(whoosh(0.8, 300, 4500), 0.8, 0.16)
T.add(sweep(90, 40, 0.5) * env(int(0.5 * SR), 0.003, 0.15), 1.45, 0.35)
for i in range(18):
    T.add(tick(), 2.4 + i * 1.2 / 18, 0.13 + 0.04 * rng.random())
T.add(click(), 3.7, 0.25)                                                # enter
for i, nm in enumerate(["C5", "E5", "G5", "C6"]):                        # page-load chime
    T.add(ping(nm, 0.7), 3.9 + i * 0.06, 0.06)

# Cards + buttons.
for at, nm in ((4.5, "E5"), (4.7, "G5"), (4.9, "C6")):
    T.add(pluck(nm, 0.3), at, pan=0.2)
T.add(whoosh(0.3, 800, 3000, rising=False), 5.25, 0.06)
T.add(click(), 6.05, 0.35)                                               # tap on Open Terminal

# Outro: URL reveal.
T.add(riser(0.9), 6.3, 0.26)
T.add(boom(), 7.25, 0.8)
for i, nm in enumerate(["C5", "E5", "G5", "C6"]):
    T.add(ping(nm), 7.35 + i * 0.07, 0.05)
T.add(pluck("G5", 0.3), 7.9); T.add(pluck("C6", 0.3), 8.2)

T.write(sys.argv[1])
