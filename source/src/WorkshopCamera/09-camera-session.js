      // ---- The camera follows the session (ESTANDAR 3.2, 2026-11-05) ----
      //
      // The cause of a blank camera is INFERRED and told with the shared pieces (09-notice-dom.js): signed out (session), a role without the camera
      // (role), the service does not answer or gives no address (down, with Retry) or no camera yet (empty). Nothing is built from an unknown
      // identity ("full" for workshopIdentityView(null)) nor from an "na" list; every change of identity (09-session-change.js) drops what the previous
      // person read (panel, list, day key) and builds again, by itself: signing in shows the image without a reload and without tapping Retry.
      // Where the panel would be there is a cover (N4) while the camera cannot be shown; the launcher tile opens it.
      // Owner rule (2026-11-06, capture 9): without a session (or with a role that has no camera) NOTHING opens from the launcher: the launcher of the
      // bar shows a lock with the reason and its tap signs in (cameraSessionLock / cameraSessionLockTap). The cover for those two causes is shown
      // only when the viewer was OPEN and the permission went away (a sign-out, another person): then it takes the place of the viewer, same spot
      // and size, with the reason and the sign-in button. The causes that are not about the person (down, empty, loading) keep the cover from the tile.

      var CAMERA_SESSION_COVER_ID = "workshop-camera-cover";
      var cameraSessionCoverOpen = false; // the person wants the panel and it cannot show yet (it was open when the session ended, or the tile was tapped)
      var cameraSessionCoverAt = null; // { left, top, width, height } of the viewer that was open when the permission went away: the cover takes its place
      var cameraSessionSeq = 0; // a late answer of an older build (another identity) does nothing

      // Pure: the lock of the launcher for a cause ({ kind: "session" } / { kind: "role", needed } or null when nothing about the person blocks it)
      function cameraSessionLockOf(cause) {
        if (!cause || (cause.kind !== "session" && cause.kind !== "role")) return null;
        return cause.kind === "session" ? { kind: "session" } : { kind: "role", needed: cause.needed || "operator" };
      }

      function cameraSessionLock() {
        if (pluginStopped) return null;
        return cameraSessionLockOf(cameraSessionCause());
      }

      // The tap on a locked launcher (the bar, or the fallback button without a bar): the name + PIN dialog; a sign-in builds the viewer by itself
      function cameraSessionLockTap() {
        if (typeof workshopLogin === "function") workshopLogin();
      }

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
        var box = workshopNoticeEl(cause.kind, "cover", {
          needed: cause.needed,
          subject: title, // the camera: the cover says WHAT it covers (DESIGN 7d)
          text: cause.kind === "role" ? cameraSessionRoleText(cause.needed) : undefined, // the sentence of the camera (09-camera-session-wait.js)
          onRetry: function () {
            cameraRebuild("retry");
          },
        });
        // a role without the camera: the cover that blocks the open viewer offers the way out too (owner rule 2026-11-06): another person signs in
        if (cause.kind === "role" && typeof document !== "undefined" && typeof document.createElement === "function") {
          var change = document.createElement("button");
          change.type = "button";
          change.className = "wf-btn";
          change.textContent = i18nT("roles.change_role");
          change.addEventListener("click", cameraSessionLockTap);
          box.appendChild(change);
        }
        return box;
      }

      function cameraSessionCoverRemove() {
        var old = document.getElementById(CAMERA_SESSION_COVER_ID);
        if (old) old.remove();
      }

      // Pure: where the cover goes. at = the rect of the viewer that lost its permission (null: none was open), win = { vw, vh }, margin.
      // In the place of the viewer when there was one (never off the window); else the bottom right corner, as before.
      function cameraSessionCoverPlace(at, win, margin) {
        if (!at || !(at.width > 0) || !(at.height > 0) || !win || !(win.vw > 0) || !(win.vh > 0)) return null;
        var fit = function (v, min, max) { return max < min ? min : Math.min(Math.max(v, min), max); };
        var w = Math.min(at.width, win.vw - 2 * margin);
        var h = Math.min(at.height, win.vh - 2 * margin);
        return {
          left: Math.round(fit(at.left, margin, win.vw - w - margin)),
          top: Math.round(fit(at.top, margin, win.vh - h - margin)),
          width: Math.round(w),
          height: Math.round(h),
        };
      }

      function cameraSessionCoverWin() {
        return typeof window !== "undefined" ? { vw: window.innerWidth, vh: window.innerHeight } : null;
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
          box.setAttribute("data-workshop-float", "1"); // a floating widget like the viewer (the Jog hides them in its full screen)
          // it hangs from <body>: DWC's font does not reach it, so the family's sans is written here (a serif cover was the capture of 2026-11-06)
          box.style.cssText =
            "position:fixed;right:12px;bottom:12px;z-index:2147482000;box-sizing:border-box;width:min(360px,92vw);padding:8px;border-radius:10px;" +
            "display:flex;flex-direction:column;overflow:auto;font:13px/1.4 Roboto,Helvetica,Arial,sans-serif;color:#eceff1;" +
            "background:var(--wf-surface,#1e1e1e);border:1px solid var(--wf-line,rgba(128,128,128,0.3));box-shadow:0 4px 14px rgba(0,0,0,0.5);";
          document.body.appendChild(box);
        }
        // the viewer lost its permission while open: the cover takes its place (same spot and size) instead of a box in a corner
        var place = cameraSessionCoverPlace(cameraSessionCoverAt, cameraSessionCoverWin(), typeof MARGIN === "number" ? MARGIN : 8);
        if (place) {
          box.style.right = "auto";
          box.style.bottom = "auto";
          box.style.left = place.left + "px";
          box.style.top = place.top + "px";
          box.style.width = place.width + "px";
          box.style.height = place.height + "px";
        }
        box.textContent = "";
        var close = document.createElement("button");
        close.type = "button";
        close.className = "wf-btn";
        close.textContent = i18nT("common.close");
        close.style.cssText = "flex:none;display:block;margin:0 0 6px auto;";
        close.addEventListener("click", function () {
          cameraSessionCoverOpen = false;
          cameraSessionCoverAt = null;
          if (cameraSessionLockOf(cause)) cameraSessionCoverForget(); // closed by hand: the viewer does not pop up by itself after the next sign-in
          cameraSessionCoverRender();
          workshopNotify();
        });
        box.appendChild(close);
        var content = cameraSessionCoverContent(cause);
        if (content.style) {
          content.style.flex = "1 1 auto";
          content.style.minHeight = "0";
        }
        box.appendChild(content);
      }

      // The person closed the cover of a session / role lock: the viewer is not wanted open any more on this screen
      function cameraSessionCoverForget() {
        try {
          localStorage.setItem(typeof CAMERA_EXPANDED_KEY === "string" ? CAMERA_EXPANDED_KEY : "workshopCameraExpanded", "0");
        } catch (e) {
          /* not remembered: it only pops up again after the next sign-in */
        }
      }

      // The launcher tile while there is no panel: it opens or closes the cover (never for a session or role cause: the launcher is locked then)
      function cameraSessionToggleCover() {
        if (cameraSessionLock()) return cameraSessionLockTap();
        cameraSessionCoverAt = null;
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
        if (isCameraOpen()) {
          cameraSessionCoverOpen = true; // the open panel becomes the cover while it cannot be shown, in its own place (the view is blocked where it was)
          var el = typeof cameraPanelEl !== "undefined" ? cameraPanelEl : null;
          var r = el && typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
          cameraSessionCoverAt = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
        } else {
          cameraSessionCoverOpen = false; // closed: nothing pops up; the launcher of the bar says why with its lock
          cameraSessionCoverAt = null;
        }
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
