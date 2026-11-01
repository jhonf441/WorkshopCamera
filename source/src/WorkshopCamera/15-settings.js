      // ---- Image settings of the ESP32-camera: the SERVICE keeps them (informe-06 B-P6; the screen of them is the tab Image: 18-page-image-settings.js) ----
      //
      // The ESP32-camera (CameraWebServer firmware) FORGETS everything when it restarts. What a technician chooses (a profile, a fine value, "follow the
      // job") is saved by the service for every screen (camera.json, per camera) and the service applies it again by itself when the camera restarts and,
      // with "automatic", switches to the profile that fits what the machine is doing (laser job: "During cut", else "Balanced"). It used to be this
      // plugin's: a timer and a re-apply when the viewer opened, which only worked with a screen looking and two screens could undo each other.
      // Here: the two operations (technician only) and the names of the profiles; the values of each profile and the numbers of the resolutions are the service's.

      // camera.image.get: {ok, reachable, profile, auto, settings, live, suggested, profiles: [{id, settings}], resolutions: [{name, number, width, height}]}
      // or {ok: false, error}. Rejects when the service does not answer (or the role does not allow it).
      function cameraImageGet(cameraId) {
        return workshopApi("camera.image.get", { camera: cameraId });
      }

      // camera.image.set: patch = { profile }, { settings: { brightness: 1 } } or { auto: true }. It is applied to the camera and saved, or not saved at all
      // ({ok: false, error}); the answer is the one of camera.image.get.
      function cameraImageSet(cameraId, patch) {
        return workshopApi("camera.image.set", Object.assign({ camera: cameraId }, patch));
      }

      // [name, description] of a profile of the service
      function cameraProfileInfo(id) {
        var info = {
          balanced: [i18nT('settings.balanced'), i18nT('settings.good_smooth_image_for_everyday_use')],
          cut: [i18nT('settings.during_cut'), i18nT('settings.less_exposure_the_laser_dot_doesn')],
          detail: [i18nT('settings.detail'), i18nT('settings.more_resolution_to_align_or_focus')],
          little_light: [i18nT('settings.low_light'), i18nT('settings.more_exposure_and_gain_some_noise')],
          smooth: [i18nT('settings.smooth_slow_network'), i18nT('settings.small_light_image_for_weak_wifi')],
        };
        return info[id] || [id, ""];
      }

      // The text of a resolution of the service ({name, width, height}) in the list of the page
      function cameraResolutionText(r) {
        var text = {
          QVGA: i18nT('settings.320x240_very_smooth'),
          CIF: "400x296",
          VGA: i18nT('settings.640x480_very_smooth'),
          SVGA: i18nT('settings.800x600_recommended'),
          XGA: i18nT('settings.1024x768_slow'),
          HD: i18nT('settings.1280x720_slow'),
          SXGA: i18nT('settings.1280x1024_very_slow_max'),
        };
        return text[r.name] || r.width + "x" + r.height;
      }
