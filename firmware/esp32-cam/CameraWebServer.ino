#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <ArduinoOTA.h>

// ===========================
// Select camera model in board_config.h
// ===========================
#include "board_config.h"

// ===========================
// WiFi credentials and the OTA key live in secrets.h, which is NOT in git.
// Copy secrets.example.h to secrets.h and put your values there.
// ===========================
#include "secrets.h"
const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;

// Password para subir firmware por HTTP a /update (ver app_httpd.cpp) --
// una vez desconectado el cable USB, esta es la unica forma de
// reprogramarlo. Cambiala si queres, pero volve a flashear por USB una
// vez mas despues del cambio.
const char *otaPassword = OTA_PASSWORD;

void startCameraServer();
void setupLedFlash();

// ---- Perro guardian de Wi-Fi (2026-10-10) ----
// La camara se caia de la red (la Pi: "No route to host") y no volvia nunca:
// el LED rojo seguia prendido fijo y no hay como reiniciarla a distancia.
// Ahora: si se pierde el Wi-Fi, reintenta cada 10 s y a los 60 s sin red se
// reinicia sola. Si dice estar conectada pero el router (gateway) no
// contesta en 3 pruebas seguidas (cada 30 s), tambien reconecta y, si sigue
// igual, reinicia. LED rojo (GPIO33): fijo = conectada, parpadeo = sin red.
#if CONFIG_IDF_TARGET_ESP32S3
#define LED_ESTADO 2  // S3: GPIO33 belongs to the PSRAM
#define LED_ON HIGH
#define LED_OFF LOW
#else
#define LED_ESTADO 33
#define LED_ON LOW
#define LED_OFF HIGH
#endif
#define WIFI_REINTENTO_MS 10000
#define WIFI_REINICIO_MS 60000
#define GW_PRUEBA_MS 30000
#define GW_FALLAS_RECONECTAR 3
#define GW_FALLAS_REINICIAR 6
volatile unsigned wifiReconexiones = 0;

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;  // for streaming
  //config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;
#if CONFIG_IDF_TARGET_ESP32S3
  config.jpeg_buffer_size = 1024 * 1024;  // S3 driver: JPEG buffer must be sized explicitly
#endif

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (config.pixel_format == PIXFORMAT_JPEG) {
    // 2026-10-09: con PSRAM se inicia en QXGA (2048x1536, lo maximo del
    // OV3660) para que el bufer de JPEG alcance para cualquier resolucion
    // (el bufer se reserva con el tamano de ARRANQUE: con UXGA/SVGA las
    // fotos grandes daban cam_hal: FB-OVF).
    if (psramFound()) {
      config.frame_size = CONFIG_IDF_TARGET_ESP32S3 ? FRAMESIZE_UXGA : FRAMESIZE_QXGA;  // S3 board: OV2640 tops out at UXGA
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    // Best option for face detection/recognition
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

  // camera init
  Serial.printf("Camara: psramFound=%d psram=%u frame_size=%d fb_count=%d fb_en_psram=%d\n", (int)psramFound(), (unsigned)ESP.getPsramSize(), (int)config.frame_size, (int)config.fb_count, (int)(config.fb_location == CAMERA_FB_IN_PSRAM));
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  // initial sensors are flipped vertically and colors are a bit saturated
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);        // flip it back
    s->set_brightness(s, 1);   // up the brightness just a bit
    s->set_saturation(s, -2);  // lower the saturation
  }
  // drop down frame size for higher initial frame rate
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
  s->set_vflip(s, 1);
#endif

// Setup LED FLash if LED pin is defined in camera_pins.h
#if defined(LED_GPIO_NUM)
  setupLedFlash();
#endif

#if defined(STATIC_IP) && defined(GATEWAY_IP)
  // Fixed IP from secrets.h (recommended: the plugins and the relay use this address)
  IPAddress staticIP(STATIC_IP);
  IPAddress gateway(GATEWAY_IP);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.config(staticIP, gateway, subnet, gateway);
