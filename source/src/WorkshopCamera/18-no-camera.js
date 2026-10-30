      // ---- No camera added yet + searching the network for cameras (2026-10-24, from the new-user test) ----
      //
      // On a fresh install the camera relay (:8090) does not listen until the first camera has an address, so the page "Timelapses and
      // captures" could not read it and looked like a breakdown. When the service says that no camera is configured (camera.status ->
      // configured false, and no camera of its own in the list) that page says so clearly and lets the camera be added right there:
      // search the network (main action) or type the address of the stream. The search is also a button of the "Cameras" sheet.
      // It is made by the browser, asking every address of a PRIVATE network for the stream port of the ESP32-camera (:81), 32 at a time,
      // so the service needs nothing new. Saving the first camera is the call of the sheet, camera.url (the relay starts by itself).

      var CAMERA_SCAN_PORT = 81;
      var CAMERA_SCAN_PRIVATE = /^(10\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3})$/;

      // true when the service answers and says there is no camera at all
      function cameraNoCameraProbe() {
        return Promise.all([cameraStartupRelay(), cameraLoadList().catch(function () { return null; })]).then(function (r) {
          return !!r[0] && !r[0].error && cameraStartupStateCameras(cameraList, r[0]) === "missing";
        });
      }

      // true when something answers on the address (the headers arrive); the body of a stream is never read
      function cameraProbeHost(url, ms) {
        var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
        return fetch(url, { mode: "no-cors", cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(
          function () { clearTimeout(timer); if (ctl) ctl.abort(); return true; },
          function () { clearTimeout(timer); return false; }
        );
      }

      // Asks every address "prefix.1" .. "prefix.254" for the stream port, 32 at a time (prefix = "192.168.1", a private network only).
      // run = {stop: false}: set stop to true to cancel. found(url) for each answer, progress(done, total).
      function cameraScanNetwork(prefix, run, found, progress) {
        var next = 1, done = 0, total = 254;
        function worker() {
          if (run.stop || next > total) return Promise.resolve();
          var url = "http://" + prefix + "." + next++ + ":" + CAMERA_SCAN_PORT + "/stream";
          return cameraProbeHost(url, 1500).then(function (ok) {
            done++;
            if (ok && !run.stop) found(url);
            progress(done, total);
            return worker();
          });
        }
        var workers = [];
        for (var i = 0; i < 32; i++) workers.push(worker());
        return Promise.all(workers);
      }

      function cameraNoCameraPrefix() {
        var m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(window.location.hostname);
        return m && CAMERA_SCAN_PRIVATE.test(m[1]) ? m[1] : "";
      }

      // "host" of an address, to know whether a camera found is already in the list
      function cameraHostOf(url) {
        try { return new URL(String(url).replace("[HOSTNAME]", window.location.hostname)).hostname; } catch (e) { return ""; }
      }

      // Search box: network field + "Search cameras" + one button per camera found. el / btn are the caller's own element and button
      // makers (the page and the dark sheet look different). o = { primary, inputCss (style of the field), known(url) -> true if already added, pick(url), say(text, ok) }.
      function cameraScanBox(el, btn, o) {
        var box = el("div", "display:flex;flex-direction:column;gap:6px;");
        var row = el("div", "display:flex;gap:6px;flex-wrap:wrap;align-items:center;");
        var prefix = el("input", (o.inputCss || "") + "width:120px;box-sizing:border-box;");
        prefix.value = cameraNoCameraPrefix();
        prefix.placeholder = "192.168.1";
        prefix.title = i18nT("noCamera.network");
        var results = el("div", "display:flex;gap:6px;flex-wrap:wrap;");
        var run = { stop: true };
        var go = btn(i18nT("noCamera.scan_go"), o.primary ? "background:#1565c0;color:#fff;" : "", function () {
          if (!run.stop) { run.stop = true; return; }
          var p = prefix.value.trim();
          if (!CAMERA_SCAN_PRIVATE.test(p)) { o.say(i18nT("noCamera.scan_prefix"), false); return; }
          results.textContent = "";
          run = { stop: false };
          var mine = run, count = 0;
          go.textContent = i18nT("noCamera.scan_stop");
          cameraScanNetwork(p, mine, function (url) {
            if (o.known(url)) return;
            count++;
            results.appendChild(btn(cameraHostOf(url), "background:#2e7d32;color:#fff;", function () { o.pick(url); }));
          }, function (d, total) {
            if (!mine.stop) o.say(i18nT("noCamera.scanning", { done: d, total: total }));
          }).then(function () {
            mine.stop = true;
            go.textContent = i18nT("noCamera.scan_go");
            o.say(count ? i18nT("noCamera.scan_found", { n: count }) : i18nT("noCamera.scan_none"), count > 0 ? true : null);
          });
        });
        row.appendChild(el("span", "color:#b0bec5;font-size:12px;", i18nT("noCamera.network")));
        row.appendChild(prefix);
        row.appendChild(go);
        box.appendChild(row);
        box.appendChild(results);
        return box;
      }

      // The search inside the dark "Cameras" sheet: the box with its own status line, built once (the sheet repaints itself often).
      // o = { known(url), pick(url) }
      function cameraSheetScan(el, btn, o) {
        var wrap = el("div", "margin-top:8px;padding:6px;border-radius:6px;background:rgba(255,255,255,0.06);");
        var status = el("div", "margin-top:4px;font-size:11px;color:#ffe082;");
        wrap.appendChild(cameraScanBox(el, btn, {
          inputCss: "padding:5px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:#1e272c;color:#fff;font:12px monospace;",
          known: o.known, pick: o.pick, say: function (text) { status.textContent = text || ""; },
        }));
        wrap.appendChild(status);
        wrap.appendChild(el("div", "margin-top:4px;font-size:10px;color:#b0bec5;", i18nT("noCamera.scan_hint")));
        return wrap;
      }

      // The page itself, below the header (page = the page element, done() reloads the page once the camera is saved)
      function cameraNoCameraPage(page, done) {
        var card = cameraEl("div", "display:flex;flex-direction:column;gap:10px;");
        card.className = "ctl-card wf-card";
        var h = cameraEl("div", "");
        h.className = "ctl-title";
        h.appendChild(cameraEl("span", "")).className = "mdi mdi-camera-off-outline";
        h.appendChild(cameraEl("span", null, i18nT("noCamera.title")));
        card.appendChild(h);
        card.appendChild(cameraEl("div", null, i18nT("noCamera.body")));
        if (!cameraCanDo("settings")) {
          card.appendChild(cameraEl("div", null, i18nT("noCamera.ask_technician"))).className = "ctl-muted";
          page.appendChild(card);
          return;
        }
        var status = cameraEl("div", "min-height:18px;");
        function say(text, ok) {
          status.textContent = text || "";
          status.style.color = ok === false ? "var(--c-error,#ef9a9a)" : ok ? "var(--c-green,#a5d6a7)" : "var(--c-sec,#b0bec5)";
        }
        var url = cameraEl("input", CAMERA_CSS_SEL + "width:100%;box-sizing:border-box;");
        function save(u) {
          say(i18nT("common.saving"));
          workshopApiText("camera.url", { url: u })
            .then(function (t) {
              if (/error/i.test(t)) return say(t.trim(), false);
              say(i18nT("noCamera.saved"), true);
              setTimeout(done, 2500); // the relay opens its port a moment after the address is saved
            })
            .catch(function (e) { say(i18nT("common.could_not_save") + (e && e.message ? e.message : e), false); });
        }
        // 1. the search, the main action
        card.appendChild(cameraEl("div", "font-weight:500;", i18nT("noCamera.scan_title")));
        card.appendChild(cameraScanBox(cameraEl, cameraBtn, { primary: true, inputCss: CAMERA_CSS_SEL, known: function () { return false; }, say: say, pick: save }));
        card.appendChild(cameraEl("div", null, i18nT("noCamera.scan_hint"))).className = "ctl-muted";
        // 2. or the address by hand
        card.appendChild(cameraEl("div", "font-weight:500;margin-top:6px;", i18nT("noCamera.address")));
        url.placeholder = "http://192.168.1.50:81/stream";
        card.appendChild(url);
        card.appendChild(cameraEl("div", null, i18nT("noCamera.address_hint"))).className = "ctl-muted";
        function valid() {
          var u = url.value.trim();
          if (!/^https?:\/\/[^/\s]+/i.test(u)) { say(i18nT("noCamera.need_http"), false); return ""; }
          return u;
        }
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
        row.appendChild(cameraBtn(i18nT("noCamera.test"), "", function () {
          var u = valid();
          if (!u) return;
          say(i18nT("noCamera.testing"));
          cameraProbeHost(u, 4000).then(function (ok) { say(ok ? i18nT("noCamera.answers") : i18nT("noCamera.not_answering"), ok); });
        }));
        row.appendChild(cameraBtn(i18nT("noCamera.save"), "background:#2e7d32;color:#fff;", function () {
          var u = valid();
          if (u) save(u);
        }));
        card.appendChild(row);
        card.appendChild(status);
        // 3. what comes next
        card.appendChild(cameraEl("div", "font-weight:500;margin-top:6px;", i18nT("noCamera.next_title")));
        ["noCamera.next_1", "noCamera.next_2", "noCamera.next_3"].forEach(function (k) {
          card.appendChild(cameraEl("div", null, "- " + i18nT(k))).className = "ctl-muted";
        });
        page.appendChild(card);
      }
