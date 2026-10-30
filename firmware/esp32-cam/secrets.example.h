// secrets.example.h -- copy this file to secrets.h and fill in your values.
// secrets.h is listed in .gitignore, so your WiFi password never ends up in git.
#pragma once
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"
// Key for HTTP firmware upload (/update). OTA is disabled in this build
// (see app_httpd.cpp), but the symbol is still referenced.
#define OTA_PASSWORD "change-me"
// Optional fixed IP (comma separated). Without these lines the camera uses DHCP;
// then give it a DHCP reservation on your router instead.
// #define STATIC_IP 192, 168, 1, 60
// #define GATEWAY_IP 192, 168, 1, 1
