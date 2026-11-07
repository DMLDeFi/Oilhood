#!/usr/bin/env bash
# Launch-day contract address video: ./make-ca-video.sh 0xYourContractAddress
set -euo pipefail
cd "$(dirname "$0")"
CA="$1"
[[ "$CA" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "Not a valid address: $CA" >&2; exit 1; }
Q="ca=$CA" node render.js 05-ca 12
ffmpeg -y -loglevel error -i videos/05-ca.mp4 -i audio/ca-music.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart videos/05-ca-music.mp4
Q="ca=$CA" node still.js 05-ca 5.5 && cp stills/05-ca-5.5s.png covers/05-ca.png
echo "videos/05-ca-music.mp4 ready"
