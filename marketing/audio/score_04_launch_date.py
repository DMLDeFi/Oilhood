"""Music + sound design for videos/04-launch-date.mp4 (11.5s), synced to src/04-launch-date.html."""
import sys
from synth import Track, pad, groove, pluck, ping, whoosh, riser, boom, sweep, env, SR

T = Track(11.5)

pad(T, [(0.0, ["A2", "E3", "A3", "C4"]), (1.6, ["F2", "C3", "A3", "C4"]), (3.9, ["C3", "G3", "E4", "G4"]),
        (5.3, ["A2", "E3", "C4", "E4"]), (6.8, ["F2", "C3", "A3", "F4"]),
        (8.9, ["C3", "G3", "C4", "E4", "G4"]), (10.3, ["F2", "C3", "A3", "C4", "F4"])], gain=0.04)
groove(T, 1.6, 8.4, bpm=100, bass=[(1.6, "F1"), (3.9, "C2"), (5.3, "A1"), (6.8, "F1")])
groove(T, 8.9, 11.2, bpm=100, kick_gain=0.32, shake_gain=0.08, bass=[(8.9, "C2"), (10.3, "F1")])

# "Mark your calendar."
T.add(pluck("A4", 0.3), 0.5); T.add(pluck("E5", 0.3), 0.7)
# Calendar flips down and lands.
T.add(whoosh(0.6, 500, 4000, rising=False), 1.05, 0.16)
T.add(sweep(110, 45, 0.4) * env(int(0.4 * SR), 0.002, 0.12), 1.6, 0.5)
T.add(ping("A5", 0.8), 1.65, 0.07); T.add(ping("E6", 0.8), 1.7, 0.05)
# Time chips.
for at, nm in ((2.3, "C5"), (2.65, "E5"), (3.0, "G5")):
    T.add(pluck(nm, 0.35), at)
T.add(ping("C6"), 3.9, 0.05)
# Scene change, checklist ticks.
T.add(whoosh(0.5, 2500, 300, rising=False), 4.95, 0.14)
for at, nm in ((5.9, "A4"), (6.45, "C5"), (7.0, "E5"), (7.55, "A5")):
    T.add(pluck(nm, 0.3), at - 0.2, pan=-0.2)
    T.add(ping(nm.replace("4", "6").replace("5", "6"), 0.3), at, 0.05, pan=0.2)
# Outro reveal.
T.add(riser(0.9), 7.95, 0.26)
T.add(boom(), 8.85, 0.8)
for i, nm in enumerate(["C5", "E5", "G5", "C6"]):
    T.add(ping(nm), 9.0 + i * 0.07, 0.05)
T.add(pluck("G5", 0.3), 9.4); T.add(pluck("C6", 0.3), 9.8); T.add(ping("E6"), 10.3, 0.05)

T.write(sys.argv[1])
