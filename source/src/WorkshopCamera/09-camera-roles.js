      // ---- Views by role and the check of the relay contract (F3-C, 2026-10-21) ----
      //
      // The SERVICE decides who may do what (permissions.py); this only hides what the role cannot do and writes the rest in plain
      // words. Four views, from the identity of workshopIdentity() (01-api-auth.js):
      //   full        no identity yet, or a service without users or older than the roles: everything, as before (compatibility)
      //   technician  technician and admin: everything (settings, the list of cameras with their addresses, orientation, schedule, limits)
      //   operator    operator: see the cameras, capture, timelapse (start / stop / watch), gallery; no technical terms
      //   viewer      a viewer WITH the camera enabled for visitors (camera_for_viewer): only watches
      //   denied      a viewer without the camera: no viewer, a clear message instead of an error
      // Pure functions first (tests/camera-roles.test.js loads this file alone); the ones that touch the page are at the end.

      var CAMERA_RELAY_PROTO = 2; // the contract with the relay (port 8090) this page was written for; camera_proto.py PROTO in the service

      var CAMERA_VIEW_FEATURES = {
        denied: [],
        viewer: ["view", "mosaic", "zoom"],
        operator: ["view", "mosaic", "zoom", "capture", "timelapse", "gallery"],
        technician: ["view", "mosaic", "zoom", "capture", "timelapse", "gallery", "settings", "cameras", "tech_terms", "focus"],
      };
      CAMERA_VIEW_FEATURES.full = CAMERA_VIEW_FEATURES.technician;

      function cameraViewOf(identity) {
        if (!identity || !identity.table || !identity.role || identity.compat || identity.configured === false) return "full";
        if (identity.role === "viewer") return identity.user && identity.user.camera ? "viewer" : "denied";
        if (identity.role === "operator") return "operator";
        return "technician";
      }

      function cameraFeatureIn(view, feature) {
        return (CAMERA_VIEW_FEATURES[view] || []).indexOf(feature) >= 0;
      }

      // The state of the relay (/state) against this page: "unknown" (no answer), "ok", "service_old" (no proto or a smaller one:
      // update the service) or "plugin_old" (a bigger one: update the plugin).
      function cameraProtoCheck(state) {
        if (!state) return "unknown";
        var p = typeof state.proto === "number" ? state.proto : 1;
        return p === CAMERA_RELAY_PROTO ? "ok" : p < CAMERA_RELAY_PROTO ? "service_old" : "plugin_old";
      }

      // The route that saves a photo: the current name from proto 2 on; the older relay only knows the Spanish one.
      function cameraCapturePathFor(state) {
        return cameraProtoCheck(state) === "service_old" ? "/capturar" : "/capture";
      }

      // One short line in everyday words for a camera of /state (no fps, no kB/s, no relay): what the operator needs is whether it works.
      // e = the camera of /state; load = state.load.
      function cameraPlainState(e, load, t) {
        if (!e) return "";
        var level = (load && load.level) || 0;
        if (e.drop) return t("roles.not_answering_n_min", { n: Math.round((e.without_response_s || 0) / 60) });
        if (e.state === "connected") return t("roles.working") + " · " + t("roles.n_watching", { n: e.clients || 0 }) + (level >= 1 ? " · " + t("roles.system_busy") : "");
        if (e.state === "reconnecting" || e.state === "connecting") return t("roles.connecting");
        return t("roles.resting");
      }

      // ---- what touches the page ----

      function cameraView() {
        return cameraViewOf(typeof workshopIdentity === "function" ? workshopIdentity() : null);
      }

      function cameraCanDo(feature) {
        return cameraFeatureIn(cameraView(), feature);
      }

      // The text under a warning of the contract, or "" when all is well (or nothing is known yet).
      function cameraProtoWarning() {
        var c = cameraProtoCheck(typeof cameraState === "undefined" ? null : cameraState);
        return c === "service_old" ? i18nT("roles.proto_service_old") : c === "plugin_old" ? i18nT("roles.proto_plugin_old") : "";
      }

      // Shows or hides the controls of the floating panel for the view; repaints when the person logs in or out.
      // parts = { gear, capture, timelapse } (the buttons of buildCameraPanel).
      function cameraRoleBind(panel, parts) {
        function apply() {
          parts.gear.style.display = cameraCanDo("cameras") ? "" : "none";
          parts.capture.style.display = cameraCanDo("capture") ? "" : "none";
          parts.timelapse.style.display = cameraCanDo("timelapse") ? "" : "none";
          if (parts.focus) parts.focus.style.display = cameraCanDo("focus") ? "" : "none";
        }
        apply();
        if (typeof workshopOnIdentity !== "function") return;
        var off = workshopOnIdentity(function () {
          if (!panel.isConnected) return off();
          apply();
        });
        workshopOnStop(off);
      }

      // The person logged in or out: a viewer without the camera loses the panel, and gets it back when the view allows it again.
      function cameraOnIdentity() {
        if (pluginStopped) return;
        if (!cameraCanDo("view")) {
          cameraRemovePanel();
          workshopNotify();
        } else if (!cameraPanelEl) {
          createCameraWidgets();
        }
        var sheets = [CAMERA_GALLERY_ID, CAMS_SHEET_ID, CAMERA_SHEET_ID];
        sheets.forEach(function (id) {
          var s = document.getElementById(id);
          if (s && !cameraCanDo(id === CAMERA_GALLERY_ID ? "gallery" : "cameras")) s.remove();
        });
      }

      function cameraRemovePanel() {
        if (cameraStopStreamFn) cameraStopStreamFn();
        var panel = document.getElementById(CAMERA_PANEL_ID);
        if (panel) panel.remove();
        cameraPanelEl = null;
      }

      function cameraWatchIdentity() {
        if (typeof workshopOnIdentity !== "function") return;
        workshopOnStop(workshopOnIdentity(cameraOnIdentity));
      }
