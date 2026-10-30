      // ---- Studio: cinema controls of the timelapse (2026-10-24) ----
      //
      // Request: "redesign the timelapse and capture plugin, aimed at film editors: more control, more functions". One section of the
      // "Timelapses and captures" page with five cards: preview (a still of the camera with the framing and the grade already applied,
      // made by the relay), capture (interval, interval ramp, stills kept for the editor), framing (aspect, resolution, position,
      // slow push), color (grade, LUT, virtual shutter) and delivery (codec, quality, frame rate, fades). It edits the draft of the
      // settings (`borrador.timelapse`): "Save" makes it the default, "Record a take" starts one with these settings only.
      // The relay checks and limits every key (timelapse_look.py); here only the controls.

      var STUDIO_PRESETS = [
        ["web", "mdi-web", { codec: "h264", quality: 2, resolution: 1080, fps: 30, aspect: "source", blend: 1, keep_frames: false }],
        ["cinema", "mdi-movie-open-star-outline", { codec: "h264", quality: 3, resolution: 1080, fps: 23.976, aspect: "2.39:1", blend: 2, fade_in_s: 0.5, fade_out_s: 1, contrast: 1.08, saturation: 1.1, title: false, final_s: 0 }],
        ["prores", "mdi-filmstrip-box-multiple", { codec: "prores", quality: 3, resolution: 0, fps: 24, aspect: "source", blend: 1, keep_frames: true, title: false, final_s: 0, fade_in_s: 0, fade_out_s: 0 }],
        ["dnxhr", "mdi-filmstrip-box", { codec: "dnxhr", quality: 3, resolution: 0, fps: 25, aspect: "source", blend: 1, keep_frames: true, title: false, final_s: 0, fade_in_s: 0, fade_out_s: 0 }],
        ["vertical", "mdi-cellphone", { codec: "h264", quality: 3, resolution: 1080, fps: 30, aspect: "9:16", blend: 1 }],
        ["draft", "mdi-speedometer", { codec: "h264", quality: 1, resolution: 720, fps: 24, aspect: "source", blend: 1, keep_frames: false }],
      ];
      var STUDIO_PRESET_KEYS = ["each_s", "fps", "armed", "title", "title_style", "final_s", "deflicker", "stamp", "codec", "quality", "bit10", "resolution", "aspect", "pan_x", "pan_y", "zoom_start", "zoom_end", "end_x", "end_y", "brightness", "contrast", "saturation", "gamma", "lut", "blend", "fade_in_s", "fade_out_s", "each_end_s", "ramp_min", "keep_frames", "stabilize"];
      var STUDIO_FPS = [[12, "12"], [15, "15"], [23.976, "23.976"], [24, "24"], [25, "25"], [29.97, "29.97"], [30, "30"], [50, "50"], [59.94, "59.94"], [60, "60"], [120, "120"]];

      function studioCss() {
        if (document.getElementById("workshop-studio-css")) return;
        var st = document.createElement("style");
        st.id = "workshop-studio-css";
        st.textContent = [
          ".cst-row{display:grid;grid-template-columns:minmax(110px,150px) minmax(0,1fr);gap:8px;align-items:center;min-height:32px;}",
          ".cst-row>label{color:var(--c-sec);font-size:12px;}",
          ".cst-range{display:flex;align-items:center;gap:8px;min-width:0;}.cst-range input[type=range]{flex:1;min-width:0;accent-color:#1976d2;}",
          ".cst-val{min-width:54px;text-align:right;font-variant-numeric:tabular-nums;font-size:12px;}",
          ".cst-pre{width:100%;aspect-ratio:16/9;object-fit:contain;background:#000;border-radius:4px;display:block;}",
          ".cst-chips{display:flex;flex-wrap:wrap;gap:6px;}",
          ".cst-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--c-btn-edge);background:transparent;color:var(--c-text);font:inherit;font-size:12px;cursor:pointer;}",
          ".cst-chip.on{border-color:#1976d2;background:transparent;font-weight:600;}",
          ".cst-chip .mdi{font-size:16px;color:var(--wf-icon,rgba(128,128,128,0.95));}",
          ".cst-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;align-items:start;}",
          ".cst-est{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;}.cst-est>div{background:var(--c-interna);border-radius:4px;padding:6px 8px;}.cst-est b{display:block;font-size:15px;font-weight:500;}",
        ].join("\n");
        document.head.appendChild(st);
      }

      function studioCard(parent, icon, title, sub) {
        var c = cameraEl("div", "");
        c.className = "ctl-card wf-card";
        var h = cameraEl("div", "");
        h.className = "ctl-title";
        h.appendChild(cameraEl("span", "")).className = "mdi " + icon;
        h.appendChild(cameraEl("span", null, title));
        c.appendChild(h);
        if (sub) c.appendChild(cameraEl("div", null, sub)).className = "ctl-muted";
        parent.appendChild(c);
        return c;
      }

      function studioRow(label, control) {
        var r = cameraEl("div", "");
        r.className = "cst-row";
        r.appendChild(cameraEl("label", null, label));
        r.appendChild(control);
        return r;
      }

      // slider: the value and the preview follow the finger; the page is only redrawn when it is released
      function studioRange(S, key, min, max, step, fmt) {
        var t = S.t;
        var box = cameraEl("div", "");
        box.className = "cst-range";
        var inp = cameraEl("input", "");
        inp.type = "range";
        inp.min = String(min);
        inp.max = String(max);
        inp.step = String(step);
        inp.value = String(t[key] != null ? t[key] : min);
        var val = cameraEl("span", null, fmt(parseFloat(inp.value)));
        val.className = "cst-val";
        inp.addEventListener("input", function () {
          t[key] = parseFloat(inp.value);
          val.textContent = fmt(t[key]);
          S.preview();
        });
        inp.addEventListener("change", function () { S.rerender(); });
        box.appendChild(inp);
        box.appendChild(val);
        return box;
      }

      function studioSelect(S, key, options, numeric, disabledMap) {
        var sel = cameraEl("select", CAMERA_CSS_SEL + "min-width:0;max-width:100%;");
        if (!options.some(function (o) { return String(o[0]) === String(S.t[key]); })) options = options.concat([[S.t[key], String(S.t[key])]]);
        options.forEach(function (o) {
          var e = cameraEl("option", null, o[1]);
          e.value = String(o[0]);
          if (disabledMap && disabledMap[o[0]] === false) {
            e.disabled = true;
            e.textContent += " · " + i18nT("studio.not_available");
          }
          if (String(o[0]) === String(S.t[key])) e.selected = true;
          sel.appendChild(e);
        });
        sel.addEventListener("change", function () {
          S.t[key] = numeric ? parseFloat(sel.value) : sel.value;
          S.rerender();
        });
        return sel;
      }

      function studioCheck(S, key, text) {
        var l = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;");
        var cb = cameraEl("input", "width:18px;height:18px;flex:none;");
        cb.type = "checkbox";
        cb.checked = !!S.t[key];
        cb.addEventListener("change", function () { S.t[key] = cb.checked; S.rerender(); });
        l.appendChild(cb);
        l.appendChild(cameraEl("span", null, text));
        return l;
      }

      function studioNumber(S, key, min, max, step, unit) {
        var box = cameraEl("div", "display:flex;align-items:center;gap:6px;");
        var n = cameraEl("input", CAMERA_CSS_SEL + "width:84px;");
        n.type = "number";
        n.min = String(min);
        n.max = String(max);
        n.step = String(step);
        n.value = S.t[key] != null ? S.t[key] : "";
        n.addEventListener("change", function () {
          var v = parseFloat(n.value);
          if (!isNaN(v)) S.t[key] = Math.max(min, Math.min(max, v));
          S.rerender();
        });
        box.appendChild(n);
        if (unit) box.appendChild(cameraEl("span", "color:var(--c-sec);", unit));
        return box;
      }

      // The keys the relay needs to draw the preview (or to start a take); the rest of the draft does not travel.
      function studioTake(t) {
        var o = {};
        Object.keys(t).forEach(function (k) {
          if (k !== "active" && k !== "camera" && k !== "trigger") o[k] = t[k];
        });
        return o;
      }

      function studioPreviewCard(parent, S) {
        var c = studioCard(parent, "mdi-image-filter-center-focus-strong-outline", i18nT("studio.preview"), i18nT("studio.preview_hint"));
        var cams = (S.est && S.est.cameras) || [];
        if (!S.cam || !cams.some(function (x) { return x.id === S.cam; })) S.cam = (cams[0] && cams[0].id) || "main";
        if (cams.length > 1) {
          var chips = cameraEl("div", "");
          chips.className = "cst-chips";
          cams.forEach(function (x) {
            var b = cameraEl("button", null, x.name);
            b.type = "button";
            b.className = "cst-chip" + (x.id === S.cam ? " on" : "");
            b.addEventListener("click", function () { S.cam = x.id; cameraTlStudio.keep.cam = S.cam; S.rerender(); });
            chips.appendChild(b);
          });
          c.appendChild(chips);
        }
        var img = cameraEl("img", "");
        img.className = "cst-pre";
        var info = cameraEl("div", null, "");
        info.className = "ctl-muted";
        var timer = null;
        var own = cameraOwnError(img);
        function load() {
          clearTimeout(timer);
          timer = cameraTlStudio.pending = setTimeout(function () {
            cameraTlStudio.pending = null;
            if (!img.isConnected) return; // the tab was left while the timer waited
            own.clear();
            img.src = cameraRelayBase() + "/timelapse/preview?c=" + encodeURIComponent(S.cam) + "&cfg=" + encodeURIComponent(JSON.stringify(studioTake(S.t))) + "&_=" + Date.now();
          }, 250);
        }
        img.addEventListener("error", function () { info.textContent = i18nT("studio.preview_unavailable"); });
        img.addEventListener("load", function () { info.textContent = i18nT("studio.preview_shows", { w: img.naturalWidth, h: img.naturalHeight }); });
        S.preview = load;
        c.appendChild(img);
        c.appendChild(info);
        c.appendChild(cameraBtn(i18nT("studio.refresh_preview"), "align-self:flex-start;", load));
        load();
        return c;
      }

      function studioPresetsCard(parent, S) {
        var c = studioCard(parent, "mdi-bookmark-multiple-outline", i18nT("studio.presets"), i18nT("studio.presets_hint"));
        var chips = cameraEl("div", "");
        chips.className = "cst-chips";
        function apply(p) {
          Object.keys(p).forEach(function (k) { S.t[k] = p[k]; });
          S.rerender();
        }
        STUDIO_PRESETS.forEach(function (p) {
          var b = cameraEl("button", "");
          b.type = "button";
          b.className = "cst-chip";
          b.appendChild(cameraEl("span", "")).className = "mdi " + p[1];
          b.appendChild(cameraEl("span", null, i18nT("studio.preset_" + p[0])));
          b.title = i18nT("studio.preset_" + p[0] + "_hint");
          b.addEventListener("click", function () { apply(p[2]); });
          chips.appendChild(b);
        });
        var mine = S.draft.presets || {};
        Object.keys(mine).forEach(function (name) {
          var b = cameraEl("button", "");
          b.type = "button";
          b.className = "cst-chip";
          b.appendChild(cameraEl("span", "")).className = "mdi mdi-account-star-outline";
          b.appendChild(cameraEl("span", null, name));
          b.addEventListener("click", function () { apply(mine[name]); });
          chips.appendChild(b);
        });
        c.appendChild(chips);
        studioPresetsSave(c, S);
        return c;
      }

      function studioPresetsSave(c, S) {
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;align-items:center;");
        var nm = cameraEl("input", CAMERA_CSS_SEL + "flex:1;min-width:120px;");
        nm.placeholder = i18nT("studio.preset_name");
        nm.maxLength = 40;
        row.appendChild(nm);
        row.appendChild(cameraBtn(i18nT("studio.save_preset"), "", function () {
          var name = nm.value.replace(/\s+/g, " ").trim();
          if (!name) return;
          var p = {};
          STUDIO_PRESET_KEYS.forEach(function (k) { p[k] = S.t[k]; });
          S.draft.presets = S.draft.presets || {};
          S.draft.presets[name] = p;
          S.rerender();
        }));
        var names = Object.keys(S.draft.presets || {});
        if (names.length) {
          row.appendChild(cameraBtn(i18nT("studio.delete_presets"), "", function () { S.draft.presets = {}; S.rerender(); }));
        }
        c.appendChild(row);
        c.appendChild(cameraEl("div", null, i18nT("studio.presets_saved_with_settings"))).className = "ctl-muted";
      }
