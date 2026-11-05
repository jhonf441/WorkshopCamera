      // ---- 2. Floating camera panel (the viewer) ----
      //
      // informe-07: the viewer is for LOOKING: the picture, close, resize, zoom, the camera selector, the photo / live-video button, the flash
      // (when the camera has one and the view can), the mosaic of all the cameras, the quick capture (the owner's decision) and ONE button that opens the
      // page of the plugin (capture, timelapse, cameras, image settings, focus, relay, gallery: 17-gallery.js and 18-page-*.js).
      // 2026-10-08 (v3): there is NO round floating button (FAB) any more. The
      // launcher is the camera icon of the sidebar (section 0):
      // it opens/closes this panel, which still floats and can be dragged over
      // any page. Only two states: open / closed (the "x"
      // closes it completely, nothing is left on screen) -- the
      // "Hide/Reactivate" disappeared, it only existed because the circles
      // got in the way. The panel is created ONCE on load and afterwards only
      // its display is toggled (the same "never destroy" pattern that avoided the
      // duplicate copies of v1).

      var CAMERA_PANEL_ID = "workshop-camera-panel";
      var CAMERA_W = 340; // wide enough for the four round buttons of the bottom row and the label of the button to the page
      var CAMERA_H = 226;
      // Smallest the viewer can be made (2026-11-04): the top row (flash, mode, close), the badge under it, the bottom row (four round buttons, the
      // page button as an icon, the corner) and, when the picture fails, the Retry and "Help" buttons stacked in the middle must all fit without
      // covering each other (owner report 2026-11-04: at 190x120 they covered the badge text "does not respond"). Under CAMERA_COMPACT_W the
      // buttons with a word become icons (the page button; the camera chips show their number, the name stays in the tooltip).
      var CAMERA_MIN_W = 250;
      var CAMERA_MIN_H = 190;
      var CAMERA_COMPACT_W = 300;
      var CAMERA_MAX_W = 640;
      var CAMERA_MAX_H = 480;
      var CAMERA_SIZE_KEY = "workshopCameraSize";
      var CAMERA_EXPANDED_KEY = "workshopCameraExpanded";
      var CAMERA_POS_KEY = "workshopCameraPos";

      var cameraPanelEl = null;
      var cameraStopStreamFn = null;
      var cameraStartModeFn = null;
      var CAMERA_SNAPSHOT_POLL_MS = 3000;

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
        if (cameraPanelEl) { cameraPanelEl.style.display = ""; cameraReclampPanel(); workshopAnnouncePanelOpened("camera"); } // a phone: the open Controls bar would cover the viewer
        workshopNotify();
        cameraStateRead(); // 13-service.js: once per opening, the relay says whether this camera has a flash (the page keeps its own 3 s read)
        // It always starts in photo mode -- see startSnapshotMode() inside
        // buildCameraPanel. Video mode is only activated with the
        // button next to the flash, never on its own.
        if (cameraStartModeFn) cameraStartModeFn();
      }

      // `silent`: when applying the state saved on page load
      // the anti-keyboard burst is not needed (nobody touched anything).
      function cameraCollapse(silent) {
        if (!silent) workshopWithoutTouchGhost(); // the closing tap must not reach what is under the panel
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


      // What the service says about the camera, judged with the list (cameraStartupStateCameras, 19-startup.js): "configured" | "missing" (no
      // camera has an address yet: there is no viewer) | "na" (the service does not answer: the viewer is built anyway and says so).
      // null = not asked yet. The text of the launcher reads it (20-main.js).
      var cameraAddressState = null;

      function createCameraWidgets() {
        if (pluginStopped) return;
        if (document.getElementById(CAMERA_PANEL_ID)) return;
        if (!cameraCanDo("view")) return; // a visitor without the camera: no panel (the launcher says why, 20-main.js)

        // The panel is created from the start (hidden if it was closed); the
        // camera (ESP32-camera, behind the 1-to-many relay on the Pi) is only
        // asked for while the panel is open (see cameraExpand/cameraCollapse).
        // 2026-10-12: the address comes only from the own list
        // (cameras.json, 12-cameras.js), no longer from DWC's webcam.
        cameraLoadList().then(cameraStartupRelay).then(function (relay) {
          cameraAddressState = cameraStartupStateCameras(cameraList, relay);
          workshopNotify();
          if (cameraAddressState === "missing") return; // no camera yet: no viewer (the page "Timelapses and captures" adds the first one)
          if (pluginStopped) return;
          if (document.getElementById(CAMERA_PANEL_ID)) return;
          buildCameraPanel(cameraUrlMain());
          if (isCameraExpanded()) {
            cameraExpand();
          } else {
            cameraCollapse(true);
          }
          // several cameras (12-cameras.js): the one chosen on this screen
          if (cameraChangeFn) cameraChangeFn(cameraChosen());
        });
      }

      // The first camera was saved (or the address changed): ask the service again and, if there is a camera now, the viewer appears.
      function cameraRefreshAddress() {
        cameraStartupRelayMemo.t = 0; // 19-startup.js: the memo of camera.status is stale now
        createCameraWidgets();
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
        var saved = loadPos(CAMERA_POS_KEY);
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
        var health = null; // the judgement of the picture on screen (14-health.js): null while the viewer is closed

        var panel = cameraPanelBox(savedSize); // 11-panel-parts.js

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
        var viewBtn = cameraRetryButton(); // 11-panel-parts.js
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

        // The picture on screen is judged by 14-health.js (frames that come, a black frame, the relay's numbers): the badge, the Retry and the
        // help follow that judgement, never the mode alone. A new mode or camera starts a new judgement; closing the viewer ends it.
        function healthStart() {
          healthStop();
          var again = liveMode ? startLiveMode : startSnapshotMode; // Retry asks again in the mode on screen (never back to photo from live)
          health = cameraHealthWatch(img, cameraCurrent || cameraChosen(), { video: liveMode, photo: snapshotUrl, relayPoll: true, onChange: paintHealth, reload: again });
        }
        function healthStop() {
          if (health) cameraHealthStop(health);
          health = null;
        }
        function paintHealth() {
          var h = health && health.h;
          modeBadge(liveMode, h);
          var alive = !h || h.state === "fresh" || h.state === "waiting";
          helpBtn.style.display = !alive && cameraPageLinkShown(cameraCanDo("gallery"), cameraPageRegistered) ? "" : "none";
          viewBtn.style.display = alive ? "none" : ""; // Retry whenever the picture is not alive, in either mode
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
          healthStart();
          updateModeBtn();
          img.src = snapshotUrl + "?_=" + Date.now();
          scheduleSnapshotTick(CAMERA_SNAPSHOT_POLL_MS);
        }

        function startLiveMode() {
          liveMode = true; cameraLiveId = (cameraCurrent || cameraChosen()).id;
          stopSnapshotMode();
          viewBtn.style.display = "none";
          healthStart();
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
          liveMode = false; cameraLiveId = null;
          stopSnapshotMode();
          healthStop();
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          img.removeAttribute("src");
          img.style.setProperty("display", "none", "important");
          flashBtn.style.display = "none";
          viewBtn.style.display = "none";
          helpBtn.style.display = "none";
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
          if (health) cameraHealthRetry(health); // a fresh request in the mode on screen, judged as a first one (14-health.js)
          else startLiveMode();
        });
        // the way to the checklist of the page (Live section) while the picture is not alive; on a narrow screen the viewer closes behind it
        var helpBtn = cameraHelpButton(panel, function () {
          cameraOpenPage("live");
          if (workshopIsNarrow()) cameraCollapse();
        });

        img.addEventListener("load", function () {
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }
          img.style.setProperty("display", "block", "important");
          flashBtn.style.display = cameraCanDo("flash") && cameraFlashShown(cameraCurrent, esEsp32 && cameraHasFlash()) ? "" : "none"; // a viewer has no flash: the relay would refuse it
        });

        cameraResizeHandle(panel); // 11-panel-parts.js: the corner that resizes the viewer

        // Flash button (top left): the service holds the flash (camera.flash, informe-06 B-P5): it switches the LED of the camera or the work lights and
        // remembers it, and it switches it off when nobody looks at the camera any more, so this viewer keeps no "how it was before" and puts nothing
        // back when it closes. The button asks and paints what the service answers.
        var cameraHost = null;
        try {
          cameraHost = new URL(url, window.location.href).host;
        } catch (e) {
          /* odd URL -- the flash button simply will not be able to call the endpoint */
        }

        var flashBtn = cameraFlashButton(panel); // 11-panel-parts.js

        flashBtn.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // ver nota en viewBtn pointerdown
        });
        flashBtn.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          var camera = cameraCurrent;
          if (!camera) return;
          var wanted = !flashOn;
          flashOn = wanted;
          cameraFlashPaint(flashBtn, flashOn);
          cameraFlashSet(camera, wanted).then(function (r) {
            if (camera !== cameraCurrent) return;
            if (!r.ok) { // the light did not change (the service refused or the camera did not answer): the button does not say it did
              flashOn = !wanted;
              cameraFlashPaint(flashBtn, flashOn);
              notify(r.error || i18nT('camera.could_not_switch_the_flash'));
              return;
            }
            flashFromRecord();
          });
        });

        // what the service says about the flash of the camera that is being seen: the state of the relay when it has one (read when the viewer
        // opens), else the record of the list
        function flashOfCurrent() {
          var e = cameraStateOf(cameraRelayId(cameraCurrent));
          return (e && e.flash) || (cameraCurrent && cameraCurrent.flash) || null;
        }
        function flashFromRecord() {
          var f = flashOfCurrent();
          flashOn = !!(f && f.on);
          cameraFlashPaint(flashBtn, flashOn);
        }

        // Mode button (next to the flash) -- alternates between photo (light, default) and live video (11-panel-parts.js).
        var mode = cameraModeButton(panel);
        var modeBtn = mode.btn;

        var modeBadge = cameraModeBadge(panel); // 11-panel-parts.js
        function updateModeBtn() {
          mode.paint(liveMode, !!snapshotUrl);
          paintHealth(); // the badge says what the judgement says, in the mode on screen
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


        // Camera selector (top, center): only with 2 or more cameras (11-panel-parts.js).
        var renderSelector = cameraSelectorAssemble(panel);
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
            img.alt = camera.name;
            cameraCurrent = camera;
            flashFromRecord();
            zoom.reset();
            zoom.orient(cameraOrientOf(camera)); // girar / espejar (16-orientation.js)
            updateModeBtn();
            paintDown();
            if (abierto) cameraStartModeFn();
          });
        };

        // flash: only if the camera has it (the relay detects it: capable false = it has none; not known yet = the button shows)
        function cameraHasFlash() {
          if (cameraFlashIsStrip(cameraCurrent)) return true; // the light strip is the flash: it does not depend on the camera having an LED
          var f = flashOfCurrent();
          return !(f && f.capable === false);
        }

        // ---- Bottom row: quick capture, mosaic, zoom, and the way to the page ----
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
        // the way to the page of the plugin (18-page-tabs.js): capture, timelapse, cameras, image settings, focus, relay and the gallery live there
        var pageBtn = cameraPageButton(panel);
        cameraRoleBind(panel, { capture: capBtn, page: pageBtn }); // 09-camera-roles.js: what each view shows
        // what depends on the camera that is being seen: the quick capture needs the relay, the flash needs the camera to have one and the view to allow it
        function paintDown() {
          var rid = cameraRelayId(cameraCurrent);
          capBtn.style.opacity = rid ? "1" : "0.4";
          var shown = img.style.display === "block" || img.style.getPropertyValue("display") === "block";
          if (shown) flashBtn.style.display = cameraCanDo("flash") && cameraFlashShown(cameraCurrent, esEsp32 && cameraHasFlash()) ? "" : "none";
          flashFromRecord(); // the relay was read again: the button says what the service says
        }
        cameraStateListeners.push(paintDown);
        paintDown();

        // Close button (top right) -- closes the panel (display: none, it does not delete it from the DOM) and cuts this screen's image
        // request. It is opened again from the camera icon of the sidebar. It does NOT touch the Pi's relay (that is the GLOBAL action).
        cameraCloseButton(panel, cameraCollapse); // 11-panel-parts.js

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
        makeDraggable(panel, CAMERA_POS_KEY, savedSize.w, savedSize.h, 16, 16, null);
      }
