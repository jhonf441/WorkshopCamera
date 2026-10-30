# ESP32-CAM firmware (example)

Firmware for an **AI-Thinker ESP32-CAM** (OV2640 / OV3660) used as the workshop camera: the floating viewer ([WorkshopCamera](../../docs/plugins/camera.md)) and/or the fixed bed camera of the [Work zones map](../../docs/plugins/zones.md#map-camera). It is Espressif's **CameraWebServer** example from the Arduino-ESP32 core, with a few changes:

- **Wi-Fi credentials live in `secrets.h`**, which is ignored by git, so your password never ends up in a repository. Copy `secrets.example.h` to `secrets.h` and fill it in.
- **Optional fixed IP** (`STATIC_IP` / `GATEWAY_IP` in `secrets.h`). Without it the camera uses DHCP; then make a DHCP reservation on your router so the address doesn't change.
- **Status LED:** the small red on-board LED (GPIO33, not the flash) blinks 3 times at boot, then stays **on** while connected and **blinks fast** while Wi-Fi is lost.
- **Wi-Fi watchdog:** if Wi-Fi drops it retries every 10 s and **restarts itself after 60 s** without network (it used to stay offline forever). Every 30 s it also checks that the router answers; after 3 failures it reconnects, after 6 it restarts. At boot it gives up and restarts after 60 s instead of waiting forever.
- The serial monitor prints the Wi-Fi signal (RSSI), free heap and PSRAM every 2 s.
- **Full resolution with PSRAM:** the camera starts at QXGA (2048×1536, the OV3660 maximum) so the JPEG buffers are big enough for any resolution you pick later (starting at a smaller size made large photos fail with `cam_hal: FB-OVF`). `/status` also reports `psram`, `psram_libre` (free PSRAM) and `heap`.
- **Firmware update over Wi-Fi (ArduinoOTA, port 3232, password `OTA_PASSWORD` in `secrets.h`).** `partitions.csv` has **two app slots** (`ota_0` / `ota_1`): the new firmware is written to the free slot and the camera only boots from it once it was written correctly; if it fails, the old one keeps running. The sketch's `partitions.csv` overrides the IDE's *Partition Scheme* option. The earlier HTTP `/update` attempt stays in `app_httpd.cpp` inside `#if 0`.

## Endpoints

| URL | What |
|---|---|
| `http://<ip>/` | Web page with all camera settings |
| `http://<ip>:81/stream` | MJPEG stream: **use this as the webcam URL in DWC** (or behind the camera relay) |
| `http://<ip>/capture` | One JPEG |
| `http://<ip>/status`, `/control?var=…&val=…` | Read / change settings (used by the camera settings gear). `/status` also has `uptime_s`, `arranque` (last reset reason) and `wifi_reconexiones` |
| `http://<ip>/restart` | Restart the camera remotely |

## Update over Wi-Fi

In ArduinoOTA the ESP32 opens a TCP connection **back** to the computer that sends the firmware, and the Windows firewall usually blocks it, so send it from a Linux machine on the same network (for example the system):

1. Compile on your PC: `arduino-cli compile -b esp32:esp32:esp32cam --output-dir build .`
2. Copy `build/CameraWebServer.ino.bin` and `espota.py` (from the esp32 Arduino core, `tools/espota.py`) into `ota/` on that machine, next to a `secrets.h` with your `OTA_PASSWORD`.
3. Run `ota/subir.sh ota/CameraWebServer.ino.bin <camera ip>`. It takes about 25 s and the camera restarts by itself.

If large photos (≥ 1600×1200) fail after the update, check `/status`: about 2.9 MB of free PSRAM is fine; about 4.1 MB means the camera buffers didn't land in PSRAM, so power-cycle the camera.

## Build and flash (first time, over USB)

1. Arduino IDE 2.x with the **esp32** boards package (Espressif, 3.x).
2. Board **AI Thinker ESP32-CAM**. The `partitions.csv` in the sketch folder is used automatically.
3. Copy `secrets.example.h` to `secrets.h`, then set your Wi-Fi name and password, and optionally the fixed IP.
4. Connect a USB-serial adapter (5 V, GND, U0R/U0T crossed). Bridge **GPIO0 to GND**, reset, upload, then remove the bridge and reset again.
5. Open the serial monitor at 115200 baud: it prints the camera's address.

Choose a different model in `board_config.h` if your board isn't an AI-Thinker.

## License

The files come from Espressif's Arduino-ESP32 example and keep their original **Apache-2.0** headers. The changes above are under the same license.

## Two boards, one firmware

The same sketch runs on **two boards**; the board is chosen in `board_config.h` (only one `#define CAMERA_MODEL_...` active):

| | Camera 1: AI-Thinker ESP32-CAM | Camera 2: ESP32-S3 + OV5640 (Freenove S3 CAM pins) |
|---|---|---|
| `board_config.h` | `#define CAMERA_MODEL_AI_THINKER` | `#define CAMERA_MODEL_FREENOVE_S3` |
| Chip / sensor | ESP32 (OV2640 or OV3660) | ESP32-S3 QFN56, 16 MB flash, 8 MB octal PSRAM, OV5640 |
| Arduino board (FQBN) | `esp32:esp32:esp32cam` | `esp32:esp32:esp32s3:PSRAM=opi,FlashSize=16M,PartitionScheme=default` |
| Start resolution | QXGA (2048x1536) | UXGA (the S3 camera driver is configured with a 1 MB JPEG buffer: `config.jpeg_buffer_size`) |
| Status LED | GPIO33 (active low) | GPIO2 (active high; GPIO33 belongs to the PSRAM on the S3) |
| Partitions | `partitions.csv` of this folder (two OTA slots) | the default scheme of the board option above |
| Flashed | over USB, then over Wi-Fi (`ota/`) | over USB (`esptool`, merged image at 0x0); Wi-Fi update not tried |

ESP32-S3 camera pins (Freenove S3 CAM set): XCLK 15, SIOD 4, SIOC 5, VSYNC 6, HREF 7, PCLK 13, D0-D7 = 11, 9, 8, 10, 12, 18, 17, 16 (see `camera_pins.h`, `CAMERA_MODEL_FREENOVE_S3`). A board with other pins needs its own block in `camera_pins.h`.

### Build and flash the ESP32-S3

1. Arduino core `esp32` (Espressif, 3.x) and `arduino-cli` or Arduino IDE 2.x.
2. In `board_config.h` comment `CAMERA_MODEL_AI_THINKER` and uncomment `CAMERA_MODEL_FREENOVE_S3`.
3. Copy `secrets.example.h` to `secrets.h` (Wi-Fi name and password, optional fixed IP: use a different one from camera 1).
4. `arduino-cli compile -b esp32:esp32:esp32s3:PSRAM=opi,FlashSize=16M,PartitionScheme=default --output-dir build .`
5. Connect the board by USB and write the merged image: `esptool --port <COM or /dev/ttyUSB> write-flash 0x0 build/CameraWebServer.ino.merged.bin`.
6. Open the serial monitor at 115200 baud: it prints the address. In DWC, add `http://<ip>:81/stream` as a camera in the Camera plugin (a second camera shows as its own profile; see the plugin documentation).

### Update over Wi-Fi with retries (AI-Thinker, from a Linux machine)

`ota/reintentar.sh <camera ip>` waits until the camera answers, drops its video to 320x240 to free the Wi-Fi and uploads `ota/CameraWebServer.ino.bin` (3 tries). Afterwards set the frame size back with `/control?var=framesize&val=11`. The camera's Wi-Fi can be flaky, which is why the upload is retried.
