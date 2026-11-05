      // ---- The one client of the camera relay (informe-06, A-P6) ----
      //
      // The relay (WorkshopService, port WORKSHOP_RELAY_PORT of src/_camera_client/10-camera-ports.js) serves the video and the photos and keeps
      // the captures and the timelapses. Everything this plugin asks of it goes through the functions of this file: the address of the relay,
      // the address of each thing it serves (an <img> or a <video> cannot carry headers: the address is all they have) and every call. No other
      // file builds a relay address or calls fetch() on it (tests/camera-boundary.test.js, tests/camera-relay.test.js look for it).
      //
      // The day's key and the identity headers are added by the fetch of src/_camera_client/26-camera-key.js. Here the answer is read: a 401
      // or a 403 that survives that says what it means (sign in / your role) instead of "HTTP 403".
      // What the relay SERVES (the lists, its state, the images and the videos) is read from :8090. What it DOES (capture, burst, remove, keep, rename,
      // edit, rerender, timelapse, schedule) is an operation of the service API (informe-06 B-P8): it is in the history and the audit with who did it,
      // and the service decides by role. Only the upload of a LUT (a file too big for the API) is still a POST of :8090.

      // ---- addresses ----

      function cameraRelayHost() {
        return window.location.hostname + ":" + WORKSHOP_RELAY_PORT;
      }

      function cameraRelayUrl(path) {
        return "http://" + cameraRelayHost() + path;
      }

      // {a: 1, b: "x y", c: null} -> "?a=1&b=x%20y" (what is null or undefined is left out)
      function cameraRelayQuery(params) {
        var parts = [];
        Object.keys(params || {}).forEach(function (k) {
          if (params[k] !== null && params[k] !== undefined) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
        });
        return parts.length ? "?" + parts.join("&") : "";
      }

      // "host/c/<id>": the camera <id> of the relay. Its /status and /control are the camera's (the relay passes them on), see cameraEspUrl.
      function cameraRelayCameraHost(rid) {
        return cameraRelayHost() + "/c/" + encodeURIComponent(rid);
      }

      // The saved files: kind "video" (a timelapse) or "photo" (a capture)
      function cameraRelayMediaUrl(kind, file) {
        return cameraRelayUrl((kind === "video" ? "/timelapses/" : "/captures/") + encodeURIComponent(file));
      }

      function cameraRelayThumbUrl(timelapse) {
        return cameraRelayUrl("/timelapses/" + encodeURIComponent(timelapse.thumbnail));
      }

      // The latest saved photo of a camera being recorded (frames makes the address change with each photo)
      function cameraRelayLastUrl(cid, frames) {
        return cameraRelayUrl("/timelapse/last" + cameraRelayQuery({ c: cid, _: frames || 0 }));
      }

      // A still with the look of the studio applied (cfg = the settings of the studio, an object)
      function cameraRelayPreviewUrl(cid, cfg) {
        return cameraRelayUrl("/timelapse/preview" + cameraRelayQuery({ c: cid, cfg: JSON.stringify(cfg), _: Date.now() }));
      }

      // The id the relay knows for a camera of the list, or null when that camera does not go through the relay (a common IP camera, one that
      // asked for the direct way, an address only a browser resolves). The service says it (`via_relay` of each camera of camera.status): the rule
      // is not repeated here (camera_sources.py).
      function cameraRelayId(camera) {
        return camera && camera.via_relay ? camera.id : null;
      }

      // An address on the ESP32 of a camera: host = "<pi>:8090/c/<id>" (through the relay) or "<ip>:80" (straight): its /stream and /snapshot. The settings
      // and the flash of the camera are not asked here: they are operations of the service (camera.image.get / set, camera.flash).
      function cameraEspUrl(host, path) {
        return "http://" + host + path;
      }

      // ---- what a refusal says ----

      // The text of a call that did not work: the two refusals of the relay in plain words, any other status as a number.
      function cameraRelayError(status) {
        if (status === 401) return i18nT("relay.error_sign_in");
        if (status === 403) return i18nT("relay.error_role");
        return i18nT("relay.error_http", { status: status });
      }

      // ---- calls ----

      // One call. Resolves { ok, status, data }: data is the JSON of the body or null when the body is not JSON. A network failure rejects.
      function cameraRelayCall(path, method, body) {
        var options = method === "GET" ? { cache: "no-store" } : { method: method, body: body };
        return fetch(cameraRelayUrl(path), options).then(function (r) {
          return r.json().then(
            function (data) { return { ok: r.ok, status: r.status, data: data }; },
            function () { return { ok: r.ok, status: r.status, data: null }; }
          );
        });
      }

      // A reading: the JSON, or `fallback` when the relay does not answer, refuses or answers something that is not JSON.
      // why (optional, an object) gets why.cause and why.status when the reading fails: see cameraRelayCause.
      function cameraRelayRead(path, fallback, why) {
        return cameraRelayCall(path, "GET").then(
          function (res) {
            if (res.ok && res.data !== null) return res.data;
            if (why) { why.cause = cameraRelayCause(res.status, res.ok); why.status = res.status; }
            return fallback;
          },
          function () {
            if (why) { why.cause = "unreachable"; why.status = 0; }
            return fallback;
          }
        );
      }

      // Pure: why a reading of the relay failed. 401 -> "login_required", 403 -> "forbidden", any other answer that is not usable -> "error"
      // (the relay answered: it is not down); "unreachable" is only a network failure (it never reaches here, the call rejects).
      function cameraRelayCause(status, ok) {
        if (status === 401) return "login_required";
        if (status === 403) return "forbidden";
        return ok || status ? "error" : "unreachable";
      }

      // A POST of :8090 (only the LUTs): always resolves { ok, error? } (the relay's own answer, or the text of the refusal); only a network failure rejects.
      function cameraRelayWrite(path, params, body) {
        return cameraRelayCall(path + cameraRelayQuery(params), "POST", body).then(function (res) {
          var refused = res.status === 401 || res.status === 403;
          if (res.data && typeof res.data === "object" && !refused) return res.data;
          return { ok: false, error: cameraRelayError(res.status) };
        });
      }

      function cameraRelayState() {
        return cameraRelayRead("/state", null);
      }

      // The saved files, newest first: kind "video" | "photo". null = the relay does not answer.
      // why (optional): see cameraRelayRead.
      function cameraRelayList(kind, why) {
        return cameraRelayRead(kind === "video" ? "/timelapses" : "/captures", null, why);
      }

      // What the relay is going to delete by itself because of the caps ({items, wait_h}); null = it does not say
      function cameraRelayPerDelete() {
        return cameraRelayRead("/per_delete", null);
      }

      // Asks the service whether the address is an ESP32-camera and whether it has a flash (the browser cannot ask the camera: CORS): the API
      // operation camera.detect. Resolves {ok, reachable, esp32, flash, error?}.
      function cameraRelayDetect(address) {
        return workshopApi("camera.detect", { url: address });
      }

      // An operation of the service API that DOES something: always resolves { ok, error? } (the service's own answer, or the words of the refusal: the
      // role does not allow it, the camera is not there); never rejects.
      function cameraRelayAction(op, args) {
        return workshopApi(op, args).then(
          function (r) { return r && typeof r === "object" ? r : { ok: false, error: "" }; },
          function (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
        );
      }

      function cameraRelayCapture(rid) {
        return cameraRelayAction("camera.capture", { camera: rid });
      }

      // The settings of a take: an object, or its JSON text
      function cameraRelayTake(cfg) {
        if (typeof cfg !== "string") return cfg;
        try {
          return JSON.parse(cfg);
        } catch (e) {
          return null;
        }
      }

      // action: begin | stop | schedule | unschedule; params: { name, cfg (the settings of the take), since, until (epoch seconds) }
      function cameraRelayTimelapse(action, params) {
        var p = params || {};
        var args = {};
        if (p.name) args.name = p.name;
        if (action === "schedule" || action === "unschedule") {
          args.action = action;
          if (p.since !== null && p.since !== undefined) args.since = Number(p.since);
          if (p.until !== null && p.until !== undefined) args.until = Number(p.until);
          return cameraRelayAction("camera.schedule", args);
        }
        args.action = action === "begin" ? "start" : "stop";
        if (action === "begin" && p.cfg) args.cfg = cameraRelayTake(p.cfg);
        return cameraRelayAction("camera.timelapse", args);
      }

      function cameraRelayRemove(file) {
        return cameraRelayAction("camera.remove", { file: file });
      }

      function cameraRelayRename(file, name) {
        return cameraRelayAction("camera.rename", { file: file, name: name });
      }

      function cameraRelayKeep(file, value) {
        return cameraRelayAction("camera.keep", { file: file, value: !!value });
      }

      // The edited copy of a video: since / until in seconds (until null = to the end), speed a multiplier
      function cameraRelayEdit(file, edit) {
        var args = { file: file, since: Number(edit.since.toFixed(2)), speed: Number(edit.speed) };
        if (edit.until !== null) args.until = Number(edit.until.toFixed(2));
        return cameraRelayAction("camera.edit", args);
      }

      function cameraRelayBurst(cid, count, gap) {
        return cameraRelayAction("camera.burst", { camera: cid, count: Number(count), gap: Number(gap) });
      }

      // The video built again with the settings of the studio (cfg = an object); the original stays
      function cameraRelayRerender(file, cfg) {
        return cameraRelayAction("camera.rerender", { file: file, cfg: cfg });
      }

      // A .cube file (the bytes) for the look of the studio: the one POST that stays on :8090 (6 MB do not fit the body of the API; the relay asks the technician)
      function cameraRelayLutSave(name, bytes) {
        return cameraRelayWrite("/luts", { name: name }, bytes);
      }

      function cameraRelayLutRemove(name) {
        return cameraRelayWrite("/luts/remove", { name: name });
      }
