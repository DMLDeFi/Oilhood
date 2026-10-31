"""Sound design + music for the teaser, synced to src/01-teaser.html, mixed with an optional voiceover.

python mix.py out.wav [voice_dir voice_prefix]
Voice files are <prefix>_0..3.wav (24 kHz mono), placed at the cue times below.
"""
import sys
import numpy as np
import soundfile as sf

SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def env(n, a, r):
    """Attack/exponential-release envelope of n samples."""
    e = np.exp(-np.arange(n) / (r * SR))
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff can be a scalar or per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def saw(f, tt, detune=0.0):
    ph = (f * (1 + detune)) * tt
    return 2 * (ph - np.floor(ph + 0.5))


def reverb(x, seconds=2.2, mix=0.25):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.35 * SR))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    F = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[: len(x)]
    return x * (1 - mix) + wet * mix * 1.6


def note(name):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    return 440 * 2 ** ((names[name[0]] + 12 * (int(name[-1]) - 4)) / 12)


# ---------- music bed (stereo) ----------
L = np.zeros(N); R = np.zeros(N)

# Dark drone 0 → 5.1s (A minor), filter slowly opening into the riser.
drone_chord = ["A2", "E3", "A3", "C4"]
seg = slice(0, int(5.15 * SR))
tt = t[seg]
for k, nm in enumerate(drone_chord):
    f = note(nm)
    for ch, det in ((L, -0.003), (R, 0.003)):
        ch[seg] += saw(f, tt, det * (k + 1)) * 0.06
cut = np.interp(t, [0, 3.5, 5.1, 10], [300, 700, 2600, 2600])
L = lowpass(L, cut); R = lowpass(R, cut)
fade_in = np.clip(t / 1.2, 0, 1)
L *= fade_in; R *= fade_in
sub = np.sin(2 * np.pi * 55 * t) * 0.10 * np.clip(t / 2, 0, 1) * (t < 5.12)
L += sub; R += sub

# Warm major pad after the reveal: F → C → G/B → Am, gently swelling.
pad_L = np.zeros(N); pad_R = np.zeros(N)
chords = [(5.1, ["F2", "C3", "A3", "C4", "F4"]), (6.6, ["C3", "G3", "E4", "G4"]),
          (8.0, ["G2", "D3", "B3", "D4"]), (9.0, ["A2", "E3", "C4", "E4"])]
for idx, (start, notes) in enumerate(chords):
    end = chords[idx + 1][0] if idx + 1 < len(chords) else DUR
    s, e = int(start * SR), int(min(DUR, end + 0.4) * SR)
    tt = t[s:e] - start
    shape = np.clip(tt / 0.25, 0, 1) * np.clip((end + 0.4 - start - tt) / 0.4, 0, 1)
    for k, nm in enumerate(notes):
        f = note(nm)
        pad_L[s:e] += saw(f, tt, -0.004 * (k + 1)) * 0.045 * shape
        pad_R[s:e] += saw(f, tt, 0.004 * (k + 1)) * 0.045 * shape
pad_L = lowpass(pad_L, 1800); pad_R = lowpass(pad_R, 1800)
L += pad_L; R += pad_R

# Soft groove from 6.2s: kick + shaker at 100 BPM, fading at the end.
beat = 60 / 100
kick = np.sin(2 * np.pi * np.cumsum(np.linspace(110, 45, int(0.35 * SR))) / SR) * env(int(0.35 * SR), 0.002, 0.09)
shaker = lowpass(rng.standard_normal(int(0.06 * SR)), 9000) - lowpass(rng.standard_normal(int(0.06 * SR)), 3000)
shaker *= env(len(shaker), 0.004, 0.02)
for i in range(16):
    at = 6.2 + i * beat / 2
    if at > 9.7:
        break
    if i % 2 == 0:
        place(L, kick, at, 0.42); place(R, kick, at, 0.42)
    place(L, shaker, at + beat / 4, 0.10); place(R, shaker, at + beat / 4 + 0.008, 0.10)

