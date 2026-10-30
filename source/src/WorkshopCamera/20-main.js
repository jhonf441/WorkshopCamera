      // ---- Arranque de WorkshopCamera ----

      var CAMERA_ICON =
        '<path d="M9.4 4L7.8 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.8L14.6 4H9.4zM12 9c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';

      // Launcher in the sidebar (WorkshopControlBar), if installed.
      workshopRegisterPanel("camera", {
        title: i18nT('main.camera'),
        icon: CAMERA_ICON,
        order: 10,
        description:
          i18nT('main.opens_the_floating_viewer'),
        toggle: cameraToggle,
        state: function () {
          var open = isCameraOpen();
          var noPanel = !cameraPanelEl; // sin direccion de camara (o todavia cargando)
          var denied = !cameraCanDo("view"); // a visitor without the camera: a clear message instead of an error (F3-C)
          return {
            open: open,
            disabled: noPanel,
            statusText: denied
              ? i18nT('roles.no_permission')
              : noPanel
              ? cameraWasEnabledAtLoad === false
                ? i18nT('main.no_camera_address_check_the_list')
                : i18nT('main.loading')
              : open
              ? i18nT('main.open_on_this_screen')
              : i18nT('main.closed'),
            railTitle: noPanel
              ? i18nT('main.camera_no_camera_address')
              : open ? i18nT('main.camera_this_screen_only_open') : i18nT('main.camera_this_screen_only_tap_to_open'),
          };
        },
      });
      cameraWatchIdentity(); // 09-camera-roles.js: the panel appears or goes away when the person logs in or out

      // Without a sidebar installed, the camera shows its own floating button.
      workshopFallbackLauncher("camera", CAMERA_ICON, i18nT('main.camera'), 10, cameraToggle, isCameraOpen);

      workshopWhenReady(createCameraWidgets);
      cameraRegisterGallery(); // Complementos > Timelapses y capturas (17-gallery.js)
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

      workshopOnStop(function () {
        if (cameraStopStreamFn) cameraStopStreamFn();
        cameraViewTeardown(null);
        var panel = document.getElementById(CAMERA_PANEL_ID);
        if (panel) panel.remove();
        cameraPanelEl = null;
        workshopUnregisterPanel("camera");
      });
      workshopWatchEnabled();
