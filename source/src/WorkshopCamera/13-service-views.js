      // ---- Pieces of the floating viewer and of its gallery sheet that used to live inside the big functions (F3-C) ----

      // The capture button of the viewer: current = the camera being seen (12-cameras.js), notify(text) = the toast of the panel.
      function cameraPanelCapture(current, notify) {
        var rid = cameraRelayId(current || { id: "main", url: "" });
        if (!rid) return notify(i18nT(cameraCanDo("tech_terms") ? 'camera.this_camera_doesn_t_go_through' : 'roles.this_camera_cannot_capture'));
        notify(i18nT('camera.capturing'));
        cameraCapture(rid)
          .then(function (d) { notify(d.ok ? i18nT('camera.capture_saved_captures_and_timelapse') : i18nT('common.couldn_t_error', { error: d.error || "" })); })
          .catch(function (e) { notify(i18nT('camera.could_not_capture', { error: String(e.message || e) })); });
      }

      // The record button of the viewer: one tap starts a manual timelapse, another stops it.
      function cameraPanelTimelapse(notify) {
        var tl = (cameraState && cameraState.timelapse) || {};
        var stopping = !!tl.recording;
        notify(i18nT(stopping ? 'camera.stopping_the_timelapse' : 'camera.starting_the_timelapse'));
        cameraTimelapse(stopping ? "stop" : "begin")
          .then(function (d) {
            if (d.ok) return notify(i18nT(stopping ? 'camera.timelapse_stopped_the_video_is_built' : 'camera.recording_timelapse_another_tap_stops_it'));
            notify(i18nT('common.couldn_t_error', { error: d.error || "" }));
          })
          .catch(function (e) { notify(i18nT('common.couldn_t_error', { error: String(e.message || e) })); })
          .then(cameraStateRead);
      }

      // What the gallery sheet shows when a video or a photo is opened big: viewing = {kind: "video" | "photo", file}.
      function cameraGalleryOpened(viewing, onClose, onDelete) {
        var v = cameraEl("div", "margin-top:10px;");
        var src = cameraRelayBase() + (viewing.kind === "video" ? "/timelapses/" : "/captures/") + encodeURIComponent(viewing.file);
        if (viewing.kind === "video") {
          var vid = cameraEl("video", "width:100%;border-radius:6px;background:#000;");
          vid.controls = true;
          vid.autoplay = true;
          vid.src = src;
          v.appendChild(vid);
        } else {
          v.appendChild(cameraEl("img", "width:100%;border-radius:6px;background:#000;")).src = src;
        }
        var vf = cameraEl("div", "display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;");
        var a = cameraEl("a", "display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:6px;background:#1976d2;color:#fff;text-decoration:none;", i18nT('common.download'));
        a.href = src + "?download=1";
        a.setAttribute("download", viewing.file);
        vf.appendChild(a);
        vf.appendChild(cameraBtnDouble(i18nT('common.delete'), i18nT('common.delete_confirm'), "", function () { onDelete(viewing.file); }));
        vf.appendChild(cameraBtn(i18nT('common.close'), "", onClose));
        v.appendChild(vf);
        return v;
      }

      // The page "Timelapses y capturas" for a view that has no gallery (a visitor): one clear line instead of an empty or failing page.
      function cameraGalleryDenied(root) {
        var d = cameraEl("div", "padding:16px;font:14px Roboto,sans-serif;", i18nT('roles.no_permission'));
        d.setAttribute("data-workshop-i18n", "");
        root.appendChild(d);
        return { destroy: function () {} };
      }

      // The saved tab of the gallery page ("record" when there is none or it is not allowed to this view).
      function cameraGalleryTab(key) {
        var tab = "record";
        try {
          var p0 = localStorage.getItem(key);
          if (["record", "videos", "captures", "settings"].indexOf(p0) >= 0) tab = p0;
        } catch (e) {
          /* Grabar */
        }
        return tab === "settings" && !cameraCanDo("settings") ? "record" : tab;
      }