# ---------- sound effects ----------
fx = np.zeros(N)
# Whoosh as the drop falls (0.2 → 1.1s).
n = int(0.95 * SR)
wh = rng.standard_normal(n) * np.linspace(0, 1, n) ** 2
fx[int(0.2 * SR):int(0.2 * SR) + n] += lowpass(wh, np.linspace(400, 4000, n)) * 0.22

# Oil drop "plop" + low thump at impact (1.1s), echoed by the ripples.
n = int(0.25 * SR)
f = np.linspace(380, 1300, n) ** 1.0
plop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.05)
thump = np.sin(2 * np.pi * np.cumsum(np.linspace(90, 40, n)) / SR) * env(n, 0.002, 0.12)
place(fx, plop, 1.1, 0.55); place(fx, thump, 1.1, 0.6)
place(fx, plop, 1.35, 0.18); place(fx, plop, 1.6, 0.08)

# Typing ticks matching the typewriter text.
tick_n = int(0.012 * SR)
for start, count, dur in ((1.7, 26, 1.3), (3.2, 18, 0.9)):
    for i in range(count):
        tick = rng.standard_normal(tick_n) * env(tick_n, 0.0005, 0.003)
        tick = tick - lowpass(tick, 2500)
        place(fx, tick, start + i * dur / count, 0.12 + 0.04 * rng.random())

# Riser into the reveal (4.0 → 5.1s).
n = int(1.1 * SR)
rs = rng.standard_normal(n) * np.linspace(0, 1, n) ** 3
fx[int(4.0 * SR):int(4.0 * SR) + n] += lowpass(rs, np.linspace(300, 9000, n)) * 0.28
tone = np.sin(2 * np.pi * np.cumsum(np.linspace(220, 880, n)) / SR) * np.linspace(0, 1, n) ** 2
place(fx, tone, 4.0, 0.06)

# Impact at the reveal (5.1s): sub boom + noise crack.
n = int(1.8 * SR)
boom = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 32, n)) / SR) * env(n, 0.003, 0.5)
crack = lowpass(rng.standard_normal(int(0.4 * SR)), 6000) * env(int(0.4 * SR), 0.001, 0.07)
place(fx, boom, 5.1, 0.85); place(fx, crack, 5.1, 0.35)

# Sparkle pings as each letter of $OILHOOD rises.
for i in range(8):
    n = int(0.5 * SR)
    f0 = note(["E5", "A5", "C6", "E6", "A5", "C6", "E6", "A6"][i])
    ping = np.sin(2 * np.pi * f0 * np.arange(n) / SR) * env(n, 0.002, 0.12)
    place(fx, ping, 5.25 + i * 0.07, 0.05)

L = reverb(L + fx, 2.4, 0.22)
R = reverb(R + fx, 2.4, 0.22)

# ---------- voice ----------
voice = np.zeros(N)
if len(sys.argv) > 3:
    vdir, prefix = sys.argv[2], sys.argv[3]
    cues = [1.75, 5.45, 6.45, 7.75]
    for i, at in enumerate(cues):
        v, sr = sf.read(f"{vdir}/{prefix}_{i}.wav", dtype="float64")
        v = np.interp(np.arange(int(len(v) * SR / sr)) * sr / SR, np.arange(len(v)), v)
        v /= np.max(np.abs(v)) + 1e-9
        place(voice, v, at, 0.9)
    voice = reverb(voice, 1.0, 0.10)
    # Duck the music under the voice.
    vabs = lowpass(np.abs(voice), 8)
    duck = 1 - 0.55 * np.clip(vabs / (vabs.max() + 1e-9) * 3, 0, 1)
    L *= duck; R *= duck

out = np.stack([L + voice, R + voice], axis=1)
out *= np.clip((DUR - t) / 0.6, 0, 1)[:, None]  # fade out
out /= np.max(np.abs(out)) / 0.89
sf.write(sys.argv[1], out.astype(np.float32), SR)
print("wrote", sys.argv[1])
