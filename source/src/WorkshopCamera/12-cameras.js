      // ---- Several cameras (request 2026-10-10) ----
      //
      // "I want the surveillance plugin to allow any camera (I am going
      // to publish the plugin) and the floating viewer to support several,
      // with a selector to choose which one to see when opening it."
      //
      // THE list of cameras is cameras.json (0:/sys/workshop/config, the same for all screens), and the service owns it: it reads it, decides
      // which cameras go through the relay and tells every screen, Vision and the relay itself (camera.status, camera_sources.py). This plugin
      // asks the service for it (cameraLoadList) and writes it back through the settings store with the revision it read (cameraSaveList).
      // {version: 2, cameras: [{id, name, url, photo, esp32, relay, flash_source, open}]}
      //   url   MJPEG stream; the main camera ("main") has one like the others: the relay reads it
      //   photo still image (JPEG) for photo mode, lightweight; empty = it is
      //         deduced (/stream -> /snapshot) if it is an ESP32-camera or the relay, and if
      //         there is no way to take a photo the viewer goes straight to video
      //   esp32 ESP32-camera (CameraWebServer): flash and image settings
      //   relay the video goes through the Pi's relay (:8090/c/<id>/...) so several screens can watch it without choking it
      //         (false = direct); the service answers `via_relay` (what it really does) with each camera
      //   flash_source "camera" (its LED) | "strip" (the work lights): the flash itself is the service's (camera.flash); each camera that comes from the
      //         service carries `flash` {capable, on}: whether it has one and whether it is on now
      //   open  "photo" (lightweight, default) | "video": how the viewer opens
      // [HOSTNAME] in any URL = the machine this screen connects to.
      // The chosen camera belongs to THIS screen (localStorage).
      // The "work" camera (below the Zones / Vision map) is something else
      // and is not touched from here.
      // The list is edited in the tab "Cameras" of the page (18-page-cameras.js); this file is the list itself and the addresses of each camera.
      //
      // 2026-10-12 (request 29d): the camera does NOT use DWC's webcam
      // (main.webcam of 0:/sys/dwc-settings.json) nor writes that file: DWC
      // keeps its own copy and they fought. All the config lives in this file.

      var CAMS_SEL_KEY = "workshopCameraChosen";
      // The first camera of a machine has the id "main" (it has no address until the person gives it one)
      var CAMS_MAIN = { id: "main", name: i18nT('cameras.main'), url: "", photo: "", esp32: true };

      var cameraList = [cameraNormalize(CAMS_MAIN, 0)];
      var cameraChangeFn = null; // set by buildCameraPanel: (cam) -> switches the viewer

      function cameraResolverUrl(u) {
        return String(u || "")
          .trim()
          .replace("[HOSTNAME]", window.location.hostname);
      }

      // A camera as the screen holds it: what is stored plus what the service says (via_relay, flash)
      function cameraNormalize(c, i) {
        return {
          id: String((c && c.id) || "c" + Date.now().toString(36) + i),
          name: String((c && c.name) || i18nT('cameras.camera_n', { n: i + 1 })).slice(0, 30),
          url: String((c && c.url) || ""),
          photo: String((c && c.photo) || ""),
          esp32: !!(c && c.esp32),
          flash: c && c.flash && typeof c.flash === "object" ? { capable: c.flash.capable === undefined ? null : c.flash.capable, on: !!c.flash.on } : { capable: null, on: false },
          relay: !(c && c.relay === false),
          flash_source: c && c.flash_source === "strip" ? "strip" : "camera",
          open: c && c.open === "video" ? "video" : "photo",
          via_relay: !!(c && c.via_relay),
        };
      }

      // What is written to cameras.json for a camera: only what is stored (via_relay and flash are the service's answer, not settings)
      function cameraStored(c) {
        return { id: c.id, name: c.name, url: c.url, photo: c.photo, esp32: c.esp32, relay: c.relay, flash_source: c.flash_source, open: c.open };
      }

      // The list from the service (camera.status): the same for every screen, whatever the role (a visitor with the camera has no access to the
      // settings). cameraListRev is the revision of cameras.json it was read at: cameraSaveList writes with it, so a page that was open with an old
      // copy cannot erase what another person saved (the service refuses with "conflict"). The service does not answer: the screen keeps its list.
      var cameraListRev = "0";
      function cameraLoadList() {
        return workshopApiText("camera.status")
          .then(cameraRelayParse)
          .then(function (st) {
            if (st.error || !Array.isArray(st.cameras)) return cameraList;
            var arr = st.cameras.map(cameraNormalize);
            cameraList = arr.length ? arr : [cameraNormalize(CAMS_MAIN, 0)];
            cameraListRev = String(st.cameras_rev || "0");
            return cameraList;
          })
          .catch(function () {
            return cameraList;
          });
      }

      // The list is edited as a whole: it is saved with the revision it was read at ("conflict": "Another person changed this: reload or save
      // as a copy") and read again, so every camera has the service's `via_relay` of what was just saved.
      function cameraSaveList() {
        var value = { version: 2, cameras: cameraList.map(cameraStored) };
        return workshopApi("settings.set", { name: "cameras", value: value, base_rev: cameraListRev }).then(
          function (r) {
            cameraListRev = String(r.rev);
            return cameraLoadList();
          },
          function (e) {
            if (e && e.code === "conflict") throw workshopApiError("conflict", i18nT('core.settings_conflict'), null);
            throw e;
          }
        );
      }

      // The first camera of a machine: its address goes into the "Main" camera of the list (made when the list has none) and the list is saved.
      function cameraAddMain(url) {
        var main = cameraList.filter(function (c) {
          return c.id === "main";
        })[0];
        if (!main) {
          main = cameraNormalize(CAMS_MAIN, 0);
          cameraList.unshift(main);
        }
        main.url = url;
        main.esp32 = true;
        return cameraSaveList();
      }

      // Video address of the Main camera: its address on the relay, or its own address when it does not go through the relay ("" = none yet).
      function cameraUrlMain() {
        var main = cameraList.filter(function (c) {
          return c.id === "main";
        })[0];
        if (!main) return "";
        return cameraRelayId(main) ? cameraEspUrl(cameraRelayCameraHost(main.id), "/stream") : cameraResolverUrl(String(main.url || "").trim());
      }

      function cameraChosenId() {
        try {
          return localStorage.getItem(CAMS_SEL_KEY) || "";
        } catch (e) {
          return "";
        }
      }

      function cameraChosen() {
        var id = cameraChosenId();
        return (
          cameraList.filter(function (c) {
            return c.id === id;
          })[0] || cameraList[0]
        );
      }

      function cameraChoose(id) {
        try {
          localStorage.setItem(CAMS_SEL_KEY, id);
        } catch (e) {
          /* no critico */
        }
        if (cameraChangeFn) cameraChangeFn(cameraChosen());
      }

      // -> Promise {video, photo, host, esp32}
      function cameraUrls(camera) {
        // through the Pi's relay (2026-10-10): several screens at once; the service says which cameras go (cameraRelayId)
        var rid = cameraRelayId(camera);
        if (rid) {
          var host = cameraRelayCameraHost(rid);
          return Promise.resolve({
            video: cameraEspUrl(host, "/stream"),
            photo: cameraResolverUrl(camera.photo) || cameraEspUrl(host, "/snapshot"),
            host: host,
            esp32: !!camera.esp32,
          });
        }
        var video = cameraResolverUrl(String(camera.url || "").trim());
        var photo = cameraResolverUrl(camera.photo);
        if (!photo && camera.esp32 && /\/stream$/.test(video)) photo = video.replace(/\/stream$/, "/snapshot");
        var direct = null;
        if (camera.esp32) {
          try {
            direct = new URL(video, window.location.href).host;
          } catch (e) {
            direct = null;
          }
        }
        return Promise.resolve({ video: video, photo: photo, host: direct, esp32: !!camera.esp32 && !!direct });
      }
