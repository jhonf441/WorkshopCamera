      // ---- Tab "Live" of the page: what goes next to the capture and the timelapse (informe-07, mockup 2026-11-01) ----
      //
      // The picture of this tab is the preview of the tab Image (cameraFocusPreview, 11-focus.js): a photo that refreshes every 3 s. The live video
      // stays in the floating viewer (10-camera.js), which holds the only /stream of the camera: the page never opens a second one. Here also: the
      // light, the way to the focus assistant and the quick profiles of the image. They call what the viewer and the Image tab call.

      // The button "Light / flash" of the camera on this screen, or null when the view or the camera has none (same rule as the viewer's button).
      // camera = a camera of the list; notify(text) shows a message.
      // asIcon: the icon of the tools row of the Live tab (mdi-flash / mdi-flash-off, its words as the name), else a text button (a tile of "All").
      function cameraLiveFlash(camera, notify, asIcon) {
        if (!camera || !cameraCanDo("flash")) return null;
        var e = cameraStateOf(cameraRelayId(camera));
        var f = (e && e.flash) || camera.flash || null;
        var own = !!camera.esp32 && !(f && f.capable === false);
        if (!cameraFlashShown(camera, own)) return null;
        var on = !!(f && f.on);
        var words = function () { return i18nT('live.flash') + (on ? " · " + i18nT('live.on') : ""); };
        var paint = function () {
          b.setAttribute("aria-pressed", on ? "true" : "false");
          if (!asIcon) { b.textContent = words(); return; }
          b.title = words();
          b.setAttribute("aria-label", words());
          var ic = b.querySelector ? b.querySelector(".mdi") : null;
          if (ic) ic.className = "mdi " + (on ? "mdi-flash" : "mdi-flash-off");
        };
        var tap = function () {
          var wanted = !on;
          cameraFlashSet(camera, wanted).then(function (r) {
            if (r.ok) {
              on = wanted;
              paint();
            } else notify(r.error || i18nT('camera.could_not_switch_the_flash'));
          });
        };
        var b = asIcon ? cameraIconBtn(on ? "mdi-flash" : "mdi-flash-off", words(), tap) : cameraBtn(words(), "", tap);
        paint();
        return b;
      }

      // The profiles of the image as chips (the technician's: the service refuses camera.image.set to anyone else). One tap applies and saves it,
      // as in the Image tab. Draws itself into `holder`: at once from what was read last time (store.liveProfiles, kept while the person stays in the tab),
      // and asks the service again only when that is older than 30 s, repainting only when the answer is different. Before, every draw of the tab left
      // the holder empty until the service answered, so the section went out and came back at each redraw.
      var CAMERA_LIVE_PROFILES_FRESH_MS = 30000;
      // opts.select: ONE select of the profiles (44 px) instead of the chips: the tile of a camera in "All" has little room (2026-11-22)
      function cameraLiveProfiles(holder, cam, notify, store, opts) {
        var cache = (store && (store.liveProfiles || (store.liveProfiles = {}))) || {};
        var drawn = null;
        var asSelect = !!(opts && opts.select);
        function applyProfile(id) {
          cameraImageSet(cam.id, { profile: id }).then(function (r) {
            delete cache[cam.id]; // what the camera has changed: the next draw reads it again
            notify(r && r.ok ? i18nT('live.profile_applied', { name: cameraProfileInfo(id)[0] }) : i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: (r && r.error) || "" }), !!(r && r.ok));
          });
        }
        function drawSelect(d, plain) {
          var row = cameraEl("label", "display:flex;align-items:center;gap:8px;min-width:0;");
          row.appendChild(cameraEl("span", "flex:0 0 auto;font-size:12px;opacity:.7;", i18nT('live.image')));
          var sel = workshopInputEl("select", "flex:1 1 140px;min-width:0;");
          sel.setAttribute("aria-label", i18nT('live.image'));
          if (!plain || !d.profile) {
            var o0 = document.createElement("option");
            o0.value = "";
            o0.textContent = i18nT('live.image_custom');
            o0.disabled = true;
            sel.appendChild(o0);
          }
          d.profiles.forEach(function (p) {
            var o = document.createElement("option");
            o.value = p.id;
            o.textContent = cameraProfileInfo(p.id)[0];
            sel.appendChild(o);
          });
          sel.value = plain && d.profile ? d.profile : "";
          sel.addEventListener("change", function () { if (sel.value) applyProfile(sel.value); });
          row.appendChild(sel);
          holder.appendChild(row);
        }
        function draw(d) {
          var sig = JSON.stringify(d);
          if (sig === drawn) return;
          drawn = sig;
          holder.textContent = "";
          var plain = !Object.keys(d.settings || {}).length;
          if (asSelect) return drawSelect(d, plain);
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

      // The tab "Live" (CAMARA-REDISENO.md, owner 2026-11-23: "a redesign of the whole page, not spot changes"). Two cards side by side on a wide page
      // (one under the other on a tablet or a phone): "View" = a row of 32 px tools ABOVE the picture (the cameras and the mode at the left; light, focus,
      // the floating viewer and full screen as icons at the right), the picture at the whole width of the card, its state in ONE line and, only when the
      // camera fails, the ONE fold of the recovery; "Actions" = capture now (the main button), record a timelapse, the timelapse box and the last file saved.
      // The picture of the camera is the floating viewer's (it holds the only /stream of the camera): while a timelapse records, the last photo of
      // each camera is here. The operator starts a timelapse with a name (cameraTlBox); the technician with the form (cameraTlForm), which also
      // holds the schedule. c = the context of the page; the form state lives in c.state.live (the page forgets it when the person leaves the tab).
      function cameraLiveTab(page, c) {
        var est = c.est, t0 = est && est.timelapse;
        var recording = !!(t0 && t0.recording);
        var tech = cameraCanDo("settings");
        var live = c.state.live || (c.state.live = { when: null, name: "", more: false, open: false });
        var cam = cameraLiveCamera(c);
        var multi = c.state.liveCam === "all" && cameraList.length > 1; // "All": every camera at once in a grid of tiles (cameraLiveMulti)
        var grid = cameraEl("div", "");
        grid.className = "ctl-live2";
        var view = cameraLiveCard("mdi-video", i18nT('page.live'), i18nT('live.lead'));
        var pic = cameraEl("div", "");
        pic.className = "ctl-live-pic";
        view.appendChild(cameraLiveTools(c, cam, multi, pic));
        view.appendChild(pic);
        cameraLivePicture(pic, c, cam);
        if (recording) { // what the cameras are recording: the last saved photo of each
          view.appendChild(cameraLiveGrid(t0));
          view.appendChild(cameraEl("div", "", i18nT('gallery.the_last_saved_photo_of_each'))).className = "ctl-muted";
        }
        grid.appendChild(view);
        var acts = cameraLiveCard("mdi-gesture-tap-button", i18nT('live.actions'), "");
        cameraLiveCapture(acts, c);
        if (cameraCanDo("timelapse")) {
          if (tech && !recording && c.cfg && c.draft) {
            if (!live.when) live.when = (c.cfg.timelapse || {}).active ? "job" : "now";
            acts.appendChild(cameraBtn(i18nT('live.record_timelapse') + "...", "", function () { live.open = !live.open; live.reveal = live.open; c.rerender(); })); // reveal: the form opens under the cards, out of sight: bring it into view once it is drawn
          }
          acts.appendChild(cameraTlBox(function () { c.reload(); }, { noStart: tech })); // the state, Stop and build, the schedule; the operator also starts here
          acts.appendChild(cameraReasonEl("timelapse"));
        }
        // the quick profiles of the image belong to ONE camera: in "All" each tile has its own
        if (!multi && cameraCanDo("cameras") && cam) {
          var profs = cameraEl("div", "");
          acts.appendChild(profs);
          cameraLiveProfiles(profs, cam, c.notice, c.state, { select: true });
          acts.appendChild(cameraReasonEl("image", cam.id));
        }
        if (!multi && cam && cameraCanDo("flash")) acts.appendChild(cameraReasonEl("light", cam.id));
        acts.appendChild(cameraLiveLastSaved(c));
        grid.appendChild(acts);
        page.appendChild(grid);
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
          var how = workshopHelpFoldEl({ title: i18nT('common.how_it_works'), rows: [] }); // the family's fold, with the three numbered steps as its body
          how.style.marginTop = "12px";
          how.querySelector(".wf-help-fold-body").appendChild(cameraAsWorks());
          page.appendChild(how);
        }
      }

      // A card of the tab: the family card with its title (gray icon 20 + 16/600); tip = what the card is for, as the tooltip of the title
      function cameraLiveCard(icon, title, tip) {
        var card = cameraEl("div", "");
        card.className = "ctl-card wf-card";
        var h = cameraEl("div", "");
        h.className = "ctl-title";
        h.appendChild(cameraEl("span", "")).className = "mdi " + icon;
        h.appendChild(cameraEl("span", null, title));
        if (tip) h.title = tip;
        card.appendChild(h);
        return card;
      }

      // The row of tools above the picture (32 px each): the chips of the cameras ("All" shows every camera in the page) and the mode of the camera at the
      // left; the light, the focus assistant, the floating viewer and full screen as icons at the right. pic = the box of the picture (full screen).
      function cameraLiveTools(c, cam, multi, pic) {
        studioCss(); // the chips (18-tl-studio.js)
        var row = cameraEl("div", "");
        row.className = "ctl-live-tools";
        var left = cameraEl("div", "");
        left.className = "ctl-live-tools-l";
        var chips = cameraEl("div", "");
        chips.className = "wf-seg"; // the cameras and the mode: two groups of the family's segments, 8 px apart (ux 2026-11-23)
        chips.setAttribute("role", "group");
        chips.setAttribute("aria-label", i18nT('cameras.cameras'));
        cameraList.forEach(function (x) {
          var b = cameraEl("button", null, x.name);
          b.type = "button";
          b.className = "wf-btn";
          b.setAttribute("aria-pressed", !multi && x.id === cam.id ? "true" : "false");
          b.addEventListener("click", function () { c.state.liveCam = x.id; c.rerender(); });
          chips.appendChild(b);
        });
        if (cameraList.length > 1) {
          var all = cameraEl("button", null, i18nT('live.all_cameras'));
          all.type = "button";
          all.className = "wf-btn";
          all.setAttribute("aria-pressed", multi ? "true" : "false");
          all.addEventListener("click", function () { c.state.liveCam = "all"; c.rerender(); }); // in the page, not a floating window (the viewer keeps its own mosaic button)
          chips.appendChild(all);
        }
        left.appendChild(chips);
        if (!multi && cam) left.appendChild(cameraLiveModes(cam, function () { c.rerender(); })); // in "All" each tile has its own
        row.appendChild(left);
        var right = cameraEl("div", "");
        right.className = "ctl-live-tools-r";
        if (!multi && cam) {
          var fl = cameraLiveFlash(cam, function (text) { c.notice(text, false); }, true);
          if (fl) right.appendChild(fl);
          if (cameraCanDo("focus")) right.appendChild(cameraIconBtn("mdi-image-filter-center-focus", i18nT('live.focus'), function () { c.go("image"); }));
        }
        var vb = cameraLiveViewerBtn();
        if (vb) right.appendChild(vb);
        var fs = cameraLiveFullscreenBtn(pic);
        if (fs) right.appendChild(fs);
        row.appendChild(right);
        return row;
      }

      // The icon that opens (or closes) the floating viewer, repainted IN PLACE: it says what it will do and is pressed while the viewer is open
      function cameraLiveViewerBtn() {
        if (typeof cameraExpand !== "function" || !cameraPanelEl) return null;
        var vb = cameraIconBtn("mdi-picture-in-picture-bottom-right", "", function () { if (isCameraOpen()) cameraCollapse(); else cameraExpand(); paint(); });
        var paint = function () {
          if (!vb.isConnected && vb.painted) { cameraStateListeners = cameraStateListeners.filter(function (f) { return f !== paint; }); return; }
          vb.painted = true;
          var o = isCameraOpen();
          var words = i18nT(o ? 'live.close_viewer' : 'live.open_viewer');
          vb.title = words;
          vb.setAttribute("aria-label", words);
          vb.setAttribute("aria-pressed", o ? "true" : "false");
        };
        paint();
        cameraStateListeners.push(paint);
        return vb;
      }

      // Full screen for the picture of the card (the browser's own), when the browser offers it
      function cameraLiveFullscreenBtn(pic) {
        if (typeof document === "undefined" || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return null;
        return cameraIconBtn("mdi-fullscreen", i18nT('live.fullscreen'), function () {
          var go = pic.requestFullscreen || pic.webkitRequestFullscreen;
          if (go) go.call(pic);
        });
      }

      // The last file saved (a capture or a video), with its date, under the actions: what the last tap left on the system
      function cameraLiveLastSaved(c) {
        var line = cameraEl("div", "");
        line.className = "ctl-muted ctl-live-last";
        var f = c.files || {};
        var items = typeof cameraLibraryItems === "function" ? cameraLibraryItems(f.tls || [], f.caps || [], "all", function () { return true; }) : [];
        var x = items[0] && items[0].x;
        line.textContent = x ? i18nT('live.last_saved', { name: x.name || x.job || x.file, when: cameraWhen(x.start || x.ts) }) : i18nT('live.nothing_saved');
        return line;
      }

      // The button that captures ONE camera (the operator's: feature capture). A camera that does not respond keeps it grey (cameraAvailLock: the reason is the
      // title; `reasonHost`, when given, also gets the reason written under the button). label = its text.
      function cameraLiveCaptureBtn(cam, c, label, reasonHost) {
        var av = cameraAvailability(cam); // A10: a camera that does not respond keeps the button grey, with the reason written next to it
        var b = cameraBtn(label, "background:#1976d2;color:#fff;", function () {
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
        cameraAvailLock(b, av, reasonHost || null);
        return b;
      }

      // "Capture now" of the side column (the operator's: feature capture): one camera = its own button; several = ONE button for all of them ("Capture
      // all": the ones that respond; each camera keeps its own button next to its picture: cameraLiveTileControls, cameraLiveExtras).
      function cameraLiveCapture(col, c) {
        var cs = (c.est && c.est.cameras) || [];
        if (!cs.length || !cameraCanDo("capture")) return;
        if (cs.length === 1) {
          col.appendChild(cameraLiveCaptureBtn(cs[0], c, i18nT('gallery.capture_now'), col));
          col.appendChild(cameraReasonEl("capture", cs[0].id)); // 09-camera-access-reasons.js: why the service refuses the capture, when it does
          return;
        }
        var ready = cs.filter(function (cam) { return cameraAvailability(cam).ok; });
        var all = cameraBtn(i18nT('live.capture_all'), "background:#1976d2;color:#fff;", function () {
          if (all.disabled) return;
          all.disabled = true; all.setAttribute("aria-busy", "true"); all.textContent = i18nT('camera.capturing');
          Promise.all(ready.map(function (cam) { return cameraRelayCapture(cam.id).catch(function (e) { return { ok: false, error: String(e.message || e) }; }); }))
            .then(function (rs) {
              var bad = rs.filter(function (d) { return !d.ok; })[0];
              if (bad) return c.notice(i18nT('common.couldn_t_error', { error: bad.error || "" }), false);
              c.notice(i18nT('gallery.capture_saved'), true, true);
              c.reload();
            });
        });
        if (!ready.length) { all.disabled = true; all.title = cameraAvailability(cs[0]).reason; }
        col.appendChild(all);
        cs.forEach(function (cam) { col.appendChild(cameraReasonEl("capture", cam.id)); });
      }

      // What belongs to ONE camera, under its picture in "All" (2026-11-22: the controls were one long column far from the cameras, and nothing said whose button
      // it was): Capture, Light, Focus and the image profile in ONE select. 44 px, one wrapping row; a camera that does not respond greys only ITS buttons and
      // says why in a line of fixed height (so the tile does not jump when the answer comes).
      function cameraLiveTileControls(cam, c) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:8px;margin-top:8px;min-width:0;");
        var av = cameraAvailability(cam);
        var row = cameraEl("div", "display:flex;gap:8px;flex-wrap:wrap;align-items:center;");
        var notify = function (text, ok) { c.notice(text, !!ok); };
        if (cameraCanDo("capture")) row.appendChild(cameraLiveCaptureBtn(cam, c, i18nT('live.capture'), null));
        var fl = cameraLiveFlash(cam, notify);
        if (fl) { cameraAvailLock(fl, av, null); row.appendChild(fl); }
        if (cameraCanDo("focus")) {
          var fb = cameraBtn(i18nT('live.focus'), "", function () {
            var S = c.state.image || (c.state.image = { ctx: c, root: null, cam: cam.id, urls: null }); // the Image tab opens on THIS camera
            if (S.cam !== cam.id) { S.cam = cam.id; S.urls = null; }
            c.go("image");
          });
          cameraAvailLock(fb, av, null);
          row.appendChild(fb);
        }
        if (row.children.length) box.appendChild(row);
        if (cameraCanDo("cameras") && cam.esp32) {
          var profs = cameraEl("div", "min-width:0;");
          box.appendChild(profs);
          cameraLiveProfiles(profs, cam, c.notice, c.state, { select: true });
        }
        var why = cameraEl("div", "min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", av.ok ? "" : av.reason);
        why.className = "ctl-muted";
        if (!av.ok) why.title = av.reason;
        box.appendChild(why);
        return box;
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
          tile.appendChild(cameraLiveTileControls(cam, c)); // its own capture, light, focus and image profile (2026-11-22)
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
        row.className = compact ? "cst-modes" : "wf-seg";
        ["photo", "video"].forEach(function (m) {
          var on = cameraLiveModeOf(cam.id) === m;
          var label = m === "video" ? i18nT('live.mode_video') : i18nT('live.mode_photo');
          var b = cameraEl("button", null, compact ? "" : label);
          b.type = "button";
          b.className = compact ? "cst-mode mdi " + (m === "video" ? "mdi-video-outline" : "mdi-image-outline") + (on ? " on" : "") : "wf-btn";
          b.title = label;
          b.setAttribute("aria-label", label);
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.addEventListener("click", function () { if (cameraLiveModeOf(cam.id) !== m) { cameraLiveModeSet(cam.id, m); onPick(m); } });
          row.appendChild(b);
        });
        return row;
      }

      // The picture of the Live tab: the same preview as the tab Image (a photo every 3 s, or the live video), its ONE line of state and, when the camera
      // fails, the ONE fold of the recovery (11-focus.js, 14-health-recover.js); in "All" the grid of tiles. The addresses of the camera are read once per
      // camera and kept in the state of the page. The chips, the mode and the viewer are the tools row above it (cameraLiveTools).
      function cameraLivePicture(box, c, cam) {
        studioCss(); // the frame of the picture (18-tl-studio.js)
        if (c.state.liveCam === "all") return cameraLiveMulti(box, c);
        var kept = c.state.liveUrls;
        if (kept && kept.id === cam.id) return cameraFocusPreview(box, cam, cameraLiveUrls(cam, kept.u), { go: c.go, live: true });
        box.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
        cameraUrls(cam).then(function (u) {
          c.state.liveUrls = { id: cam.id, u: u };
          if (box.isConnected) { box.textContent = ""; cameraFocusPreview(box, cam, cameraLiveUrls(cam, u), { go: c.go, live: true }); }
        });
      }
