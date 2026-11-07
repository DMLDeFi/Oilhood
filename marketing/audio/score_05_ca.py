"""Music + sound design for videos/05-ca.mp4 (12s), synced to src/05-ca.html."""
import sys
from synth import Track, pad, groove, pluck, ping, whoosh, riser, boom, tick, rng

T = Track(12.0)

pad(T, [(0.5, ["F2", "C3", "A3", "C4", "F4"]), (2.2, ["C3", "G3", "E4", "G4"]), (4.5, ["A2", "E3", "C4", "E4"]),
        (6.9, ["F2", "C3", "A3", "F4"]), (8.3, ["G2", "D3", "B3", "D4"]), (9.7, ["C3", "G3", "C4", "E4", "G4"])], gain=0.042)
groove(T, 1.0, 6.5, bpm=104, bass=[(1.0, "F1"), (2.2, "C2"), (4.5, "A1")])
groove(T, 6.9, 9.3, bpm=104, bass=[(6.9, "F1"), (8.3, "G1")])
groove(T, 9.7, 11.7, bpm=104, kick_gain=0.32, shake_gain=0.08, bass=[(9.7, "C2")])

# IT'S LIVE.
T.add(riser(0.5), 0.0, 0.22)
T.add(boom(), 0.5, 0.95)
for i, nm in enumerate(["C5", "E5", "G5", "C6", "E6"]):
    T.add(ping(nm), 0.6 + i * 0.06, 0.06)
T.add(pluck("A5", 0.3), 1.4)
# Contract address types in.
T.add(whoosh(0.5, 400, 4000), 1.8, 0.14)
for i in range(42):
    T.add(tick(), 2.6 + i * (1.6 / 42), 0.14 + 0.04 * rng.random())
for at, nm in ((4.5, "E5"), (4.8, "A5")):
    T.add(pluck(nm, 0.35), at)
# Terminal switches on.
T.add(whoosh(0.5, 2500, 300, rising=False), 6.55, 0.14)
for at, nm in ((7.3, "C5"), (7.8, "E5"), (8.3, "G5")):
    T.add(pluck(nm, 0.32), at, pan=-0.2)
    T.add(ping("C6", 0.3), at + 0.15, 0.04, pan=0.2)
# Outro.
T.add(riser(0.9), 8.7, 0.26)
T.add(boom(), 9.6, 0.8)
for i, nm in enumerate(["C5", "E5", "G5", "C6"]):
    T.add(ping(nm), 9.75 + i * 0.07, 0.05)
T.add(pluck("G5", 0.3), 10.1); T.add(pluck("C6", 0.3), 10.5); T.add(ping("E6"), 10.8, 0.05)

T.write(sys.argv[1])
