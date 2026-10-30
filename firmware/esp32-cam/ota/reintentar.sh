#!/bin/sh
# Waits for the camera and uploads the firmware as soon as it answers (up to 3 tries).
# First it drops the video to 320x240 to leave the Wi-Fi free for the upload.
IP="${1:?usage: reintentar.sh <camera ip>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
CLAVE="$(sed -n "s/^#define OTA_PASSWORD \"\(.*\)\"/\1/p" "$DIR/../secrets.h")"
for n in 1 2 3; do
  until curl -s -m3 http://$IP/status | grep -q framesize; do sleep 3; done
  echo "camera online, try $n"
  curl -s -m3 "http://$IP/control?var=framesize&val=5" >/dev/null
  sleep 2
  if python3 "$DIR/espota.py" -i $IP -p 3232 -a "$CLAVE" -f "$DIR/CameraWebServer.ino.bin" -t 30 2>&1 | grep -E "ERROR|Success|Done|OK" | tail -3; then :; fi
  sleep 15
  if curl -s -m4 http://$IP/status | grep -q uptime_s; then echo "NEW FIRMWARE OK"; exit 0; fi
  echo "try $n did not take"
done
echo "THE 3 TRIES FAILED"
