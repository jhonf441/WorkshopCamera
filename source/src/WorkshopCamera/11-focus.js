      // ---- Focus assistant (2026-10-23; moved from the floating viewer to the tab "Image" of the page by informe-07) ----
      // Sharpness meter for turning the lens by hand: the live video is measured at the centre of the frame (variance of the
      // Laplacian of a square crop) and the bar shows it against the best value seen since it was started. Measuring needs the
      // image to be readable by the page: the displayed <img> is not (a crossorigin image does not send the relay's key cookie and
      // gets a 401), so the frame is downloaded with fetch() (it carries the key, 26-camera-key.js) from the photo address while the
      // live video keeps the relay's last frame fresh.
      // {sharp, dark} of the centre of the image now; null = no frame yet; false = the browser does not let it be read
      function cameraFocusMeasure(img, canvas) {
        var w = img.width, h = img.height;
        if (!w || !h) return null;
        var crop = Math.round(Math.min(w, h) * 0.4);
        var side = Math.max(32, Math.min(192, crop));
        canvas.width = side;
        canvas.height = side;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        var data;
        try {
          ctx.drawImage(img, Math.round((w - crop) / 2), Math.round((h - crop) / 2), crop, crop, 0, 0, side, side);
          data = ctx.getImageData(0, 0, side, side).data;
        } catch (e) {
          return false;
        }
        var g = new Float32Array(side * side);
        var total = 0;
        for (var i = 0, k = 0; i < data.length; i += 4, k++) {
          g[k] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          total += g[k];
        }
        var sum = 0, sumsq = 0, n = 0;
        for (var y = 1; y < side - 1; y++) {
          for (var x = 1; x < side - 1; x++) {
            var c = y * side + x;
            var l = 4 * g[c] - g[c - 1] - g[c + 1] - g[c - side] - g[c + side];
            sum += l;
            sumsq += l * l;
            n++;
          }
        }
        return { sharp: sumsq / n - (sum / n) * (sum / n), dark: total / g.length < 35 };
      }

      // The assistant of the card that is on screen (the stop of the plugin and the destroy of the page release it; a card that was redrawn
      // away ends by itself the next time its timer finds the picture off the page).
      var cameraFocusCurrent = null;
      // The last good photo of each camera (camera id -> blob address). A page that is drawn again (the form of the timelapse opens) builds its preview
      // again: it starts from this photo, so the picture neither shows its alt text with a broken icon nor flashes while the next photo comes.
      var cameraFocusKept = {};
      // The previews of the "All cameras" grid of the Live tab (opts.tile): several at once, each one ends with the page that drew it (cameraFocusRelease).
      var cameraFocusTiles = [];

      // One state per card. img = the picture, u = { photo, video } (cameraUrls), ui = the elements it writes to:
      // { meter, frame, text, bar, hint, note, button }
      function cameraFocusState(img, u, ui) {
        return { img: img, u: u, ui: ui, on: false, ended: false, timer: null, photoTimer: null, peak: 0, now: 0, busy: false, failures: 0, canvas: document.createElement("canvas") };
      }

      function cameraFocusEnd(F) {
        F.ended = true;
        F.on = false;
        clearInterval(F.timer);
        clearTimeout(F.photoTimer);
        F.timer = null;
        F.photoTimer = null;
        if (F.health) cameraHealthStop(F.health); // 14-health.js: the judgement of this picture ends with it
        if (!F.u.photo && F.img.removeAttribute) F.img.removeAttribute("src"); // a video preview closes its stream when it ends (a picture off the page keeps loading otherwise)
      }

      function cameraFocusRelease() {
        if (cameraFocusCurrent) cameraFocusEnd(cameraFocusCurrent);
        cameraFocusCurrent = null;
        cameraFocusTiles.forEach(cameraFocusEnd);
        cameraFocusTiles = [];
      }

      // Ends one preview and forgets it (a tile whose mode changed is drawn again by itself, the others are left alone).
      function cameraFocusDrop(F) {
        if (!F) return;
        cameraFocusEnd(F);
        cameraFocusTiles = cameraFocusTiles.filter(function (x) { return x !== F; });
        if (cameraFocusCurrent === F) cameraFocusCurrent = null;
      }

      function cameraFocusStamp(url) {
        return url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now();
      }

      // The picture while the assistant is off: a photo that refreshes (the live video only while measuring). A camera with no still image shows its video.
      function cameraFocusPhoto(F) {
        clearTimeout(F.photoTimer);
        F.photoTimer = null;
        if (F.ended || F.on) return;
        if (!F.img.isConnected) return cameraFocusEnd(F);
        if (!F.u.photo) {
          F.img.src = F.u.video;
          return;
        }
        cameraFocusSwap(F, cameraFocusStamp(F.u.photo));
        F.photoTimer = setTimeout(function () { cameraFocusPhoto(F); }, CAMERA_SNAPSHOT_POLL_MS);
      }

      // The next photo is asked for OFF the picture and put in only when it came whole and is not black: while it loads (or when the camera gave a
      // black frame, seen while a timelapse recorded with another camera down) the picture keeps the last good one instead of flashing black.
      // At most 2 black ones in a row are held back (a dark room is black too). Without fetch / createImageBitmap, or on any failure, the plain
      // way: the <img> asks for the address itself and its own load / error event says what happened (the judgement, 14-health.js).
      function cameraFocusSwap(F, url) {
        if (typeof fetch !== "function" || typeof createImageBitmap !== "function" || typeof URL === "undefined" || !URL.createObjectURL) {
          F.img.src = url;
          return;
        }
        var seq = F.swapSeq = (F.swapSeq || 0) + 1;
        fetch(url, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.blob();
          })
          .then(function (blob) {
            return createImageBitmap(blob).then(function (bitmap) {
              var dark = false;
              try {
                var cv = F.swapCanvas || (F.swapCanvas = document.createElement("canvas"));
                cv.width = CAMERA_HEALTH_SAMPLE_W;
                cv.height = CAMERA_HEALTH_SAMPLE_H;
                var cx = cv.getContext("2d", { willReadFrequently: true });
                cx.drawImage(bitmap, 0, 0, CAMERA_HEALTH_SAMPLE_W, CAMERA_HEALTH_SAMPLE_H);
                dark = cameraHealthBlack(cx.getImageData(0, 0, CAMERA_HEALTH_SAMPLE_W, CAMERA_HEALTH_SAMPLE_H).data);
              } catch (e) {
                dark = false; /* a frame the browser does not let be read: it goes in as it is */
              }
              if (bitmap.close) bitmap.close();
              return { blob: blob, dark: dark };
            });
          })
          .then(function (res) {
            if (F.ended || F.on || seq !== F.swapSeq) return; // F.on: the assistant took the picture for the live video meanwhile
            if (res.dark && (F.swapHeld || 0) < 2) {
              F.swapHeld = (F.swapHeld || 0) + 1;
              return;
            }
            F.swapHeld = 0;
            var old = cameraFocusKept[F.camId];
            cameraFocusKept[F.camId] = URL.createObjectURL(res.blob); // kept per camera: a preview drawn again starts from it
            F.img.src = cameraFocusKept[F.camId];
            if (old) setTimeout(function () { URL.revokeObjectURL(old); }, 2000);
          })
          .catch(function () {
            if (!F.ended && seq === F.swapSeq) F.img.src = url;
          });
      }

      function cameraFocusShow(F, m) {
        var ui = F.ui;
        F.now = F.now ? F.now * 0.5 + m.sharp * 0.5 : m.sharp;
        if (F.now > F.peak) F.peak = F.now;
        var pct = F.peak > 0 ? Math.round((F.now / F.peak) * 100) : 0;
        ui.bar.style.width = pct + "%";
        ui.bar.style.background = pct >= 95 ? "#43a047" : pct >= 75 ? "#fbc02d" : "#e53935";
        ui.text.textContent = Math.round(F.now) + "  ·  " + i18nT('image.focus_best') + " " + Math.round(F.peak);
        ui.hint.textContent = m.dark ? i18nT('image.focus_too_dark') : i18nT('image.focus_hint');
      }

      // One measurement: downloads the last frame (the relay keeps it fresh while the video is live) and reads its centre.
      function cameraFocusTick(F) {
        if (F.ended) return;
        if (!F.img.isConnected) return cameraFocusEnd(F);
        var url = F.u.photo ? cameraFocusStamp(F.u.photo) : ""; // the photo address of the relay, with the stamp that makes it a new frame
        if (F.busy || !url) return;
        F.busy = true;
        fetch(url, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.blob();
          })
          .then(function (blob) { return createImageBitmap(blob); })
          .then(function (bitmap) {
            F.busy = false;
            F.failures = 0;
            if (!F.on) return;
            var m = cameraFocusMeasure(bitmap, F.canvas);
            if (m) cameraFocusShow(F, m);
          })
          .catch(function () {
            F.busy = false;
            if (F.on && ++F.failures >= 8) cameraFocusOff(F, i18nT('image.focus_cannot_measure'));
          });
      }

      function cameraFocusOn(F) {
        var ui = F.ui;
        if (F.on || F.ended) return;
        F.on = true;
        F.peak = 0;
        F.now = 0;
        F.failures = 0;
        clearTimeout(F.photoTimer);
        F.photoTimer = null;
        ui.note.textContent = "";
        ui.text.textContent = "";
        ui.bar.style.width = "0";
        ui.hint.textContent = i18nT('image.focus_hint');
        ui.frame.style.display = "";
        ui.meter.style.display = "flex";
        ui.button.classList.add("ctl-on");
        if (F.health) cameraHealthMode(F.health, true); // the picture is the live video while it measures
        F.img.src = F.u.video;
        F.timer = setInterval(function () { cameraFocusTick(F); }, 300);
      }

      function cameraFocusOff(F, message) {
        var ui = F.ui;
        if (!F.on) return;
        F.on = false;
        clearInterval(F.timer);
        F.timer = null;
        ui.frame.style.display = "none";
        ui.meter.style.display = "none";
        ui.button.classList.remove("ctl-on");
        ui.note.textContent = message || "";
        F.img.removeAttribute("src");
        if (F.health) cameraHealthMode(F.health, false);
        cameraFocusPhoto(F);
      }

      // The meter under the picture: the numbers, the bar, the hint and the button that restarts the peak -> { meter, text, bar, hint, reset }
      function cameraFocusMeter(F0) {
        var meter = cameraEl("div", "display:none;flex-direction:column;gap:4px;");
        var text = cameraEl("div", "font-weight:500;");
        var barBox = cameraEl("div", "height:10px;border-radius:5px;background:var(--c-neutro,#37474f);overflow:hidden;");
        var bar = cameraEl("div", "height:100%;width:0;background:#fbc02d;");
        barBox.appendChild(bar);
        var hint = cameraEl("div", "");
        hint.className = "ctl-muted";
        var reset = cameraBtn(i18nT('image.focus_reset'), "align-self:flex-start;", function () { F0.peak = 0; });
        [text, barBox, hint, reset].forEach(function (n) { meter.appendChild(n); });
        return { meter: meter, text: text, bar: bar, hint: hint, reset: reset };
      }

      // The picture of a camera: a photo that refreshes every 3 s (the live video only while the assistant measures; a camera with no still image shows
      // its video). It is the preview of the tabs Image and Live: ONE component, and it never opens a second stream of its own.
      // parent = where the picture goes, cam = the camera of the list, u = cameraUrls(cam), opts = { go(tab) (the page: the help may open its
      // Cameras tab) }. Under the picture: its judgement (14-health.js, the same words as the viewer's badge and the in-place note) and the help to
      // bring the camera back when it is not alive (14-health-recover.js). Returns the state F (11-focus.js) that keeps it alive.
      function cameraFocusPreview(parent, cam, u, opts) {
        var tile = !!(opts && opts.tile); // a tile of the grid of all the cameras: many at once, no hint line, they end with the page
        if (!tile) cameraFocusRelease();
        var box = cameraEl("div", "position:relative;");
        var img = cameraEl("img", "");
        img.className = "cst-pre"; // the frame of the picture (studioCss, 18-tl-studio.js)
        img.alt = ""; // the name is the accessible label: an empty alt keeps its text and the broken-image icon off the screen while the photo loads
        if (img.setAttribute) img.setAttribute("aria-label", cam.name);
        if (cam.id && cameraFocusKept[cam.id]) img.src = cameraFocusKept[cam.id];
        box.appendChild(img);
        var F = cameraFocusState(img, u, null);
        F.camId = cam.id || "";
        cameraOwnError(img, function () { return cameraHealthWord(F.health && F.health.h, i18nT) || workshopCoverReason(); }); // the note next to the picture says what the judgement says
        var frame = cameraEl("div", "position:absolute;left:30%;top:30%;width:40%;height:40%;border:2px dashed #fff59d;box-sizing:border-box;pointer-events:none;display:none;");
        box.appendChild(frame);
        parent.appendChild(box);
        if (!tile) parent.appendChild(cameraEl("div", null, i18nT(u.photo ? 'image.preview_hint' : 'image.preview_video_hint', { s: CAMERA_SNAPSHOT_POLL_MS / 1000 }))).className = "ctl-muted"; // a camera with no still image (or the video mode of the Live tab) says it is video
        F.frame = frame;
        if (tile) cameraFocusTiles.push(F); else cameraFocusCurrent = F;
        F.health = cameraHealthWatch(img, cam, { video: !u.photo, photo: u.photo, onChange: function () { if (F.healthUi) F.healthUi.paint(); }, reload: function () { cameraFocusPhoto(F); } });
        F.healthUi = cameraHealthPanel(parent, F.health, { go: opts && opts.go, compact: tile });
        // A page that draws again (a profile was applied) builds the preview before its parent is in the document: the picture is asked for once
        // it is there. Asking at once saw a picture "not connected", ended the preview and left the image without an address (broken icon).
        if (img.isConnected === false) F.photoTimer = setTimeout(function () { cameraFocusPhoto(F); }, 0);
        else cameraFocusPhoto(F);
        return F;
      }

      // The focus assistant of a preview: for the technician (feature "focus") with a camera that has a still image, the button, its note and the
      // sharpness meter go into `side`.
      function cameraFocusAssistant(F, side) {
        if (!cameraCanDo("focus") || !F.u.photo) return;
        var m = cameraFocusMeter(F);
        var note = cameraEl("div", "");
        note.className = "ctl-muted";
        var button = cameraBtn(i18nT('image.focus_assistant'), "align-self:flex-start;", function () { if (F.on) cameraFocusOff(F); else cameraFocusOn(F); });
        F.ui = { meter: m.meter, frame: F.frame, text: m.text, bar: m.bar, hint: m.hint, note: note, button: button };
        [button, note, m.meter].forEach(function (n) { side.appendChild(n); });
      }

      // The preview of the tab Image with its assistant: the picture in `parent`, the assistant in `side` (default: after the picture).
      function cameraFocusCard(parent, cam, u, side, opts) {
        var F = cameraFocusPreview(parent, cam, u, opts);
        cameraFocusAssistant(F, side || parent);
        return F;
      }
