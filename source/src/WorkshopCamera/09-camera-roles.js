      // ---- Views by role and the check of the relay contract (F3-C, 2026-10-21) ----
      //
      // The SERVICE decides who may do what (permissions.py); this only hides what the role cannot do and writes the rest in plain
      // words. Four views, from the identity of workshopIdentity() (01-api-auth.js):
      //   full        no identity yet, or a service without users or older than the roles: everything, as before (compatibility)
      //   technician  technician and admin: everything (settings, the list of cameras with their addresses, orientation, schedule, limits, start / stop of the system relay)
      //   operator    operator: see the cameras, capture, timelapse (start / stop / watch), gallery; no technical terms
      // Where each feature lives (informe-07): the floating viewer only LOOKS (view, mosaic, zoom, flash, the quick capture and the button that
      // opens the page); the page of the plugin (17-gallery.js, 18-page-*.js) holds the rest: gallery and timelapse (operator), settings, cameras,
      // focus and relay (technician).
      //   viewer      a viewer WITH the camera enabled for visitors (camera_for_viewer): only watches
      //   denied      a viewer without the camera: no viewer, a clear message instead of an error
      // Pure functions first (tests/camera-roles.test.js loads this file alone); the ones that touch the page are at the end.

      var CAMERA_RELAY_PROTO = 3; // the contract with the relay (port 8090) this page was written for; camera_proto.py PROTO in the service (3: the writes are API operations)

      var CAMERA_VIEW_FEATURES = {
        denied: [],
        viewer: ["view", "mosaic", "zoom"],
        operator: ["view", "mosaic", "zoom", "capture", "timelapse", "gallery", "flash"], // flash: camera.flash is an operation of the operator
        technician: ["view", "mosaic", "zoom", "capture", "timelapse", "gallery", "flash", "settings", "cameras", "tech_terms", "focus", "relay"],
      };
      CAMERA_VIEW_FEATURES.full = CAMERA_VIEW_FEATURES.technician;

      function cameraViewOf(identity) {
        var role = workshopIdentityView(identity); // 01-identity-view.js
        if (role === "full") return "full";
        if (role === "viewer") return identity.user && identity.user.camera ? "viewer" : "denied";
        return role === "operator" ? "operator" : "technician";
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

      // The catalog key of a signed-out sentence: the plugin's own for a plain "signed out", the shared one for an expired session or a locked PIN
      function cameraSessionKeyOf(state, base) {
        return typeof workshopNoticeSessionKey === "function" ? workshopNoticeSessionKey(state, base) : base;
      }

      // Why the camera is not shown, in words: "signed_out" (signing in may fix it) or "role" (only another role does; the text names the role).
      // signedOut: the person has no session; roleLabel: the name of their role ("Visitor"). t = i18nT.
      // state: the session state (expired and a locked PIN have their own shared sentence, see workshopNoticeSessionKey)
      function cameraDeniedText(signedOut, roleLabel, t, state) {
        return signedOut ? t(cameraSessionKeyOf(state, "roles.signed_out_camera")) : t("roles.no_permission", { role: roleLabel || "" });
      }

      // The same sentence for the refusal of a call to the relay (port 8090): cause = "login_required" | "forbidden" | "unreachable" | "error".
      // "unreachable" is only a network failure; a refusal is never told as a relay that is down.
      function cameraRelayCauseText(cause, status, signedOut, roleLabel, t, state) {
        if (cause === "login_required") return signedOut ? t(cameraSessionKeyOf(state, "roles.signed_out_files")) : t("relay.error_sign_in");
        if (cause === "forbidden") return t("roles.no_permission_files", { role: roleLabel || "" });
        if (cause === "error") return t("relay.error_http", { status: status });
        return t("gallery.could_not_read_the_system_relay");
      }

      // ---- what touches the page ----

      function cameraView() {
        return cameraViewOf(typeof workshopIdentity === "function" ? workshopIdentity() : null);
      }

      function cameraCanDo(feature) {
        return cameraFeatureIn(cameraView(), feature);
      }

      function cameraSignedOut() {
        return typeof workshopSignedOut === "function" && workshopSignedOut();
      }

      function cameraStateNow() {
        return typeof workshopSessionState === "function" ? workshopSessionState() : "";
      }

      // The name of the role of the person in the language of the page ("Visitor" for nobody).
      function cameraRoleLabel() {
        var role = typeof workshopRole === "function" ? workshopRole() : "";
        return typeof workshopApiT === "function" ? workshopApiT("role_" + (role || "viewer")) : role;
      }

      // The sentence of a camera that cannot be shown to this person (signed out or role).
      function cameraDenied() {
        return cameraDeniedText(cameraSignedOut(), cameraRoleLabel(), i18nT, cameraStateNow());
      }

      // The same sentence for a failed call to the relay.
      function cameraRelayCauseNow(cause, status) {
        return cameraRelayCauseText(cause, status, cameraSignedOut(), cameraRoleLabel(), i18nT, cameraStateNow());
      }

      // The text under a warning of the contract, or "" when all is well (or nothing is known yet).
      function cameraProtoWarning() {
        var c = cameraProtoCheck(typeof cameraState === "undefined" ? null : cameraState);
        return c === "service_old" ? i18nT("roles.proto_service_old") : c === "plugin_old" ? i18nT("roles.proto_plugin_old") : "";
      }

      // Shows or hides the controls of the floating panel for the view; repaints when the person logs in or out.
      // parts = { capture, page } (the quick capture and the button to the page: the only buttons of buildCameraPanel that depend on the role).
      function cameraRoleBind(panel, parts) {
        var reason = null; // ONE reason for the locked controls of the panel (capture and flash), below them: no session blue, role gray
        function apply() {
          // the quick capture stays in its place: locked (not hidden) for a view that cannot take it, with the reason below
          var canCapture = cameraCanDo("capture");
          parts.capture.style.display = "";
          parts.capture.disabled = !canCapture;
          if (reason && reason.parentNode) reason.parentNode.removeChild(reason);
          reason = null;
          // the button to the page: locked (not hidden) for a view without the gallery; hidden only when the page is not registered at all
          var canGallery = cameraCanDo("gallery");
          var pageHere = !!cameraPageRegistered;
          if (!canCapture || (pageHere && !canGallery)) {
            if (typeof workshopReasonEl === "function") {
              var kind = cameraSignedOut() ? "session" : "role";
              reason = workshopReasonEl(kind, workshopNoticeText(kind, "operator"));
              reason.style.margin = "4px 8px";
              panel.appendChild(reason);
            }
          }
          parts.page.style.display = pageHere ? "flex" : "none"; // 18-page-tabs.js
          parts.page.disabled = !canGallery;
        }
        apply();
        if (typeof workshopOnIdentity !== "function") return;
        var off = workshopOnIdentity(function () {
          if (!panel.isConnected) return off();
          apply();
        });
        workshopOnStop(off);
      }

      function cameraRemovePanel() {
        if (cameraStopStreamFn) cameraStopStreamFn();
        var panel = document.getElementById(CAMERA_PANEL_ID);
        if (panel) panel.remove();
        cameraPanelEl = null;
      }
