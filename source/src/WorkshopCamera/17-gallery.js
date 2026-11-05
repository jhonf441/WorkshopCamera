      // ---- "Timelapses and captures" page (Plugins, 2026-10-10) ----
      //
      // Request: "how are timelapses managed: delete, edit, download;
      // there should be something that extends those functions". Here: view large, rename, download, delete
      // several, and edit a video (trim and change speed: the Pi builds
      // a NEW one and the original stays). Everything lives in the Pi's relay.
      // informe-07: the page is the home of everything of the camera that is not just looking. Its tabs are listed in 18-page-tabs.js
      // (live, library, studio, cameras, image, store; in three groups); the floating viewer only looks and has a button that opens this page.

      var CAMERA_GAL_PATH = "/Plugins/Timelapses";
      var cameraGalleryPage = null; // the page that is mounted ({destroy}); the plugin's stop destroys it (13-service.js cameraCloseOpenViews)
      var cameraPageRegistered = false; // the route of the page was registered (the viewer shows its button to the page only then)

      // The saved files and the relay's state: what the page loads. A list is null when the relay does not answer.
      // withPerDelete: also what the relay is going to delete by itself.
      function cameraGalleryLoad(withPerDelete) {
        var why = {}; // why.cause when a list could not be read: the page says it (login_required / forbidden / error / unreachable)
        return Promise.all([cameraRelayList("video", why), cameraRelayList("photo", why), cameraStateRead(), withPerDelete ? cameraRelayPerDelete() : null]).then(function (r) {
          return { timelapses: r[0], captures: r[1], state: r[2], perDelete: r[3], why: why };
        });
      }

      function cameraDate(ts) {
        var d = new Date(ts * 1000);
        var dd = function (n) { return (n < 10 ? "0" : "") + n; };
        return dd(d.getDate()) + "/" + dd(d.getMonth() + 1) + " " + dd(d.getHours()) + ":" + dd(d.getMinutes());
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
        var tls = null, caps = null, est = null, whyFail = {}, noCam = false; // noCam: the service says no camera is added yet (18-no-camera.js)
        var pb = null; // {items: [{archivo, tipo, motivo, hasta}], wait_h}: what is going to be deleted by itself
        var sel = {}; // archivo -> true
        var filtro = "";
        var rango = null; // the time range of the search (workshopRangePicker): null = no limit in time
        var busFoco = false;
        var viendo = null; // {kind, item}: the file open in the player of the library
        var sub = "all"; // second level tab of the library (18-page-library.js): all | video | photo | keep
        var multi = false; // "Choose several" of the library: tapping a card chooses it instead of opening it
        var msg = "", msgOk = true;
        var timer = null, puesta = cameraStartupCreate(); // puesta: start-up chip in the header, see cameraGalStartupAssemble
        // Tabs (18-page-tabs.js): the saved one if this view may use it
        var pestana = cameraGalleryTab(CAMERA_PAGE_TAB_KEY); // 13-service-views.js (an id of the 7 tabs of before is moved to its section)
        try { localStorage.setItem(CAMERA_PAGE_TAB_KEY, pestana); } catch (e) { /* the page opens on the tab it had */ }
        var pageState = {}; // what the tabs of cameras and image keep between redraws (18-page-cameras.js); cameraPageForget empties it
        var cfg = null, borrador = null; // ajustes del servicio
        function loadCfg() {
          return cameraService(null)
            .then(function (c) {
              cfg = c;
              if (!borrador) borrador = JSON.parse(JSON.stringify(c));
            })
            .catch(function (e) {
              if (typeof workshopSignedOut === "function" && workshopSignedOut()) return; // the sign-in chip says it: no second raw line
              notice(i18nT('common.could_not_read_the_service', { error: String(e.message || e) }), false);
            })
            .then(render);
        }

        function load() {
          return cameraGalleryLoad(true).then(function (g) {
            pb = g.perDelete;
            tls = g.timelapses;
            caps = g.captures; est = g.state; whyFail = g.why || {};
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
        function download(kind, file) {
          var a = document.createElement("a");
          a.href = cameraRelayMediaUrl(kind, file) + "?download=1";
          a.setAttribute("download", file);
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        function deleteSeveral(items) {
          notice(i18nT('gallery.deleting_n', { n: items.length }));
          var p = Promise.resolve();
          items.forEach(function (a) {
            p = p.then(function () { return cameraRelayRemove(a); });
          });
          p.then(function () {
            sel = {};
            if (viendo && items.indexOf(viendo.item.file) >= 0) viendo = null;
            notice(i18nT('gallery.deleted_n', { n: items.length }));
            load();
          });
        }
        function rename(item, n) {
          cameraRelayRename(item.file, n).then(function (d) {
            notice(d.ok ? i18nT('gallery.name_changed') : i18nT('common.couldn_t_error', { error: d.error || "" }), d.ok);
            load();
          });
        }

        function keep(items, value) {
          var p = Promise.resolve();
          items.forEach(function (a) {
            p = p.then(function () { return cameraRelayKeep(a, value); });
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
          k = cameraPageTabMigrate(k);
          pestana = cameraPageTabsFor(cameraCanDo).indexOf(k) >= 0 ? k : "live";
          viendo = null;
          multi = false;
          cameraPageForget(pageState);
          try { localStorage.setItem(CAMERA_PAGE_TAB_KEY, pestana); } catch (e) { /* no critico */ }
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
          if (t && t.recording) chip(i18nT('common.recording') + " · " + (t.frames || 0) + " " + i18nT('timelapse.frames'), "red", function () { irPestana("live"); });
          else if (t && t.scheduled) chip(i18nT('common.scheduled') + " " + (t.scheduled.since ? cameraDate(t.scheduled.since) : i18nT('gallery.now')), "blue", function () { irPestana("live"); });
          if (t && (t.assembling || t.editing)) chip(i18nT('gallery.building_video'), "blue");
          if (t) {
            chip(i18nT('common.videos') + " " + (t.videos_gb != null ? t.videos_gb : "?") + (cfg ? "/" + (cfg.timelapses_gb || 5) : "") + " GB", "gris", function () { irPestana("store"); }, i18nT('gallery.where_and_how_much_is_stored'));
            chip(i18nT('gallery.free') + " " + (t.disk_free_gb != null ? t.disk_free_gb : "?") + " GB", t.disk_free_gb != null && t.disk_free_gb < 4 ? "red" : "gris");
          }
          var bAct = cameraBtn(i18nT('common.refresh'), "", function () { cameraPageForget(pageState); load(); loadCfg(); puesta.refresh(); });
          cab.appendChild(puesta.el); cab.appendChild(bAct);
          hc.appendChild(cab);
          page.appendChild(hc); cameraGalStartupAssemble(puesta);
          if (noCam) return cameraNoCameraPage(page, function () { noCam = false; load(); loadCfg(); puesta.refresh(); });
          // side bar of the page (same measures as the bar of Vision): the tabs of 18-page-tabs.js; it folds to the icons after choosing
          page.classList.add("ctl-with-nav");
          tabs = cameraPageNav({
            tab: pestana, folded: navPlegada, pinned: navFija, tls: tls, caps: caps,
            onFold: function () { navPlegada = !navPlegada; render(); },
            onPin: function () { navFija = !navFija; cameraNavPinSet(navFija); render(); },
            onTab: function (id) { if (!navFija) navPlegada = true; irPestana(id); },
          });
          page.appendChild(tabs);
          // banners and messages like a dense text v-alert (.ctl-alert)
          if (t && t.recording && pestana !== "live") page.appendChild(cameraEl("div", "", i18nT('gallery.recording_now', { job: t.job || "", n: t.frames || 0 }))).className = "ctl-alert red";
          if (t && (t.assembling || t.editing)) page.appendChild(cameraEl("div", "", i18nT('gallery.the_system_is_building_a_video'))).className = "ctl-alert blue";
          if (msg) page.appendChild(cameraEl("div", "color:" + (msgOk ? "var(--c-green,#a5d6a7)" : "var(--c-error,#ef9a9a)") + ";", msg)).className = "ctl-alert " + (msgOk ? "green" : "red");
          if (pb && pb.items && pb.items.length) page.appendChild(noticeByDelete());
          if (pestana === "live") return cameraLiveTab(page, ctx()); // 18-page-live.js
          if (pestana === "store" && cameraCanDo("settings")) return renderSettings();
          if (pestana === "studio" && cameraCanDo("settings")) return cameraStudioPage(page, ctx());
          if (pestana === "cameras" && cameraCanDo("cameras")) return cameraCamerasTab(page, ctx()); // 18-page-cameras.js
          if (pestana === "image" && cameraCanDo("cameras")) return cameraImageTab(page, ctx()); // 18-page-image.js
          renderItems(); // library
        }

        // what the Studio, the Live form and the Storage tab share: the draft, the saved settings and how to save or drop the draft (18-tl-studio-cards.js)
        function ctx() {
          return { draft: borrador, cfg: cfg, est: est, rerender: render, notice: notice, reload: load, go: irPestana, state: pageState, startup: puesta,
            saved: function (c) { cfg = c; borrador = JSON.parse(JSON.stringify(c)); }, discard: function () { borrador = JSON.parse(JSON.stringify(cfg)); } };
        }

        // ---- Tab "Storage and system" ----
        function renderSettings() {
          if (!borrador) {
            page.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.reading_the_system_s_settings')));
            return;
          }
          var t = (est && est.timelapse) || {};
          cameraSettingsComplete(borrador, cfg, {
            parent: page,
            rerender: render,
            usage: { videos_gb: t.videos_gb, free_gb: t.disk_free_gb, videos: tls ? tls.length : null, captures: caps ? caps.length : null },
            save: cameraStudioSaver(ctx()),
            undo: function () { ctx().discard(); render(); },
          });
        }

        // ---- Tab "Library": the videos and the captures in one place (18-page-library.js says what each second level tab lists) ----
        function renderItems() {
          var bus = cameraEl("input", "width:200px;"); // field look: .ctl input (DESIGN.md 4)
          bus.placeholder = i18nT('gallery.search_by_name');
          bus.value = filtro;
          bus.addEventListener("input", function () {
            filtro = bus.value;
            clearTimeout(bus._t);
            bus._t = setTimeout(function () { busFoco = true; render(); }, 250);
          });
          if (tls === null && caps === null) {
            cameraGalleryFailed(page, whyFail);
            return;
          }
          // second level tabs (wf-tabs): All | Videos (n) | Captures (n) | Kept
          var n = cameraLibraryCounts(tls, caps);
          var tabsEl = cameraEl("div", "margin-bottom:12px;");
          tabsEl.className = "wf-tabs";
          tabsEl.setAttribute("role", "tablist");
          [["all", i18nT('library.all')], ["video", i18nT('common.videos') + " (" + n.video + ")"], ["photo", i18nT('common.captures') + " (" + n.photo + ")"], ["keep", i18nT('library.kept')]].forEach(function (o) {
            var b = cameraEl("button", "", o[1]);
            b.type = "button";
            b.className = "wf-tab" + (sub === o[0] ? " on" : "");
            b.setAttribute("role", "tab");
            b.setAttribute("aria-selected", sub === o[0] ? "true" : "false");
            b.addEventListener("click", function () { sub = o[0]; render(); });
            tabsEl.appendChild(b);
          });
          page.appendChild(tabsEl);
          var f = filtro.trim().toLowerCase();
          var ahora = new Date();
          function passes(x) {
            return (!f || (nameOf(x) + " " + (x.start || x.ts || "")).toLowerCase().indexOf(f) >= 0) && workshopRangeHas(rango, x.start || x.ts, ahora);
          }

          // -- the file that is open: player, rename, keep, download, trim / speed (videos), delete --
          if (viendo) page.appendChild(panelVer());

          // -- search and choosing several --
          var chosen = Object.keys(sel).filter(function (k) { return sel[k]; });
          var bar = cameraEl("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;");
          bar.appendChild(bus);
          // search by date: the timelapses (start) or the captures (ts) inside a range, like the one of CloudWatch (04-range-picker.js)
          bar.appendChild(workshopRangePicker({ value: rango, clearable: true, onChange: function (nv) { rango = nv; render(); } }));
          if (busFoco) {
            busFoco = false; // seguir escribiendo despues de filtrar
            setTimeout(function () { bus.focus(); bus.setSelectionRange(bus.value.length, bus.value.length); }, 0);
          }
          bar.appendChild(boton(i18nT(multi ? 'library.done_choosing' : 'library.choose_several'), multi ? "border:1px solid #1976d2;" : "", function () {
            multi = !multi;
            sel = {};
            viendo = null;
            render();
          }));
          page.appendChild(bar);
          if (multi) {
            var sb = cameraEl("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid var(--c-edge,rgba(128,128,128,0.3));border-radius:8px;");
            sb.appendChild(cameraEl("span", null, chosen.length ? i18nT('gallery.selected_n', { n: chosen.length }) : i18nT('gallery.tap_each_checkbox_to_choose_several')));
            if (chosen.length) {
              sb.appendChild(boton(i18nT('gallery.keep'), "", function () { keep(chosen, true); }));
              sb.appendChild(boton(i18nT('gallery.download_selected'), "", function () {
                chosen.forEach(function (a, i) {
                  setTimeout(function () { download(/\.mp4$/.test(a) ? "video" : "photo", a); }, i * 400);
                });
              }));
              sb.appendChild(cameraBtnDouble(i18nT('gallery.delete_selected'), i18nT('common.delete_confirm'), "", function () { deleteSeveral(chosen); }));
              sb.appendChild(boton(i18nT('gallery.clear_selection'), "", function () { sel = {}; render(); }));
            }
            page.appendChild(sb);
          }

          // -- the cards: videos and captures, newest first --
          var items = cameraLibraryItems(tls, caps, sub, passes);
          var shown = 0;
          var g = cameraEl("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;");
          items.forEach(function (it) {
            if (it.kind === "photo" && shown >= 300) return; // the captures can be thousands: the first 300 (the search narrows them)
            if (it.kind === "photo") shown++;
            g.appendChild(card(it.kind, it.x));
          });
          if (!items.length) g.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT(sub === "keep" ? 'library.nothing_kept' : sub === "video" ? 'gallery.no_timelapses_they_re_recorded_in' : sub === "photo" ? 'gallery.no_captures_take_them_in_record' : 'library.empty')));
          page.appendChild(g);
        }

        function card(kind, x) {
          var c = cameraEl("div", "");
          c.className = "ctl-mini" + (sel[x.file] ? " sel" : "");
          var im = cameraEl("img", "width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#000;cursor:pointer;");
          im.src = kind === "video" ? cameraRelayThumbUrl(x) : cameraRelayMediaUrl("photo", x.file);
          im.loading = "lazy";
          cameraOwnError(im); // appended below: the note needs the parent
          im.addEventListener("click", function () {
            if (multi) { // choosing several: a tap chooses the card
              sel[x.file] = !sel[x.file];
              render();
              return;
            }
            viendo = { kind: kind, item: x };
            render();
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
          c.appendChild(im);
          var pie = cameraEl("div", "padding:6px 8px;display:flex;flex-direction:column;gap:2px;font-size:12px;");
          var l1 = cameraEl("label", "display:flex;align-items:center;gap:6px;font-weight:500;cursor:pointer;");
          if (multi) {
            var cb = cameraEl("input");
            cb.type = "checkbox";
            cb.checked = !!sel[x.file];
            cb.addEventListener("change", function () {
              sel[x.file] = cb.checked;
              render();
            });
            l1.appendChild(cb);
          }
          l1.appendChild(cameraEl("span", "font-size:10px;font-weight:700;border:1px solid var(--c-edge,rgba(128,128,128,0.3));border-radius:99px;padding:0 6px;flex:none;", i18nT(kind === "video" ? 'library.tag_video' : 'library.tag_photo')));
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
            media.src = cameraRelayMediaUrl("video", x.file);
          } else {
            media = cameraEl("img", "width:100%;max-height:70vh;object-fit:contain;border-radius:6px;background:#000;");
            media.src = cameraRelayMediaUrl("photo", x.file);
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
            cameraRelayEdit(x.file, e).then(function (d) {
              notice(d.ok ? i18nT('gallery.the_system_is_building_the_edited') : i18nT('common.couldn_t_error', { error: d.error || "" }), d.ok);
              if (d.ok) setTimeout(load, 4000);
            });
          }));
          paint();
          return box;
        }

        load();
        loadCfg();
        var busyBefore = false; var offIdentity = cameraGalleryOnIdentity(page, function () { load(); loadCfg(); });
        timer = cameraGalleryPoll(function (d) {
          est = d || est;
          var t = d && d.timelapse;
          var busy = !!(t && (t.recording || t.assembling || t.editing));
          // algo cambia en la Pi, o recien termino de armarse un video
          var held = pestana === "library" ? cameraLibraryBusy(viendo, Object.keys(sel).filter(function (k) { return sel[k]; }).length) : !!(pageState.live && pageState.live.open); // the form of the timelapse is open
          if ((busy || busyBefore) && cameraPageReloads(pestana, held)) load(); // the tabs that hold what is being typed (or a player, or a selection) are not redrawn
          busyBefore = busy;
        });
        return cameraGalleryHandle(page, function () { clearInterval(timer); if (offIdentity) offIdentity(); });
      }

      // A list the relay did not give: a refusal (no session, role) is told as such, calm and with the sign-in button when the session is missing; only
      // a real network failure says the relay is unreachable (why = { cause, status } of cameraRelayRead).
      function cameraGalleryFailed(page, why) {
        var cause = why.cause || "unreachable";
        var refused = cause === "login_required" || cause === "forbidden";
        page.appendChild(cameraEl("div", refused ? "color:var(--c-amber,#ffe082);" : "color:var(--c-error,#ef9a9a);", cameraRelayCauseNow(cause, why.status)));
        if (cause === "login_required" && cameraSignedOut() && typeof workshopLogin === "function") {
          page.appendChild(cameraBtn(workshopApiT("signInAction"), "background:#1976d2;color:#fff;margin-top:8px;", function () { workshopLogin(); }));
        }
      }

      // The person signed in or out (or changed role): what the relay refused is read again now, not at the next refresh. Returns the way to stop listening.
      function cameraGalleryOnIdentity(page, reread) {
        return typeof workshopOnIdentity === "function" ? workshopOnIdentity(function () { if (page.isConnected) reread(); }) : null;
      }

      // Asks the relay's state every 3 s while the page is open (not while the tab is hidden); onState(state) gets each answer. Returns the timer.
      function cameraGalleryPoll(onState) {
        return setInterval(function () {
          if (document.hidden) return;
          cameraStateRead().then(onState);
        }, 3000);
      }

      // What DWC gets for the mounted page: destroy() stops its timer, tears its views down and takes it off the screen. The plugin's stop
      // calls it too (13-service.js cameraCloseOpenViews).
      function cameraGalleryHandle(page, stopTimer) {
        var handle = {
          destroy: function () {
            stopTimer();
            if (cameraGalleryPage === handle) cameraGalleryPage = null;
            cameraViewTeardown(page);
            page.remove();
          },
        };
        cameraGalleryPage = handle;
        return handle;
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
          cameraPageRegistered = true;
          workshopOnStop(function () { cameraPageRegistered = false; });
        } catch (e) {
          console.error("[WorkshopCamera] could not register the timelapses page:", e);
        }
      }
