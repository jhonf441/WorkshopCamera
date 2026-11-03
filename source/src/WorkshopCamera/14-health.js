      // ---- One judgement of how a camera is doing (owner report 2026-11-03) ----
      //
      // "The main camera does not respond, yet Live says it is live over a black picture, and the Timelapse page says the camera does not
      // respond." Each place judged on its own: the viewer's badge said LIVE because the video mode had been chosen (not because a frame had
      // come), the picture of the page said "does not respond" because its photo request had failed, the relay serves its last photo again and
      // again while the camera is silent (a picture that loads and never changes), a video whose frames stop keeps its connection open without
      // any event, and nobody read what the relay knows of the camera (/state: seconds since the last frame, without_response_s, drop,
      // last_error). Now every picture of a camera (the viewer, the Live and Image tabs, the mosaic) is judged HERE, from the same facts, and
      // every place paints the state this file decides, with the same words and the same colours:
      //
      //   fresh        frames arrive and the last one is not black                         green
      //   waiting      no frame yet and the first request is still young                   grey
      //   stale        the picture stopped changing, or the relay waits for frames         amber
      //   black        the last frame is all near black                                    amber
      //   down         the camera does not respond: a request failed, or the relay says so red
      //   unreachable  the relay itself (the system service) cannot be reached             red
      //
      // The facts of a picture (cameraHealthFacts) are what THIS browser saw of it (a frame loaded and when, the last request failed, the frame
      // measured near black, the same frame again and again) and what the relay says of that camera in /state. The decision is pure
      // (cameraHealthDecide: tests/camera-health.test.js); the watch (cameraHealthWatch) collects the facts of one <img> and tells its owner when
      // the state changes; ONE timer for every watch, none while no picture is on screen. The help to bring the camera back is 14-health-recover.js.

      var CAMERA_HEALTH_WAIT_MS = 8000; // a first picture that does not come in this long is a hung request (the viewer's own 6 s was the same idea)
      var CAMERA_HEALTH_STALE_MS = 12000; // a photo not renewed in this long (the page asks one every 3 s) stopped
      var CAMERA_HEALTH_SAME_MAX = 4; // this many identical frames in a row (measured 5 s apart): the relay serves the same old frame
      var CAMERA_HEALTH_RELAY_QUIET_S = 10; // the relay has the video open and no frame reached it for this long: the camera went quiet
      var CAMERA_HEALTH_BLACK = 24; // luminance (0..255) under which a pixel counts as black
      var CAMERA_HEALTH_SAMPLE_W = 24; // the small canvas a frame is measured on
      var CAMERA_HEALTH_SAMPLE_H = 18;
      var CAMERA_HEALTH_MEASURE_MS = 5000; // a frame is measured at most this often (a second request of the photo: the relay serves it from its cache)
      var CAMERA_HEALTH_TICK_MS = 1000;
      var CAMERA_HEALTH_RELAY_POLL_MS = 5000; // a watch that asks for it (the viewer in live video) reads /state this often

      // ---- pure: the decision ----

      // The facts of one picture. video: the <img> shows the live video (a browser fires "load" once for it, so its freshness comes from the relay).
      function cameraHealthFacts(video) {
        return { video: !!video, startedMs: 0, loads: 0, lastLoadMs: 0, errorMs: 0, black: null, same: 0, sig: null, relay: null, relayKnown: null };
      }

      // The relay has the video of the camera open (or is opening it again) and no frame has reached it for a while.
      function cameraHealthRelayQuiet(e) {
        if (!e) return false;
        if (e.state === "reconnecting") return true;
        return e.state === "connected" && typeof e.last_frame_s === "number" && e.last_frame_s > CAMERA_HEALTH_RELAY_QUIET_S;
      }

      // What the relay alone says of a camera of /state: {state: "down" | "stale", since_s} when its numbers say something is wrong, else null.
      function cameraHealthFromRelay(e) {
        if (!e) return null;
        if (e.drop || e.without_response_s > 0) return { state: "down", since_s: e.without_response_s || 0 };
        if (cameraHealthRelayQuiet(e)) return { state: "stale", since_s: typeof e.last_frame_s === "number" ? Math.round(e.last_frame_s) : 0 };
        return null;
      }

      // {state, since_s} from the facts f at the time now (ms). The order is the order of certainty: a request that failed, what the relay says,
      // no picture at all, a black picture, a picture that stopped; the rest is fresh.
      function cameraHealthDecide(f, now) {
        var failed = f.errorMs > 0 && f.errorMs >= f.lastLoadMs;
        if (failed && f.relayKnown === false) return { state: "unreachable", since_s: 0 };
        var relay = cameraHealthFromRelay(f.relay);
        if (failed) return { state: "down", since_s: relay && relay.state === "down" ? relay.since_s : 0 };
        if (relay && relay.state === "down") return relay;
        if (!f.loads) {
          if (now - f.startedMs < CAMERA_HEALTH_WAIT_MS) return { state: "waiting", since_s: 0 };
          return { state: f.relayKnown === false ? "unreachable" : "down", since_s: 0 };
        }
        if (f.black === true) return { state: "black", since_s: 0 };
        if (relay) return relay; // stale by the relay's numbers
        if (!f.video && now - f.lastLoadMs > CAMERA_HEALTH_STALE_MS) return { state: "stale", since_s: Math.round((now - f.lastLoadMs) / 1000) };
        if (f.same >= CAMERA_HEALTH_SAME_MAX) return { state: "stale", since_s: Math.round((f.same * CAMERA_HEALTH_MEASURE_MS) / 1000) };
        return { state: "fresh", since_s: 0 };
      }

      // The meaning of a state as the family paints it: ok (green), info (grey / blue), warn (amber), err (red).
      function cameraHealthTone(state) {
        if (state === "fresh") return "ok";
        if (state === "waiting") return "info";
        if (state === "stale" || state === "black") return "warn";
        return "err";
      }

      // Fill of a badge or a chip with white text on the dark panels (DESIGN.md section 2), and the text colour on a dark background.
      function cameraHealthFill(state) {
        var tone = cameraHealthTone(state);
        return tone === "ok" ? "#2e7d32" : tone === "warn" ? "#e65100" : tone === "err" ? "#c62828" : "#455a64";
      }
      function cameraHealthTextColor(state) {
        var tone = cameraHealthTone(state);
        return tone === "ok" ? "var(--c-green,#a5d6a7)" : tone === "warn" ? "var(--c-notice,#ffb74d)" : tone === "err" ? "var(--c-error,#ef9a9a)" : "var(--c-sec,#b0bec5)";
      }

      // The words of a state, the same in every place. h = {state, since_s}; t = i18nT.
      function cameraHealthWord(h, t) {
        if (!h) return "";
        if (h.state === "down" && h.since_s >= 60) return t("health.down_since", { n: Math.round(h.since_s / 60) });
        if (h.state === "stale" && h.since_s > 0) return t("health.stale_since", { s: h.since_s });
        return t("health." + h.state);
      }

      // One line under the words: what the state means and where the help is. t = i18nT.
      function cameraHealthHint(h, t) {
        return h ? t("health." + h.state + "_hint") : "";
      }

      // ---- pure: the measure of a frame ----

      // Every sampled pixel under the threshold: the frame is black. data = RGBA bytes (ImageData.data or a plain array).
      function cameraHealthBlack(data, threshold) {
        var lim = threshold == null ? CAMERA_HEALTH_BLACK : threshold;
        if (!data || !data.length) return false;
        for (var i = 0; i + 2 < data.length; i += 4) if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 >= lim) return false;
        return true;
      }

      // A short signature of a frame (the luminance of each sampled pixel): two signatures are equal only for the same bytes again; a live
      // sensor never gives the same 432 values twice, even in front of a still scene.
      function cameraHealthSignature(data) {
        var s = [];
        for (var i = 0; i + 2 < data.length; i += 4) s.push(Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114));
        return s.join(",");
      }

      // The facts after one measured frame: black, and how many identical frames in a row. Pure over the facts (returns the new values).
      function cameraHealthMeasured(f, data) {
        var sig = cameraHealthSignature(data);
        return { black: cameraHealthBlack(data), same: f.sig !== null && sig === f.sig ? f.same + 1 : 0, sig: sig };
      }

      // ---- what touches the page ----

      // {black, sig, same} of a bitmap drawn small on the canvas, or null when the browser does not let it be read.
      function cameraHealthMeasure(f, bitmap, canvas) {
        try {
          canvas.width = CAMERA_HEALTH_SAMPLE_W;
          canvas.height = CAMERA_HEALTH_SAMPLE_H;
          var ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0, CAMERA_HEALTH_SAMPLE_W, CAMERA_HEALTH_SAMPLE_H);
          return cameraHealthMeasured(f, ctx.getImageData(0, 0, CAMERA_HEALTH_SAMPLE_W, CAMERA_HEALTH_SAMPLE_H).data);
        } catch (e) {
          return null;
        }
      }

      var cameraHealthWatches = []; // the pictures being judged: [W]
      var cameraHealthTimer = null; // the one timer, while there is a watch
      var cameraHealthRelay = { known: null, hooked: false, polledAt: 0 }; // what the last read of /state gave (null: none yet)

      // The read of /state is shared (13-service.js): every watch learns from it whether the relay answers.
      function cameraHealthHookRelay() {
        if (cameraHealthRelay.hooked || typeof cameraStateListeners === "undefined") return;
        cameraHealthRelay.hooked = true;
        cameraStateListeners.push(function (d) {
          cameraHealthRelay.known = !!d;
          cameraHealthWatches.forEach(cameraHealthRefresh);
        });
      }

      // Judges a picture: img = the <img> (or <video>), cam = the camera of the list, o = { video (live video, not a photo), photo (the address
      // of a still of the camera, to measure black and repeated frames; "" = no measuring), relayPoll (read /state while this watch lives: the
      // viewer in live video), onChange(W) (the state changed), reload() (what asks for the picture again: the Retry of the help) }.
      // Returns W = { img, cam, rid, facts, h (the state, {state, since_s}), results (what the help tried), stop }.
      function cameraHealthWatch(img, cam, o) {
        o = o || {};
        var W = { img: img, cam: cam, rid: cameraRelayId(cam), facts: cameraHealthFacts(o.video), h: null, results: {}, photo: o.photo || "", relayPoll: !!o.relayPoll,
          onChange: o.onChange || null, reload: o.reload || null, measuredAt: 0, busy: false, canvas: null, stopped: false };
        W.facts.startedMs = Date.now();
        W.onLoad = function () { cameraHealthOnLoad(W); };
        W.onError = function () { cameraHealthOnError(W); };
        img.addEventListener(img.tagName === "VIDEO" ? "loadeddata" : "load", W.onLoad);
        img.addEventListener("error", W.onError);
        cameraHealthWatches.push(W);
        cameraHealthHookRelay();
        if (!cameraHealthTimer) cameraHealthTimer = setInterval(cameraHealthTick, CAMERA_HEALTH_TICK_MS);
        cameraHealthRefresh(W);
        return W;
      }

      function cameraHealthOnLoad(W) {
        var f = W.facts;
        f.loads++;
        f.lastLoadMs = Date.now();
        f.errorMs = 0;
        cameraHealthSample(W);
        cameraHealthRefresh(W);
      }

      function cameraHealthOnError(W) {
        W.facts.errorMs = Date.now();
        cameraHealthRefresh(W);
      }

      // The picture switched between a photo and the live video (the focus assistant does that): the freshness rule changes with it.
      function cameraHealthMode(W, video) {
        W.facts.video = !!video;
        W.facts.same = 0;
        W.facts.sig = null;
      }

      // Downloads the still of the camera (the relay serves its cached frame: cheap) and measures it, at most every CAMERA_HEALTH_MEASURE_MS.
      // A browser without createImageBitmap, or a frame it does not let read, measures nothing: black stays unknown (null).
      function cameraHealthSample(W) {
        var url = W.photo;
        if (!url || W.busy || W.stopped || typeof createImageBitmap !== "function" || typeof fetch !== "function") return;
        if (Date.now() - W.measuredAt < CAMERA_HEALTH_MEASURE_MS) return;
        W.busy = true;
        W.measuredAt = Date.now();
        url += (url.indexOf("?") < 0 ? "?" : "&") + "_h=" + W.measuredAt;
        fetch(url, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.blob();
          })
          .then(function (blob) { return createImageBitmap(blob); })
          .then(function (bitmap) {
            W.busy = false;
            if (W.stopped) return;
            if (!W.canvas) W.canvas = document.createElement("canvas");
            var m = cameraHealthMeasure(W.facts, bitmap, W.canvas);
            if (bitmap.close) bitmap.close();
            if (!m) return;
            W.facts.black = m.black;
            W.facts.same = m.same;
            W.facts.sig = m.sig;
            cameraHealthRefresh(W);
          })
          .catch(function () { W.busy = false; /* the picture's own load or error event says what happened */ });
      }

      // Judges W now and tells its owner when the state changed.
      function cameraHealthRefresh(W) {
        if (W.stopped) return;
        var f = W.facts;
        f.relay = typeof cameraStateOf === "function" ? cameraStateOf(W.rid) : null;
        f.relayKnown = cameraHealthRelay.known;
        var h = cameraHealthDecide(f, Date.now());
        var changed = !W.h || W.h.state !== h.state || W.h.since_s !== h.since_s;
        W.h = h;
        if (changed && W.onChange) {
          try {
            W.onChange(W);
          } catch (e) {
            /* a broken owner does not stop the others */
          }
        }
      }

      // The timer: judges every watch (time passes: waiting becomes down, fresh becomes stale), drops the ones whose picture left the page,
      // reads /state for the watches that ask for it, and stops itself with the last watch.
      function cameraHealthTick() {
        cameraHealthWatches = cameraHealthWatches.filter(function (W) {
          if (W.stopped || W.img.isConnected === false) {
            cameraHealthDetach(W);
            return false;
          }
          return true;
        });
        var now = Date.now();
        if (cameraHealthWatches.some(function (W) { return W.relayPoll; }) && now - cameraHealthRelay.polledAt >= CAMERA_HEALTH_RELAY_POLL_MS && typeof cameraStateRead === "function") {
          cameraHealthRelay.polledAt = now;
          cameraStateRead(); // its listener (cameraHealthHookRelay) judges every watch again
        }
        cameraHealthWatches.forEach(cameraHealthRefresh);
        if (!cameraHealthWatches.length && cameraHealthTimer) {
          clearInterval(cameraHealthTimer);
          cameraHealthTimer = null;
        }
      }

      function cameraHealthDetach(W) {
        W.stopped = true;
        try {
          W.img.removeEventListener(W.img.tagName === "VIDEO" ? "loadeddata" : "load", W.onLoad);
          W.img.removeEventListener("error", W.onError);
        } catch (e) {
          /* a fake or detached picture */
        }
      }

      // The owner no longer shows the picture.
      function cameraHealthStop(W) {
        if (!W || W.stopped) return;
        cameraHealthDetach(W);
        cameraHealthWatches = cameraHealthWatches.filter(function (x) { return x !== W; });
        if (!cameraHealthWatches.length && cameraHealthTimer) {
          clearInterval(cameraHealthTimer);
          cameraHealthTimer = null;
        }
      }

      // A view is torn down: the watches of the pictures inside root go (null = every watch: the plugin stops).
      function cameraHealthRelease(root) {
        cameraHealthWatches.slice().forEach(function (W) {
          if (!root || W.img === root || (typeof root.contains === "function" && root.contains(W.img))) cameraHealthStop(W);
        });
      }

      // "Retry the picture": the facts start again (so a new request is judged as a first one) and the owner asks for it with a fresh address.
      function cameraHealthRetry(W) {
        var f = W.facts;
        f.startedMs = Date.now();
        f.loads = 0;
        f.lastLoadMs = 0;
        f.errorMs = 0;
        f.black = null;
        f.same = 0;
        f.sig = null;
        W.measuredAt = 0;
        if (W.reload) W.reload();
        cameraHealthRefresh(W);
      }
