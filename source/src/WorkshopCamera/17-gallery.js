      // ---- "Timelapses and captures" page (Plugins, 2026-10-10) ----
      //
      // Request: "how are timelapses managed: delete, edit, download;
      // there should be something that extends those functions". The viewer's sheet
      // stays for quick things; here: view large, rename, download, delete
      // several, and edit a video (trim and change speed: the Pi builds
      // a NEW one and the original stays). Everything lives in the Pi's relay.

      var CAMERA_GAL_PATH = "/Plugins/Timelapses";

      function cameraDate(ts) {
        var d = new Date(ts * 1000);
        var dd = function (n) { return (n < 10 ? "0" : "") + n; };
        return dd(d.getDate()) + "/" + dd(d.getMonth() + 1) + " " + dd(d.getHours()) + ":" + dd(d.getMinutes());
      }

      function cameraPost(path) {
        return fetch(cameraRelayBase() + path, { method: "POST" }).then(function (r) {
          return r.json().catch(function () {
            return { ok: false, error: "HTTP " + r.status };
          });
        });
      }

      // Start-up chip (19-startup.js): the same one as the Cameras sheet, in the page header next to the other chips; its rows are the captures
      // folder and the timelapse needs (video tool, system clock). It is asked once, when the page opens.
      function cameraGalStartupAssemble(puesta) {
        if (!puesta.mounted) { puesta.mounted = true; puesta.refresh(); }
      }

      function cameraAssembleGallery(root) {
        if (!cameraCanDo("gallery")) return cameraGalleryDenied(root); // 13-service-views.js
        cameraTlCss();
        var page = cameraEl("div", ""); // full width (2026-10-10: "no ocupa el espacio completo"), see .ctl-page
        page.className = "ctl ctl-page workshop-theme";
        page.setAttribute("data-workshop-i18n", "");
        root.appendChild(page);
        var tls = null, caps = null, est = null, noCam = false; // noCam: the service says no camera is added yet (18-no-camera.js)
        var pb = null; // {items: [{archivo, tipo, motivo, hasta}], wait_h}: what is going to be deleted by itself
        var sel = {}; // archivo -> true
        var filtro = "";
        var rango = null; // the time range of the search (workshopRangePicker): null = no limit in time
        var busFoco = false;
        var viendo = null; // {tipo, item}
        var msg = "", msgOk = true;
        var timer = null, puesta = cameraStartupCreate(); // puesta: start-up chip in the header, see cameraGalStartupAssemble
        // Tabs (2026-10-10, "turn it around and redesign timelapse"; "what is
        // in the camera button has to be the same and complete here"):
        // Record, Videos, Captures and Settings.
        var TL_PEST_KEY = "workshopTlTab";
        var pestana = cameraGalleryTab(TL_PEST_KEY); // the saved tab (13-service-views.js)
        var cfg = null, borrador = null; // ajustes del servicio
        function loadCfg() {
          return cameraService(null)
            .then(function (c) {
              cfg = c;
              if (!borrador) borrador = JSON.parse(JSON.stringify(c));
            })
            .catch(function (e) {
              notice(i18nT('common.could_not_read_the_service', { error: String(e.message || e) }), false);
            })
            .then(render);
        }

        function load() {
          return Promise.all([
            fetch(cameraRelayBase() + "/timelapses", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return null; }),
            fetch(cameraRelayBase() + "/captures", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return null; }),
            cameraStateRead(),
            fetch(cameraRelayBase() + "/per_delete", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
          ]).then(function (r) {
            pb = r[3];
            tls = r[0];
            caps = r[1];
            est = r[2];
            return tls === null && caps === null ? cameraNoCameraProbe() : false;
          }).then(function (none) { noCam = !!none; render(); });
        }
        function notice(t, ok) {
          msg = t || "";
          msgOk = ok !== false;
          render();
        }
        function nameOf(x) {
          return x.name || x.job || x.file;
        }
        function src(kind, file) {
          return cameraRelayBase() + (kind === "video" ? "/timelapses/" : "/captures/") + encodeURIComponent(file);
        }
        function download(kind, file) {
          var a = document.createElement("a");
          a.href = src(kind, file) + "?download=1";
          a.setAttribute("download", file);
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        function deleteSeveral(items) {
          notice(i18nT('gallery.deleting_n', { n: items.length }));
          var p = Promise.resolve();
          items.forEach(function (a) {
            p = p.then(function () { return cameraPost("/remove?file=" + encodeURIComponent(a)); });
          });
          p.then(function () {
            sel = {};
            if (viendo && items.indexOf(viendo.item.file) >= 0) viendo = null;
            notice(i18nT('gallery.deleted_n', { n: items.length }));
            load();
          });
        }
        function rename(item, n) {
          cameraPost("/rename?file=" + encodeURIComponent(item.file) + "&name=" + encodeURIComponent(n)).then(function (d) {
            notice(d.ok ? i18nT('gallery.name_changed') : i18nT('common.couldn_t_error', { error: d.error || "" }), d.ok);
            load();
          });
        }

        function keep(items, value) {
          var p = Promise.resolve();
          items.forEach(function (a) {
            p = p.then(function () { return cameraPost("/keep?file=" + encodeURIComponent(a) + "&value=" + (value ? 1 : 0)); });
          });
          p.then(function () {
            notice(value ? (items.length > 1 ? i18nT('gallery.kept_n', { n: items.length }) : i18nT('gallery.kept_it_won_t_be_deleted')) : i18nT('gallery.no_longer_kept'));
            load();
          });
        }
        // What the Pi is going to delete by itself because of the caps (with a notice to the phone):
        // keep, download or delete now. If nobody does anything, it is deleted.
        function noticeByDelete() {
          var box = cameraEl("div", "display:flex;flex-direction:column;gap:6px;");
          box.className = "ctl-alert amber";
          var it = pb.items;
          box.appendChild(cameraEl("div", "font-weight:bold;color:var(--c-notice,#ffb74d);", i18nT('gallery.n_files_will_be_deleted_by_themselves', { n: it.length })));
          box.appendChild(cameraEl("div", null, i18nT('gallery.the_count_or_space_limits_were')));
          it.slice(0, 20).forEach(function (d) {
            var f = cameraEl("div", "display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;");
            var item = (d.kind === "video" ? tls : caps) || [];
            var x = item.filter(function (y) { return y.file === d.file; })[0] || { file: d.file };
            f.appendChild(cameraEl("span", "font-weight:bold;", nameOf(x)));
            f.appendChild(cameraEl("span", "color:var(--c-sec,#b0bec5);", cameraDate(d.until) + " · " + workshopServiceText(d.reason)));
            f.appendChild(boton(i18nT('gallery.keep'), "", function () { keep([d.file], true); }));
            f.appendChild(boton(i18nT('common.download'), "", function () { download(d.kind === "video" ? "video" : "photo", d.file); }));
            f.appendChild(cameraBtnDouble(i18nT('gallery.delete_now'), i18nT('common.delete_confirm'), "", function () { deleteSeveral([d.file]); }));
            box.appendChild(f);
          });
          if (it.length > 20) box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.and_n_more', { n: it.length - 20 })));
          box.appendChild(boton(i18nT('gallery.keep_all'), "background:#2e7d32;color:#fff;align-self:flex-start;", function () {
            keep(it.map(function (d) { return d.file; }), true);
          }));
          return box;
        }
        function boton(t, estilo, fn) {
          return cameraBtn(t, estilo, fn);
        }
        function irPestana(k) {
          pestana = (k === "settings" || k === "studio") && !cameraCanDo("settings") ? "record" : k;
          viendo = null;
          try { localStorage.setItem(TL_PEST_KEY, k); } catch (e) { /* no critico */ }
          render();
        }
        var navPlegada = false, navFija = cameraNavPinGet(); // the bar folds to its icons after a choice unless it is pinned
        var tabs = null;
        function render() {
          cameraViewTeardown(page); // the previous tab: its pictures, boxes and timers go before it is drawn again
          page.textContent = "";
          var t = est && est.timelapse;
          // the page bar of the family (wf-bar): badge with the icon of the menu, title, one line that says what the page is for, and on the
          // right the state chips, the start-up chip and the refresh button
          var hc = cameraEl("div", "");
          hc.className = "wf-bar";
          hc.innerHTML = '<span class="wf-badge"><span class="wf-badge-icon mdi mdi-filmstrip"></span></span><div class="wf-bar-txt"><div class="wf-title" role="heading" aria-level="1"></div><div class="wf-lead"></div></div>';
          hc.querySelector(".wf-title").textContent = i18nT('gallery.timelapses_and_captures');
          hc.querySelector(".wf-lead").textContent = i18nT('gallery.timelapses_of_jobs_or_by_hand');
          var cab = cameraEl("div", "");
          cab.className = "wf-bar-right";
          // a state = a dot + the word (err, info); a figure (videos, free space) = a pill with a border
          function chip(text, color, alTocar, titulo) {
            var c = cameraEl("span", null, text);
            c.className = (color === "gris" ? "wf-pill" : "wf-state " + (color === "red" ? "err" : "info")) + (alTocar ? " ctl-click" : "");
            if (titulo) c.title = titulo;
            if (alTocar) c.addEventListener("click", alTocar);
            cab.appendChild(c);
          }
          if (t && t.recording) chip(i18nT('common.recording') + " · " + (t.frames || 0) + " " + i18nT('timelapse.frames'), "red", function () { irPestana("record"); });
          else if (t && t.scheduled) chip(i18nT('common.scheduled') + " " + (t.scheduled.since ? cameraDate(t.scheduled.since) : i18nT('gallery.now')), "blue", function () { irPestana("record"); });
          if (t && (t.assembling || t.editing)) chip(i18nT('gallery.building_video'), "blue");
          if (t) {
            chip(i18nT('common.videos') + " " + (t.videos_gb != null ? t.videos_gb : "?") + (cfg ? "/" + (cfg.timelapses_gb || 5) : "") + " GB", "gris", function () { irPestana("settings"); }, i18nT('gallery.where_and_how_much_is_stored'));
            chip(i18nT('gallery.free') + " " + (t.disk_free_gb != null ? t.disk_free_gb : "?") + " GB", t.disk_free_gb != null && t.disk_free_gb < 4 ? "red" : "gris");
          }
          var bAct = cameraBtn(i18nT('common.refresh'), "", function () { load(); loadCfg(); puesta.refresh(); });
          cab.appendChild(puesta.el); cab.appendChild(bAct);
          hc.appendChild(cab);
          page.appendChild(hc); cameraGalStartupAssemble(puesta);
          if (noCam) return cameraNoCameraPage(page, function () { noCam = false; load(); loadCfg(); puesta.refresh(); });
          // side bar of the page (same measures as the bar of Vision): Record / Videos / Captures / Settings
          page.classList.add("ctl-with-nav");
          tabs = cameraEl("nav", "");
          tabs.className = "wf-nav ctl-nav" + (navPlegada ? " collapsed" : "");
          // folds to the icons after choosing; opens again (over the page) with the pointer or the focus
          // the double arrow (as in the bar of Vision): folds the bar to its icons or opens it for good
          var plegar = cameraEl("button", "");
          plegar.type = "button";
          plegar.className = "ctln-fold"; plegar.title = i18nT("common.fold_bar"); plegar.setAttribute("aria-label", plegar.title); // QA-11: icon-only button needs a name
          plegar.appendChild(cameraEl("span", "")).className = "mdi " + (navPlegada ? "mdi-chevron-double-right" : "mdi-chevron-double-left");
          plegar.addEventListener("click", function () { navPlegada = !navPlegada; render(); });
          tabs.appendChild(cameraNavHead(navFija, navPlegada, plegar, function () { navFija = !navFija; cameraNavPinSet(navFija); render(); })); // pin + fold arrow
          [
            ["record", "mdi-record-rec", i18nT('gallery.record')],
            ["studio", "mdi-movie-edit-outline", i18nT('studio.nav')],
            ["videos", "mdi-movie-open-outline", i18nT('common.videos') + (tls ? " (" + tls.length + ")" : "")],
            ["captures", "mdi-image-multiple-outline", i18nT('common.captures') + (caps ? " (" + caps.length + ")" : "")],
            ["settings", "mdi-cog-outline", i18nT('common.settings')],
          ].filter(function (k) { return (k[0] !== "settings" && k[0] !== "studio") || cameraCanDo("settings"); }).forEach(function (k) {
            var b = cameraEl("button", "");
            b.className = "wf-nav-item ctl-nav-item" + (pestana === k[0] ? " on" : "");
            b.type = "button";
            b.title = k[2];
            b.appendChild(cameraEl("span", "")).className = "wf-nav-icon mdi " + k[1];
            b.appendChild(cameraEl("span", null, k[2])).className = "tx";
            b.addEventListener("click", function () { if (!navFija) navPlegada = true; irPestana(k[0]); });
            tabs.appendChild(b);
          });
          page.appendChild(tabs);
          // banners and messages like a dense text v-alert (.ctl-alert)
          if (t && t.recording && pestana !== "record") page.appendChild(cameraEl("div", "", i18nT('gallery.recording_now', { job: t.job || "", n: t.frames || 0 }))).className = "ctl-alert red";
          if (t && (t.assembling || t.editing)) page.appendChild(cameraEl("div", "", i18nT('gallery.the_system_is_building_a_video'))).className = "ctl-alert blue";
          if (msg) page.appendChild(cameraEl("div", "color:" + (msgOk ? "var(--c-green,#a5d6a7)" : "var(--c-error,#ef9a9a)") + ";", msg)).className = "ctl-alert " + (msgOk ? "green" : "red");
          if (pb && pb.items && pb.items.length) page.appendChild(noticeByDelete());
          if (pestana === "record") return renderRecord();
          if (pestana === "settings" && cameraCanDo("settings")) return renderSettings();
          if (pestana === "studio" && cameraCanDo("settings")) return cameraStudioPage(page, ctx());
          renderItems(pestana === "videos" ? "video" : "photo");
        }

        function renderRecord() {
          var t0 = est && est.timelapse;
          var cols = cameraEl("div", "");
          cols.className = "ctl-grid";
          function cardG(icon, title) {
            var c = cameraEl("div", "");
            c.className = "ctl-card wf-card";
            var h = cameraEl("div", "");
            h.className = "ctl-title";
            h.appendChild(cameraEl("span", "")).className = "mdi " + icon;
            h.appendChild(cameraEl("span", null, title));
            c.appendChild(h);
            cols.appendChild(c);
            return c;
          }
          var c1 = cardG("mdi-record-rec", i18nT('common.timelapse'));
          c1.appendChild(cameraTlBox(function () { load(); }));
          if (t0 && t0.recording) {
            // live: the latest photo of each camera being recorded
            var cv = cardG("mdi-eye-outline", i18nT('gallery.live'));
            var gv = cameraLiveGrid(t0);
            cv.appendChild(gv);
            cv.appendChild(cameraEl("div", "", i18nT('gallery.the_last_saved_photo_of_each'))).className = "ctl-muted";
          }
          if (cameraCanDo("settings")) cardG("mdi-calendar-clock", i18nT('common.schedule')).appendChild(cameraTlSchedule(function () { load(); })); // the schedule is the technician's
          // how it is configured now (summary) + capture
          var c2 = cardG("mdi-tune-variant", i18nT(cameraCanDo("settings") ? 'gallery.how_it_will_record' : 'roles.capture_card'));
          if (!cfg) c2.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('common.reading')));
          else if (cameraCanDo("settings")) { // limits, fps and assembly are the technician's
            var tl = cfg.timelapse || {};
            var cams = cameraTlNames(tl.cameras && tl.cameras.length ? tl.cameras : [tl.camera || "main"]);
            var arm = cams.length < 2 ? i18nT('gallery.one_video') : tl.armed === "mosaic" ? i18nT('gallery.mosaic_lower') : tl.armed === "toggle" ? i18nT('gallery.switching_with_a_fade') : i18nT('gallery.one_video_per_camera');
            [
              [i18nT('cameras.cameras'), cams.join(", ")],
              [i18nT('common.one_photo_every'), (tl.each_s || 10) + " s"],
              [i18nT('common.stops_by_itself_after'), cameraFmtDoes((tl.max_min || 720) * 60)],
              [i18nT('common.video'), (tl.fps || 15) + " " + i18nT('common.frames_per_s') + ", " + arm + (tl.title !== false ? ", " + (tl.title_style === "large" ? i18nT('gallery.with_a_large_title_card') : i18nT('gallery.with_a_small_name')) : "")],
              [i18nT('gallery.with_every_job'), (tl.active ? i18nT('gallery.yes_starts_and_ends_on_its') : i18nT('gallery.no_only_by_hand'))],
              [i18nT('common.photos'), (tl.trigger === "layer" ? i18nT('gallery.one_per_layer_3d_printing') : i18nT('gallery.by_time')) + (tl.stamp ? ", " + i18nT('gallery.with_date_and_time') : "")],
              [i18nT('gallery.light'), (tl.deflicker ? i18nT('gallery.smooths_flicker') : i18nT('gallery.no_correction'))],
            ].forEach(function (r) {
              var f = cameraEl("div", "display:flex;gap:6px;");
              f.appendChild(cameraEl("span", "color:var(--c-sec,#b0bec5);min-width:120px;", r[0]));
              var v = cameraEl("span", null, r[1]);
              f.appendChild(v);
              c2.appendChild(f);
            });
            c2.appendChild(boton(i18nT('gallery.change_in_settings'), "align-self:flex-start;", function () { irPestana("settings"); }));
          }
          // captura ahora, de cualquier camara del relay
          var cs = (est && est.cameras) || [];
          if (cs.length) {
            c2.appendChild(cameraEl("div", "font-weight:bold;margin-top:6px;", i18nT('gallery.capture_now')));
            var fc = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
            cs.forEach(function (c) {
              fc.appendChild(boton(c.name, "", function () {
                cameraCapture(c.id)
                  .then(function () { notice(i18nT('gallery.capture_saved') + " " + c.name); load(); })
                  .catch(function (e) { notice(i18nT('common.couldn_t_error', { error: String(e.message || e) }), false); });
              }));
            });
            c2.appendChild(fc);
            c2.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('gallery.saves_the_photo_with_the_date')));
          }
          if (cameraCanDo("settings")) cardG("mdi-help-circle-outline", i18nT('common.how_it_works')).appendChild(cameraAsWorks());
          page.appendChild(cols);
        }

        // what the Studio and the Settings tab share: the draft, the saved settings and how to save or drop the draft (18-tl-studio-cards.js)
        function ctx() {
          return { draft: borrador, cfg: cfg, est: est, rerender: render, notice: notice, reload: load, go: irPestana,
            saved: function (c) { cfg = c; borrador = JSON.parse(JSON.stringify(c)); }, discard: function () { borrador = JSON.parse(JSON.stringify(cfg)); } };
        }

        function renderSettings() {
          if (!borrador) {
            page.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.reading_the_system_s_settings')));
            return;
          }
          var t = (est && est.timelapse) || {};
          page.appendChild(cameraSettingsComplete(borrador, cfg, {
            columns: true,
            rerender: render,
            usage: { videos_gb: t.videos_gb, free_gb: t.disk_free_gb, videos: tls ? tls.length : null, captures: caps ? caps.length : null },
            save: cameraStudioSaver(ctx()),
            undo: function () { ctx().discard(); render(); },
          }));
        }

        function renderItems(kindItems) {
          var bus = cameraEl("input", "width:200px;"); // field look: .ctl input (DESIGN.md 4)
          bus.placeholder = i18nT('gallery.search_by_name');
          bus.value = filtro;
          bus.addEventListener("input", function () {
            filtro = bus.value;
            clearTimeout(bus._t);
            bus._t = setTimeout(function () { busFoco = true; render(); }, 250);
          });
          if (tls === null && caps === null) {
            page.appendChild(cameraEl("div", "color:var(--c-error,#ef9a9a);", i18nT('gallery.could_not_read_the_system_relay')));
            return;
          }
          var f = filtro.trim().toLowerCase();
          var ahora = new Date();
          function passes(x) {
            return (!f || (nameOf(x) + " " + (x.start || x.ts || "")).toLowerCase().indexOf(f) >= 0) && workshopRangeHas(rango, x.start || x.ts, ahora);
          }

          // -- en grande + editor --
          if (viendo && viendo.kind === kindItems) page.appendChild(panelVer());

          // -- seleccion --
          var chosen = Object.keys(sel).filter(function (k) { return sel[k]; });
          var bar = cameraEl("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;");
          bar.appendChild(bus);
          // search by date: the timelapses (start) or the captures (ts) inside a range, like the one of CloudWatch (04-range-picker.js)
          bar.appendChild(workshopRangePicker({ value: rango, clearable: true, onChange: function (nv) { rango = nv; render(); } }));
          if (busFoco) {
            busFoco = false; // seguir escribiendo despues de filtrar
            setTimeout(function () { bus.focus(); bus.setSelectionRange(bus.value.length, bus.value.length); }, 0);
          }
          bar.appendChild(cameraEl("span", null, chosen.length ? i18nT('gallery.selected_n', { n: chosen.length }) : i18nT('gallery.tap_each_checkbox_to_choose_several')));
          if (chosen.length) {
            bar.appendChild(boton(i18nT('gallery.download_selected'), "", function () {
              chosen.forEach(function (a, i) {
                setTimeout(function () { download(/\.mp4$/.test(a) ? "video" : "photo", a); }, i * 400);
              });
            }));
            bar.appendChild(cameraBtnDouble(i18nT('gallery.delete_selected'), i18nT('common.delete_confirm'), "", function () { deleteSeveral(chosen); }));
            bar.appendChild(boton(i18nT('gallery.clear_selection'), "", function () { sel = {}; render(); }));
          }
          page.appendChild(bar);

          if (kindItems === "video") {
          // -- timelapses --
          var lt = (tls || []).filter(passes);
          page.appendChild(cameraEl("div", "", i18nT('service.timelapses') + " (" + lt.length + ")")).className = "ctl-section";
          var gv = cameraEl("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;");
          lt.forEach(function (x) { gv.appendChild(card("video", x)); });
          if (!lt.length) gv.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.no_timelapses_they_re_recorded_in')));
          page.appendChild(gv);
          return;
          }

          // -- capturas --
          var lc = (caps || []).filter(passes);
          page.appendChild(cameraEl("div", "", i18nT('common.captures') + " (" + lc.length + ")")).className = "ctl-section";
          var gc = cameraEl("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;");
          lc.slice(0, 300).forEach(function (x) { gc.appendChild(card("photo", x)); });
          if (!lc.length) gc.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.no_captures_take_them_in_record')));
          page.appendChild(gc);
        }

        function card(kind, x) {
          var c = cameraEl("div", "");
          c.className = "ctl-mini" + (sel[x.file] ? " sel" : "");
          var im = cameraEl("img", "width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#000;cursor:pointer;");
          im.src = kind === "video" ? cameraRelayBase() + "/timelapses/" + encodeURIComponent(x.thumbnail || x.miniatura) : src("photo", x.file);
          im.loading = "lazy";
          cameraOwnError(im); // appended below: the note needs the parent
          im.addEventListener("click", function () {
            viendo = { kind: kind, item: x };
            render();
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
          c.appendChild(im);
          var pie = cameraEl("div", "padding:6px 8px;display:flex;flex-direction:column;gap:2px;font-size:12px;");
          var l1 = cameraEl("label", "display:flex;align-items:center;gap:6px;font-weight:500;cursor:pointer;");
          var cb = cameraEl("input");
          cb.type = "checkbox";
          cb.checked = !!sel[x.file];
          cb.addEventListener("change", function () {
            sel[x.file] = cb.checked;
            render();
          });
          l1.appendChild(cb);
          l1.appendChild(cameraEl("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", nameOf(x)));
          pie.appendChild(l1);
          if (x.pending_delete_until) pie.appendChild(cameraEl("div", "color:var(--c-notice,#ffb74d);font-weight:bold;", i18nT('gallery.deleted_by_itself_on', { date: cameraDate(x.pending_delete_until) })));
          else if (x.keep) pie.appendChild(cameraEl("div", "color:var(--c-green,#a5d6a7);", i18nT('gallery.kept')));
          pie.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", kind === "video" ? (x.start || "") + " · " + cameraFmtDur(x.duration_s) + " · " + cameraFmtMB(x.bytes || 0) : (x.ts || "") + " · " + (x.camera_name || x.camera || "")));
          if (kind === "video" && (x.camera || (x.cameras && x.cameras.length > 1))) pie.appendChild(cameraEl("div", "color:var(--c-blue,#90caf9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", x.camera || x.cameras.join(", ")));
          c.appendChild(pie);
          return c;
        }

        function panelVer() {
          var x = viendo.item, kind = viendo.kind;
          var box = cameraEl("div", "flex-direction:row;gap:12px;flex-wrap:wrap;margin-bottom:12px;");
          box.className = "ctl-card";
          var izq = cameraEl("div", "flex:2 1 420px;min-width:280px;");
          var media;
          if (kind === "video") {
            media = cameraEl("video", "width:100%;max-height:70vh;border-radius:6px;background:#000;");
            media.controls = true;
            media.src = src("video", x.file);
          } else {
            media = cameraEl("img", "width:100%;max-height:70vh;object-fit:contain;border-radius:6px;background:#000;");
            media.src = src("photo", x.file);
          }
          izq.appendChild(media);
          cameraOwnError(media);
          box.appendChild(izq);
          var der = cameraEl("div", "flex:1 1 240px;display:flex;flex-direction:column;gap:8px;");
          der.appendChild(cameraEl("div", "", nameOf(x))).className = "ctl-title";
          der.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", kind === "video" ? (x.start || "") + " · " + i18nT('gallery.recording_length_and_frames', { t: cameraFmtDur(x.duration_s), n: x.frames || "?" }) : (x.ts || "")));
          var acc = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
          acc.appendChild(boton(i18nT('common.download'), "background:#1976d2;color:#fff;", function () { download(kind, x.file); }));
          acc.appendChild(cameraBtnDouble(i18nT('common.delete'), i18nT('common.delete_confirm'), "", function () { deleteSeveral([x.file]); }));
          acc.appendChild(boton(i18nT('common.close'), "", function () { viendo = null; render(); }));
          der.appendChild(acc);
          // keep: it is never deleted by itself because of the caps
          var lc = cameraEl("label", "display:flex;align-items:center;gap:8px;cursor:pointer;");
          var cc = cameraEl("input");
          cc.type = "checkbox";
          cc.checked = !!x.keep;
          cc.style.cssText = "width:18px;height:18px;";
          cc.addEventListener("change", function () { keep([x.file], cc.checked); });
          lc.appendChild(cc);
          lc.appendChild(document.createTextNode(i18nT('gallery.keep_not_deleted_automatically')));
          der.appendChild(lc);
          if (x.pending_delete_until) der.appendChild(cameraEl("div", "color:var(--c-notice,#ffb74d);", i18nT('gallery.deleted_by_itself_on_unless_kept', { date: cameraDate(x.pending_delete_until) })));
          // rename in place (without prompt(): in the kiosk the native boxes misbehave)
          var fn = cameraEl("div", "display:flex;gap:6px;");
          var inp = cameraEl("input", "flex:1;min-width:0;"); // field look: .ctl input (DESIGN.md 4)
          inp.value = nameOf(x);
          inp.maxLength = 80;
          fn.appendChild(inp);
          fn.appendChild(boton(i18nT('gallery.rename'), "", function () { rename(x, inp.value); }));
          der.appendChild(fn);
          if (kind === "video") der.appendChild(editor(x, media));
          box.appendChild(der);
          return box;
        }

        // trim and change speed: the points are taken from the player
        function editor(x, video) {
          var e = { since: 0, until: null, speed: 1 };
          var box = cameraEl("div", "border-top:1px solid var(--c-edge,rgba(128,128,128,0.35));padding-top:8px;display:flex;flex-direction:column;gap:6px;");
          box.appendChild(cameraEl("div", "font-weight:500;", i18nT('gallery.edit_creates_a_new_video_this')));
          var info = cameraEl("div", "color:var(--c-sec,#b0bec5);");
          function paint() {
            info.textContent = i18nT('gallery.trim_from_to_speed', { from: e.since.toFixed(1), to: e.until === null ? i18nT('gallery.the_end') : e.until.toFixed(1) + " s", speed: e.speed });
          }
          var f1 = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
          f1.appendChild(boton(i18nT('gallery.start_here'), "", function () { e.since = video.currentTime || 0; paint(); }));
          f1.appendChild(boton(i18nT('gallery.end_here'), "", function () { e.until = video.currentTime || null; paint(); }));
          f1.appendChild(boton(i18nT('gallery.no_trim'), "", function () { e.since = 0; e.until = null; paint(); }));
          box.appendChild(f1);
          box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('gallery.pause_the_video_where_you_want')));
          var f2 = cameraEl("div", "display:flex;gap:6px;align-items:center;flex-wrap:wrap;");
          f2.appendChild(cameraEl("span", null, i18nT('common.speed')));
          var s = cameraEl("select", "padding:4px;border-radius:4px;background:var(--c-field,#1e272c);color:var(--c-text,#fff);border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));font:inherit;");
          [[0.5, i18nT('gallery.x0_5_slower')], [1, "x1"], [2, "x2"], [4, i18nT('gallery.x4_faster')], [8, "x8"]].forEach(function (o) {
            var op = cameraEl("option", null, o[1]);
            op.value = String(o[0]);
            if (o[0] === 1) op.selected = true;
            s.appendChild(op);
          });
          s.addEventListener("change", function () { e.speed = parseFloat(s.value) || 1; paint(); });
          f2.appendChild(s);
          box.appendChild(f2);
          box.appendChild(info);
          box.appendChild(boton(i18nT('gallery.create_the_edited_video'), "background:#1976d2;color:#fff;", function () {
            if (e.until !== null && e.until <= e.since + 0.2) return notice(i18nT('gallery.the_end_has_to_be_after'), false);
            cameraPost("/edit?file=" + encodeURIComponent(x.file) + "&since=" + e.since.toFixed(2) + (e.until !== null ? "&until=" + e.until.toFixed(2) : "") + "&speed=" + e.speed).then(function (d) {
              notice(d.ok ? i18nT('gallery.the_system_is_building_the_edited') : i18nT('common.couldn_t_error', { error: d.error || "" }), d.ok);
              if (d.ok) setTimeout(load, 4000);
            });
          }));
          paint();
          return box;
        }

        load();
        loadCfg();
        var busyBefore = false;
        timer = setInterval(function () {
          if (document.hidden) return;
          cameraStateRead().then(function (d) {
            est = d || est;
            var t = d && d.timelapse;
            var busy = !!(t && (t.recording || t.assembling || t.editing));
            // algo cambia en la Pi, o recien termino de armarse un video
            if ((busy || busyBefore) && pestana !== "studio") load(); // the studio keeps what is being edited
            busyBefore = busy;
          });
        }, 3000);
        return {
          destroy: function () {
            clearInterval(timer);
            cameraViewTeardown(page);
            page.remove();
          },
        };
      }

      function cameraRegisterGallery() {
        try {
          workshopHostRegisterPage(
            {
              name: "WorkshopTimelapsesPage",
              mount: function (el) { return cameraAssembleGallery(el); },
              destroy: function (handle) { handle.destroy(); },
            },
            { Plugins: { WorkshopTimelapses: { icon: "mdi-filmstrip", caption: 'plugins.WorkshopCamera.gallery.timelapses_and_captures', path: CAMERA_GAL_PATH } } }
          );
        } catch (e) {
          console.error("[WorkshopCamera] could not register the timelapses page:", e);
        }
      }
