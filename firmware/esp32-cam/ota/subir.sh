#!/bin/sh
# Update the ESP32-CAM firmware over Wi-Fi (ArduinoOTA, port 3232).
# Run it from a Linux machine on the same network (e.g. the Pi): from
# Windows the firewall usually blocks the connection the ESP32 opens back.
#   ./subir.sh <firmware.bin> <camera ip>
# The password is read from ../secrets.h (OTA_PASSWORD) and not printed.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="${1:-$DIR/CameraWebServer.ino.bin}"
IP="${2:?usage: ./subir.sh <firmware.bin> <camera ip>}"
CLAVE="$(sed -n "s/^#define OTA_PASSWORD \"\(.*\)\"/\1/p" "$DIR/../secrets.h")"
[ -n "$CLAVE" ] || { echo "OTA_PASSWORD not found in secrets.h"; exit 1; }
python3 "$DIR/espota.py" -i "$IP" -p 3232 -a "$CLAVE" -f "$BIN" -r
