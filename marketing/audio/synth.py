"""Small synth/sound-design toolkit shared by the OilHood post scores."""
import numpy as np
import soundfile as sf

SR = 48000
rng = np.random.default_rng(7)


class Track:
    def __init__(self, seconds):
        self.dur = seconds
        self.n = int(SR * seconds)
        self.t = np.arange(self.n) / SR
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        j = min(self.n, i + len(sig))
        if j <= i:
            return
        s = sig[: j - i] * gain
        self.L[i:j] += s * min(1, 1 - pan)
        self.R[i:j] += s * min(1, 1 + pan)

    def write(self, path, verb=0.22):
        L, R = reverb(self.L, 2.4, verb), reverb(self.R, 2.4, verb)
        fade = np.clip((self.dur - self.t) / 0.6, 0, 1) * np.clip(self.t / 0.05, 0, 1)
        out = np.stack([L * fade, R * fade], axis=1)
        out /= np.max(np.abs(out)) / 0.89
        sf.write(path, out.astype(np.float32), SR)
        print("wrote", path)


def env(n, a, r):
    e = np.exp(-np.arange(n) / (r * SR))
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def lowpass(x, cutoff):
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


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


def saw(f, tt, detune=0.0):
    ph = (f * (1 + detune)) * tt
    return 2 * (ph - np.floor(ph + 0.5))


def sweep(f0, f1, seconds):
    n = int(seconds * SR)
    return np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR)


# ----- instruments -----

def pad(track, chords, gain=0.045, cutoff=1800):
    """chords: [(start, [notes]), ...]; each holds until the next start."""
    L = np.zeros(track.n); R = np.zeros(track.n)
    for idx, (start, notes) in enumerate(chords):
        end = chords[idx + 1][0] if idx + 1 < len(chords) else track.dur
        s, e = int(start * SR), int(min(track.dur, end + 0.4) * SR)
        tt = track.t[s:e] - start
        shape = np.clip(tt / 0.3, 0, 1) * np.clip((end + 0.4 - start - tt) / 0.4, 0, 1)
        for k, nm in enumerate(notes):
            f = note(nm)
            L[s:e] += saw(f, tt, -0.004 * (k + 1)) * gain * shape
            R[s:e] += saw(f, tt, 0.004 * (k + 1)) * gain * shape
    track.L += lowpass(L, cutoff); track.R += lowpass(R, cutoff)


def kick():
    n = int(0.35 * SR)
    return np.sin(2 * np.pi * np.cumsum(np.linspace(110, 45, n)) / SR) * env(n, 0.002, 0.09)


def shaker():
    n = int(0.06 * SR)
    s = lowpass(rng.standard_normal(n), 9000) - lowpass(rng.standard_normal(n), 3000)
    return s * env(n, 0.004, 0.02)


def groove(track, start, end, bpm=100, kick_gain=0.42, shake_gain=0.10, bass=None):
    """Soft kick on beats, shaker on off-beats, optional bass line [(time, note)]."""
    beat = 60 / bpm
    k, sh = kick(), shaker()
    i = 0
    while start + i * beat / 2 < end:
        at = start + i * beat / 2
        if i % 2 == 0:
            track.add(k, at, kick_gain)
        track.add(sh, at + beat / 4, shake_gain, pan=0.3 if i % 2 else -0.3)
        i += 1
    if bass:
        for idx, (at, nm) in enumerate(bass):
            nxt = bass[idx + 1][0] if idx + 1 < len(bass) else end
            n = int((nxt - at) * SR)
            tt = np.arange(n) / SR
            b = np.sin(2 * np.pi * note(nm) * tt) + 0.3 * np.sin(4 * np.pi * note(nm) * tt)
            track.add(b * env(n, 0.01, 0.6), at, 0.12)


def pluck(name, gain=1.0, length=0.6):
    n = int(length * SR)
    f = note(name)
    tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.15 * np.sin(6 * np.pi * f * tt))
    return lowpass(s * env(n, 0.002, 0.16), 5000) * gain


def ping(name, length=0.5):
    n = int(length * SR)
    return np.sin(2 * np.pi * note(name) * np.arange(n) / SR) * env(n, 0.002, 0.12)


def whoosh(seconds, f0=400, f1=4000, rising=True):
    n = int(seconds * SR)
    shape = np.linspace(0, 1, n) ** 2 if rising else np.sin(np.linspace(0, np.pi, n)) ** 2
    return lowpass(rng.standard_normal(n) * shape, np.linspace(f0, f1, n))


def riser(seconds):
    n = int(seconds * SR)
    noise = lowpass(rng.standard_normal(n) * np.linspace(0, 1, n) ** 3, np.linspace(300, 9000, n))
    return noise + 0.2 * sweep(220, 880, seconds) * np.linspace(0, 1, n) ** 2


def boom():
    n = int(1.8 * SR)
    b = sweep(70, 32, 1.8) * env(n, 0.003, 0.5)
    c = np.zeros(n)
    m = int(0.4 * SR)
    c[:m] = lowpass(rng.standard_normal(m), 6000) * env(m, 0.001, 0.07) * 0.4
    return b + c


def tick():
    n = int(0.012 * SR)
    s = rng.standard_normal(n) * env(n, 0.0005, 0.003)
    return s - lowpass(s, 2500)


def click():
    n = int(0.03 * SR)
    return sweep(2400, 900, 0.03) * env(n, 0.0005, 0.006)


def pour(seconds):
    """Liquid pour: band-limited noise with random bubble blips."""
    n = int(seconds * SR)
    base = lowpass(rng.standard_normal(n), 900) - lowpass(rng.standard_normal(n), 200)
    base *= np.clip(np.linspace(0, 1, n) * 4, 0, 1) * np.clip(np.linspace(1, 0, n) * 4, 0, 1)
    out = base * 0.6
    for _ in range(int(seconds * 18)):
        at = rng.integers(0, n - int(0.05 * SR))
        m = int(0.04 * SR)
        f0 = rng.uniform(300, 700)
        out[at:at + m] += sweep(f0, f0 * 1.8, 0.04)[:m] * env(m, 0.001, 0.01) * 0.35
    return out
