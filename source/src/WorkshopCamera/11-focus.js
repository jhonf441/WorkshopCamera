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
      }

      function cameraFocusRelease() {
        if (cameraFocusCurrent) cameraFocusEnd(cameraFocusCurrent);
        cameraFocusCurrent = null;
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
        F.img.src = cameraFocusStamp(F.u.photo);
        F.photoTimer = setTimeout(function () { cameraFocusPhoto(F); }, CAMERA_SNAPSHOT_POLL_MS);
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

      // The card "Preview and focus" of the tab Image: the picture of the camera (a photo every 3 s; the live video while the assistant is on) and,
      // for the technician (feature "focus") with a camera that has a still image, the sharpness meter. cam = the camera of the list, u = cameraUrls(cam).
      function cameraFocusCard(grid, cam, u) {
        cameraFocusRelease();
        var card = studioCard(grid, "mdi-image-filter-center-focus", i18nT('image.preview'), i18nT('image.preview_hint', { s: CAMERA_SNAPSHOT_POLL_MS / 1000 }));
        var box = cameraEl("div", "position:relative;");
        var img = cameraEl("img", "");
        img.className = "cst-pre";
        img.alt = cam.name;
        box.appendChild(img);
        cameraOwnError(img); // the note goes next to the picture, inside the box
        var frame = cameraEl("div", "position:absolute;left:30%;top:30%;width:40%;height:40%;border:2px dashed #fff59d;box-sizing:border-box;pointer-events:none;display:none;");
        box.appendChild(frame);
        card.appendChild(box);
        var F = cameraFocusState(img, u, null);
        cameraFocusCurrent = F;
        if (cameraCanDo("focus") && u.photo) {
          var m = cameraFocusMeter(F);
          var note = cameraEl("div", "");
          note.className = "ctl-muted";
          var button = cameraBtn(i18nT('image.focus_assistant'), "align-self:flex-start;", function () { if (F.on) cameraFocusOff(F); else cameraFocusOn(F); });
          F.ui = { meter: m.meter, frame: frame, text: m.text, bar: m.bar, hint: m.hint, note: note, button: button };
          [button, note, m.meter].forEach(function (n) { card.appendChild(n); });
        }
        cameraFocusPhoto(F);
        return F;
      }
