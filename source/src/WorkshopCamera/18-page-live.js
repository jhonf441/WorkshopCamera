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
      // as in the Image tab. Draws itself into `holder` once the service answers.
      function cameraLiveProfiles(holder, cam, notify) {
        cameraImageGet(cam.id)
          .then(function (d) {
            if (!d || !d.ok || !holder.isConnected) return;
            var plain = !Object.keys(d.settings || {}).length;
            holder.appendChild(cameraEl("div", "font-size:12px;opacity:.7;margin-bottom:4px;", i18nT('live.image')));
            var chips = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
            d.profiles.forEach(function (p) {
              var on = d.profile === p.id && plain;
              var c = cameraBtn(cameraProfileInfo(p.id)[0], on ? "border:1px solid #1976d2;" : "", function () {
                cameraImageSet(cam.id, { profile: p.id }).then(function (r) {
                  notify(r && r.ok ? i18nT('live.profile_applied', { name: cameraProfileInfo(p.id)[0] }) : i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: (r && r.error) || "" }), !!(r && r.ok));
                });
              });
              chips.appendChild(c);
            });
            holder.appendChild(chips);
          })
          .catch(function () { /* the Image tab says what is wrong */ });
      }

      // Starts what the form says. c = the context of the page (17-gallery.js ctx()), live = the form state. "job" saves the mode (a timelapse with
      // every job); "now" saves the draft when it changed (the relay records with the saved settings) and begins by hand.
      function cameraLiveStart(c, live) {
        if (live.when === "job") c.draft.timelapse.active = true;
        var changed = JSON.stringify(c.cfg) !== JSON.stringify(c.draft);
        var saved = changed ? cameraService(c.draft).then(function (r) { c.saved(r); }) : Promise.resolve();
        c.notice(i18nT('common.saving'));
        saved
          .then(function () {
            if (live.when === "job") return { ok: true, saved: true };
            return cameraRelayTimelapse("begin", { name: (live.name || "").trim() || null });
          })
          .then(function (d) {
            if (d.ok) { live.open = false; live.name = ""; }
            c.notice(d.ok ? (d.saved ? i18nT('common.settings_saved_on_the_system_they') : i18nT('studio.take_started')) : i18nT('common.couldn_t_error', { error: d.error || "" }), !!d.ok);
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
            col.appendChild(cameraBtn(i18nT('live.record_timelapse') + "...", "min-height:44px;", function () { live.open = !live.open; c.rerender(); }));
          }
          col.appendChild(cameraTlBox(function () { c.reload(); }, { noStart: tech })); // the state, Stop and build, the schedule; the operator also starts here
        }
        cameraLiveExtras(col, c, cam);
        two.appendChild(col);
        page.appendChild(card);
        if (recording) live.open = false;
        if (tech && live.open && c.cfg && c.draft) {
          var fc = cameraEl("div", "");
          fc.className = "ctl-card wf-card";
          fc.appendChild(cameraTlForm({
            t: c.draft.timelapse, rerender: c.rerender, form: live,
            onStart: function () { cameraLiveStart(c, live); },
            onCancel: function () { live.open = false; c.rerender(); },
            onSchedule: function () { live.open = false; c.reload(); },
            goStudio: function () { c.go("studio"); },
          }));
          page.appendChild(fc);
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
          col.appendChild(cameraBtn(cs.length > 1 ? i18nT('gallery.capture_now') + ": " + cam.name : i18nT('gallery.capture_now'), "background:#1976d2;color:#fff;min-height:44px;", function () {
            cameraRelayCapture(cam.id)
              .then(function (d) {
                if (!d.ok) return c.notice(i18nT('common.couldn_t_error', { error: d.error || "" }), false);
                c.notice(i18nT('gallery.capture_saved') + " " + cam.name);
                c.reload();
              })
              .catch(function (e) { c.notice(i18nT('common.couldn_t_error', { error: String(e.message || e) }), false); });
          }));
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
          cameraLiveProfiles(profs, cam, c.notice);
        }
      }

      // The camera this tab shows: the one picked on its chips, else the one of the viewer.
      function cameraLiveCamera(c) {
        var id = c.state.liveCam;
        return cameraList.filter(function (x) { return x.id === id; })[0] || cameraChosen();
      }

      // The picture of the Live tab: the chips of the cameras ("All" opens the mosaic), the preview photo of the Image tab and the button that opens
      // the floating viewer. The addresses of the camera are read once per camera and kept in the state of the page.
      function cameraLivePicture(box, c, cam) {
        studioCss(); // the frame of the picture (18-tl-studio.js)
        var chips = cameraEl("div", "");
        chips.className = "cst-chips";
        cameraList.forEach(function (x) {
          var b = cameraEl("button", null, x.name);
          b.type = "button";
          b.className = "cst-chip" + (x.id === cam.id ? " on" : "");
          b.addEventListener("click", function () { c.state.liveCam = x.id; c.rerender(); });
          chips.appendChild(b);
        });
        if (cameraList.length > 1) {
          var all = cameraEl("button", null, i18nT('live.all_cameras'));
          all.type = "button";
          all.className = "cst-chip";
          all.addEventListener("click", function () { cameraOpenMosaic(); }); // the same mosaic as the viewer's button
          chips.appendChild(all);
        }
        box.appendChild(chips);
        var holder = cameraEl("div", "");
        box.appendChild(holder);
        var kept = c.state.liveUrls;
        if (kept && kept.id === cam.id) cameraFocusPreview(holder, cam, kept.u, { go: c.go }); // 11-focus.js: the same preview as the tab Image, with its state and help
        else {
          holder.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
          cameraUrls(cam).then(function (u) {
            c.state.liveUrls = { id: cam.id, u: u };
            if (holder.isConnected) { holder.textContent = ""; cameraFocusPreview(holder, cam, u, { go: c.go }); }
          });
        }
        if (typeof cameraExpand === "function" && cameraPanelEl) {
          var row = cameraEl("div", "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
          row.appendChild(cameraBtn(i18nT('live.open_viewer'), "", function () { cameraExpand(); })); // what the button of the launcher does: shows the floating viewer
          row.appendChild(cameraEl("span", null, i18nT('live.viewer_hint'))).className = "ctl-muted";
          box.appendChild(row);
        }
      }
