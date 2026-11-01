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
        handle.style.cssText = "position:absolute;right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;touch-action:none;background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.65) 50%);";
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
        return function () {
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
              ev.preventDefault(); // see the note in viewBtn pointerdown
            });
            b.addEventListener("pointerup", function (ev) {
              ev.stopPropagation();
              if (!on) cameraChoose(c.id);
            });
            selector.appendChild(b);
          });
        };
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
        b.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
        });
        b.addEventListener("pointerup", function (ev) {
          ev.stopPropagation();
          cameraOpenPage("record"); // 18-page-tabs.js
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
        return panel;
      }

      // The "Retry" button, centered: it ONLY appears when the live video mode fails (the photo mode retries by itself on its next tick).
      function cameraRetryButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = i18nT('camera.retry');
        button.style.cssText = [
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
        return button;
      }

      // A size saved on a wide screen is brought inside a narrow window (a phone), or the "x" of the viewer ends up off screen.
      function cameraFitSize(size) {
        return {
          w: Math.min(size.w, Math.max(CAMERA_MIN_W, window.innerWidth - 2 * MARGIN)),
          h: Math.min(size.h, Math.max(CAMERA_MIN_H, window.innerHeight - 2 * MARGIN)),
        };
      }

      // The flash button says its state by itself: on = bright yellow with a halo, off = dark grey with a struck-through bolt (two yellows were hard to tell apart)
      function cameraFlashPaint(btn, on) {
        btn.style.background = on ? "#ffeb3b" : "#37474f";
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
      function cameraFlashSet(camera, on) {
        return workshopApi("camera.flash", { camera: camera.id, on: !!on }).then(
          function (r) {
            if (r && r.flash) {
              camera.flash = r.flash;
              var state = cameraStateOf(cameraRelayId(camera)); // the state of the relay read when the viewer opened must not say the old one
              if (state) state.flash = r.flash;
            }
            return r || { ok: false, error: "" };
          },
          function (e) {
            return { ok: false, error: String(e && e.message ? e.message : e) };
          }
        );
      }

      // Pill that says whether what is on screen is live video or a photo that refreshes: returns set(live), live = true | false.
      // `host` is the element it sits on (absolute); `css` positions it.
      function cameraBadge(host, css) {
        var b = document.createElement("div");
        b.setAttribute("data-workshop-i18n", "");
        b.style.cssText = "position:absolute;padding:1px 7px;border-radius:9px;font:bold 10px Roboto,sans-serif;color:#fff;pointer-events:none;z-index:2;" + css;
        host.appendChild(b);
        return function (live) {
          b.textContent = live ? "● " + i18nT('camera.badge_live') : i18nT('camera.badge_photo', { s: CAMERA_SNAPSHOT_POLL_MS / 1000 });
          b.style.background = live ? "#d32f2f" : "rgba(55,71,79,0.9)";
        };
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
        workshopCoverRelease(root || null); // 26-camera-cover.js
      }

      // "Live" card of the Record tab: the latest saved photo of each camera being recorded (t = the timelapse state of the relay).
      function cameraLiveGrid(t) {
        var grid = cameraEl("div", "");
        grid.className = "ctl-live";
        (t.cameras || []).forEach(function (cid) {
          var fig = cameraEl("div", "");
          var im = cameraEl("img", "");
          im.src = cameraRelayLastUrl(cid, t.frames);
          im.alt = cid;
          fig.appendChild(im);
          cameraOwnError(im);
          fig.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;margin-top:2px;", cameraTlNames([cid])[0]));
          grid.appendChild(fig);
        });
        return grid;
      }
