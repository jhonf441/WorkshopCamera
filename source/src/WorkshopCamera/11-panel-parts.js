      // ---- Small parts of the floating camera panel (taken out of buildCameraPanel) ----

      // id of the camera the viewer is showing as live video (null: photo mode or panel closed); the mosaic follows it
      var cameraLiveId = null;

      // ---- ONE look for every button of the floating viewer (2026-11-20; owner: the square Retry is ugly, ovals show up when the viewer moves) ----
      // The geometry lives in ONE sheet (workshop-cam-btn-css), never in per-button inline sizes: a button is `cam-btn` (a text button: height = the
      // size of the row, radius 6) or `cam-btn cam-btn--icon` (a round icon: fixed width = height, aspect-ratio 1, so it can never turn into an oval
      // whatever the panel does); `cam-btn--head` puts it in the top row, `cam-chip` is a camera chip. The sizes come from variables of the panel (set once).
      // Redesign of 2026-11-23 (owner: "the buttons still look too big", informes/auditoria-diseno-23nov/CAMARA-REDISENO.md): two strips of 44 px, at
      // the top and at the bottom, on a black veil of 35 % (never on the picture itself); in them OUTLINED buttons of 32 px (white line at 60 %, no
      // filled circles), the camera chips 28 px; every button is touched over 40 px by an invisible ::after; 8 px between them, 6 px from the edge.
      // The strips fold away after 3 s without a touch and come back with one (never while the camera fails).
      var CAMERA_GAP = 8;
      var CAMERA_HEAD_GAP = 8;
      var CAMERA_EDGE = 6;
      var CAMERA_STRIP = 44; // the height of the two strips
      var CAMERA_ZOOM_MARK_W = 52; // the "2.0x" mark under the close button: wide enough for "6.0x" at 13 px; the badge stops before it
      var CAMERA_STRIPS_IDLE_MS = 3000;

      // Pure: the sizes of the viewer's buttons, the same for every pointer. { btn, head, chip, gap, headGap, edge, strip, corner }
      function cameraButtonMetrics() {
        return { btn: 32, head: 32, chip: 28, gap: CAMERA_GAP, headGap: CAMERA_HEAD_GAP, edge: CAMERA_EDGE, strip: CAMERA_STRIP, corner: 28 };
      }

      // the CSS of a slot of the bottom row: slot 0 is the first button from the left edge (the next ones follow with the gap)
      function cameraSlotLeft(i) {
        return "calc(var(--cam-e) + " + i + " * (var(--cam-b) + var(--cam-g)))";
      }

      // the CSS of a slot of the top row
      function cameraHeadSlotLeft(i) {
        return "calc(var(--cam-e) + " + i + " * (var(--cam-h) + var(--cam-gh)))";
      }

      function cameraBtnCss() {
        if (document.getElementById("workshop-cam-btn-css")) return;
        var st = document.createElement("style");
        st.id = "workshop-cam-btn-css";
        st.textContent = [
          ".cam-btn{position:absolute;z-index:2;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:none;height:var(--cam-b);min-height:var(--cam-b);padding:0 12px;border:1px solid rgba(255,255,255,0.6);border-radius:6px;background:transparent;color:#fff;font:500 13px/1 Roboto,Helvetica,Arial,sans-serif;white-space:nowrap;cursor:pointer;touch-action:none;transition:opacity 0.2s;}",
          // the area to touch: 40 px around a 32 px button (1 px border + 4 px each side), so two neighbours 8 px apart just meet
          ".cam-btn::after{content:\"\";position:absolute;inset:-5px;}",
          ".cam-btn--icon{width:var(--cam-b);min-width:var(--cam-b);max-width:var(--cam-b);aspect-ratio:1/1;padding:0;border-radius:50%;}",
          ".cam-btn--head{height:var(--cam-h);min-height:var(--cam-h);}",
          ".cam-btn--head.cam-btn--icon{width:var(--cam-h);min-width:var(--cam-h);max-width:var(--cam-h);}",
          // a camera chip: 28 px to see, 40 px to touch up and down, 4 px more on each side (8 px between chips)
          ".cam-chip{height:var(--cam-chip);min-height:var(--cam-chip);padding:0 10px;border-radius:14px;}",
          ".cam-chip::after{inset:-7px -5px;}",
          ".cam-btn--main{border-color:#1976d2;background:#1976d2;}",
          ".cam-btn:hover{background:rgba(255,255,255,0.18);}",
          ".cam-btn--main:hover{background:#1565c0;}",
          ".cam-btn:active{background:rgba(255,255,255,0.3);}",
          ".cam-btn--main:active{background:#0d47a1;}",
          ".cam-btn:disabled{opacity:0.45;cursor:not-allowed;}",
          ".cam-off{opacity:0.4;}",
          ".cam-btn svg{flex:none;}",
          ".cam-btn--icon>span,.cam-btn--icon svg+span{display:none;}",
          // the two strips: a veil of 35 % under the buttons, never over the middle of the picture
          ".cam-strip{position:absolute;left:0;right:0;height:var(--cam-strip);background:rgba(0,0,0,0.35);z-index:1;pointer-events:none;transition:opacity 0.2s;}",
          ".cam-strip--top{top:0;}",
          ".cam-strip--bottom{bottom:0;}",
          // idle: the strips and what sits in them fold away (a tap brings them back); while the camera fails they stay (cameraStripsAuto)
          ".cam-idle .cam-strip,.cam-idle .cam-auto{opacity:0;pointer-events:none;}",
          ".cam-waking .cam-auto{pointer-events:none;}", // the touch that brought them back does not press what appeared under it
          // the camera fails: the buttons that need a picture step aside, Retry and the help take the middle of the bottom strip
          ".cam-down .cam-hide-down{display:none !important;}",
          "@media (prefers-reduced-motion: reduce){.cam-btn,.cam-strip{transition:none;}}",
        ].join("\n");
        document.head.appendChild(st);
      }

      // the variables of the sizes, on the panel
      function cameraButtonVars(panel) {
        var m = cameraButtonMetrics();
        panel.style.setProperty("--cam-b", m.btn + "px");
        panel.style.setProperty("--cam-h", m.head + "px");
        panel.style.setProperty("--cam-chip", m.chip + "px");
        panel.style.setProperty("--cam-g", m.gap + "px");
        panel.style.setProperty("--cam-gh", m.headGap + "px");
        panel.style.setProperty("--cam-e", m.edge + "px");
        panel.style.setProperty("--cam-strip", m.strip + "px");
        panel.style.setProperty("--cam-corner", m.corner + "px");
      }

      // The two strips of the viewer (veils under the buttons of the top and the bottom rows)
      function cameraStrips(panel) {
        ["top", "bottom"].forEach(function (side) {
          var s = document.createElement("div");
          s.className = "cam-strip cam-strip--" + side;
          s.setAttribute("aria-hidden", "true");
          panel.appendChild(s);
        });
      }

      // The strips fold away after CAMERA_STRIPS_IDLE_MS without a touch (or a mouse moving over the viewer) and come back with one; a keyboard focus inside
      // brings them back too. Returns { alive(isAlive) }: while the picture is not alive they stay (the person needs Retry and the state).
      // A touch while they are folded ONLY brings them back (owner 2026-11-23): its buttons stay out of reach until that finger is lifted, or the release
      // would land on the button that has just appeared under it (the buttons act on pointerup).
      function cameraStripsAuto(panel) {
        var timer = null;
        var alive = true;
        function wake() {
          panel.classList.remove("cam-idle");
          clearTimeout(timer);
          if (alive) timer = setTimeout(function () { panel.classList.add("cam-idle"); }, CAMERA_STRIPS_IDLE_MS);
        }
        function down(ev) {
          if (panel.classList.contains("cam-idle")) {
            panel.classList.add("cam-waking");
            var lifted = function () {
              document.removeEventListener("pointerup", lifted, true);
              document.removeEventListener("pointercancel", lifted, true);
              setTimeout(function () { panel.classList.remove("cam-waking"); }, 0); // after the release is delivered (to what is under the folded buttons)
            };
            document.addEventListener("pointerup", lifted, true);
            document.addEventListener("pointercancel", lifted, true);
          }
          wake(ev);
        }
        panel.addEventListener("pointerdown", down, true);
        ["pointermove", "focusin"].forEach(function (t) { panel.addEventListener(t, wake, true); });
        wake();
        return {
          alive: function (on) {
            alive = !!on;
            panel.classList.toggle("cam-down", !alive);
            wake();
          },
        };
      }

      // Round button of the bottom row of the panel (slot = its place in the row, 0 = the first from the left); bind it to the panel with .bind(null, panel)
      function cameraBottomButton(panel, slot, title, svg, onTap) {
        var b = document.createElement("button");
        b.type = "button";
        b.title = title;
        b.setAttribute("aria-label", title);
        b.className = "cam-btn cam-btn--icon cam-auto" + (slot === 1 ? "" : " cam-hide-down"); // the mosaic (slot 1) stays while the camera fails
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff">' + svg + "</svg>";
        b.style.cssText = "left:" + cameraSlotLeft(slot) + ";bottom:var(--cam-e);";
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
        var px = cameraButtonMetrics().corner;
        handle.className = "cam-auto";
        handle.style.cssText = "position:absolute;right:0;bottom:0;width:" + px + "px;height:" + px + "px;cursor:nwse-resize;touch-action:none;z-index:2;transition:opacity 0.2s;" +
          "background:linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.65) 50%) right bottom / 16px 16px no-repeat;";
        handle.title = i18nT('camera.resize_handle');
        handle.setAttribute("aria-label", i18nT('camera.resize_handle'));
        panel.appendChild(handle);
        // { id, x, y, w, h, maxW, maxH } while a finger or a mouse holds the corner. Everything the drag needs from the layout is read ONCE at the
        // pointerdown (the corner of the panel does not move while it is resized): a move only writes, it never reads the layout it has just changed
        // (owner 2026-11-23, note 15; criteria C12: no forced layout in a handler)
        var drag = null;
        handle.addEventListener("pointerdown", function (ev) {
          ev.stopPropagation();
          ev.preventDefault(); // see the note in viewBtn pointerdown
          drag = {
            id: ev.pointerId, x: ev.clientX, y: ev.clientY, w: panel.offsetWidth, h: panel.offsetHeight,
            maxW: Math.min(CAMERA_MAX_W, window.innerWidth - panel.offsetLeft - MARGIN),
            maxH: Math.min(CAMERA_MAX_H, window.innerHeight - panel.offsetTop - MARGIN),
            minW: cameraMinW(), minH: cameraMinH(),
          };
          handle.setPointerCapture(ev.pointerId);
        });
        handle.addEventListener("pointermove", function (ev) {
          if (!drag || ev.pointerId !== drag.id) return;
          ev.stopPropagation();
          panel.style.width = clamp(drag.w + ev.clientX - drag.x, drag.minW, drag.maxW) + "px";
          panel.style.height = clamp(drag.h + ev.clientY - drag.y, drag.minH, drag.maxH) + "px";
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
        b.setAttribute("aria-label", i18nT('camera.close_camera'));
        b.className = "cam-btn cam-btn--icon cam-btn--head cam-auto";
        // SVG instead of emoji: the unicode glyphs are not in the kiosk font
        b.innerHTML = workshopCloseIconSvg(18); // the same icon as the close of every sheet header (10-registry.js), 18 px like the other icons of the top row
        b.style.cssText = "right:var(--cam-e);top:var(--cam-e);";
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
      // Returns render(): draws the chips again (the list or the chosen camera changed). sayName(text): the viewer's own short notice; a touch screen never
      // shows a tooltip, so the name of a chip is said when the chosen chip is tapped, and when a narrow viewer (chips with a number) changes camera.
      function cameraSelectorAssemble(panel, sayName) {
        var selector = document.createElement("div");
        // 2 px of padding all round (the box grows by the same 2 px, so the chips keep their place): the 40 px area of a 36 px chip fits inside the
        // scrolling row instead of making it scroll by 2 px
        selector.className = "cam-auto";
        selector.style.cssText = "position:absolute;box-sizing:border-box;padding:0 6px;left:calc(" + cameraHeadSlotLeft(2) + " - 6px);right:calc(var(--cam-e) + var(--cam-h) + var(--cam-gh) - 6px);top:0;height:var(--cam-strip);display:none;gap:var(--cam-gh);justify-content:center;align-items:center;overflow-x:auto;z-index:2;scrollbar-width:none;transition:opacity 0.2s;";
        panel.appendChild(selector);
        var render = function () {
          selector.textContent = "";
          selector.style.display = cameraList.length > 1 ? "flex" : "none";
          var current = cameraChosen();
          cameraList.forEach(function (c) {
            var b = document.createElement("button");
            b.type = "button";
            var compact = cameraIsCompact(panel);
            // the words are cut inside their own span: an overflow:hidden on the chip would also cut its 40 px touch area (the ::before of cam-btn--head)
            var words = document.createElement("span");
            words.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            words.textContent = compact ? String(cameraList.indexOf(c) + 1) : c.name; // narrow viewer: the number, the name stays in the tooltip
            b.appendChild(words);
            b.title = c.name;
            b.setAttribute("aria-label", c.name); // the whole name, also when the chip shows a number or cuts the name
            var on = c === current;
            b.setAttribute("aria-pressed", on ? "true" : "false");
            b.className = "cam-btn cam-chip" + (on ? " cam-btn--main" : "");
            // a chip of the top row: the family text button, in the flow (relative, not static: its touch area is drawn around the chip itself)
            b.style.cssText = "position:relative;min-width:var(--cam-chip);max-width:110px;padding:0 " + (compact ? 8 : 10) + "px;"; // a "1" chip is still as wide as it is high
            b.addEventListener("pointerdown", function (ev) {
              ev.stopPropagation();
              ev.preventDefault(); // see the note in viewBtn pointerdown
            });
            b.addEventListener("pointerup", function (ev) {
              ev.stopPropagation();
              if (typeof sayName === "function" && (on || compact)) sayName(c.name);
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
        b.setAttribute("aria-label", i18nT('camera.open_page'));
        b.className = "cam-btn cam-auto cam-hide-down";
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none;flex:none" fill="#fff"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>';
        var label = document.createElement("span");
        label.textContent = i18nT('camera.open_page');
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        b.appendChild(label);
        b.style.cssText = "left:" + cameraSlotLeft(4) + ";right:calc(var(--cam-corner) + var(--cam-g));bottom:var(--cam-e);overflow:hidden;"; // the family secondary button, the height of the round ones
        panel.appendChild(b);
        // narrow viewer: the word goes and the button is the round icon (the tooltip keeps the words)
        function paint() {
          var compact = cameraIsCompact(panel);
          label.style.display = compact ? "none" : "";
          b.classList.toggle("cam-btn--icon", compact); // the round icon: fixed size, never an oval
          b.style.right = compact ? "auto" : "calc(var(--cam-corner) + var(--cam-g))";
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
        cameraBtnCss();
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
        // AFTER cssText: assigning cssText replaces every inline declaration, custom properties included. Set before it, the sizes (--cam-b, --cam-e, --cam-g,
        // --cam-corner) were wiped, every `var(--cam-*)` position was invalid and all the buttons piled up in the top left corner, the resize corner and the
        // bottom row collapsed (2026-11-22, found with a page that loads this file).
        cameraButtonVars(panel);
        cameraStrips(panel); // the two veils of the top and bottom rows (redesign 2026-11-23)
        cameraWatchCompact(panel);
        return panel;
      }

      // Is the viewer narrow enough for icons only? width in px (the panel's own, or its style before it is on screen).
      function cameraIsCompactWidth(width) {
        return width < CAMERA_COMPACT_W;
      }
      // The answer kept by the ResizeObserver (cameraWatchCompact) when there is one: the badge asks every second and must not read the layout for it
      // (note 15); without an observer yet, the width of the panel (or its style before it is on screen).
      function cameraIsCompact(panel) {
        if (typeof panel.camCompact === "boolean") return panel.camCompact;
        return cameraIsCompactWidth(panel.offsetWidth || parseInt(panel.style.width, 10) || CAMERA_W);
      }

      // The parts that change look with the width ask to be told when the viewer crosses CAMERA_COMPACT_W: they listen to "camera-compact" on the panel.
      // The observer reads the size the browser has just laid out (contentRect + the 2 px borders), so keeping the answer costs no layout.
      function cameraWatchCompact(panel) {
        if (typeof ResizeObserver !== "function" || typeof Event !== "function") return;
        var last = cameraIsCompact(panel);
        new ResizeObserver(function (entries) {
          var box = entries && entries[0] && entries[0].contentRect;
          if (!box || !(box.width > 0)) return; // closed (display none): nothing to judge; the next opening is observed again
          var now = cameraIsCompactWidth(box.width + 4);
          panel.camCompact = now;
          if (now === last) return;
          last = now;
          panel.dispatchEvent(new Event("camera-compact"));
        }).observe(panel);
      }

      // The smallest viewer: the bottom row (four round buttons, the page icon, the corner) must fit with the buttons of this pointer
      function cameraMinW() {
        var m = cameraButtonMetrics();
        return Math.max(CAMERA_MIN_W, m.edge + 5 * (m.btn + m.gap) + m.corner);
      }
      function cameraMinH() {
        var m = cameraButtonMetrics();
        return Math.max(CAMERA_MIN_H, 2 * m.strip + 70); // the two strips and a piece of picture
      }

      // The two buttons over a picture that is not alive (Retry, and the way to the help of the page): the family look through the same sheet as every
      // other button of the viewer (cam-btn: the main one filled with the accent, the help the outline one; radius 6, the height of the round ones).
      // They sit side by side in the middle, 8 px apart, at every width: wide = Retry with its icon and its word and the help as a round "?";
      // narrow = two round icons of the same size as the rest. Hidden with display none, shown by clearing it (the sheet gives the layout back).
      function cameraRetryButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = i18nT('camera.retry');
        button.className = "cam-btn cam-btn--main";
        button.style.cssText = "left:50%;bottom:var(--cam-e);display:none;";
        return button;
      }

      // Pure: where the two buttons sit at a width (the same at every width: only the look of Retry changes): side by side in the middle of the bottom strip,
      // 8 px apart (redesign 2026-11-23: Retry no longer covers the picture). Returns { small, bottom, retryTransform, helpTransform }.
      function cameraOverButtonsLayout(compact) {
        return { small: !!compact, bottom: "var(--cam-e)", retryTransform: "translateX(calc(-100% - 4px))", helpTransform: "translateX(4px)" };
      }

      function cameraNarrowIcons(panel, retry, help) {
        var ICON_RETRY = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff"><path d="M17.65 6.35A7.96 7.96 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L13 11h7V4z"/></svg>';
        var ICON_HELP = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff"><path d="M11 18h2v-2h-2v2zm1-16a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm0-14a4 4 0 00-4 4h2a2 2 0 114 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 00-4-4z"/></svg>';
        var retryWords = retry.textContent;
        retry.title = retryWords;
        retry.setAttribute("aria-label", retryWords);
        help.setAttribute("aria-label", help.title); // the words of the help are its tooltip and its accessible name; the button is only the "?"
        help.className = "cam-btn cam-btn--icon";
        function paint() {
          var L = cameraOverButtonsLayout(cameraIsCompact(panel));
          // Retry: the icon always, the word only when wide; the help: the icon only, round, always
          retry.innerHTML = ICON_RETRY + (L.small ? "" : "<span>" + retryWords.replace(/</g, "&lt;") + "</span>");
          help.innerHTML = ICON_HELP;
          retry.classList.toggle("cam-btn--icon", L.small);
          retry.style.padding = L.small ? "" : "0 14px 0 10px";
          retry.style.left = help.style.left = "50%";
          retry.style.top = help.style.top = "auto";
          retry.style.bottom = help.style.bottom = L.bottom;
          retry.style.transform = L.retryTransform;
          help.style.transform = L.helpTransform;
        }
        paint();
        panel.addEventListener("camera-compact", paint);
      }

      // A size saved on a wide screen is brought inside a narrow window (a phone), or the "x" of the viewer ends up off screen.
      function cameraFitSize(size) {
        return {
          w: Math.max(cameraMinW(), Math.min(size.w, window.innerWidth - 2 * MARGIN)), // a size saved before the limit existed is brought up to it
          h: Math.max(cameraMinH(), Math.min(size.h, window.innerHeight - 2 * MARGIN)),
        };
      }

      // The flash button says its state by itself: on = bright yellow with a halo, off = dark grey with a struck-through bolt (two yellows were hard to tell apart)
      function cameraFlashPaint(btn, on) {
        btn.style.background = on ? "#ffeb3b" : "";
        btn.style.borderColor = on ? "#fff" : "";
        btn.style.color = on ? "#000" : "#fff"; // the bolt is read on either background
        btn.style.boxShadow = on ? "0 0 0 2px #fff, 0 0 10px 3px #fff176" : "none";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.title = on ? i18nT('camera.flash_is_on') : i18nT('camera.flash_is_off');
        var bolt = btn.querySelector("path");
        if (bolt) bolt.setAttribute("fill", on ? "#000" : "#cfd8dc");
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
      // picture that stopped or is black, red for a camera that does not respond), the same as every other place (user report 2026-11-03).
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
      // Pure: where the badge of the floating viewer sits for a panel `width` px wide, and how much room it has. It lives in its own strip UNDER the top row
      // (mode, flash, camera chips, close), 24 px high (a dot of 10 px when narrow) so that changing words never moves anything, and it never reaches the column
      // on the right of that strip, where the zoom mark sits under the close button (CAMERA_ZOOM_MARK_W, wider than the close): the words are cut with an
      // ellipsis before that. { left, top, height, maxWidth, closeLeft, markLeft }
      function cameraBadgeBox(width) {
        var m = cameraButtonMetrics();
        var small = cameraIsCompactWidth(width);
        var left = small ? m.edge : 6;
        var closeLeft = width - m.edge - m.head;
        var markLeft = width - m.edge - CAMERA_ZOOM_MARK_W;
        return { left: left, top: m.strip + m.edge, height: small ? 10 : 24, maxWidth: Math.max(0, markLeft - m.headGap - left), closeLeft: closeLeft, markLeft: markLeft };
      }
      function cameraBadge(host, css) {
        var b = document.createElement("div");
        b.setAttribute("data-workshop-i18n", "");
        // white 12 px text in 600 on the filled colour of the state: it reads over any picture (ux review 2026-11-23)
        b.style.cssText = "position:absolute;box-sizing:border-box;max-width:calc(100% - 12px);padding:1px 7px;border-radius:9px;font:600 12px Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;pointer-events:none;z-index:2;" + css;
        host.appendChild(b);
        var last = [false, null];
        var drawn = ""; // what the badge shows now: the judgement says "does not respond for N s" every second, the rest of the look rarely changes
        var viewer = typeof CAMERA_PANEL_ID !== "undefined" && host.id === CAMERA_PANEL_ID; // only the floating viewer has a narrow look
        var paint = function (live, h) {
          last = [live, h];
          var state = h ? h.state : "waiting";
          var words = !h || state === "fresh" ? (live ? "● " + i18nT('camera.badge_live') : i18nT('camera.badge_photo', { s: CAMERA_SNAPSHOT_POLL_MS / 1000 })) : cameraHealthWord(h, i18nT);
          if (viewer && state === "black" && typeof cameraBlackHint === "function") words = cameraBlackHint() || words;
          var small = viewer && cameraIsCompact(host); // narrow viewer: a coloured dot, the words stay in the tooltip
          // note 15: the same badge again writes nothing (no style recalculation every second for a badge that did not change)
          var key = state + "|" + (small ? 1 : 0) + "|" + words;
          if (key === drawn) return;
          drawn = key;
          b.textContent = small ? "" : words;
          b.title = words;
          b.style.width = small ? "10px" : "";
          b.style.height = small ? "10px" : viewer ? "24px" : "";
          b.style.padding = small ? "0" : viewer ? "0 10px" : "1px 7px";
          b.style.lineHeight = small ? "" : viewer ? "24px" : "";
          b.style.borderRadius = small ? "50%" : viewer ? "12px" : "9px";
          // always UNDER the top row (2026-11-22: the dot of the narrow viewer sat in the top row, on the camera selector and next to the close button);
          // wide: the words, narrow: the dot; it never shares a row with a button
          if (viewer) {
            b.style.left = small ? "var(--cam-e)" : "6px";
            b.style.top = "calc(var(--cam-strip) + var(--cam-e))";
            // never under the zoom mark: the room is what is left of the width after the mark column and the gap (cameraBadgeBox is the same sum)
            b.style.maxWidth = "calc(100% - " + (small ? "var(--cam-e)" : "6px") + " - var(--cam-e) - " + CAMERA_ZOOM_MARK_W + "px - var(--cam-gh))";
          }
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
        flashBtn.setAttribute("aria-label", i18nT('camera.camera_flash'));
        flashBtn.className = "cam-btn cam-btn--icon cam-btn--head cam-auto";
        // SVG instead of emoji -- the unicode bolt has no glyph in the kiosk font (it looked like a "broken image" icon, confirmed live 2026-10-07).
        flashBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff">' +
          '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>' +
          '<line x1="3" y1="21" x2="21" y2="3" stroke="#ef5350" stroke-width="2.5"/>' +
          "</svg>";
        flashBtn.style.cssText = "left:" + cameraHeadSlotLeft(1) + ";top:var(--cam-e);display:none;";
        cameraFlashPaint(flashBtn, false);
        panel.appendChild(flashBtn);
        return flashBtn;
      }

      // The mode button (first of the top left corner, the flash is after it): photo (light, default) or live video. Returns { btn, paint(liveMode, shown) }: "play" = it is in photo,
      // tapping switches to video; "stop" = it is in video, tapping goes back to photo.
      var CAMERA_MODE_ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
      var CAMERA_MODE_ICON_STOP = '<svg viewBox="0 0 24 24" width="18" height="18" style="pointer-events:none" fill="#fff"><rect x="6" y="6" width="12" height="12"/></svg>';
      function cameraModeButton(panel) {
        var modeBtn = document.createElement("button");
        modeBtn.type = "button";
        modeBtn.className = "cam-btn cam-btn--icon cam-btn--head cam-auto";
        modeBtn.style.cssText = "left:var(--cam-e);top:var(--cam-e);";
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
        b.className = "cam-btn cam-btn--icon";
        b.style.cssText = "left:50%;bottom:var(--cam-e);display:none;";
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
        return cameraBadge(panel, "left:6px;top:calc(var(--cam-strip) + var(--cam-e));");
      }

      // The zoom mark ("2.0x", tap = back to 1x): a button of the top row's size, under the close button, right-aligned, in the strip of the badge
      // (which stops before it, cameraBadgeBox). Hidden while the zoom is 1x. It used to be a 22 px pill at top:34px that sat on the close button.
      function cameraZoomMark(panel) {
        var mark = document.createElement("button");
        mark.type = "button";
        mark.className = "cam-btn cam-btn--head";
        mark.title = i18nT('service.back_to_1x');
        mark.setAttribute("aria-label", mark.title);
        mark.style.cssText = "right:var(--cam-e);top:calc(var(--cam-strip) + var(--cam-e));width:" + CAMERA_ZOOM_MARK_W + "px;padding:0;font-weight:600;background:rgba(0,0,0,0.35);display:none;";
        panel.appendChild(mark);
        return mark;
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
          fig.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:12px;margin-top:2px;", cameraTlNames([cid])[0]));
          grid.appendChild(fig);
        });
        return grid;
      }
