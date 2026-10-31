"""Music + sound design for videos/02-building.mp4 (14.5s), synced to src/02-building.html."""
import sys
from synth import Track, pad, groove, pluck, ping, whoosh, riser, boom, tick, pour, sweep, env, SR, rng

T = Track(14.5)

# Bed: hopeful A minor → F → C → G, groove enters with the terminal.
pad(T, [(0.0, ["A2", "E3", "A3", "C4"]), (1.9, ["F2", "C3", "A3", "C4"]),
        (3.7, ["A2", "E3", "C4", "E4"]), (6.1, ["F2", "C3", "A3", "F4"]),
        (8.5, ["C3", "G3", "E4", "G4"]), (10.3, ["G2", "D3", "B3", "D4"]),
        (12.0, ["F2", "C3", "A3", "C4", "F4"]), (13.3, ["C3", "G3", "C4", "E4", "G4"])], gain=0.04)
groove(T, 3.7, 11.9, bpm=100, bass=[(3.7, "A1"), (6.1, "F1"), (8.5, "C2"), (10.3, "G1")])
groove(T, 12.2, 14.2, bpm=100, kick_gain=0.3, shake_gain=0.07)

# Intro: words rising, strike-through swipe, gold lines land.
T.add(whoosh(0.5, 300, 2500, rising=False), 0.25, 0.10)
T.add(pluck("A4", 0.25), 0.3); T.add(pluck("C5", 0.25), 0.5)
T.add(whoosh(0.35, 6000, 800, rising=False), 1.3, 0.22)                  # strike swipe
T.add(pluck("E5", 0.3), 1.9); T.add(pluck("A5", 0.3), 2.1)
T.add(whoosh(0.5, 2000, 300, rising=False), 3.35, 0.14)                  # intro exits

# Terminal slides in, price counter rolls, chart draws.
T.add(whoosh(0.8, 300, 5000), 3.0, 0.16)
T.add(sweep(90, 40, 0.5) * env(int(0.5 * SR), 0.003, 0.15), 3.75, 0.45)
for i in range(46):                                                       # counter ticks, slowing down
    at = 4.0 + 2.3 * (i / 46) ** 1.6
    T.add(tick(), at, 0.10 + 0.03 * rng.random())
n = int(2.2 * SR)
T.add(sweep(300, 900, 2.2) * env(n, 0.3, 3.0) * 0.5, 4.1, 0.05, pan=-0.2)  # chart line tone
T.add(ping("E6"), 5.4, 0.08)                                             # LIVE

# Feature cards: rising plucks.
for at, nm in ((5.9, "A4"), (6.6, "C5"), (7.3, "E5"), (8.0, "A5")):
    T.add(whoosh(0.3, 800, 3000, rising=False), at - 0.05, 0.06, pan=-0.3)
    T.add(pluck(nm, 0.35), at, pan=-0.2)

# Barrel fills with oil.
T.add(pour(2.7), 7.7, 0.22, pan=0.3)
T.add(ping("A5"), 10.4, 0.07, pan=0.3)

# Outro reveal.
T.add(riser(0.9), 11.1, 0.26)
T.add(boom(), 12.1, 0.8)
for i, nm in enumerate(["E5", "A5", "C6", "E6"]):
    T.add(ping(nm), 12.25 + i * 0.07, 0.05)
T.add(ping("A5"), 12.7, 0.05); T.add(ping("E6"), 13.1, 0.05)

T.write(sys.argv[1])
