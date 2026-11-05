      // ---- The camera follows the session (ESTANDAR 3.2, 2026-11-05) ----
      //
      // The cause of a blank camera is INFERRED and told with the shared pieces (09-notice-dom.js): signed out (session), a role without the camera
      // (role), the service does not answer or gives no address (down, with Retry) or no camera yet (empty). Nothing is built from an unknown
      // identity ("full" for workshopIdentityView(null)) nor from an "na" list; every change of identity (09-session-change.js) drops what the previous
      // person read (panel, list, day key) and builds again, by itself: signing in shows the image without a reload and without tapping Retry.
      // Where the panel would be there is a cover (N4) while the camera cannot be shown; the launcher tile opens it.

      var CAMERA_SESSION_COVER_ID = "workshop-camera-cover";
      var cameraSessionCoverOpen = false; // the person wants the panel and it cannot show yet (it was open when the session ended, or the tile was tapped)
      var cameraSessionSeq = 0; // a late answer of an older build (another identity) does nothing

      // Pure: what blocks the camera. f = { known, canView, signedOut, address (cameraAddressState), hasUrl }.
      // Returns { kind: "loading" | "session" | "role" | "down" | "empty" | "" } ("" = it can be built).
      function cameraSessionCauseOf(f) {
        if (!f.known) return f.timedOut ? { kind: "down" } : { kind: "loading" }; // 8 s without an identity: the service is not answering (09-camera-session-wait.js)
        if (!f.canView) return f.signedOut ? { kind: "session" } : { kind: "role", needed: "operator" };
        if (f.address === null || f.address === undefined) return { kind: "loading" };
        if (f.address === "missing") return { kind: "empty" };
        if (f.address === "na" || !f.hasUrl) return { kind: "down" };
        return { kind: "" };
      }

      function cameraSessionCause() {
        var known = typeof workshopIdentity === "function" && !!workshopIdentity();
        var canView = cameraCanDo("view");
        return cameraSessionCauseOf({
          known: known,
          canView: canView,
          signedOut: cameraSignedOut(),
          address: cameraAddressState,
          hasUrl: canView && known ? !!cameraUrlMain() : false,
          timedOut: cameraSessionWaitTimedOut,
        });
      }

      // The N4 of a cause (the reason is the shared sentence; session has the sign-in button, down has Retry, role has none)
      function cameraSessionCoverContent(cause) {
        var title = i18nT("main.camera");
        if (cause.kind === "empty") return workshopNoticeEl("empty", "cover", { title: title, text: i18nT("main.no_camera_yet_add_the_first_one") });
        if (cause.kind === "loading") return workshopNoticeEl("empty", "cover", { title: title, text: i18nT("main.loading") });
        return workshopNoticeEl(cause.kind, "cover", {
          needed: cause.needed,
          text: cause.kind === "role" ? cameraSessionRoleText(cause.needed) : undefined, // the sentence of the camera (09-camera-session-wait.js)
          onRetry: function () {
            cameraRebuild("retry");
          },
        });
      }

      function cameraSessionCoverRemove() {
        var old = document.getElementById(CAMERA_SESSION_COVER_ID);
        if (old) old.remove();
      }

      // Paints (or removes) the cover for the cause of now
      function cameraSessionCoverRender() {
        var cause = pluginStopped ? { kind: "" } : cameraSessionCause();
        if (!cameraSessionCoverOpen || !cause.kind) {
          cameraSessionCoverRemove();
          return;
        }
        var box = document.getElementById(CAMERA_SESSION_COVER_ID);
        if (!box) {
          box = document.createElement("div");
          box.id = CAMERA_SESSION_COVER_ID;
          box.setAttribute("data-tp-panel", "1");
          box.style.cssText =
            "position:fixed;right:12px;bottom:12px;z-index:2147482000;box-sizing:border-box;width:min(360px,92vw);padding:8px;border-radius:10px;" +
            "background:var(--wf-surface,#1e1e1e);border:1px solid var(--wf-line,rgba(128,128,128,0.3));box-shadow:0 4px 14px rgba(0,0,0,0.5);";
          document.body.appendChild(box);
        }
        box.textContent = "";
        var close = document.createElement("button");
        close.type = "button";
        close.className = "wf-btn";
        close.textContent = i18nT("common.close");
        close.style.cssText = "display:block;margin:0 0 6px auto;";
        close.addEventListener("click", function () {
          cameraSessionCoverOpen = false;
          cameraSessionCoverRender();
          workshopNotify();
        });
        box.appendChild(close);
        box.appendChild(cameraSessionCoverContent(cause));
      }

      // The launcher tile while there is no panel: it opens or closes the cover
      function cameraSessionToggleCover() {
        cameraSessionCoverOpen = !document.getElementById(CAMERA_SESSION_COVER_ID);
        cameraSessionCoverRender();
        workshopNotify();
      }

      // The day key of the relay belongs to the person who asked for it: it is dropped (signed out) and asked again (signed in), and the answer is
      // awaited, so the first picture of the new panel already carries it. Not on the Pi's own screen (it never needs the key).
      function cameraSessionKey(drop) {
        var st = typeof window !== "undefined" ? window.__workshopCameraKey : null;
        if (!st) return Promise.resolve("");
        if (drop) {
          st.token = "";
          try {
            document.cookie = "workshop_camera=; path=/; max-age=0; SameSite=Lax";
          } catch (e) {
            /* no cookie to drop */
          }
          return Promise.resolve("");
        }
        if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) || typeof st.request !== "function") return Promise.resolve("");
        return Promise.resolve(st.requested).then(function () {
          st.last = 0;
          return st.request();
        });
      }

      // Any change of identity (except the first one, which createCameraWidgets already waits for): forget what the previous person saw and build again
      function cameraRebuild(kind) {
        if (pluginStopped || kind === "known") return;
        if (!workshopIdentity()) {
          cameraSessionCoverRender(); // Retry before any identity: still down; the build waits for it (workshopWhenIdentityKnown)
          return;
        }
        if (isCameraOpen()) cameraSessionCoverOpen = true; // the open panel becomes the cover while it cannot be shown
        cameraSessionSeq++;
        cameraRemovePanel();
        cameraList = [cameraNormalize(CAMS_MAIN, 0)]; // 12-cameras.js: the default, not the list another person read
        cameraListRev = "0";
        cameraAddressState = null;
        cameraStartupRelayMemo.t = 0; // 19-startup.js
        cameraStartupRelayMemo.p = null;
        workshopNotify();
        cameraSessionCoverRender();
        if (!cameraCanDo("view")) {
          cameraSessionKey(true);
          return;
        }
        var seq = cameraSessionSeq;
        cameraSessionKey(kind === "signed-out").then(function () {
          if (seq === cameraSessionSeq) createCameraWidgets();
        });
      }

      function cameraWatchSession() {
        workshopOnStop(workshopOnSessionChange(cameraRebuild));
        workshopOnStop(cameraSessionCoverRemove);
        cameraSessionWaitStart(); // 09-camera-session-wait.js
      }
