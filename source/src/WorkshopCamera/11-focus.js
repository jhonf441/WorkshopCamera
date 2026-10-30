      // ---- Focus assistant (2026-10-23) ----
      // Sharpness meter for turning the lens by hand: the live video is measured at the centre of the frame (variance of the
      // Laplacian of a square crop) and the bar shows it against the best value seen since it was opened. Measuring needs the
      // image to be readable by the page: the displayed <img> is not (a crossorigin image does not send the relay's key cookie and
      // gets a 401), so the frame is downloaded with fetch() (it carries the key, 26-camera-key.js) from the photo address while the
      // live video keeps the relay's last frame fresh.
      // hooks = { isLive(), startLive(), startSnapshot(), stopSnapshot(), photoUrl(), notify(text), button(left, title, svg, onTap) }
      // -> { button, quiet() }  (quiet = drop the assistant without touching the stream: it is being cut or changed by someone else)
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

      // The parts the assistant draws over the panel: the dashed frame and the meter box -> {frame, meter, text, bar, hint, reset}
      // (reset is the button that restarts the peak: the caller adds its tap action)
      function cameraFocusParts(panel) {
        var frame = document.createElement("div");
        frame.style.cssText = "position:absolute;left:30%;top:30%;width:40%;height:40%;border:2px dashed #fff59d;box-sizing:border-box;pointer-events:none;z-index:1;display:none;";
        panel.appendChild(frame);
        var meter = document.createElement("div");
        meter.setAttribute("data-workshop-i18n", "");
        meter.style.cssText = "position:absolute;left:34px;right:34px;bottom:64px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,0.75);color:#fff;font:11px Roboto,sans-serif;z-index:2;display:none;pointer-events:none;";
        var text = document.createElement("div");
        var barBox = document.createElement("div");
        barBox.style.cssText = "height:10px;border-radius:5px;background:#37474f;margin:4px 0;overflow:hidden;";
        var bar = document.createElement("div");
        bar.style.cssText = "height:100%;width:0;background:#fbc02d;";
        barBox.appendChild(bar);
        var hint = document.createElement("div");
        hint.style.cssText = "color:#b0bec5;";
        var reset = document.createElement("button");
        reset.type = "button";
        reset.style.cssText = "pointer-events:auto;margin-top:4px;border:none;border-radius:10px;padding:2px 8px;background:#e0e0e0;color:#000;font:11px Roboto,sans-serif;cursor:pointer;touch-action:none;";
        reset.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); ev.preventDefault(); });
        [text, barBox, hint, reset].forEach(function (n) { meter.appendChild(n); });
        panel.appendChild(meter);
        return { frame: frame, meter: meter, text: text, bar: bar, hint: hint, reset: reset };

      }

      function cameraFocusAssemble(panel, img, hooks) {
        var on = false;
        var timer = null;
        var peak = 0;
        var now = 0;
        var wasLive = false;
        var busy = false;
        var failures = 0;
        var canvas = document.createElement("canvas");
        var parts = cameraFocusParts(panel);
        var frame = parts.frame, meter = parts.meter, text = parts.text, bar = parts.bar, hint = parts.hint, reset = parts.reset;
        reset.addEventListener("pointerup", function (ev) { ev.stopPropagation(); peak = 0; });

        function show(m) {
          now = now ? now * 0.5 + m.sharp * 0.5 : m.sharp;
          if (now > peak) peak = now;
          var pct = peak > 0 ? Math.round((now / peak) * 100) : 0;
          bar.style.width = pct + "%";
          bar.style.background = pct >= 95 ? "#43a047" : pct >= 75 ? "#fbc02d" : "#e53935";
          text.textContent = Math.round(now) + "  ·  " + i18nT('camera.focus_best') + " " + Math.round(peak);
          hint.textContent = m.dark ? i18nT('camera.focus_too_dark') : i18nT('camera.focus_hint');
        }

        // one measurement: downloads the last frame (the relay keeps it fresh while the video is live) and reads its centre
        function tick() {
          var url = hooks.photoUrl();
          if (busy || !url) return;
          busy = true;
          fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(), { cache: "no-store" })
            .then(function (r) {
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.blob();
            })
            .then(function (blob) { return createImageBitmap(blob); })
            .then(function (bitmap) {
              busy = false;
              failures = 0;
              if (!on) return;
              var m = cameraFocusMeasure(bitmap, canvas);
              if (m) show(m);
            })
            .catch(function () {
              busy = false;
              if (on && ++failures >= 8) stop(i18nT('camera.focus_cannot_measure'));
            });
        }

        function quiet() {
          on = false;
          clearInterval(timer);
          timer = null;
          frame.style.display = "none";
          meter.style.display = "none";
          btn.style.background = "#e0e0e0";
        }

        function stop(message) {
          if (!on) return;
          quiet();
          if (!wasLive) {
            img.removeAttribute("src");
            hooks.startSnapshot();
          }
          if (message) hooks.notify(message);
        }

        function start() {
          if (!img.getAttribute("src") && !hooks.isLive()) return; // nothing is being shown yet
          on = true;
          peak = 0;
          now = 0;
          failures = 0;
          wasLive = hooks.isLive();
          reset.textContent = i18nT('camera.focus_reset');
          text.textContent = "";
          bar.style.width = "0";
          hint.textContent = i18nT('camera.focus_hint');
          frame.style.display = "";
          meter.style.display = "";
          btn.style.background = "#fff59d";
          if (!wasLive) {
            hooks.stopSnapshot();
            hooks.startLive();
          }
          timer = setInterval(tick, 300);
        }

        var btn = hooks.button(154, i18nT('camera.focus_assistant'),
          '<path d="M12 8a4 4 0 100 8 4 4 0 000-8zM5 15H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4z"/>',
          function () { if (on) stop(); else start(); });
        return { button: btn, quiet: quiet };
      }