#endif

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  WiFi.setAutoReconnect(true);

  Serial.print("WiFi connecting");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - t0 > WIFI_REINICIO_MS) {  // antes esperaba para siempre
      Serial.println("\nSin WiFi en 60 s: reinicio");
      ESP.restart();
    }
  }
  Serial.println("");
  Serial.println("WiFi connected");

  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");
  // Actualizacion por WiFi (ArduinoOTA, puerto 3232, con clave). OJO: en
  // este protocolo la ESP32 se conecta DE VUELTA por TCP a la maquina que
  // manda el firmware -- desde Windows el firewall suele cortar esa conexion
  // (eso parecio "OTA roto" el 2026-10-07). Mandarlo desde la Pi:
  //   python3 espota.py -i <ip camara> -a <clave> -f firmware.bin
  // La camara NO se apaga durante la actualizacion (apagarla la dejaba sin
  // memoria cuando fallaba); al terminar bien, reinicia sola.
  ArduinoOTA.setHostname("camara-taller");
  ArduinoOTA.setPassword(otaPassword);
  ArduinoOTA.onStart([]() { Serial.println("OTA: empezando"); });
  ArduinoOTA.onEnd([]() { Serial.println("OTA: listo, reiniciando"); });
  ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
    static unsigned int last = 101;
    unsigned int pct = t ? p * 100 / t : 0;
    if (pct != last && pct % 10 == 0) {
      last = pct;
      Serial.printf("OTA: %u%%\n", pct);
    }
  });
  ArduinoOTA.onError([](ota_error_t e) { Serial.printf("OTA: error %u\n", (unsigned)e); });
  ArduinoOTA.begin();
  Serial.printf("OTA por WiFi listo (puerto 3232). PSRAM: %u bytes\n", (unsigned)ESP.getPsramSize());

  // LED rojo integrado de la placa (GPIO33, logica invertida: LOW=prendido)
  // -- NO es el flash (ese es LED_GPIO_NUM/GPIO4, controlado por DWC).
  // Tres parpadeos y despues queda prendido fijo como señal de "camara
  // arriba y conectada" a simple vista, sin tener que mirar una pantalla.
  pinMode(LED_ESTADO, OUTPUT);
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_ESTADO, LED_ON);
    delay(120);
    digitalWrite(LED_ESTADO, LED_OFF);
    delay(120);
  }
  digitalWrite(LED_ESTADO, LED_ON);
}

// El router contesta? (conexion TCP al gateway; "rechazada" tambien es
// respuesta: solo cuenta como falla el tiempo agotado).
static bool gatewayResponde() {
  IPAddress gw = WiFi.gatewayIP();
  if (gw == IPAddress(0, 0, 0, 0)) return false;
  NetworkClient c;
  unsigned long t = millis();
  bool ok = c.connect(gw, 80, 2000);
  c.stop();
  return ok || millis() - t < 1900;
}

void loop() {
  ArduinoOTA.handle();
  unsigned long ahora = millis();

  static unsigned long sinRedDesde = 0, ultimoReintento = 0, ultimaPruebaGw = 0, ultimoLed = 0;
  static int fallasGw = 0;
  static bool led = true;
  if (WiFi.status() != WL_CONNECTED) {
    if (!sinRedDesde) {
      sinRedDesde = ahora;
      Serial.println("WiFi perdido");
    }
    if (ahora - ultimoReintento > WIFI_REINTENTO_MS) {
      ultimoReintento = ahora;
      wifiReconexiones++;
      WiFi.reconnect();
    }
    if (ahora - sinRedDesde > WIFI_REINICIO_MS) {
      Serial.println("60 s sin WiFi: reinicio");
      ESP.restart();
    }
    if (ahora - ultimoLed > 250) {  // parpadeo = sin red
      ultimoLed = ahora;
      led = !led;
      digitalWrite(LED_ESTADO, led ? LED_ON : LED_OFF);
    }
  } else {
    if (sinRedDesde) {
      Serial.printf("WiFi de vuelta tras %lu s\n", (ahora - sinRedDesde) / 1000);
      sinRedDesde = 0;
      fallasGw = 0;
    }
    digitalWrite(LED_ESTADO, LED_ON);  // fijo = conectada
    if (ahora - ultimaPruebaGw > GW_PRUEBA_MS) {
      ultimaPruebaGw = ahora;
      if (gatewayResponde()) {
        fallasGw = 0;
      } else {
        fallasGw++;
        Serial.printf("El router no contesta (%d)\n", fallasGw);
        if (fallasGw >= GW_FALLAS_REINICIAR) {
          Serial.println("Red muerta: reinicio");
          ESP.restart();
        } else if (fallasGw == GW_FALLAS_RECONECTAR) {
          wifiReconexiones++;
          WiFi.disconnect();
          WiFi.begin(ssid, password);
        }
      }
    }
  }

  static unsigned long lastPrint = 0;
  if (ahora - lastPrint > 2000) {
    lastPrint = ahora;
    Serial.printf("RSSI: %d dBm, heap: %u, psram: %u\n", WiFi.RSSI(), ESP.getFreeHeap(), ESP.getFreePsram());
  }
  delay(10);
}
