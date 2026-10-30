      // ---- Start-up card of the camera (2026-10-15) ----
      //
      // A person who installs the camera on THEIR machine has no camera yet: this card (src/_shared/16-startup.js)
      // says what is missing, in the "Cameras" sheet (the gear of the viewer: the one place where cameras are added).
      //   green  = ready; orange = works but something is off (the optional relay is not running);
      //   red    = a camera is missing or does not answer; grey = does not apply to this machine (no camera, or no camera
      //   that goes through the relay: never an error).
      // The camera has no macros and no example files (nothing in sd/), so no row is a file. Nothing here writes anything.

      // Pure: {configured|missing|na} from the camera list (cameraList) and the relay status (camera.status, null = unknown).
      // The Main camera with an empty address reads the relay's camera (config.json camera_relay.url of the service).
      function cameraStartupStateCameras(items, relay) {
        var own = (items || []).some(function (c) {
          return String((c && c.url) || "").trim() !== "";
        });
        if (own) return "configured";
        var main = (items || []).some(function (c) {
          return c && c.id === "main";
        });
        if (!main) return "missing";
        if (!relay || relay.error) return "na"; // the service does not answer: its own row says so
        return relay.url ? "configured" : "missing";
      }

      // Pure: the relay is optional. Grey if no camera goes through it (usaRelay false) or the service does not answer.
      function cameraStartupStateRelay(usesRelay, relay) {
        if (!usesRelay) return "na";
        if (!relay || relay.error) return "na";
        return relay.running ? "configured" : "example";
      }

      var cameraStartupRelayMemo = { t: 0, p: null };
      // camera.status of the service, or null when it does not answer (shared by the rows of one refresh)
      function cameraStartupRelay() {
        if (cameraStartupRelayMemo.p && Date.now() - cameraStartupRelayMemo.t < 2000) return cameraStartupRelayMemo.p;
        cameraStartupRelayMemo.t = Date.now();
        cameraStartupRelayMemo.p = workshopApiText("camera.status")
          .then(function (t) {
            var k = t.indexOf("{");
            return k >= 0 ? JSON.parse(t.slice(k)) : null;
          })
          .catch(function () {
            return null;
          });
        return cameraStartupRelayMemo.p;
      }

      // true when the address answers (the headers arrive); the body of a stream is never read. Opaque response: no CORS needed.
      function cameraStartupAnswers(url) {
        var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = setTimeout(function () {
          if (ctl) ctl.abort();
        }, 4000);
        return fetch(url, { mode: "no-cors", cache: "no-store", signal: ctl ? ctl.signal : undefined })
          .then(
            function () {
              return true;
            },
            function () {
              return false;
            }
          )
          .then(function (ok) {
            clearTimeout(timer);
            if (ctl) ctl.abort(); // stop reading the stream
            return ok;
          });
      }

      // ---- What captures and timelapse need (camera.status -> requisitos, from the service; null = it does not say) ----
      // Pure. All of them are grey when no camera goes through the relay (captures and timelapse are made by it), when the service does
      // not answer, or when it is an older service that does not report requisitos: never an error for something unknown.
      function cameraStartupRequirements(usesRelay, relay) {
        if (!usesRelay || !relay || relay.error || !relay.requirements) return null;
        return relay.requirements;
      }

      // Folder where captures and videos are kept: red if it cannot be written or under 100 MB free, orange under 500 MB.
      function cameraStartupStateFolder(usesRelay, relay) {
        var r = cameraStartupRequirements(usesRelay, relay);
        if (!r) return "na";
        if (!r.folder_ok || (typeof r.free_mb === "number" && r.free_mb < 100)) return "missing";
        if (typeof r.free_mb === "number" && r.free_mb < 500) return "example";
        return "configured";
      }

      // ffmpeg builds the timelapse video: without it no video is made (red).
      function cameraStartupStateFfmpeg(usesRelay, relay) {
        var r = cameraStartupRequirements(usesRelay, relay);
        return !r ? "na" : r.ffmpeg ? "configured" : "missing";
      }

      // Pillow writes the date and the position on the photo: without it the photo is saved plain (orange, it still works).
      function cameraStartupStateStamp(usesRelay, relay) {
        var r = cameraStartupRequirements(usesRelay, relay);
        return !r ? "na" : r.pillow ? "configured" : "example";
      }

      // A Pi without internet at boot can start with the clock in the past: the names and stamps of the files would be wrong (orange).
      function cameraStartupStateHour(usesRelay, relay) {
        var r = cameraStartupRequirements(usesRelay, relay);
        return !r ? "na" : r.hour_ok ? "configured" : "example";
      }

      function cameraStartupUsesRelay() {
        return cameraList.some(function (c) {
          return !!cameraRelayId(c);
        });
      }

      var CAMERA_STARTUP_I18N = "startup_camera" + "."; // keys of this card (built here, not written whole, for the rows of requisitos)

      // one row of the requisitos: state(usaRelay, relay) from the pure function above
      function cameraStartupRowRequirement(id, group, stateFn, texts) {
        return {
          id: id,
          group: group.id, groupLabel: group.label, groupDescription: group.description, groupIcon: group.icon,
          label: CAMERA_STARTUP_I18N + id, what: CAMERA_STARTUP_I18N + id + "_what", why: CAMERA_STARTUP_I18N + id + "_for", ifMissing: CAMERA_STARTUP_I18N + id + "_missing",
          help: CAMERA_STARTUP_I18N + id + "_tip", // tests/startup-camera-vision.test.js checks that every one of these keys exists in es and en
          texts: texts,
          check: function () {
            return cameraStartupRelay().then(function (relay) {
              return stateFn(cameraStartupUsesRelay(), relay);
            });
          },
        };
      }

      var CAMERA_STARTUP_GROUP_CAPTURES = { id: "captures", label: "startup_camera.g_captures", description: "startup_camera.g_captures_desc", icon: "file" };
      var CAMERA_STARTUP_GROUP_TIMELAPSE = { id: "timelapse", label: "startup_camera.g_timelapse", description: "startup_camera.g_timelapse_desc", icon: "service" };

      var CAMERA_STARTUP_ROWS = [
        {
          id: "cameras",
          label: "startup_camera.cameras", what: "startup_camera.cameras_what", why: "startup_camera.cameras_for", ifMissing: "startup_camera.cameras_missing",
          help: "startup_camera.cameras_tip",
          texts: { configured: "startup_camera.cameras_ok", missing: "startup_camera.cameras_missing" },
          check: function () {
            return cameraStartupRelay().then(function (relay) {
              return cameraStartupStateCameras(cameraList, relay); // cameraList is loaded when the viewer opens
            });
          },
        },
        {
          id: "address",
          label: "startup_camera.address", what: "startup_camera.address_what", why: "startup_camera.address_for", ifMissing: "startup_camera.address_missing",
          help: "startup_camera.address_tip",
          texts: { configured: "startup_camera.address_ok", missing: "startup_camera.address_missing" },
          check: function () {
            return cameraStartupRelay().then(function (relay) {
              if (cameraStartupStateCameras(cameraList, relay) !== "configured") return "na"; // nothing to try yet
              return cameraUrls(cameraChosen()).then(function (u) {
                return cameraStartupAnswers(u.photo || u.video).then(function (ok) {
                  return ok ? "configured" : "missing";
                });
              });
            });
          },
        },
        {
          id: "relay",
          label: "startup_camera.relay", what: "startup_camera.relay_what", why: "startup_camera.relay_for", ifMissing: "startup_camera.relay_missing",
          help: "startup_camera.relay_tip",
          texts: { configured: "startup_camera.relay_ok", example: "startup_camera.relay_stopped" },
          check: function () {
            return cameraStartupRelay().then(function (relay) {
              var uses = cameraList.some(function (c) {
                return !!cameraRelayId(c);
              });
              return cameraStartupStateRelay(uses, relay);
            });
          },
        },
        cameraStartupRowRequirement("folder", CAMERA_STARTUP_GROUP_CAPTURES, cameraStartupStateFolder, { configured: "startup_camera.folder_ok", example: "startup_camera.folder_low", missing: "startup_camera.folder_bad" }),
        cameraStartupRowRequirement("stamp", CAMERA_STARTUP_GROUP_CAPTURES, cameraStartupStateStamp, { configured: "startup_camera.stamp_ok", example: "startup_camera.stamp_plain" }),
        cameraStartupRowRequirement("ffmpeg", CAMERA_STARTUP_GROUP_TIMELAPSE, cameraStartupStateFfmpeg, { configured: "startup_camera.ffmpeg_ok", missing: "startup_camera.ffmpeg_none" }),
        cameraStartupRowRequirement("clock", CAMERA_STARTUP_GROUP_TIMELAPSE, cameraStartupStateHour, { configured: "startup_camera.clock_ok", example: "startup_camera.clock_wrong" }),
      ];

      // The card for the "Cameras" sheet (one per sheet). Returns the card; the sheet appends card.el and calls refrescar().
      function cameraStartupCreate() {
        var card = workshopStartupInput({ plugin: "WorkshopCamera", rows: CAMERA_STARTUP_ROWS }); // a strip; the card is in the dialog
        var refrescar = card.refresh;
        card.refresh = function () {
          cameraStartupRelayMemo.p = null; // a new refresh asks the service again
          return refrescar();
        };
        return card;
      }
