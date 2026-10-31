import sys, sherpa_onnx, soundfile as sf
d = "kokoro-multi-lang-v1_0"
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt", data_dir=f"{d}/espeak-ng-data", lexicon=f"{d}/lexicon-us-en.txt", dict_dir=f"{d}/dict", lang="en-us"),
    num_threads=4)))
sid, speed = int(sys.argv[1]), float(sys.argv[2])
for i, text in enumerate(sys.argv[3:]):
    a = tts.generate(text, sid=sid, speed=speed)
    out = f"v{sid}_{i}.wav"
    sf.write(out, a.samples, a.sample_rate)
    print(out, round(len(a.samples) / a.sample_rate, 2), a.sample_rate)
