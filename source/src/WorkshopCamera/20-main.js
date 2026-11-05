      // ---- Arranque de WorkshopCamera ----

      var CAMERA_ICON =
        '<path d="M9.4 4L7.8 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.8L14.6 4H9.4zM12 9c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';

      // Launcher in the sidebar (WorkshopControlBar), if installed.
      var CAMERA_PANEL = {
        title: i18nT('main.camera'),
        icon: CAMERA_ICON,
        order: 10,
        description:
          i18nT('main.opens_the_floating_viewer'),
        toggle: cameraToggle,
        state: function () {
          var open = isCameraOpen();
          var noPanel = !cameraPanelEl; // no camera yet (the service says so) or still loading
          var denied = !cameraCanDo("view"); // a visitor without the camera: a clear message instead of an error (F3-C)
          return {
            open: open,
            disabled: noPanel && !cameraSessionCause().kind, // with a cause the tile opens the cover that tells it
            statusText: denied
              ? cameraDenied()
              : noPanel
              ? cameraAddressState === "missing"
                ? i18nT('main.no_camera_yet_add_the_first_one')
                : i18nT('main.loading')
              : open
              ? i18nT('main.open_on_this_screen')
              : i18nT('main.closed'),
            railTitle: noPanel
              ? i18nT('main.camera_no_camera_address')
              : open ? i18nT('main.camera_this_screen_only_open') : i18nT('main.camera_this_screen_only_tap_to_open'),
          };
        },
      };
      workshopRegisterPanel("camera", CAMERA_PANEL);
      cameraWatchSession(); // 09-camera-session.js: every change of identity drops what the other person read and builds again

      // Without a sidebar installed, the camera shows its own floating button.
      workshopFallbackLauncher("camera", CAMERA_PANEL);

      cameraRegisterGallery(); // Plugins > Timelapses and captures (17-gallery.js): before the viewer, whose button to the page needs it registered
      workshopWhenReady(function () {
        workshopWhenIdentityKnown(createCameraWidgets); // never from an unknown identity (it counts as "full")
      });
      workshopWatchDom(function () {
        if (cameraPanelEl && !document.getElementById(CAMERA_PANEL_ID)) {
          cameraPanelEl = null;
          cameraStopStreamFn = null;
          cameraStartModeFn = null;
          createCameraWidgets();
        }
      });
      workshopGuardFocus(function () {
        return [cameraPanelEl];
      });

      // 2026-10-12 (request 29d): healWebcamEnabledIfNeeded was removed, which
      // wrote main.webcam.enabled in 0:/sys/dwc-settings.json (it had been off
      // since 2026-10-09). The camera neither reads nor writes DWC's config any more:
      // it uses only cameras.json (12-cameras.js).

      // the <style> elements only the Camera uses leave the page when it stops (the shared ones go with the last plugin: workshopRemoveLeftovers)
      var CAMERA_OWN_STYLES = ["workshop-tl-css", "workshop-studio-css"];
      workshopOwnStyles(CAMERA_OWN_STYLES);

      workshopOnStop(function () {
        if (cameraStopStreamFn) cameraStopStreamFn();
        cameraCloseOpenViews(); // 13-service.js: the mosaic and the page, with their timers
        cameraViewTeardown(null); // every view: the cover boxes and the judgement of every picture (14-health.js) go with it
        var panel = document.getElementById(CAMERA_PANEL_ID);
        if (panel) panel.remove();
        cameraPanelEl = null;
        // the launcher panel leaves the registry by itself (workshopRegisterPanel registers that cleanup)
      });
      workshopWatchEnabled();
