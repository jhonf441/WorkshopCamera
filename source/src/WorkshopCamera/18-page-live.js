      // ---- Tab "Live" of the page: what goes next to the capture and the timelapse (informe-07, mockup 2026-11-01) ----
      //
      // The picture of this tab is the preview of the tab Image (cameraFocusPreview, 11-focus.js): a photo that refreshes every 3 s. The live video
      // stays in the floating viewer (10-camera.js), which holds the only /stream of the camera: the page never opens a second one. Here also: the
      // light, the way to the focus assistant and the quick profiles of the image. They call what the viewer and the Image tab call.

      // The button "Light / flash" of the camera on this screen, or null when the view or the camera has none (same rule as the viewer's button).
      // camera = a camera of the list; notify(text) shows a message.
      function cameraLiveFlash(camera, notify) {
        if (!camera || !cameraCanDo("flash")) return null;
        var e = cameraStateOf(cameraRelayId(camera));
        var f = (e && e.flash) || camera.flash || null;
        var own = !!camera.esp32 && !(f && f.capable === false);
        if (!cameraFlashShown(camera, own)) return null;
        var on = !!(f && f.on);
        var b = cameraBtn(i18nT('live.flash') + (on ? " · " + i18nT('live.on') : ""), "", function () {
          var wanted = !on;
          cameraFlashSet(camera, wanted).then(function (r) {
            if (r.ok) {
              on = wanted;
              b.textContent = i18nT('live.flash') + (on ? " · " + i18nT('live.on') : "");
            } else notify(r.error || i18nT('camera.could_not_switch_the_flash'));
          });
        });
        b.setAttribute("aria-pressed", on ? "true" : "false");
        return b;
      }

      // The profiles of the image as chips (the technician's: the service refuses camera.image.set to anyone else). One tap applies and saves it,
      // as in the Image tab. Draws itself into `holder`: at once from what was read last time (store.liveProfiles, kept while the person stays in the tab),
      // and asks the service again only when that is older than 30 s, repainting only when the answer is different. Before, every draw of the tab left
      // the holder empty until the service answered, so the section went out and came back at each redraw.
      var CAMERA_LIVE_PROFILES_FRESH_MS = 30000;
      function cameraLiveProfiles(holder, cam, notify, store) {
        var cache = (store && (store.liveProfiles || (store.liveProfiles = {}))) || {};
        var drawn = null;
        function draw(d) {
          var sig = JSON.stringify(d);
          if (sig === drawn) return;
          drawn = sig;
          holder.textContent = "";
          var plain = !Object.keys(d.settings || {}).length;
          holder.appendChild(cameraEl("div", "font-size:12px;opacity:.7;margin-bottom:4px;", i18nT('live.image')));
          var chips = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
          d.profiles.forEach(function (p) {
            var on = d.profile === p.id && plain;
            var c = cameraBtn(cameraProfileInfo(p.id)[0], on ? "border:1px solid #1976d2;" : "", function () {
              cameraImageSet(cam.id, { profile: p.id }).then(function (r) {
                delete cache[cam.id]; // what the camera has changed: the next draw reads it again
                notify(r && r.ok ? i18nT('live.profile_applied', { name: cameraProfileInfo(p.id)[0] }) : i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: (r && r.error) || "" }), !!(r && r.ok));
              });
            });
            chips.appendChild(c);
          });
          holder.appendChild(chips);
        }
        var hit = cache[cam.id];
        if (hit) draw(hit.d);
        if (hit && Date.now() - hit.at < CAMERA_LIVE_PROFILES_FRESH_MS) return;
        cameraImageGet(cam.id)
          .then(function (d) {
            if (!d || !d.ok) return;
            cache[cam.id] = { at: Date.now(), d: d };
            if (holder.isConnected) draw(d);
          })
          .catch(function () { /* the Image tab says what is wrong */ });
      }

      // Starts what the form says. c = the context of the page (17-gallery.js ctx()), live = the form state. "job" saves the mode (a timelapse with
      // every job); "now" saves the draft when it changed (the relay records with the saved settings) and begins by hand.
      function cameraLiveStart(c, live) {
        if (live.when === "job") c.draft.timelapse.active = true;
        var changed = JSON.stringify(c.cfg) !== JSON.stringify(c.draft);
        var saved = changed ? cameraService(c.draft).then(function (r) { c.saved(r); }) : Promise.resolve();
        c.notice(i18nT('common.saving'), true, true); // quiet: the form button already says it started, and every draw of this tab asks the camera again
        saved
          .then(function () {
            if (live.when === "job") return { ok: true, saved: true };
            return cameraRelayTimelapse("begin", { name: (live.name || "").trim() || null });
          })
          .then(function (d) {
            if (d.ok) { live.open = false; live.name = ""; }
            c.notice(d.ok ? (d.saved ? i18nT('common.settings_saved_on_the_system_they') : i18nT('studio.take_started')) : i18nT('common.couldn_t_error', { error: d.error || "" }), !!d.ok, true); // quiet: c.reload() below draws once
            return cameraStateRead();
          })
          .then(function () { c.reload(); })
          .catch(function (e) { c.notice(i18nT('common.could_not_save') + (e.message || e), false); });
      }

      // The tab "Live" (mockup 2026-11-01): capture now, record a timelapse, the light and the quick profiles.
      // The picture of the camera is the floating viewer's (it holds the only /stream of the camera): while a timelapse records, the last photo of
      // each camera is here. The operator starts a timelapse with a name (cameraTlBox); the technician with the form (cameraTlForm), which also
      // holds the schedule. c = the context of the page; the form state lives in c.state.live (the page forgets it when the person leaves the tab).
      function cameraLiveTab(page, c) {
        var est = c.est, t0 = est && est.timelapse;
        var recording = !!(t0 && t0.recording);
        var tech = cameraCanDo("settings");
        var live = c.state.live || (c.state.live = { when: null, name: "", more: false, open: false });
        var card = cameraEl("div", "");
        card.className = "ctl-card wf-card";
        var h = cameraEl("div", "");
        h.className = "ctl-title";
        h.appendChild(cameraEl("span", "")).className = "mdi mdi-video";
        h.appendChild(cameraEl("span", null, i18nT('page.live')));
        card.appendChild(h);
        card.appendChild(cameraEl("div", null, i18nT('live.lead'))).className = "ctl-muted";
        var two = cameraEl("div", "");
        two.className = "ctl-live-two";
        card.appendChild(two);
        var left = cameraEl("div", "display:flex;flex-direction:column;gap:8px;min-width:0;");
        var cam = cameraLiveCamera(c);
        cameraLivePicture(left, c, cam);
        if (recording) { // what the cameras are recording: the last saved photo of each
          left.appendChild(cameraLiveGrid(t0));
          left.appendChild(cameraEl("div", "", i18nT('gallery.the_last_saved_photo_of_each'))).className = "ctl-muted";
        }
        two.appendChild(left);
        var col = cameraEl("div", "display:flex;flex-direction:column;gap:10px;min-width:0;");
        cameraLiveCapture(col, c);
        if (cameraCanDo("timelapse")) {
          if (tech && !recording && c.cfg && c.draft) {
            if (!live.when) live.when = (c.cfg.timelapse || {}).active ? "job" : "now";
            col.appendChild(cameraBtn(i18nT('live.record_timelapse') + "...", "min-height:44px;", function () { live.open = !live.open; live.reveal = live.open; c.rerender(); })); // reveal: the form opens under the picture, out of sight: bring it into view once it is drawn
          }
          col.appendChild(cameraTlBox(function () { c.reload(); }, { noStart: tech })); // the state, Stop and build, the schedule; the operator also starts here
        }
        if (c.state.liveCam === "all" && cameraList.length > 1) { // "All": the light, the focus and the profiles belong to ONE camera each: one titled block per camera
          cameraLiveOrdered(cameraList).forEach(function (x) {
            var blk = cameraEl("div", "display:flex;flex-direction:column;gap:8px;min-width:0;");
            blk.appendChild(cameraEl("div", "font-weight:600;", x.name));
            cameraLiveExtras(blk, c, x);
            col.appendChild(blk);
          });
        } else cameraLiveExtras(col, c, cam);
        two.appendChild(col);
        page.appendChild(card);
        if (recording) live.open = false;
        if (tech && live.open && c.cfg && c.draft) {
          var fc = cameraEl("div", "");
          fc.className = "ctl-card wf-card";
          fc.appendChild(cameraTlForm({
            t: c.draft.timelapse, rerender: c.rerender, form: live, startBlock: cameraAnyAvailability(c.est && c.est.cameras).reason,
            onStart: function () { cameraLiveStart(c, live); },
            onCancel: function () { live.open = false; c.rerender(); },
            onSchedule: function () { live.open = false; c.reload(); },
            goStudio: function () { c.go("studio"); },
          }));
          page.appendChild(fc);
          if (live.reveal) { live.reveal = false; setTimeout(function () { if (fc.scrollIntoView) fc.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 0); }
        }
        if (tech) {
          var how = cameraEl("details", "margin-top:12px;");
          how.appendChild(cameraEl("summary", "cursor:pointer;font-weight:600;min-height:32px;", i18nT('common.how_it_works')));
          how.appendChild(cameraAsWorks());
          page.appendChild(how);
        }
      }

      // "Capture now" of every camera of the relay (the operator's: feature capture); one camera = one button.
      function cameraLiveCapture(col, c) {
        var cs = (c.est && c.est.cameras) || [];
        if (!cs.length || !cameraCanDo("capture")) return;
        cs.forEach(function (cam) {
          var av = cameraAvailability(cam); // A10: a camera that does not respond keeps the button grey, with the reason written next to it
          var label = cs.length > 1 ? i18nT('gallery.capture_now') + ": " + cam.name : i18nT('gallery.capture_now');
          var b = cameraBtn(label, "background:#1976d2;color:#fff;min-height:44px;", function () {
            if (b.disabled) return;
            b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = i18nT('camera.capturing'); // the order was received: said at once, without drawing the page
            cameraRelayCapture(cam.id)
              .then(function (d) {
                if (!d.ok) return c.notice(i18nT('common.couldn_t_error', { error: d.error || "" }), false);
                c.notice(i18nT('gallery.capture_saved') + " " + cam.name, true, true); // quiet: the reload that follows draws the page once
                c.reload();
              })
              .catch(function (e) { c.notice(i18nT('common.couldn_t_error', { error: String(e.message || e) }), false); });
          });
          col.appendChild(b);
          cameraAvailLock(b, av, col);
        });
      }

      // The light, the way to the focus assistant (Image tab) and the quick profiles, each for the view that may use it.
      function cameraLiveExtras(col, c, cam) {
        var extra = cameraEl("div", "display:flex;gap:8px;flex-wrap:wrap;");
        var fl = cameraLiveFlash(cam, function (text) { c.notice(text, false); });
        if (fl) extra.appendChild(fl);
        if (cameraCanDo("focus")) extra.appendChild(cameraBtn(i18nT('live.focus'), "", function () { c.go("image"); }));
        if (extra.children.length) col.appendChild(extra);
        if (cameraCanDo("cameras") && cam) {
          var profs = cameraEl("div", "");
          col.appendChild(profs);
          cameraLiveProfiles(profs, cam, c.notice, c.state);
        }
      }

      // The camera this tab shows: the one picked on its chips, else the one of the viewer.
      function cameraLiveCamera(c) {
        var id = c.state.liveCam;
        return cameraList.filter(function (x) { return x.id === id; })[0] || cameraChosen();
      }

      // ---- "All" in the Live tab: every camera at once, INSIDE the page (not a floating window), each tile with a handle to drag it to another place ----
      var CAMERA_LIVE_ORDER_KEY = "workshopCameraLiveOrder"; // localStorage: the ids of the cameras in the order the person put them

      // The cameras in the saved order (the ones the order does not know go last, in their own order).
      function cameraLiveOrdered(list) {
        var saved = [];
        try { saved = JSON.parse(localStorage.getItem(CAMERA_LIVE_ORDER_KEY) || "[]"); } catch (e) { saved = []; }
        if (!Array.isArray(saved)) saved = [];
        var rank = function (c) { var i = saved.indexOf(c.id); return i < 0 ? saved.length + list.indexOf(c) : i; };
        return list.slice().sort(function (a, b) { return rank(a) - rank(b); });
      }

      // Pointer events (mouse and finger): a press on a .cst-handle picks up its .cst-tile, which FOLLOWS the pointer (lifted, with a shadow) while the tile
      // under it is marked; released over a tile, the dragged one takes its slot and the tiles are moved IN PLACE (no redraw: nothing reloads, no flash).
      // Released over nothing, the tile slides back. onDone(ids) gets the new order of data-cam ids.
      function cameraLiveDrag(grid, onDone) {
        grid.addEventListener("pointerdown", function (ev) {
          var h = ev.target && ev.target.closest ? ev.target.closest(".cst-handle") : null;
          var tile = h && h.closest(".cst-tile");
          if (!tile) return;
          ev.preventDefault();
          var x0 = ev.clientX, y0 = ev.clientY;
          tile.classList.add("drag");
          tile.style.transition = "none";
          var over = null;
          var move = function (e) {
            tile.style.transform = "translate(" + (e.clientX - x0) + "px," + (e.clientY - y0) + "px)";
            var el = document.elementFromPoint(e.clientX, e.clientY); // the lifted tile ignores the pointer (CSS), so this is what is under it
            var t = el && el.closest ? el.closest(".cst-tile") : null;
            if (over) over.classList.remove("over");
            over = t && t !== tile && grid.contains(t) ? t : null;
            if (over) over.classList.add("over");
          };
          var up = function () {
            grid.removeEventListener("pointermove", move);
            grid.removeEventListener("pointerup", up);
            grid.removeEventListener("pointercancel", up);
            tile.classList.remove("drag");
            tile.style.transition = "transform 0.15s ease";
            tile.style.transform = "";
            if (!over) return;
            over.classList.remove("over");
            var kids = [].slice.call(grid.children);
            var from = kids.indexOf(tile), to = kids.indexOf(over);
            grid.insertBefore(tile, from < to ? over.nextSibling : over); // the dragged tile takes the slot of the one it was released over
            onDone([].map.call(grid.children, function (t) { return t.getAttribute("data-cam"); }));
          };
          if (grid.setPointerCapture) { try { grid.setPointerCapture(ev.pointerId); } catch (e) { /* a pointer that is gone */ } }
          grid.addEventListener("pointermove", move);
          grid.addEventListener("pointerup", up);
          grid.addEventListener("pointercancel", up);
        });
      }

      // The grid: a tile per camera (handle, name, ITS OWN mode buttons, its picture). Changing the mode of a tile draws only that tile again.
      function cameraLiveMulti(box, c) {
        var grid = cameraEl("div", "");
        grid.className = "cst-multi";
        cameraLiveOrdered(cameraList).forEach(function (cam) {
          var tile = cameraEl("div", "");
          tile.className = "cst-tile";
          tile.setAttribute("data-cam", cam.id);
          var head = cameraEl("div", "");
          head.className = "cst-tile-head";
          var handle = cameraEl("span", "");
          handle.className = "cst-handle mdi mdi-drag";
          handle.title = i18nT('live.drag_to_move');
          head.appendChild(handle);
          head.appendChild(cameraEl("span", null, cam.name)).className = "cst-tile-name";
          var modes = cameraEl("span", "");
          head.appendChild(modes);
          tile.appendChild(head);
          var holder = cameraEl("div", "");
          tile.appendChild(holder);
          grid.appendChild(tile);
          var F = null, seq = 0;
          var show = function () { // this tile's picture in ITS mode: a photo every 3 s or the live video
            var mine = ++seq;
            cameraFocusDrop(F);
            F = null;
            holder.textContent = "";
            cameraUrls(cam).then(function (u) { if (mine === seq && holder.isConnected) F = cameraFocusPreview(holder, cam, cameraLiveUrls(cam, u), { go: c.go, tile: true }); });
          };
          var paintModes = function () { modes.textContent = ""; modes.appendChild(cameraLiveModes(cam, function () { paintModes(); show(); }, true)); };
          paintModes();
          show();
        });
        cameraLiveDrag(grid, function (ids) { try { localStorage.setItem(CAMERA_LIVE_ORDER_KEY, JSON.stringify(ids)); } catch (e) { /* it still moves for this session */ } });
        box.appendChild(grid);
        box.appendChild(cameraEl("div", null, i18nT('live.multi_hint'))).className = "ctl-muted";
      }

      // What each camera shows: a photo every 3 s (light, the default) or its live video through the relay (it streams only while a picture shows it). It is
      // chosen PER CAMERA and kept in the browser. The video is the same preview with the addresses of a camera that has no still image: the preview
      // already shows those as video.
      var CAMERA_LIVE_MODES_KEY = "workshopCameraLiveModes";
      var cameraLiveModesNow = null; // { camera id: "photo" | "video" }
      function cameraLiveModeOf(id) {
        if (!cameraLiveModesNow) {
          try { cameraLiveModesNow = JSON.parse(localStorage.getItem(CAMERA_LIVE_MODES_KEY) || "{}") || {}; } catch (e) { cameraLiveModesNow = {}; }
        }
        return cameraLiveModesNow[id] === "video" ? "video" : "photo";
      }
      function cameraLiveModeSet(id, mode) {
        cameraLiveModeOf(id);
        cameraLiveModesNow[id] = mode;
        try { localStorage.setItem(CAMERA_LIVE_MODES_KEY, JSON.stringify(cameraLiveModesNow)); } catch (e) { /* it still changes for this session */ }
      }
      function cameraLiveUrls(cam, u) {
        return cameraLiveModeOf(cam.id) === "video" && u.video ? { photo: "", video: u.video } : u;
      }
      // The two buttons of a camera. compact = the icons in the header of a tile; else the chips under the camera chips. onPick(mode) after the change.
      function cameraLiveModes(cam, onPick, compact) {
        var row = cameraEl("span", "");
        row.className = compact ? "cst-modes" : "cst-chips";
        ["photo", "video"].forEach(function (m) {
          var on = cameraLiveModeOf(cam.id) === m;
          var label = m === "video" ? i18nT('live.mode_video') : i18nT('live.mode_photo');
          var b = cameraEl("button", null, compact ? "" : label);
          b.type = "button";
          b.className = (compact ? "cst-mode mdi " + (m === "video" ? "mdi-video-outline" : "mdi-image-outline") : "cst-chip") + (on ? " on" : "");
          b.title = label;
          b.setAttribute("aria-label", label);
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.addEventListener("click", function () { if (cameraLiveModeOf(cam.id) !== m) { cameraLiveModeSet(cam.id, m); onPick(m); } });
          row.appendChild(b);
        });
        return row;
      }

      // The picture of the Live tab: the chips of the cameras ("All" opens the mosaic), the preview photo of the Image tab and the button that opens
      // the floating viewer. The addresses of the camera are read once per camera and kept in the state of the page.
      function cameraLivePicture(box, c, cam) {
        studioCss(); // the frame of the picture (18-tl-studio.js)
        var multi = c.state.liveCam === "all"; // "All": every camera at once in a grid of tiles (cameraLiveMulti)
        var chips = cameraEl("div", "");
        chips.className = "cst-chips";
        cameraList.forEach(function (x) {
          var b = cameraEl("button", null, x.name);
          b.type = "button";
          b.className = "cst-chip" + (!multi && x.id === cam.id ? " on" : "");
          b.addEventListener("click", function () { c.state.liveCam = x.id; c.rerender(); });
          chips.appendChild(b);
        });
        if (cameraList.length > 1) {
          var all = cameraEl("button", null, i18nT('live.all_cameras'));
          all.type = "button";
          all.className = "cst-chip" + (multi ? " on" : "");
          all.addEventListener("click", function () { c.state.liveCam = "all"; c.rerender(); }); // in the page, not a floating window (the viewer keeps its own mosaic button)
          chips.appendChild(all);
        }
        box.appendChild(chips); if (!multi) box.appendChild(cameraLiveModes(cam, function () { c.rerender(); })); // in "All" each tile has its own
        var holder = cameraEl("div", "");
        box.appendChild(holder);
        var kept = c.state.liveUrls;
        if (multi) cameraLiveMulti(holder, c);
        else if (kept && kept.id === cam.id) cameraFocusPreview(holder, cam, cameraLiveUrls(cam, kept.u), { go: c.go }); // 11-focus.js: the same preview as the tab Image, with its state and help
        else {
          holder.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
          cameraUrls(cam).then(function (u) {
            c.state.liveUrls = { id: cam.id, u: u };
            if (holder.isConnected) { holder.textContent = ""; cameraFocusPreview(holder, cam, cameraLiveUrls(cam, u), { go: c.go }); }
          });
        }
        if (typeof cameraExpand === "function" && cameraPanelEl) {
          var row = cameraEl("div", "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
          var vb = cameraBtn("", "", function () { if (isCameraOpen()) cameraCollapse(); else cameraExpand(); paintViewer(); }), vh = cameraEl("span", null, "");
          // the button says what it will do (open the viewer, or close it when it is open) and is repainted IN PLACE: drawing the whole page again made the picture flash
          var paintViewer = function () { if (!vb.isConnected && vb.painted) { cameraStateListeners = cameraStateListeners.filter(function (f) { return f !== paintViewer; }); return; } vb.painted = true; var o = isCameraOpen(); vb.textContent = i18nT(o ? 'live.close_viewer' : 'live.open_viewer'); vb.className = "wf-btn" + (o ? " ctl-on" : ""); vh.textContent = i18nT(o ? 'live.viewer_is_open' : 'live.viewer_hint'); };
          paintViewer(); cameraStateListeners.push(paintViewer); vh.className = "ctl-muted"; row.appendChild(vb); row.appendChild(vh);
          box.appendChild(row);
        }
      }
