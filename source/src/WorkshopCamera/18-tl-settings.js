      // ---- Capture and timelapse settings, grouped (2026-10-10) ----
      //
      // Request: "I do not know where things are configured, for example the
      // storage for images and timelapse, and it does not say how they are
      // assembled either". The same settings in the viewer's sheet and in the
      // Timelapses and captures page, in four groups with a title: Recording, How the
      // video is assembled, Where it is saved and Phone notices. Everything is done by the
      // Pi's Service (camera relay, :8090) with ffmpeg: it does not use Vision
      // nor OpenCV.

      var CAMERA_CSS_SEL = "padding:4px;min-height:32px;border-radius:4px;background:var(--c-field,#1e272c);color:var(--c-text,#fff);border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));font:inherit;";

      // DESIGN.md style (2026-10-10, "apply the styles already defined"):
      // variables with the dark palette (floating panels: the viewer's sheet) and
      // the light one under .theme--light (the page follows DWC's theme). The
      // elements use var(--c-..., dark value), so the floating sheet stays
      // the same and 03-theme.js turns it light like the other panels.
      function cameraTlCss() {
        if (document.getElementById("workshop-tl-css")) return;
        var st = document.createElement("style");
        st.id = "workshop-tl-css";
        workshopInjectFamily(); // the design family (wf-* classes), once per page
        st.textContent = workshopCss([
          ".ctl{--c-card:#263238;--c-interna:rgba(0,0,0,0.18);--c-edge:rgba(255,255,255,0.12);--c-text:#eceff1;--c-sec:#b0bec5;--c-field:#1e272c;--c-field-edge:rgba(255,255,255,0.3);--c-btn-edge:rgba(255,255,255,0.23);--c-neutro:#37474f;--c-blue:#90caf9;--c-green:#a5d6a7;--c-amber:#ffe082;--c-notice:#ffb74d;--c-error:#ef9a9a;--c-tab:rgba(255,255,255,0.6);color:var(--c-text);font-size:12px;}",
          ".theme--light .ctl{--c-card:#ffffff;--c-interna:#f5f7f8;--c-edge:rgba(0,0,0,0.12);--c-text:#212121;--c-sec:#616161;--c-field:#ffffff;--c-field-edge:rgba(0,0,0,0.23);--c-btn-edge:rgba(0,0,0,0.23);--c-neutro:#eceff1;--c-blue:#1565c0;--c-green:#2e7d32;--c-amber:#8d6e00;--c-notice:#b26a00;--c-error:#c62828;--c-tab:rgba(0,0,0,0.54);}",
          // ---- the design family (src/_shared/05-family-css.js) draws the bar, the menu, the cards, the buttons and the states (wf-*);
          // below only the layout of the page and the content that is the Camera's own ----
          ".ctl-with-nav{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:14px;row-gap:12px;align-items:start;}",
          ".ctl-with-nav>*{grid-column:2;min-width:0;}",
          ".ctl-with-nav>.wf-bar:first-child{grid-column:1/-1;}",
          ".ctl-with-nav>.ctl-nav{grid-column:1;grid-row:2/span 60;position:sticky;top:64px;width:190px;display:flex;flex-direction:column;padding:0 4px 8px 0;z-index:3;}",
          ".ctln-head{display:flex;align-items:center;justify-content:space-between;}.ctl-nav.collapsed .ctln-head{flex-direction:column-reverse;justify-content:center;}",
          ".ctln-pin{width:auto!important;min-width:32px;padding:0 8px!important;display:inline-flex;align-items:center;gap:4px;font-size:12px;opacity:.85!important;}.ctln-pin.pinned{opacity:1!important;}.ctl-nav.collapsed .ctln-pin{width:32px!important;padding:0!important;justify-content:center;}",
          ".ctln-fold{align-self:flex-end;height:32px;width:32px;border:none;border-radius:6px;background:transparent;color:inherit;opacity:.7;cursor:pointer;}.ctln-fold:hover{background:rgba(128,128,128,0.12);opacity:1;}",
          ".ctl-nav-item{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 12px;text-align:left;cursor:pointer;}",
          "@media (pointer:coarse),(max-width:599px){.ctl-nav-item{min-height:44px;}}",
          ".ctl-nav.collapsed{width:52px;overflow:hidden;}.ctl-nav.collapsed .tx{display:none;}.ctl-nav.collapsed .ctl-nav-item{justify-content:center;padding:6px 0;}",
          ".ctl-with-nav>.ctl-nav.collapsed{width:52px;}.ctl-nav.collapsed .ctln-fold{align-self:center;}",
          "@media (max-width:900px){.ctl-with-nav{display:block;}.ctl-with-nav>.ctl-nav,.ctl-with-nav>.ctl-nav.collapsed{position:static;flex-direction:row;flex-wrap:wrap;width:auto;padding:0 0 4px;margin-bottom:10px;}.ctl-nav-item,.ctl-nav.collapsed .ctl-nav-item{width:auto;justify-content:flex-start;padding:6px 8px;}.ctl-nav.collapsed .tx{display:block;}.ctln-fold{display:none;}}",
          ".ctl-page{--wf-badge:#6d4c41;--wf-sec:#6d4c41;}",
          ".ctl-card.wf-card{display:flex;flex-direction:column;gap:8px;min-width:0;}",
          ".ctl-gp{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:13px;}",
          ".ctl-title{font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;}",
          ".ctl-title .mdi{font-size:20px;color:var(--wf-icon,rgba(128,128,128,0.95));}",
          ".ctl-click{cursor:pointer;}",
          ".ctl-on{border-color:var(--wf-icon,rgba(128,128,128,0.95));font-weight:600;}",
          ".ctl-danger{color:var(--wf-err,#e53935);border-color:var(--wf-err,#e53935);}",
          ".ctl-page .ctl-group-t{font-size:16px;font-weight:600;}",
          ".ctl-page .ctl-muted{font-size:12px;}",
          ".ctl-section{font-size:16px;font-weight:600;margin:12px 0 8px;}",
          // messages: a thin outline of the color of the meaning, no tint
          ".ctl-alert{padding:8px 12px;border:1px solid var(--c-sec);border-radius:10px;margin-bottom:8px;}",
          ".ctl-alert.blue{border-color:var(--wf-info,#1e88e5);}.ctl-alert.red{border-color:var(--wf-err,#e53935);}.ctl-alert.green{border-color:var(--wf-ok,#43a047);}.ctl-alert.amber{border-color:var(--wf-warn,#fb8c00);}",
          ".ctl-mini{border-radius:8px;overflow:hidden;border:1px solid rgba(128,128,128,0.3);display:flex;flex-direction:column;}",
          ".ctl-mini.sel{border-color:var(--wf-accent,#1976d2);}",
          ".ctl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;align-items:start;}",
          ".ctl-muted{color:var(--c-sec);font-size:11px;}",
          ".ctl input[type=datetime-local],.ctl input[type=text],.ctl input:not([type]){background:var(--c-field);color:var(--c-text);border:1px solid var(--c-field-edge);border-radius:4px;min-height:32px;padding:4px 8px;font:inherit;box-sizing:border-box;}",
          ".ctl .ctl-live{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;}",
          ".ctl .ctl-live img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#000;border-radius:6px;display:block;}",
          ".ctl-group{border:1px solid var(--c-edge);border-radius:8px;padding:10px;background:var(--c-interna);display:flex;flex-direction:column;gap:6px;font-size:12px;}",
          ".ctl-group-t{font-weight:bold;font-size:13px;}",
          ".ctl.ctl-page{--c-card:#1e1e1e;--c-interna:rgba(128,128,128,0.09);--c-text:#fff;--c-sec:rgba(255,255,255,0.7);--c-field:#1e1e1e;font-size:14px;font-family:Roboto,sans-serif;padding:0;width:100%;box-sizing:border-box;}",
          ".theme--light .ctl.ctl-page{--c-card:#ffffff;--c-interna:#f5f7f8;--c-text:#212121;--c-sec:rgba(0,0,0,0.6);--c-field:#ffffff;}",
          ".ctl-sub{font-size:14px;color:var(--c-sec);}",
        ]);
        document.head.appendChild(st);
      }

      // Explicacion corta, en pasos
      function cameraAsWorks() {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:6px;font-size:12px;");
        [
          ["1", i18nT('tlSettings.takes_photos'), i18nT('tlSettings.while_it_runs_by_hand_or')],
          ["2", i18nT('tlSettings.builds_the_video'), i18nT('tlSettings.when_it_stops_the_system_joins')],
          ["3", i18nT('tlSettings.it_s_saved'), i18nT('tlSettings.the_video_shows_up_in_videos')],
        ].forEach(function (p) {
          var f = cameraEl("div", "display:flex;gap:8px;align-items:flex-start;");
          f.appendChild(cameraEl("span", "flex:none;width:22px;height:22px;border-radius:50%;background:#1976d2;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;", p[0]));
          var tx = cameraEl("div", "min-width:0;");
          tx.appendChild(cameraEl("div", "font-weight:bold;", p[1]));
          tx.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", p[2]));
          f.appendChild(tx);
          box.appendChild(f);
        });
        box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT(workshopPathExists("/Plugins/Vision") ? 'tlSettings.the_system_service_the_camera_relay' : 'tlSettings.the_system_service_the_camera_relay_no_vision')));
        return box;
      }

      // b = draft of the config (modified); cfg = what is saved on the Pi.
      // o = {rerender, guardar(b) -> Promise, uso: {videos_gb, free_gb, videos, capturas}, columnas}
      function cameraSettingsComplete(b, cfg, o) {
        var rr = o.rerender;
        var root = cameraEl("div", "display:flex;flex-direction:column;gap:10px;");
        var grid = cameraEl("div", o.columns ? "display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px;align-items:start;" : "display:flex;flex-direction:column;gap:10px;");
        root.appendChild(grid);

        function group(num, title, sub) {
          var g = cameraEl("div", "");
          g.className = o.columns ? "wf-card ctl-gp" : "ctl-group"; // the page: a card of the family; the viewer's sheet: its own panel box
          var cab = cameraEl("div", "display:flex;align-items:center;gap:8px;");
          var ix = cameraEl("span", o.columns ? "" : "flex:none;width:22px;height:22px;border-radius:50%;background:var(--c-neutro,#37474f);color:var(--c-blue,#90caf9);display:inline-flex;align-items:center;justify-content:center;font-weight:bold;", num); if (o.columns) ix.className = "wf-index"; cab.appendChild(ix); // the page: the numbered circle of the family; the sheet: its own
          cab.appendChild(cameraEl("span", "", title)).className = "ctl-group-t";
          g.appendChild(cab);
          if (sub) g.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", sub));
          grid.appendChild(g);
          return g;
        }
        function casilla(text, value, alChange) {
          var l = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;");
          var cb = cameraEl("input");
          cb.type = "checkbox";
          cb.checked = !!value;
          cb.style.cssText = "width:18px;height:18px;flex:none;";
          cb.addEventListener("change", function () { alChange(cb.checked); rr(); });
          l.appendChild(cb);
          l.appendChild(cameraEl("span", null, text));
          return l;
        }
        function choose(text, options, current, alChange, after) {
          var f = cameraEl("div", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
          f.appendChild(cameraEl("span", null, text));
          var s = cameraEl("select", CAMERA_CSS_SEL);
          var has = false;
          options.forEach(function (op) {
            var e = cameraEl("option", null, op[1]);
            e.value = String(op[0]);
            if (op[0] === current) { e.selected = true; has = true; }
            s.appendChild(e);
          });
          if (!has) {
            var e2 = cameraEl("option", null, String(current));
            e2.value = String(current);
            e2.selected = true;
            s.appendChild(e2);
          }
          s.addEventListener("change", function () { alChange(parseFloat(s.value)); rr(); });
          f.appendChild(s);
          if (after) f.appendChild(cameraEl("span", "color:var(--c-sec,#b0bec5);", after));
          return f;
        }

        // 1. Grabacion
        var g1 = group("1", i18nT('tlSettings.recording'), i18nT('tlSettings.which_cameras_how_often_a_photo'));
        g1.appendChild(casilla(i18nT('tlSettings.timelapse_of_every_job_starts_and'), b.timelapse.active, function (v) { b.timelapse.active = v; }));
        g1.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('tlSettings.off_it_only_records_when_you')));
        g1.appendChild(cameraTlSettings(b.timelapse, rr, "record"));

        // 2. How it is assembled
        var g2 = group("2", i18nT('common.how_the_video_is_built'), i18nT('tlSettings.when_it_stops_the_system_joins_2'));
        g2.appendChild(cameraTlSettings(b.timelapse, rr, "video"));

        // 3. Where it is saved
        var g3 = group("3", i18nT('tlSettings.where_it_s_stored'), null);
        g3.appendChild(cameraEl("div", null, i18nT('tlSettings.on_the_system_s_card_videos')));
        var u = o.usage || {};
        var lineUse = [];
        if (u.videos_gb != null) lineUse.push(i18nT('common.videos') + ": " + u.videos_gb + " GB" + (u.videos != null ? " (" + u.videos + ")" : ""));
        if (u.captures != null) lineUse.push(i18nT('common.captures') + ": " + u.captures);
        if (u.free_gb != null) lineUse.push(i18nT('tlSettings.free_on_the_system') + ": " + u.free_gb + " GB");
        if (lineUse.length) g3.appendChild(cameraEl("div", "color:var(--c-blue,#90caf9);", lineUse.join(" · ")));
        // options according to the Pi's space (2026-10-10, "the values
        // offered must match the free space"): what there is for videos
        // = what they already take + what is free - 2 GB reserve (with less nothing is recorded)
        var tl0 = (typeof cameraState !== "undefined" && cameraState && cameraState.timelapse) || {};
        var used = u.videos_gb != null ? u.videos_gb : tl0.videos_gb;
        var free = u.free_gb != null ? u.free_gb : tl0.disk_free_gb;
        var opsEsp = cameraOptionsSpace(used, free, b.timelapses_gb || 5);
        g3.appendChild(choose(i18nT('tlSettings.space_for_the_videos'), opsEsp.list, b.timelapses_gb || 5, function (v) { b.timelapses_gb = v || 5; }));
        if (opsEsp.notice) g3.appendChild(cameraEl("div", "color:var(--c-notice,#ffb74d);font-size:11px;", opsEsp.notice));
        g3.appendChild(choose(i18nT('tlSettings.max_videos'), [[10, "10"], [30, "30"], [60, "60"], [100, "100"], [200, "200"]], b.timelapses_max || 30, function (v) { b.timelapses_max = Math.round(v) || 30; }));
        g3.appendChild(choose(i18nT('tlSettings.max_captures'), [[100, "100"], [300, "300"], [1000, "1000"], [3000, "3000"]], b.captures_max || 300, function (v) { b.captures_max = Math.round(v) || 300; }));
        g3.appendChild(choose(i18nT('tlSettings.notify_and_wait_before_deleting'), [[1, "1 h"], [6, "6 h"], [24, i18nT('tlSettings.1_day')], [72, i18nT('tlSettings.3_days')], [168, i18nT('tlSettings.7_days')]], b.delete_wait_h || 24, function (v) { b.delete_wait_h = Math.round(v) || 24; }));
        g3.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('tlSettings.when_a_limit_is_exceeded_the')));

        // 4. Avisos al celular
        var g4 = group("4", i18nT('tlSettings.phone_notifications'), null);
        g4.appendChild(casilla(i18nT(workshopPathExists("/Plugins/Activity") ? 'tlSettings.camera_photo_or_video_in_the' : 'tlSettings.camera_photo_or_video_in_the_no_activity'), b.photo_notice, function (v) { b.photo_notice = v; }));
        g4.appendChild(casilla(i18nT('tlSettings.notify_if_a_camera_stops_responding'), b.notice_drop, function (v) { b.notice_drop = v; }));

        // Save (applies to all the screens)
        var changed = cfg && JSON.stringify(cfg) !== JSON.stringify(b);
        var fg = cameraEl("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap;");
        var bg = cameraBtn(i18nT('tlSettings.save_settings'), changed ? "background:#1976d2;color:#fff;" : "", function () { o.save(b); });
        bg.disabled = !changed;
        fg.appendChild(bg);
        if (changed) {
          fg.appendChild(cameraBtn(i18nT('tlSettings.discard_changes'), "", function () { o.undo(); }));
          fg.appendChild(cameraEl("span", "color:var(--c-amber,#ffe082);font-size:12px;", i18nT('tlSettings.there_are_unsaved_changes')));
        } else fg.appendChild(cameraEl("span", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('tlSettings.saved_on_the_system_for_every')));
        root.appendChild(fg);
        return root;
      }

      // Space options for videos from what the Pi has: 10, 25,
      // 50 and 75 % of what is available (videos + free - 2 GB), rounded, plus the
      // current value. Without data from the Pi: the fixed list from before.
      function cameraOptionsSpace(used, free, current) {
        if (used == null || free == null) return { list: [[1, "1 GB"], [2, "2 GB"], [5, "5 GB"], [10, "10 GB"], [20, "20 GB"]] };
        var disp = Math.max(0, used + free - 2);
        function redondo(g) {
          return g < 5 ? Math.max(0.5, Math.round(g * 2) / 2) : Math.round(g);
        }
        var vals = [];
        [0.1, 0.25, 0.5, 0.75].forEach(function (f) {
          var g = redondo(disp * f);
          if (disp >= 0.5 && vals.indexOf(g) < 0) vals.push(g);
        });
        if (current && vals.indexOf(current) < 0) vals.push(current);
        vals.sort(function (x, y) { return x - y; });
        var items = vals.map(function (g) {
          var pct = disp > 0 ? Math.round((g / disp) * 100) : 0;
          return [g, g + " GB" + (pct ? " (" + pct + " % " + i18nT('tlSettings.of_what_is_available') + ")" : "")];
        });
        var notice = "";
        if (disp < 0.5) notice = i18nT('tlSettings.the_system_has_almost_no_free');
        else if (current > disp) notice = i18nT('tlSettings.the_current_value_is_more_than_gb', { gb: disp.toFixed(1) });
        return { list: items.length ? items : [[current || 1, (current || 1) + " GB"]], notice: notice };
      }
