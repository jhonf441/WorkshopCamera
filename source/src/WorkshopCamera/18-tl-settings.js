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
          ".ctl{--c-card:#263238;--c-interna:rgba(0,0,0,0.18);--c-edge:rgba(255,255,255,0.12);--c-text:#eceff1;--c-sec:var(--wf-n-role-text,#b0bec5);--c-field:#1e272c;--c-field-edge:rgba(255,255,255,0.3);--c-btn-edge:rgba(255,255,255,0.23);--c-neutro:#37474f;--c-blue:var(--wf-n-session-text,#90caf9);--c-green:#a5d6a7;--c-amber:var(--wf-n-down-text,#ffe082);--c-notice:var(--wf-n-down-text,#ffb74d);--c-error:#ef9a9a;--c-tab:rgba(255,255,255,0.6);color:var(--c-text);font-size:12px;}",
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
          // the groups of the side bar (the family draws their text; the room and the folded look are the page's own) and the count of the library
          ".ctl-nav .ctl-nav-group{padding:12px 12px 4px;}.ctl-nav.collapsed .ctl-nav-group{visibility:hidden;height:6px;padding:0;overflow:hidden;}",
          ".ctl-nav-count{margin-left:auto;padding:0 6px;}.ctl-nav.collapsed .ctl-nav-count{display:none;}",
          "@media (max-width:900px){.ctl-nav .ctl-nav-group,.ctl-nav.collapsed .ctl-nav-group{display:none;}}",
          // the Live tab: the pictures on the left and the buttons on the right (one column when it is narrow)
          ".ctl-live-two{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start;}@media (max-width:900px){.ctl-live-two{grid-template-columns:1fr;}}",
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
          // the judgement of a picture and the help to bring the camera back (14-health.js, 14-health-recover.js): a sub-card with numbered steps
          ".ctl-health{display:flex;flex-direction:column;gap:4px;margin-top:6px;}",
          ".ctl-recover{border-radius:8px;background:rgba(128,128,128,0.07);padding:8px 12px;}",
          ".ctl-recover>summary{cursor:pointer;font-weight:600;font-size:14px;min-height:32px;display:flex;align-items:center;}",
          ".ctl-rsteps{display:flex;flex-direction:column;gap:10px;padding-top:4px;}",
          ".ctl-rstep{display:flex;flex-direction:column;gap:4px;font-size:13px;}",
          ".ctl-rstep-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
          ".ctl-rnum{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid var(--c-sec);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;}",
          ".ctl-rhelp>summary{cursor:pointer;font-size:12px;color:var(--c-sec);min-height:28px;display:flex;align-items:center;}",
          ".ctl-rhelp>div{font-size:12px;padding-left:12px;}",
          ".ctl-rresult{font-size:12px;color:var(--c-amber);white-space:pre-wrap;}",
          ".ctl-mono{font-family:monospace;font-size:12px;white-space:pre;padding:6px 8px;border-radius:6px;background:var(--c-interna);}",
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
        box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT(workshopPluginActive("vision") ? 'tlSettings.the_system_service_the_camera_relay' : 'tlSettings.the_system_service_the_camera_relay_no_vision')));
        return box;
      }

      // The section "Storage and system" as ONE card of the family (mockup 2026-11-01): what is used, the fields of the limits in two columns,
      // the buttons (the control of the system relay is in the service page and in the bar, not here). The recording and the way the video is built are the form of the Live
      // tab (cameraTlForm) and the Studio; nothing numbered, no card inside the card.
      // b = draft of the config (modified); cfg = what is saved on the Pi.
      // o = {parent (where the card goes), rerender, save(b), undo(), usage: {videos_gb, free_gb, videos, captures}}
      function cameraSettingsComplete(b, cfg, o) {
        var card = studioCard(o.parent, "mdi-harddisk", i18nT('page.store_title'), i18nT('page.store_lead'));
        var u = o.usage || {};
        cameraStoreUsage(card, b, u);
        cameraStoreFields(card, b, u, o.rerender);
        cameraStoreActions(card, b, cfg, o);
        return card;
      }

      // "Free on the system: X GB" with a thin grey bar (what the videos take of the limit chosen for them) and the line of what is stored.
      function cameraStoreUsage(card, b, u) {
        var row = cameraEl("div", "display:flex;justify-content:space-between;gap:10px;font-size:13px;");
        var rowLabel = cameraEl("span", "opacity:.7;display:inline-flex;align-items:center;gap:4px;", i18nT('tlSettings.free_on_the_system'));
        rowLabel.appendChild(workshopHelpTipOf("camera_store"));
        row.appendChild(rowLabel);
        row.appendChild(cameraEl("b", null, u.free_gb != null ? u.free_gb + " GB" : "?"));
        card.appendChild(row);
        var cap = b.timelapses_gb || 5;
        var pct = u.videos_gb != null ? Math.max(0, Math.min(100, Math.round((u.videos_gb / cap) * 100))) : 0;
        var meter = cameraEl("div", "height:8px;border-radius:99px;background:var(--c-interna);border:1px solid var(--c-edge);overflow:hidden;");
        meter.className = "ctl-meter";
        meter.title = i18nT('page.store_meter', { used: u.videos_gb != null ? u.videos_gb : "?", cap: cap });
        meter.appendChild(cameraEl("div", "height:100%;background:var(--wf-icon,rgba(128,128,128,0.95));width:" + pct + "%;"));
        card.appendChild(meter);
        var line = [];
        if (u.videos_gb != null) line.push(i18nT('common.videos') + " " + u.videos_gb + " GB" + (u.videos != null ? " (" + u.videos + ")" : ""));
        if (u.captures != null) line.push(i18nT('common.captures') + " " + u.captures);
        if (line.length) card.appendChild(cameraEl("div", "font-size:13px;", line.join(" · ")));
        card.appendChild(cameraEl("div", null, i18nT('tlSettings.on_the_system_s_card_videos'))).className = "ctl-muted";
      }

      // A <select> of [value, text] options; a value that is not in the list is added (what is saved always shows).
      function cameraStoreSelect(options, current, onChange, rr) {
        var s = cameraEl("select", CAMERA_CSS_SEL + "width:100%;");
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
        s.addEventListener("change", function () { onChange(parseFloat(s.value)); rr(); });
        return s;
      }

      // The fields, two columns (one when it is narrow): space for the videos, how many videos and captures, the wait before deleting, the notice.
      function cameraStoreFields(card, b, u, rr) {
        var grid = cameraEl("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:4px;");
        function field(label, control) {
          var f = cameraEl("div", "display:flex;flex-direction:column;gap:4px;min-width:0;");
          f.appendChild(cameraEl("label", "font-size:12px;opacity:.7;", label));
          f.appendChild(control);
          grid.appendChild(f);
          return f;
        }
        // options according to the Pi's space (2026-10-10, "the values offered must match the free space"): what there is for videos
        // = what they already take + what is free - 2 GB reserve (with less nothing is recorded)
        var tl0 = (typeof cameraState !== "undefined" && cameraState && cameraState.timelapse) || {};
        var used = u.videos_gb != null ? u.videos_gb : tl0.videos_gb;
        var free = u.free_gb != null ? u.free_gb : tl0.disk_free_gb;
        var opsEsp = cameraOptionsSpace(used, free, b.timelapses_gb || 5);
        var fSpace = field(i18nT('tlSettings.space_for_the_videos'), cameraStoreSelect(opsEsp.list, b.timelapses_gb || 5, function (v) { b.timelapses_gb = v || 5; }, rr));
        if (opsEsp.notice) fSpace.appendChild(cameraEl("div", "color:var(--c-notice,#ffb74d);font-size:11px;", opsEsp.notice));
        field(i18nT('tlSettings.max_videos'), cameraStoreSelect([[10, "10"], [30, "30"], [60, "60"], [100, "100"], [200, "200"]], b.timelapses_max || 30, function (v) { b.timelapses_max = Math.round(v) || 30; }, rr));
        field(i18nT('tlSettings.max_captures'), cameraStoreSelect([[100, "100"], [300, "300"], [1000, "1000"], [3000, "3000"]], b.captures_max || 300, function (v) { b.captures_max = Math.round(v) || 300; }, rr));
        field(i18nT('tlSettings.notify_and_wait_before_deleting'), cameraStoreSelect([[1, "1 h"], [6, "6 h"], [24, i18nT('tlSettings.1_day')], [72, i18nT('tlSettings.3_days')], [168, i18nT('tlSettings.7_days')]], b.delete_wait_h || 24, function (v) { b.delete_wait_h = Math.round(v) || 24; }, rr));
        field(i18nT('tlSettings.notify_if_a_camera_stops_responding'), cameraStoreSelect([[1, i18nT('page.notify_yes')], [0, i18nT('page.notify_no')]], b.notice_drop ? 1 : 0, function (v) { b.notice_drop = !!v; }, rr));
        card.appendChild(grid);
        card.appendChild(cameraEl("div", null, i18nT('tlSettings.when_a_limit_is_exceeded_the'))).className = "ctl-muted";
      }

      // Undo changes and Save settings (applies to all the screens), at the end of the card.
      function cameraStoreActions(card, b, cfg, o) {
        var changed = cfg && JSON.stringify(cfg) !== JSON.stringify(b);
        var fg = cameraEl("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;");
        var undo = cameraBtn(i18nT('tlSettings.discard_changes'), "", function () { o.undo(); });
        undo.disabled = !changed;
        var save = cameraBtn(i18nT('tlSettings.save_settings'), changed ? "background:#1976d2;color:#fff;" : "", function () { o.save(b); });
        save.disabled = !changed;
        fg.appendChild(undo);
        fg.appendChild(save);
        fg.appendChild(cameraEl("span", changed ? "color:var(--c-amber,#ffe082);font-size:12px;" : "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT(changed ? 'tlSettings.there_are_unsaved_changes' : 'tlSettings.saved_on_the_system_for_every')));
        card.appendChild(fg);
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
