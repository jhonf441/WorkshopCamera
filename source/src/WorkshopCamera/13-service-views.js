      // ---- Pieces of the floating viewer and of the page that used to live inside the big functions (F3-C) ----

      // The capture button of the viewer: current = the camera being seen (12-cameras.js), notify(text) = the toast of the panel.
      function cameraPanelCapture(current, notify) {
        var rid = cameraRelayId(current);
        if (!rid) return notify(i18nT(cameraCanDo("tech_terms") ? 'camera.this_camera_doesn_t_go_through' : 'roles.this_camera_cannot_capture'));
        notify(i18nT('camera.capturing'));
        cameraRelayCapture(rid)
          .then(function (d) { notify(d.ok ? i18nT('camera.capture_saved_captures_and_timelapse') : i18nT('common.couldn_t_error', { error: d.error || "" })); })
          .catch(function (e) { notify(i18nT('camera.could_not_capture', { error: String(e.message || e) })); });
      }

      // The page "Timelapses y capturas" for a view that has no gallery (a visitor): one clear line instead of an empty or failing page.
      function cameraGalleryDenied(root) {
        var d = cameraEl("div", "padding:16px;font:14px Roboto,sans-serif;", i18nT('roles.no_permission'));
        d.setAttribute("data-workshop-i18n", "");
        root.appendChild(d);
        return { destroy: function () {} };
      }

      // The tab the page opens on: the one the address asks for (/Plugins/Timelapses?tab=cameras: the link of another page, such as the page of the
      // service) or else the saved one; an id of the 7 tabs of before is moved to its section (cameraPageTabMigrate); "live" when there is none or it is not
      // allowed to this view (18-page-tabs.js).
      function cameraGalleryTab(key) {
        var wanted = null;
        try {
          wanted = workshopHostCurrentQuery().tab || localStorage.getItem(key);
        } catch (e) {
          /* live */
        }
        wanted = cameraPageTabMigrate(wanted);
        return cameraPageTabsFor(cameraCanDo).indexOf(wanted) >= 0 ? wanted : "live";
      }
