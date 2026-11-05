      // ---- The camera while the identity is unknown, and the sentence of its role cover (ESTANDAR 3.2) ----
      //
      // If whoami never answers (service down) nothing would be built and nothing shown: after 8 s without an identity the N4 cover of kind "down" is
      // shown, and when the identity becomes known the cover goes away by itself (createCameraWidgets builds the panel: no Retry needed).

      var CAMERA_SESSION_WAIT_MS = 8000;
      var cameraSessionWaitTimedOut = false;
      var cameraSessionWaitTimer = null;

      // The sentence of a role that does not have the camera: the shared wording of the role notices naming the role that has it
      function cameraSessionRoleText(needed) {
        var mine = typeof workshopRole === "function" ? workshopRole() : "";
        return i18nT("roles.cover_role", { needed: workshopNoticeRoleName(needed || "operator"), role: workshopNoticeRoleName(mine) });
      }

      function cameraSessionWaitClear() {
        if (cameraSessionWaitTimer) clearTimeout(cameraSessionWaitTimer);
        cameraSessionWaitTimer = null;
      }

      function cameraSessionWaitStart() {
        if (typeof workshopIdentity !== "function" || workshopIdentity()) return;
        cameraSessionWaitTimer = setTimeout(function () {
          cameraSessionWaitTimer = null;
          if (pluginStopped || workshopIdentity()) return;
          cameraSessionWaitTimedOut = true;
          cameraSessionCoverOpen = true;
          cameraSessionCoverRender();
          workshopNotify();
        }, CAMERA_SESSION_WAIT_MS);
        workshopOnStop(cameraSessionWaitClear);
        workshopWhenIdentityKnown(function () {
          cameraSessionWaitClear();
          if (!cameraSessionWaitTimedOut) return;
          cameraSessionWaitTimedOut = false;
          cameraSessionCoverOpen = false;
          cameraSessionCoverRender();
          workshopNotify();
        });
      }
