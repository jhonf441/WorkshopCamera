      // ---- 2. Floating camera panel ----
      //
      // 2026-10-08 (v3): there is NO round floating button (FAB) any more. The
      // launcher is the camera icon of the sidebar (section 0):
      // it opens/closes this panel, which still floats and can be dragged over
      // any page. Only two states: open / closed (the "x"
      // closes it completely, nothing is left on screen) -- the
      // "Hide/Reactivate" disappeared, it only existed because the circles
      // got in the way. The panel is created ONCE on load and afterwards only
      // its display is toggled (the same "never destroy" pattern that avoided the
      // duplicate copies of v1).

      var CAMERA_PANEL_ID = "emergency-fab-cam-panel";
      var CAMERA_W = 240;
      var CAMERA_H = 160;
      var CAMERA_MIN_W = 120;
      var CAMERA_MIN_H = 80;
      var CAMERA_MAX_W = 640;
      var CAMERA_MAX_H = 480;
      var CAMERA_SIZE_KEY = "emergencyFabCamSize";
      var CAMERA_EXPANDED_KEY = "emergencyFabCamExpanded";

      var cameraPanelEl = null;
      var cameraStopStreamFn = null;
      var cameraStartModeFn = null;
      var CAMERA_SNAPSHOT_POLL_MS = 3000;

      // Keys of v2 (Hide/Reactivate of the circles) -- they no longer
      // mean anything; they are deleted so that they do not stay dangling.
      try {
        localStorage.removeItem("emergencyFabCamClosed");
        localStorage.removeItem("emergencyFabJogClosed");
        localStorage.removeItem("emergencyFabCamFabPos");
        localStorage.removeItem("emergencyFabJogFabPos");
      } catch (e) {
        /* no critico */
      }

      function isCameraExpanded() {
        try {
          return localStorage.getItem(CAMERA_EXPANDED_KEY) === "1";
        } catch (e) {
          return false;
        }
      }

      function cameraExpand() {
        try {
          localStorage.setItem(CAMERA_EXPANDED_KEY, "1");
        } catch (e) {
          /*  could not be remembered -- it still expands for this session */
        }
        if (cameraPanelEl) { cameraPanelEl.style.display = ""; cameraReclampPanel(); cameraCloseBarIfNarrow(); }
        workshopNotify();
        cameraStateWatch(true); // 13-service.js: fps / reconectando / quien mira
        // It always starts in photo mode -- see startSnapshotMode() inside
        // buildCameraPanel. Video mode is only activated with the
        // button next to the flash, never on its own.
        if (cameraStartModeFn) cameraStartModeFn();
      }

      // `silent`: when applying the state saved on page load
      // the anti-keyboard burst is not needed (nobody touched anything).
      function cameraCollapse(silent) {
        if (!silent) workshopWithoutTouchGhost(); // the closing tap must not reach what is under the panel
        cameraCloseSheet();
        // the gear's "Cameras" sheet (12-cameras.js) also goes away with the
        // viewer (BUG 2026-10-10: it stayed open by itself when closing the camera)
        var sheetCams = document.getElementById(CAMS_SHEET_ID);
        if (sheetCams) sheetCams.remove();
        var galeria = document.getElementById(CAMERA_GALLERY_ID);
        if (galeria) galeria.remove();
        cameraStateWatch(false);
        try {
          localStorage.setItem(CAMERA_EXPANDED_KEY, "0");
        } catch (e) {
          /*  could not be remembered -- it still collapses for this session */
        }
        // If the focus is on something INSIDE the panel (e.g. the "x" button
        // itself that was just tapped) it has to be taken out BEFORE hiding
        // the panel with display:none -- a focused element that
        // disappears abruptly makes the browser reassign the focus to
        // another part of the page, and that triggers the on-screen keyboard
        // (squeekboard) if it lands on anything that looks like a text
        // field (confirmed as the probable cause live 2026-10-08,
        // the same symptom as the squeekboard bug already documented for the
        // logs terminal). document.body.focus() is a safe no-op
        // if nothing else on the page needs the focus.
        if (cameraPanelEl && document.activeElement && cameraPanelEl.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        if (cameraPanelEl) cameraPanelEl.style.display = "none";
        workshopNotify();
        // Cuts the stream when collapsing -- there is no point in continuing to
        // decode video that is not being shown (see the talk with
        // the user 2026-10-07 about CPU load on the kiosk).
        if (cameraStopStreamFn) cameraStopStreamFn();
        cameraViewTeardown(cameraPanelEl); // the "camera does not answer" box of the viewer goes with it
      }

      function loadSize(key, defaultW, defaultH) {
        try {
          var raw = localStorage.getItem(key);
          if (!raw) return { w: defaultW, h: defaultH };
          var s = JSON.parse(raw);
          if (typeof s.w === "number" && typeof s.h === "number") return s;
        } catch (e) {
          /*  ignore -- default size */
        }
        return { w: defaultW, h: defaultH };
      }

      function saveSize(key, w, h) {
        try {
          localStorage.setItem(key, JSON.stringify({ w: w, h: h }));
        } catch (e) {
          /*  localStorage not available -- not critical, it is just not remembered */
        }
      }


      // Whether a camera address was already resolved on loading this tab
      // (null = still loading). Used by the launcher's text (20-main.js).
      var cameraWasEnabledAtLoad = null;

      function createCameraWidgets() {
        if (pluginStopped) return;
        if (document.getElementById(CAMERA_PANEL_ID)) return;
        if (!cameraCanDo("view")) return; // a visitor without the camera: no panel (the launcher says why, 20-main.js)

        // The panel is created from the start (hidden if it was closed); the
        // camera (ESP32-camera, behind the 1-to-many relay on the Pi) is only
        // asked for while the panel is open (see cameraExpand/cameraCollapse).
        // 2026-10-12: the address comes only from the own list
        // (cameras.json, 12-cameras.js), no longer from DWC's webcam.
        cameraLoadList().then(function () {
          var url = cameraUrlMain();
          if (cameraWasEnabledAtLoad === null) cameraWasEnabledAtLoad = !!url;
          workshopNotify();
          if (!url) return;
          if (pluginStopped) return;
          if (document.getElementById(CAMERA_PANEL_ID)) return;
          buildCameraPanel(url);
          if (isCameraExpanded()) {
            cameraExpand();
          } else {
            cameraCollapse(true);
          }
          // several cameras (12-cameras.js): the one chosen on this screen
          if (cameraChangeFn) cameraChangeFn(cameraChosen());
        });
      }

      function isCameraOpen() {
        return !!(cameraPanelEl && cameraPanelEl.style.display !== "none");
      }

      function cameraToggle() {
        if (!cameraPanelEl) return; // no webcam configured: no panel
        if (isCameraOpen()) cameraCollapse();
        else cameraExpand();
      }

      // When opened, the panel returns to its saved position but without leaving
      // the window (which may have changed size while it was closed).
      function cameraReclampPanel() {
        var saved = loadPos("emergencyFabCamPos");
        var l = saved ? saved.left : cameraPanelEl.offsetLeft;
        var t = saved ? saved.top : cameraPanelEl.offsetTop;
        cameraPanelEl.style.left = clamp(l, MARGIN, window.innerWidth - cameraPanelEl.offsetWidth - MARGIN) + "px";
        cameraPanelEl.style.top = clamp(t, MARGIN, window.innerHeight - cameraPanelEl.offsetHeight - MARGIN) + "px";
      }

      function buildCameraPanel(url) {
        if (document.getElementById(CAMERA_PANEL_ID)) return;
        var savedSize = cameraFitSize(loadSize(CAMERA_SIZE_KEY, CAMERA_W, CAMERA_H)); // a size saved on a wide screen must fit a phone
        var flashOn = false;
        // Photo mode (default) vs live video -- see button "modeBtn" further
        // down, next to the flash. Photo asks for a single JPEG every
        // CAMERA_SNAPSHOT_POLL_MS from the relay (which caches it, see
        // camera_relay.py) instead of decoding continuous MJPEG -- much
        // cheaper in CPU on the viewing side (confirmed live
        // 2026-10-07 that the real cost is the decode in the browser, not
        // the network/the relay).
        var liveMode = false;
        var snapshotTimerId = null;
        var snapshotUrl = url.replace(/\/stream$/, "/snapshot");
        var esEsp32 = true; // the main one (ESP32-camera through the relay) until another is chosen
        var cameraCurrent = null; // the camera of the list that is being seen (12-cameras.js)

        var panel = document.createElement("div");
        panel.id = CAMERA_PANEL_ID;
        panel.style.cssText = [
          "position:fixed",
          "width:" + savedSize.w + "px",
          "height:" + savedSize.h + "px",
          "z-index:2147483646",
          "background:#000",
          "border:2px solid #fff",
          "border-radius:8px",
          "box-shadow:0 2px 10px rgba(0,0,0,0.5)",
          "overflow:hidden;box-sizing:border-box;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)", // never bigger than the window (phone, rotation)
          "touch-action:none;overscroll-behavior:contain", // it is dragged with the finger: the page behind must not scroll
          "-webkit-user-select:none",
          "user-select:none",
          "cursor:move",
        ].join(";");

        var img = document.createElement("img");
        img.alt = i18nT('main.camera');
        // display:none until there is a real src -- an <img> without src
        // but with a fixed size (100%x100%) shows the browser's
        // "broken image" icon in the corner even before
        // tapping "View camera" (confirmed on the kiosk 2026-10-07). It uses
        // setProperty(...,"important") because a display:none set through
        // normal cssText was not enough -- some global CSS rule of DWC
        // (Vuetify) wins by specificity/its own !important; with
        // !important on this side it is respected (confirmed live).
        img.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;";
        img.style.setProperty("display", "none", "important");
        panel.appendChild(img);
        var zoom = cameraZoomAssemble(panel, img); // zoom y desplazamiento digital (13-service.js)

        // "Retry" button, centered -- it ONLY appears if the live video
        // mode fails (see startLiveMode). Photo mode retries by
        // itself on the next tick, without asking for a tap.
        var viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.textContent = i18nT('camera.retry');
        viewBtn.style.cssText = [
          "position:absolute",
          "left:50%",
          "top:50%",
          "transform:translate(-50%,-50%)",
          "padding:10px 16px",
          "border-radius:20px",
          "border:none",
          "background:#1976d2",
          "color:#fff",
          "font-size:13px",
          "white-space:nowrap",
          "cursor:pointer",
          "touch-action:none",
          "z-index:1",
          "display:none",
        ].join(";");
        panel.appendChild(viewBtn);

        var connectTimeoutId = null;

        function stopSnapshotMode() {
          if (snapshotTimerId) {
            clearTimeout(snapshotTimerId);
            snapshotTimerId = null;
          }
        }

        function scheduleSnapshotTick(delay) {
          snapshotTimerId = setTimeout(function () {
            if (liveMode) return;
            img.src = snapshotUrl + "?_=" + Date.now();
            scheduleSnapshotTick(CAMERA_SNAPSHOT_POLL_MS);
          }, delay);
        }

        function startSnapshotMode() {
          // camera without a still image: video only
          if (!snapshotUrl) return startLiveMode();
          liveMode = false; cameraLiveId = null;
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          stopSnapshotMode();
          viewBtn.style.display = "none";
          updateModeBtn();
          img.src = snapshotUrl + "?_=" + Date.now();
          scheduleSnapshotTick(CAMERA_SNAPSHOT_POLL_MS);
        }

        function startLiveMode() {
          liveMode = true; cameraLiveId = (cameraCurrent || cameraChosen()).id;
          stopSnapshotMode();
          viewBtn.style.display = "none";
          updateModeBtn();
          // If the stream is already busy (another tab watching), the ESP32
          // sometimes does not even fire the <img>'s "error" event --
          // the connection stays hung without notice. This timeout is the
          // only way to notice that and show "Retry" again instead
          // of leaving the panel without an image forever.
          connectTimeoutId = setTimeout(function () {
            if (!liveMode) return;
            img.removeAttribute("src");
            img.style.setProperty("display", "none", "important");
            flashBtn.style.display = "none";
            viewBtn.style.display = "";
          }, 6000);
          img.src = url;
        }

        // Used by cameraCollapse() -- cut EVERYTHING (photo or video, whichever
        // is active) when closing the panel. cameraExpand() calls
        // cameraStartModeFn (= startSnapshotMode) to start again,
        // always in photo mode, the next time it is opened.
        cameraStopStreamFn = function () {
          focusTool.quiet();
          cameraFlashRestore(); // 2026-10-11: the flash goes back to how it was
          flashSynchronized = false;
          liveMode = false; cameraLiveId = null;
          stopSnapshotMode();
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          img.removeAttribute("src");
          img.style.setProperty("display", "none", "important");
          flashBtn.style.display = "none";
          viewBtn.style.display = "none";
        };
        // abre en foto (liviano) o en video segun la camara (12-cameras.js "abrir")
        cameraStartModeFn = function () {
          if (cameraCurrent && cameraCurrent.open === "video") startLiveMode();
          else startSnapshotMode();
        };

        viewBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          // preventDefault besides stopPropagation: it prevents the tap
          // from giving keyboard/DOM focus to the button. Strong suspicion (live
          // 2026-10-08) that the on-screen keyboard (squeekboard) is
          // triggered by the focus left by a tapped button, not by anything
          // related to collapsing the panel itself -- blur() in
          // cameraCollapse() was not enough alone.
          ev.preventDefault();
        });
        viewBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          startLiveMode();
        });

        img.addEventListener("load", function () {
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          img.style.setProperty("display", "block", "important");
          flashBtn.style.display = cameraFlashShown(cameraCurrent, esEsp32 && cameraHasFlash()) ? "" : "none";
          if (cameraHost && esEsp32) cameraReapplySaved(cameraHost);
          // once per opening (in photo mode "load" arrives with every frame)
          if (cameraHost && esEsp32 && !cameraFlashIsStrip(cameraCurrent) && cameraHasFlash() && !flashSynchronized) {
            flashSynchronized = true;
            cameraFlashSync(cameraHost);
          }
        });

        // Resize handle (bottom right corner) -- dragging it
        // changes the panel's width/height, with min/max limits. It uses
        // ev.stopPropagation() on its own pointer events so that the
        // panel's drag-to-move (above, via makeDraggable) does not
        // fire at the same time.
        var resizeHandle = document.createElement("div");
        resizeHandle.style.cssText = [
          "position:absolute",
          "right:0",
          "bottom:0",
          "width:22px",
          "height:22px",
          "cursor:nwse-resize",
          "touch-action:none",
          "background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.65) 50%)",
        ].join(";");
        panel.appendChild(resizeHandle);

        var resizing = false;
        var resizePointerId = null;
        var resizeStartX = 0;
        var resizeStartAnd = 0;
        var resizeStartW = 0;
        var resizeStartH = 0;

        resizeHandle.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown (EmergencyFab camara)
          resizing = true;
          resizePointerId = ev.pointerId;
          resizeStartX = ev.clientX;
          resizeStartAnd = ev.clientY;
          resizeStartW = panel.offsetWidth;
          resizeStartH = panel.offsetHeight;
          resizeHandle.setPointerCapture(resizePointerId);
        });

        resizeHandle.addEventListener("pointermove", function (ev) {
          if (!resizing || ev.pointerId !== resizePointerId) return;
          ev.stopPropagation();
          var dw = ev.clientX - resizeStartX;
          var dh = ev.clientY - resizeStartAnd;
          var maxW = Math.min(CAMERA_MAX_W, window.innerWidth - panel.offsetLeft - MARGIN);
          var maxH = Math.min(CAMERA_MAX_H, window.innerHeight - panel.offsetTop - MARGIN);
          var newW = clamp(resizeStartW + dw, CAMERA_MIN_W, maxW);
          var newH = clamp(resizeStartH + dh, CAMERA_MIN_H, maxH);
          panel.style.width = newW + "px";
          panel.style.height = newH + "px";
        });

        function endResize(ev) {
          if (!resizing || ev.pointerId !== resizePointerId) return;
          resizing = false;
          ev.stopPropagation();
          try {
            resizeHandle.releasePointerCapture(resizePointerId);
          } catch (e) {
            /* ya liberado */
          }
          saveSize(CAMERA_SIZE_KEY, panel.offsetWidth, panel.offsetHeight);
        }
        resizeHandle.addEventListener("pointerup", endResize);
        resizeHandle.addEventListener("pointercancel", endResize);

        // Flash button (top left) -- turns the camera's own white
        // LED on/off via /control?var=led_intensity. It is no longer
        // sent directly to the ESP32: the stream goes through the Pi's relay
        // (see camera_relay.py), which also forwards /control to the
        // real ESP32 -- so the flash hits the SAME host:port
        // as the video (the relay), not the ESP32 directly. It is important to use
        // .host (host:port) and not .hostname (which loses the relay's :8090
        // and ended up hitting the Pi's port 80 -- bug
        // confirmed live 2026-10-07, the LED never turned on from the
        // button even though /control worked fine tested by hand with curl).
        var cameraHost = null;
        try {
          cameraHost = new URL(url, window.location.href).host;
        } catch (e) {
          /* odd URL -- the flash button simply will not be able to call the endpoint */
        }

        var flashBtn = document.createElement("button");
        flashBtn.type = "button";
        flashBtn.title = i18nT('camera.camera_flash');
        // SVG instead of emoji -- the unicode bolt has no glyph in the
        // kiosk font (it looked like a "broken image" icon,
        // confirmed live 2026-10-07).
        flashBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" style="pointer-events:none;vertical-align:middle" fill="#000">' +
          '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>' +
          "</svg>";
        flashBtn.style.cssText = [
          "position:absolute",
          "left:4px",
          "top:4px",
          "width:26px",
          "height:26px",
          "border-radius:50%",
          "border:none",
          "background:#fbc02d",
          "color:#000",
          "font-size:14px",
          "line-height:26px",
          "text-align:center",
          "padding:0",
          "cursor:pointer",
          "touch-action:none",
          "z-index:1",
          "display:none",
        ].join(";");
        panel.appendChild(flashBtn);

        flashBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown
        });
        flashBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          if (cameraFlashIsStrip(cameraCurrent)) {
            flashOn = stripFlash.toggle(flashOn);
            flashBtn.style.background = flashOn ? "#fff59d" : "#fbc02d";
            return;
          }
          if (!cameraHost) return;
          var host = cameraHost;
          var nuevo = !flashOn;
          flashOn = nuevo;
          flashBtn.style.background = flashOn ? "#fff59d" : "#fbc02d";
          // The camera's native endpoint only turns on the flash if there is ALREADY an active
          // /stream (isStreaming on the ESP32 side) -- that is why
          // this button is only shown once the viewer is
          // connected (see startViewing/viewBtn), never before.
          // 2026-10-11 (reported: "I closed with the x and the flash stayed
          // on"): the Pi's relay keeps the ESP32's stream
          // open for everyone, so closing this viewer does not turn off the
          // flash. The first time it is tapped, how it was is remembered
          // (another viewer may be watching with the light on) and on closing
          // it returns to that value (camFlashRestaurar).
          var before = flashPrevious === null ? cameraFlashRead(host) : Promise.resolve(null);
          before.then(function (v) {
            if (flashPrevious === null && flashPreviousHost === null) {
              flashPrevious = v === null ? (nuevo ? 0 : 255) : v;
              flashPreviousHost = host;
            }
            return fetch("http://" + host + "/control?var=led_intensity&val=" + (nuevo ? 255 : 0));
          }).catch(function () {
            /*  the camera did not respond -- not critical, the button can be tapped again */
          });
        });

        // Camera flash (2026-10-11): value it had before THIS
        // viewer touched it (null = not touched) and its camera.
        var flashPrevious = null;
        var stripFlash = cameraStripFlash(); // 11-panel-parts.js: the light strip used as flash
        var flashPreviousHost = null;
        var flashSynchronized = false; // the real flash was already read on this opening
        // led_intensity actual del ESP32 (/status), o null si no contesta
        function cameraFlashRead(host) {
          var ctl = typeof AbortController === "function" ? new AbortController() : null;
          var t = ctl ? setTimeout(function () { ctl.abort(); }, 1500) : null;
          return fetch("http://" + host + "/status", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
            .then(function (r) { return r.json(); })
            .then(function (s) {
              if (t) clearTimeout(t);
              var v = Number(s && s.led_intensity);
              return isFinite(v) ? v : null;
            })
            .catch(function () {
              if (t) clearTimeout(t);
              return null;
            });
        }
        // when closing the viewer or changing camera: the flash returns to how it
        // was before being touched here (off if it was off; on if
        // another had it on)
        function cameraFlashRestore() {
          if (stripFlash.restore()) {
            flashOn = false;
            flashBtn.style.background = "#fbc02d";
            return;
          }
          if (flashPrevious === null || !flashPreviousHost) return;
          var v = flashPrevious;
          var host = flashPreviousHost;
          flashPrevious = null;
          flashPreviousHost = null;
          if ((v > 0) === flashOn && host === cameraHost) {
            flashOn = false;
            flashBtn.style.background = "#fbc02d";
            return; // it is already as it was
          }
          flashOn = false;
          flashBtn.style.background = "#fbc02d";
          fetch("http://" + host + "/control?var=led_intensity&val=" + Math.max(0, Math.min(255, Math.round(v)))).catch(function () {
            /*  the camera did not respond: it stays as it is */
          });
        }
        // on opening: the button shows how the flash really is (another
        // viewer may have left it on)
        function cameraFlashSync(host) {
          if (flashPrevious !== null) return;
          cameraFlashRead(host).then(function (v) {
            if (v === null || flashPrevious !== null || host !== cameraHost) return;
            if (v < 0 && cameraCurrent) { cameraCurrent.flash = false; flashBtn.style.display = "none"; } // the firmware answers -1 when the board has no LED
            flashOn = v > 0;
            flashBtn.style.background = flashOn ? "#fff59d" : "#fbc02d";
          });
        }

        // Mode button (next to the flash) -- alternates between photo
        // (light, default) and live video. "play" icon = it is in
        // photo, tapping switches to video; "stop" icon = it is in video, tapping
        // goes back to photo.
        var MODE_ICON_PLAY =
          '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#000"><path d="M8 5v14l11-7z"/></svg>';
        var MODE_ICON_STOP =
          '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#000"><rect x="6" y="6" width="12" height="12"/></svg>';

        var modeBtn = document.createElement("button");
        modeBtn.type = "button";
        modeBtn.style.cssText = [
          "position:absolute",
          "left:34px",
          "top:4px",
          "width:26px",
          "height:26px",
          "border-radius:50%",
          "border:none",
          "background:#e0e0e0",
          "color:#000",
          "line-height:26px",
          "text-align:center",
          "padding:0",
          "cursor:pointer",
          "touch-action:none",
          "z-index:1",
        ].join(";");
        panel.appendChild(modeBtn);

        var modeBadge = cameraModeBadge(panel); // 11-panel-parts.js
        function updateModeBtn() {
          modeBtn.style.display = snapshotUrl ? "" : "none";
          modeBtn.title = i18nT(liveMode ? 'camera.back_to_photo_mode' : 'camera.switch_to_live_video');
          modeBtn.innerHTML = liveMode ? MODE_ICON_STOP : MODE_ICON_PLAY;
          modeBadge(liveMode);
        }
        updateModeBtn();

        modeBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown
        });
        modeBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          if (liveMode) {
            startSnapshotMode();
          } else {
            startLiveMode();
          }
        });

        // Settings gear (2026-10-09, see 15-settings.js): image profiles
        // + fine adjustment, saved for all screens.
        var gearBtn = document.createElement("button");
        gearBtn.type = "button";
        gearBtn.title = i18nT('common.camera_settings');
        gearBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="15" height="15" style="pointer-events:none;vertical-align:middle" fill="#000">' +
          '<path d="M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.03 7.03 0 00-1.63-.94l-.36-2.54A.5.5 0 0013.9 2h-3.84a.5.5 0 00-.49.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.67 8.48a.5.5 0 00.12.64l2.03 1.58a7.07 7.07 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.6a3.6 3.6 0 110-7.2 3.6 3.6 0 010 7.2z"/>' +
          "</svg>";
        gearBtn.style.cssText = [
          "position:absolute",
          "left:64px",
          "top:4px",
          "width:26px",
          "height:26px",
          "border-radius:50%",
          "border:none",
          "background:#e0e0e0",
          "color:#000",
          "line-height:26px",
          "text-align:center",
          "padding:0",
          "cursor:pointer",
          "touch-action:none",
          "z-index:1",
        ].join(";");
        panel.appendChild(gearBtn);
        gearBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown
        });
        gearBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          cameraOpenList(panel); // camaras + ajustes de imagen (ESP32-camera)
        });
        if (cameraHost) cameraWatchSuggested(cameraHost);
        cameraHostLive = cameraHost;

        // Camera selector (top, center): only with 2 or more cameras.
        var selector = document.createElement("div");
        selector.style.cssText =
          "position:absolute;left:94px;right:34px;top:4px;display:none;gap:4px;justify-content:center;overflow-x:auto;z-index:1;scrollbar-width:none;";
        panel.appendChild(selector);
        function renderSelector() {
          selector.textContent = "";
          selector.style.display = cameraList.length > 1 ? "flex" : "none";
          var current = cameraChosen();
          cameraList.forEach(function (c) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = c.name;
            b.title = c.name;
            var on = c === current;
            b.style.cssText =
              "flex:none;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:24px;padding:0 9px;border-radius:12px;border:1px solid rgba(255,255,255,0.6);font:bold 11px Roboto,sans-serif;cursor:pointer;touch-action:none;" +
              (on ? "background:#1976d2;color:#fff;" : "background:rgba(0,0,0,0.55);color:#eceff1;");
            b.addEventListener("pointerdown", function (ev) {
              ev.stopPropagation();
              ev.preventDefault(); // ver nota en viewBtn pointerdown
            });
            b.addEventListener("pointerup", function (ev) {
              ev.stopPropagation();
              if (!on) cameraChoose(c.id);
            });
            selector.appendChild(b);
          });
        }
        renderSelector();

        // Changing camera: it cuts what is being seen and starts the new one
        // (in photo mode if it has a still image, otherwise in video).
        var changeSeq = 0;
        cameraOrientApplyFn = function () {
          zoom.orient(cameraOrientOf(cameraCurrent || cameraChosen()));
        };
        cameraChangeFn = function (camera) {
          var seq = ++changeSeq;
          renderSelector();
          cameraUrls(camera).then(function (u) {
            if (seq !== changeSeq) return;
            var abierto = isCameraOpen();
            if (abierto && cameraStopStreamFn) cameraStopStreamFn();
            url = u.video;
            snapshotUrl = u.photo;
            esEsp32 = u.esp32;
            cameraHost = u.host;
            cameraHostLive = u.esp32 ? u.host : null;
            flashOn = false;
            flashBtn.style.background = "#fbc02d";
            img.alt = camera.name;
            cameraCurrent = camera;
            zoom.reset();
            zoom.orient(cameraOrientOf(camera)); // girar / espejar (16-orientation.js)
            updateModeBtn();
            paintDown();
            if (abierto) cameraStartModeFn();
          });
        };

        // ---- Bottom (2026-10-10): capture, mosaic, zoom and relay state ----
        // flash: only if the camera has it (detected by the relay or when adding it)
        function cameraHasFlash() {
          if (cameraFlashIsStrip(cameraCurrent)) return true; // the light strip is the flash: it does not depend on the camera having an LED
          if (cameraCurrent && cameraCurrent.flash === false) return false;
          var e = cameraStateOf(cameraRelayId(cameraCurrent || { id: "main", url: "" }));
          return !(e && e.flash === false);
        }
        var botonAbajo = cameraBottomButton.bind(null, panel); // 11-panel-parts.js
        var noticeThe = document.createElement("div");
        noticeThe.setAttribute("data-workshop-i18n", "");
        noticeThe.style.cssText =
          "position:absolute;left:50%;bottom:36px;transform:translateX(-50%);max-width:90%;padding:4px 10px;border-radius:12px;background:rgba(0,0,0,0.75);color:#fff;font:12px Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:2;display:none;pointer-events:none;";
        panel.appendChild(noticeThe);
        var noticeTimer = null;
        function notify(text) {
          noticeThe.textContent = text;
          noticeThe.style.display = "";
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(function () { noticeThe.style.display = "none"; }, 3500);
        }
        var capBtn = botonAbajo(4, i18nT('camera.capture_photo_with_date_job_and'),
          '<path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/>',
          function () { cameraPanelCapture(cameraCurrent, notify); });
        botonAbajo(34, i18nT('camera.all_cameras_grid'), '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>', function () { cameraOpenMosaic(); });
        botonAbajo(64, i18nT('camera.zoom_in_digital_zoom'), '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>', function () { zoom.more(); });
        botonAbajo(94, i18nT('camera.zoom_out'), '<path d="M19 13H5v-2h14v2z"/>', function () { zoom.minus(); });
        // Manual timelapse (14-timelapse.js): one tap starts (cameras and arming
        // from the settings), another tap stops; red while recording
        var tlBtn = botonAbajo(124, i18nT('camera.timelapse_start_or_stop_cameras_and'),
          '<circle cx="12" cy="12" r="7"/>',
          function () { cameraPanelTimelapse(notify); });
        var focusTool = cameraFocusAssemble(panel, img, { // 11-focus.js
          isLive: function () { return liveMode; }, startLive: startLiveMode, startSnapshot: startSnapshotMode,
          stopSnapshot: stopSnapshotMode, photoUrl: function () { return snapshotUrl; }, notify: notify, button: botonAbajo,
        });
        cameraRoleBind(panel, { gear: gearBtn, capture: capBtn, timelapse: tlBtn, focus: focusTool.button }); // 09-camera-roles.js: what each view shows
        var stateThe = document.createElement("div");
        stateThe.setAttribute("data-workshop-i18n", "");
        stateThe.style.cssText =
          "position:absolute;left:186px;right:26px;bottom:8px;font:11px Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none;z-index:1;";
        panel.appendChild(stateThe);
        function paintDown() {
          var rid = cameraRelayId(cameraCurrent || { id: "main", url: "" });
          capBtn.style.opacity = rid ? "1" : "0.4";
          var e = rid ? cameraStateOf(rid) : null;
          var grabando = !!(cameraState && cameraState.timelapse && cameraState.timelapse.recording);
          tlBtn.style.background = grabando ? "#e53935" : "#e0e0e0";
          tlBtn.firstChild.setAttribute("fill", grabando ? "#fff" : "#c62828");
          tlBtn.title = grabando ? i18nT('camera.timelapse_recording_tap_to_stop') : i18nT('camera.timelapse_start_or_stop_cameras_and');
          stateThe.textContent = rid ? cameraStateText(e) : "";
          stateThe.style.color = cameraStateColor(e);
          if (img.style.display === "block" || img.style.getPropertyValue("display") === "block") flashBtn.style.display = cameraFlashShown(cameraCurrent, esEsp32 && cameraHasFlash()) ? "" : "none";
        }
        cameraStateListeners.push(paintDown);
        paintDown();

        // Close button (top right) -- closes the panel (display:
        // none, it does not delete it from the DOM) and cuts this screen's image
        // request. It is opened again from the camera icon of the
        // sidebar. It does NOT touch the Pi's relay (that is the GLOBAL action).
        var closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.title = i18nT('camera.close_camera');
        // SVG instead of emoji -- the same reason as the flash button.
        closeBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#fff">' +
          '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
          "</svg>";
        closeBtn.style.cssText = [
          "position:absolute",
          "right:4px",
          "top:4px",
          "width:26px",
          "height:26px",
          "border-radius:50%",
          "border:none",
          "background:rgba(0,0,0,0.6)",
          "color:#fff",
          "font-size:14px",
          "line-height:26px",
          "text-align:center",
          "padding:0",
          "cursor:pointer",
          "touch-action:none",
          "z-index:1",
        ].join(";");
        panel.appendChild(closeBtn);

        closeBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown
        });
        closeBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          cameraCollapse();
        });

        // If the image fails AFTER tapping "View camera" -- most
        // likely another tab already holds the only /stream slot
        // busy (see big comment in createCameraWidgets), not that
        // the camera stopped existing (that was already ruled out before
        // reaching the creation of the panel). That is why the whole panel is NOT
        // deleted nor is the browser's broken "image broken" icon shown --
        // the button is shown again so that they retry whenever they want.
        img.addEventListener("error", function () {
          if (!liveMode) return; // photo mode: the next already scheduled tick retries by itself
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          img.removeAttribute("src");
          img.style.setProperty("display", "none", "important");
          flashBtn.style.display = "none";
          viewBtn.style.display = "";
        });

        document.body.appendChild(panel);
        cameraPanelEl = panel;
        makeDraggable(panel, "emergencyFabCamPos", savedSize.w, savedSize.h, 16, 16, null);
      }
