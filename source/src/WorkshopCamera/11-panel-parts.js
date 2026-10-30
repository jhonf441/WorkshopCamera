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

      // The flash of a camera can be the work-light strip instead of its own LED (cameras.json flash_source "strip")
      // Narrow screen (phone): the open Controls bar would cover the viewer and its "x", so opening the viewer folds the bar
      // (the bar listens for this event, WorkshopControlBar/13-narrow.js; without the bar nothing happens).
      function cameraCloseBarIfNarrow() {
        if (window.innerWidth > 768) return;
        try {
          window.dispatchEvent(new CustomEvent("workshop-panel-opened", { detail: { id: "camera" } }));
        } catch (e) {
          /* not critical */
        }
      }

      // A size saved on a wide screen is brought inside a narrow window (a phone), or the "x" of the viewer ends up off screen.
      function cameraFitSize(size) {
        return {
          w: Math.min(size.w, Math.max(CAMERA_MIN_W, window.innerWidth - 2 * MARGIN)),
          h: Math.min(size.h, Math.max(CAMERA_MIN_H, window.innerHeight - 2 * MARGIN)),
        };
      }

      function cameraFlashIsStrip(camera) {
        return !!(camera && camera.flash_source === "strip");
      }

      // Whether the flash button shows: the strip needs the right to turn the light on; the camera LED needs an ESP32 with flash (ownLed)
      function cameraFlashShown(camera, ownLed) {
        if (cameraFlashIsStrip(camera)) return typeof workshopCan !== "function" || workshopCan("light.set");
        return ownLed;
      }

      // The light strip used as flash: it remembers how the strip was before the first tap so that closing the viewer puts it back.
      function cameraStripFlash() {
        var previous = null;
        return {
          toggle: function (currentOn) {
            var wanted = !currentOn;
            if (previous === null) previous = !wanted;
            workshopApiText("light.set", { on: wanted });
            return wanted;
          },
          restore: function () {
            if (previous === null) return false;
            var back = previous;
            previous = null;
            workshopApiText("light.set", { on: back });
            return true;
          },
        };
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
      // root = the view's element (null: every view). The studio preview waits 250 ms before it asks for the still; that timer goes too.
      function cameraViewTeardown(root) {
        if (typeof cameraTlStudio === "function" && cameraTlStudio.pending) {
          clearTimeout(cameraTlStudio.pending);
          cameraTlStudio.pending = null;
        }
        workshopCoverRelease(root || null); // 26-camera-cover.js
      }

      // "Live" card of the Record tab: the latest saved photo of each camera being recorded (t = the timelapse state of the relay).
      function cameraLiveGrid(t) {
        var grid = cameraEl("div", "");
        grid.className = "ctl-live";
        (t.cameras || []).forEach(function (cid) {
          var fig = cameraEl("div", "");
          var im = cameraEl("img", "");
          im.src = cameraRelayBase() + "/timelapse/last?c=" + encodeURIComponent(cid) + "&_=" + (t.frames || 0);
          im.alt = cid;
          fig.appendChild(im);
          cameraOwnError(im);
          fig.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;margin-top:2px;", cameraTlNames([cid])[0]));
          grid.appendChild(fig);
        });
        return grid;
      }
