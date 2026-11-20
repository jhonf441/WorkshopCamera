      // ---- Small parts of the floating camera panel (taken out of buildCameraPanel) ----

      // id of the camera the viewer is showing as live video (null: photo mode or panel closed); the mosaic follows it
      var cameraLiveId = null;

      // Round button of the bottom row of the panel (left = px from the left edge); bind it to the panel with .bind(null, panel)
      function cameraBottomButton(panel, left, title, svg, onTap) {
        var b = document.createElement("button");
        b.type = "button";
        b.title = title;
        b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" style="pointer-events:none;vertical-align:middle" fill="#000">' + svg + "</svg>";
        b.style.cssText =
          "position:absolute;left:" + left + "px;bottom:4px;width:26px;height:26px;border-radius:50%;border:none;background:#e0e0e0;padding:0;cursor:pointer;touch-action:none;z-index:1;line-height:26px;text-align:center;";
        b.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
        });
        b.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          onTap(b);
        });
        panel.appendChild(b);
        return b;
      }

      // The corner (bottom right) that resizes the viewer: dragging it changes the width and the height inside the limits, and the size is remembered.
      // It stops its own pointer events so that the drag-to-move of the panel (makeDraggable) does not fire at the same time.
      function cameraResizeHandle(panel) {
        var handle = document.createElement("div");
        // on a touch screen the corner is a 36 px target (the drawing stays a small triangle); a mouse keeps the 22 px corner
        var px = cameraIsTouch() ? 36 : 22;
        handle.style.cssText = "position:absolute;right:0;bottom:0;width:" + px + "px;height:" + px + "px;cursor:nwse-resize;touch-action:none;z-index:1;" +
          "background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.65) 50%) right bottom / 22px 22px no-repeat;";
        handle.title = i18nT('camera.resize_handle');
        handle.setAttribute("aria-label", i18nT('camera.resize_handle'));
        panel.appendChild(handle);
        var drag = null; // { id, x, y, w, h } while a finger or a mouse holds the corner
        handle.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
          drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, w: panel.offsetWidth, h: panel.offsetHeight };
          handle.setPointerCapture(ev.pointerId);
        });
        handle.addEventListener("pointermove", function (ev) {
          if (!drag || ev.pointerId !== drag.id) return;
          ev.stopPropagation();
          var maxW = Math.min(CAMERA_MAX_W, window.innerWidth - panel.offsetLeft - MARGIN);
          var maxH = Math.min(CAMERA_MAX_H, window.innerHeight - panel.offsetTop - MARGIN);
          panel.style.width = clamp(drag.w + ev.clientX - drag.x, CAMERA_MIN_W, maxW) + "px";
          panel.style.height = clamp(drag.h + ev.clientY - drag.y, CAMERA_MIN_H, maxH) + "px";
        });
        function end(ev) {
          if (!drag || ev.pointerId !== drag.id) return;
          drag = null;
          ev.stopPropagation();
          try {
            handle.releasePointerCapture(ev.pointerId);
          } catch (e) {
            /* already released */
          }
          saveSize(CAMERA_SIZE_KEY, panel.offsetWidth, panel.offsetHeight);
        }
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      }

      // The close button (top right): onClose() hides the panel (it does not delete it) and cuts this screen's image request.
      function cameraCloseButton(panel, onClose) {
        var b = document.createElement("button");
        b.type = "button";
        b.title = i18nT('camera.close_camera');
        // SVG instead of emoji: the unicode glyphs are not in the kiosk font
        b.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#fff">' +
          '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
          "</svg>";
        b.style.cssText =
          "position:absolute;right:4px;top:4px;width:26px;height:26px;border-radius:50%;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:14px;line-height:26px;text-align:center;padding:0;cursor:pointer;touch-action:none;z-index:1;";
        panel.appendChild(b);
        b.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
        });
        b.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          onClose();
        });
        return b;
      }

      // The camera selector (top, between the mode button and the close button): one chip per camera, only with two or more.
      // Returns render(): draws the chips again (the list or the chosen camera changed).
      function cameraSelectorAssemble(panel) {
        var selector = document.createElement("div");
        selector.style.cssText = "position:absolute;left:64px;right:34px;top:4px;display:none;gap:4px;justify-content:center;overflow-x:auto;z-index:1;scrollbar-width:none;";
        panel.appendChild(selector);
        var render = function () {
          selector.textContent = "";
          selector.style.display = cameraList.length > 1 ? "flex" : "none";
          var current = cameraChosen();
          cameraList.forEach(function (c) {
            var b = document.createElement("button");
            b.type = "button";
            var compact = cameraIsCompact(panel);
            b.textContent = compact ? String(cameraList.indexOf(c) + 1) : c.name; // narrow viewer: the number, the name stays in the tooltip
            b.title = c.name;
            var on = c === current;
            b.style.cssText =
              "flex:none;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:24px;padding:0 " + (compact ? 8 : 9) + "px;border-radius:12px;border:1px solid rgba(255,255,255,0.6);font:bold 11px Roboto,sans-serif;cursor:pointer;touch-action:none;" +
              (on ? "background:#1976d2;color:#fff;" : "background:rgba(0,0,0,0.55);color:#eceff1;");
            b.addEventListener("pointerdown", function (ev) {
              ev.stopPropagation();
              ev.preventDefault(); // see the note in viewBtn pointerdown
            });
            b.addEventListener("pointerup", function (ev) {
              ev.stopPropagation();
              if (!on) cameraChoose(c.id);
            });
            selector.appendChild(b);
          });
        };
        panel.addEventListener("camera-compact", render); // the width crossed the limit: names <-> numbers
        return render;
      }

      // The one button of the viewer that is not about looking (bottom right): "Open capture and timelapse" opens the page of the plugin on its
      // Record tab. 09-camera-roles.js (cameraRoleBind) shows it only to a view with the gallery and while the page is registered. On a narrow
      // screen the viewer closes behind it (it would cover the page).
      function cameraPageButton(panel) {
        var b = document.createElement("button");
        b.type = "button";
        b.title = i18nT('camera.open_page');
        b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" style="pointer-events:none;flex:none" fill="#000"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>';
        var label = document.createElement("span");
        label.textContent = i18nT('camera.open_page');
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        b.appendChild(label);
        b.style.cssText =
          "position:absolute;left:128px;right:26px;bottom:4px;height:26px;border-radius:13px;border:none;background:#e0e0e0;color:#000;padding:0 8px;display:flex;align-items:center;justify-content:center;gap:4px;font:bold 11px Roboto,sans-serif;cursor:pointer;touch-action:none;z-index:1;overflow:hidden;";
        panel.appendChild(b);
        // narrow viewer: the word goes and the button is the round icon (the tooltip keeps the words)
        function paint() {
          var compact = cameraIsCompact(panel);
          label.style.display = compact ? "none" : "";
          b.style.right = compact ? "auto" : "26px";
          b.style.width = compact ? "26px" : "";
          b.style.padding = compact ? "0" : "0 8px";
          b.style.borderRadius = compact ? "50%" : "13px";
        }
        paint();
        panel.addEventListener("camera-compact", paint);
        b.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
        });
        b.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          cameraOpenPage("live"); // 18-page-tabs.js
          if (workshopIsNarrow()) cameraCollapse();
        });
        return b;
      }

      // The flash of a camera can be the work-light strip instead of its own LED (cameras.json flash_source "strip")
      // The floating box of the viewer: the saved size, never bigger than the window, dragged with the finger. size = {w, h}.
      function cameraPanelBox(size) {
        var panel = document.createElement("div");
        panel.id = CAMERA_PANEL_ID;
        panel.setAttribute("data-workshop-float", "1"); // a floating widget: the Jog hides every one of them in its full screen (WorkshopJog/10-jog.js)
        panel.style.cssText = [
          "position:fixed",
          "width:" + size.w + "px",
          "height:" + size.h + "px",
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
        cameraWatchCompact(panel);
        return panel;
      }

      // Is the viewer narrow enough for icons only? width in px (the panel's own, or its style before it is on screen).
      function cameraIsCompactWidth(width) {
        return width < CAMERA_COMPACT_W;
      }
      function cameraIsCompact(panel) {
        return cameraIsCompactWidth(panel.offsetWidth || parseInt(panel.style.width, 10) || CAMERA_W);
      }

      // The parts that change look with the width ask to be told when the viewer crosses CAMERA_COMPACT_W: they listen to "camera-compact" on the panel.
      function cameraWatchCompact(panel) {
        if (typeof ResizeObserver !== "function" || typeof Event !== "function") return;
        var last = cameraIsCompact(panel);
        new ResizeObserver(function () {
          var now = cameraIsCompact(panel);
          if (now === last) return;
          last = now;
          panel.dispatchEvent(new Event("camera-compact"));
        }).observe(panel);
      }

      // A touch screen (phone, tablet, kiosk): the main pointer is coarse. No user-agent sniffing.
      function cameraIsTouch() {
        try {
          return !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches === true;
        } catch (e) {
          return false;
        }
      }

      // The two buttons over a picture that is not alive (Retry, and the way to the help of the page), with the look of the family (DESIGN 3: the main one
      // filled with the accent, radius 6, 32 px high; the other a gray outline) instead of the old pills. Where they sit is cameraNarrowIcons.
      var CAMERA_OVER_BTN = "position:absolute;left:50%;box-sizing:border-box;min-height:32px;padding:0 14px;border-radius:6px;display:none;align-items:center;justify-content:center;gap:6px;" +
        "font:500 13px/1 Roboto,Helvetica,Arial,sans-serif;white-space:nowrap;cursor:pointer;touch-action:none;z-index:1;";

      // The "Retry" button: it appears when the picture is not alive (the photo mode retries by itself on its next tick, the live video needs the tap).
      function cameraRetryButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = i18nT('camera.retry');
        button.style.cssText = CAMERA_OVER_BTN + "border:0;background:#1976d2;color:#fff;";
        return button;
      }

      // Where Retry and the help button sit, and how they look at each width (owner report 2026-11-06: ugly; 2026-11-18: still ugly, the second one has too
      // much text). A wide viewer: side by side in the middle, Retry with its icon and its word and the help as a round "?" (its words are the tooltip). A
      // narrow one: both round icons in the SAME row as the round buttons of the bottom, on the right (before the resize corner), so the middle stays clear.
      // Pure: the geometry for a width. Returns { small, top, bottom, right, retryTransform, helpTransform, size }.
      function cameraOverButtonsLayout(compact) {
        if (compact) return { small: true, top: "auto", bottom: "4px", retryRight: "22px", helpRight: "52px", retryTransform: "none", helpTransform: "none", size: "26px" };
        return { small: false, top: "50%", bottom: "auto", retryRight: "auto", helpRight: "auto", retryTransform: "translate(calc(-100% - 4px),-50%)", helpTransform: "translate(4px,-50%)", size: "" };
      }

      function cameraNarrowIcons(panel, retry, help) {
        var ICON_RETRY = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none;vertical-align:middle" fill="#fff"><path d="M17.65 6.35A7.96 7.96 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L13 11h7V4z"/></svg>';
        var ICON_HELP = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none;vertical-align:middle" fill="#fff"><path d="M11 18h2v-2h-2v2zm1-16a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm0-14a4 4 0 00-4 4h2a2 2 0 114 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 00-4-4z"/></svg>';
        var retryWords = retry.textContent;
        retry.title = retryWords;
        help.setAttribute("aria-label", help.title); // the words of the help are its tooltip and its accessible name; the button is only the "?"
        function paint() {
          var L = cameraOverButtonsLayout(cameraIsCompact(panel));
          // Retry: the icon always, the word only when wide; the help: the icon only, round, always
          retry.innerHTML = ICON_RETRY + (L.small ? "" : "<span>" + retryWords.replace(/</g, "&lt;") + "</span>");
          help.innerHTML = ICON_HELP;
          retry.style.padding = L.small ? "0" : "0 14px 0 10px";
          help.style.padding = "0";
          retry.style.width = L.small ? L.size : "";
          retry.style.height = L.small ? L.size : "";
          help.style.width = help.style.height = L.small ? L.size : "32px";
          retry.style.borderRadius = L.small ? "50%" : "";
          help.style.borderRadius = "50%";
          retry.style.top = help.style.top = L.top;
          retry.style.bottom = help.style.bottom = L.bottom;
          retry.style.left = help.style.left = L.small ? "auto" : "50%";
          retry.style.right = L.retryRight;
          help.style.right = L.helpRight;
          retry.style.transform = L.retryTransform;
          help.style.transform = L.helpTransform;
        }
        paint();
        panel.addEventListener("camera-compact", paint);
      }

      // A size saved on a wide screen is brought inside a narrow window (a phone), or the "x" of the viewer ends up off screen.
      function cameraFitSize(size) {
        return {
          w: Math.max(CAMERA_MIN_W, Math.min(size.w, window.innerWidth - 2 * MARGIN)), // a size saved before the limit existed is brought up to it
          h: Math.max(CAMERA_MIN_H, Math.min(size.h, window.innerHeight - 2 * MARGIN)),
        };
      }

      // The flash button says its state by itself: on = bright yellow with a halo, off = dark grey with a struck-through bolt (two yellows were hard to tell apart)
      function cameraFlashPaint(btn, on) {
        btn.style.background = on ? "#ffeb3b" : "#37474f";
        btn.style.color = on ? "#000" : "#fff"; // the bolt is read on either background
        btn.style.boxShadow = on ? "0 0 0 2px #fff, 0 0 10px 3px #fff176" : "none";
        btn.style.opacity = on ? "1" : "0.85";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.title = on ? i18nT('camera.flash_is_on') : i18nT('camera.flash_is_off');
        var bolt = btn.querySelector("path");
        if (bolt) bolt.setAttribute("fill", on ? "#000" : "#90a4ae");
        var strike = btn.querySelector("line");
        if (strike) strike.style.display = on ? "none" : "";
      }

      function cameraFlashIsStrip(camera) {
        return !!(camera && camera.flash_source === "strip");
      }

      // Whether the flash button shows: the service lets this person switch it (camera.flash: the operator and above), and the camera has one (the
      // LED of an ESP32 with flash: ownLed) or the flash is the work lights
      function cameraFlashShown(camera, ownLed) {
        if (typeof workshopCan === "function" && !workshopCan("camera.flash")) return false;
        return cameraFlashIsStrip(camera) || ownLed;
      }

      // Switches the flash of a camera of the list: the SERVICE does it (camera.flash: the camera's LED or the work lights, as the camera's flash_source
      // says) and remembers it; this only asks and keeps the answer in the camera record. Resolves {ok, error?, flash?}; never rejects.
      var cameraFlashMine = {}; // MO-7: the lights THIS page switched on and has not switched off yet (camera id -> camera)
      function cameraFlashSet(camera, on, opts) {
        if (typeof cameraHealthFlashGrace === "function") cameraHealthFlashGrace(cameraRelayId(camera)); // 14-health.js: the camera may restart with the LED
        return workshopApi("camera.flash", { camera: camera.id, on: !!on }, opts).then(
          function (r) {
            if (r && r.flash) {
              camera.flash = r.flash;
              var state = cameraStateOf(cameraRelayId(camera)); // the state of the relay read when the viewer opened must not say the old one
              if (state) state.flash = r.flash;
            }
            if (r && r.ok !== false) { if (on) cameraFlashMine[camera.id] = camera; else delete cameraFlashMine[camera.id]; }
            return r || { ok: false, error: "" };
          },
          function (e) {
            return { ok: false, error: String(e && e.message ? e.message : e) };
          }
        );
      }

      // MO-7: the flash this page switched on goes off when the page stops looking: the viewer closes (or changes camera), the plugin stops, the tab is
      // closed or reloaded (unloading: the request outlives the page). The service also switches it off when nobody looks, but a viewer in photo mode
      // asks for a picture every 3 s and never opens the video, so the service cannot tell that it was closed. Fire and forget: it never rejects.
      function cameraFlashesOff(unloading) {
        Object.keys(cameraFlashMine).forEach(function (id) {
          cameraFlashSet(cameraFlashMine[id], false, { quiet: true, keepalive: !!unloading });
        });
      }

      // Pill over a picture that says what is on screen: returns set(live, h). live = the mode chosen (live video or a photo that refreshes);
      // h = the judgement of the picture (14-health.js, {state, since_s}; null = not judged yet). The mode alone never says "LIVE": the pill says
      // LIVE or PHOTO in green only while frames come and are not black; otherwise it carries the words and the colour of the state (amber for a
      // picture that stopped or is black, red for a camera that does not respond), the same as every other place (owner report 2026-11-03).
      // `host` is the element it sits on (absolute); `css` positions it.
      // 2026-11-18: a black picture with a flash that is on screen, allowed and off is almost always a dark room: asking again or reading the help does not
      // light it, so the badge says to try the flash and Retry and the help stay out; with the flash on and still black they come back
      function cameraFlashCanLight(btn) {
        return btn.style.display !== "none" && !btn.disabled && btn.getAttribute("aria-pressed") !== "true";
      }
      function cameraBlackFlash(h, btn) {
        return !!h && h.state === "black" && cameraFlashCanLight(btn);
      }
      var cameraBlackHint = null; // set by the viewer (10-camera.js): the sentence for a black picture whose flash is still off, or "" (none)
      function cameraBadge(host, css) {
        var b = document.createElement("div");
        b.setAttribute("data-workshop-i18n", "");
        b.style.cssText = "position:absolute;padding:1px 7px;border-radius:9px;font:bold 10px Roboto,sans-serif;color:#fff;pointer-events:none;z-index:2;" + css;
        host.appendChild(b);
        var last = [false, null];
        var viewer = typeof CAMERA_PANEL_ID !== "undefined" && host.id === CAMERA_PANEL_ID; // only the floating viewer has a narrow look
        var paint = function (live, h) {
          last = [live, h];
          var state = h ? h.state : "waiting";
          var words = !h || state === "fresh" ? (live ? "● " + i18nT('camera.badge_live') : i18nT('camera.badge_photo', { s: CAMERA_SNAPSHOT_POLL_MS / 1000 })) : cameraHealthWord(h, i18nT);
          if (viewer && state === "black" && typeof cameraBlackHint === "function") words = cameraBlackHint() || words;
          var small = viewer && cameraIsCompact(host); // narrow viewer: a coloured dot, the words stay in the tooltip
          b.textContent = small ? "" : words;
          b.title = words;
          b.style.width = small ? "10px" : "";
          b.style.height = small ? "10px" : "";
          b.style.padding = small ? "0" : "1px 7px";
          b.style.borderRadius = small ? "50%" : "9px";
          if (viewer) { b.style.left = small ? "68px" : "6px"; b.style.top = small ? "13px" : "34px"; } // narrow: the dot sits in the top row, after play and flash
          b.style.background = cameraHealthFill(state);
          b.setAttribute("data-state", state);
        };
        if (viewer) host.addEventListener("camera-compact", function () { paint(last[0], last[1]); });
        return paint;
      }

      // The round button of the top left corner, before it says anything: the flash of the viewer (its state is painted by cameraFlashPaint).
      function cameraFlashButton(panel) {
        var flashBtn = document.createElement("button");
        flashBtn.type = "button";
        flashBtn.title = i18nT('camera.camera_flash');
        // SVG instead of emoji -- the unicode bolt has no glyph in the kiosk font (it looked like a "broken image" icon, confirmed live 2026-10-07).
        flashBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" style="pointer-events:none;vertical-align:middle" fill="#000">' +
          '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>' +
          '<line x1="3" y1="21" x2="21" y2="3" stroke="#ef5350" stroke-width="2.5"/>' +
          "</svg>";
        flashBtn.style.cssText =
          "position:absolute;left:34px;top:4px;width:26px;height:26px;border-radius:50%;border:none;background:#37474f;color:#000;font-size:14px;line-height:26px;text-align:center;padding:0;cursor:pointer;touch-action:none;z-index:1;display:none;";
        cameraFlashPaint(flashBtn, false);
        panel.appendChild(flashBtn);
        return flashBtn;
      }

      // The mode button (first of the top left corner, the flash is after it): photo (light, default) or live video. Returns { btn, paint(liveMode, shown) }: "play" = it is in photo,
      // tapping switches to video; "stop" = it is in video, tapping goes back to photo.
      var CAMERA_MODE_ICON_PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#000"><path d="M8 5v14l11-7z"/></svg>';
      var CAMERA_MODE_ICON_STOP = '<svg viewBox="0 0 24 24" width="14" height="14" style="pointer-events:none;vertical-align:middle" fill="#000"><rect x="6" y="6" width="12" height="12"/></svg>';
      function cameraModeButton(panel) {
        var modeBtn = document.createElement("button");
        modeBtn.type = "button";
        modeBtn.style.cssText =
          "position:absolute;left:4px;top:4px;width:26px;height:26px;border-radius:50%;border:none;background:#e0e0e0;color:#000;line-height:26px;text-align:center;padding:0;cursor:pointer;touch-action:none;z-index:1;";
        panel.appendChild(modeBtn);
        return {
          btn: modeBtn,
          paint: function (liveMode, shown) {
            modeBtn.style.display = shown ? "" : "none";
            modeBtn.title = i18nT(liveMode ? 'camera.back_to_photo_mode' : 'camera.switch_to_live_video');
            modeBtn.innerHTML = liveMode ? CAMERA_MODE_ICON_STOP : CAMERA_MODE_ICON_PLAY;
          },
        };
      }

      // "Help to bring it back", under the Retry button: it opens the Live section of the page, where the checklist is (14-health-recover.js). Shown
      // only while the picture is not alive and the view has the page (09-camera-roles.js cameraPageLinkShown).
      function cameraHelpButton(panel, onTap) {
        var b = document.createElement("button");
        b.type = "button";
        b.title = i18nT('camera.recover_help');
        b.textContent = i18nT('camera.recover_help');
        b.style.cssText = CAMERA_OVER_BTN + "border:1px solid rgba(255,255,255,0.5);background:rgba(0,0,0,0.6);color:#fff;";
        panel.appendChild(b);
        b.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
        });
        b.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          onTap();
        });
        return b;
      }

      // The badge of the floating viewer (below the buttons of the top left corner)
      function cameraModeBadge(panel) {
        return cameraBadge(panel, "left:6px;top:34px;");
      }

      // An image or video of the relay inside a page view says by itself, in place, why it cannot show (instead of the floating box of
      // 26-camera-cover.js, which lives on <body> and is not part of the view): while it fails it is replaced by a note in the same
      // spot, the note goes away when the picture loads, and it is part of the view so it disappears with it. Returns { clear() }.
      function cameraOwnError(media, note) {
        media.setAttribute("data-own-error", "1"); // 26-camera-cover.js: no floating box for this one
        var mark = null;
        function clear() {
          if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
          mark = null;
          media.style.display = "";
        }
        function fail() {
          if (!media.parentNode) return;
          media.style.display = "none";
          if (!mark) {
            mark = document.createElement("div");
            mark.className = "ctl-muted ctl-media-note";
            mark.style.cssText = "display:flex;align-items:center;justify-content:center;text-align:center;min-height:90px;padding:8px;border-radius:6px;background:rgba(128,128,128,0.15);";
            media.parentNode.insertBefore(mark, media.nextSibling);
          }
          mark.textContent = note ? note() : workshopCoverReason();
        }
        media.addEventListener("error", fail);
        media.addEventListener(media.tagName === "VIDEO" ? "loadeddata" : "load", clear);
        return { clear: clear };
      }

      // A view of the camera plugin (a tab of the page, the mosaic, the viewer) is torn down: whatever it had pending must not outlive it.
      // root = the view's element (null: every view). The studio preview waits 250 ms before it asks for the still; that timer goes too, and so do the
      // timers of the focus assistant when its picture is inside the view (11-focus.js).
      function cameraViewTeardown(root) {
        if (typeof cameraTlStudio === "function" && cameraTlStudio.pending) {
          clearTimeout(cameraTlStudio.pending);
          cameraTlStudio.pending = null;
        }
        if (typeof cameraFocusCurrent !== "undefined" && cameraFocusCurrent && (!root || (root.contains && root.contains(cameraFocusCurrent.img)))) cameraFocusRelease();
        if (typeof cameraFocusTiles !== "undefined" && cameraFocusTiles.length) cameraFocusRelease(); // the tiles of the grid of all the cameras
        if (typeof cameraHealthRelease === "function") cameraHealthRelease(root || null); // 14-health.js: the judgement of the pictures of the view
        workshopCoverRelease(root || null); // 26-camera-cover.js
      }

      // "Live" card of the Record tab: the latest saved photo of each camera being recorded (t = the timelapse state of the relay). A camera with no
      // saved photo yet (the relay answers 404) says so: that is not a camera that does not respond.
      function cameraLiveGrid(t) {
        var grid = cameraEl("div", "");
        grid.className = "ctl-live";
        (t.cameras || []).forEach(function (cid) {
          var fig = cameraEl("div", "");
          var im = cameraEl("img", "");
          im.src = cameraRelayLastUrl(cid, t.frames);
          im.alt = cid;
          fig.appendChild(im);
          cameraOwnError(im, function () { return i18nT('live.no_photo_yet'); });
          fig.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;margin-top:2px;", cameraTlNames([cid])[0]));
          grid.appendChild(fig);
        });
        return grid;
      }
