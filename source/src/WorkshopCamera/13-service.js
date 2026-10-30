      // ---- Pi camera service (2026-10-10) ----
      //
      // Request: "refine and improve the camera service, I want more useful
      // features". WorkshopService's relay (dsf/camera_relay.py, port 8090)
      // now distributes several cameras, gives its state, saves dated captures and
      // builds a timelapse of each job. Here goes what belongs to the viewer:
      //   - live state (connected / reconnecting, fps, kB/s, who is watching)
      //   - dated capture (button) and gallery with captures and timelapses
      //   - service settings (photo in notices, drop notice, timelapse)
      //   - mosaic with all the cameras
      //   - digital zoom and pan of the image (it moves nothing)

      var CAMERA_RELAY_PORT = 8090;
      var CAMERA_GALLERY_ID = "workshop-camera-gallery";
      var CAMERA_MOSAIC_ID = "workshop-camera-mosaic";

      function cameraRelayBase() {
        return "http://" + window.location.hostname + ":" + CAMERA_RELAY_PORT;
      }

      // id that the relay knows, or null if that camera does not go through the relay
      // (common IP camera, or the Main one pointing to another address).
      function cameraRelayId(camera) {
        if (!camera) return null;
        if (camera.id === "main") return String(camera.url || "").trim() ? null : "main";
        var u = String(camera.url || "");
        return camera.esp32 && u && camera.relay !== false && u.indexOf("[HOSTNAME]") < 0 && !/:8090\//.test(u) ? camera.id : null;
      }

      // ---- relay state (/estado), only while the viewer is open ----
      var cameraState = null;
      var cameraStateListeners = [];
      var cameraStateTimer = null;

      function cameraStateRead() {
        return fetch(cameraRelayBase() + "/state", { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          })
          .then(function (d) {
            cameraState = d;
            cameraStateListeners.forEach(function (fn) {
              try {
                fn(d);
              } catch (e) {
                /* un oyente roto no frena a los demas */
              }
            });
            return d;
          });
      }

      function cameraStateWatch(on) {
        if (cameraStateTimer) clearInterval(cameraStateTimer);
        cameraStateTimer = null;
        if (!on) return;
        cameraStateRead();
        var ticks = 0;
        cameraStateTimer = setInterval(function () {
          // hidden tab: do not ask the relay. QA-08: while the relay does not answer, ask once every 4th tick (12 s), not every 3 s
          if (document.hidden || (!cameraState && ++ticks % 4 !== 0)) return;
          cameraStateRead();
        }, 3000);
      }

      function cameraStateOf(rid) {
        var cs = (cameraState && cameraState.cameras) || [];
        for (var i = 0; i < cs.length; i++) if (cs[i].id === rid) return cs[i];
        return null;
      }

      // A short line: "12 fps · 85 kB/s · 2 mirando", "reconnecting...", ...
      function cameraStateText(e) {
        if (!e) return "";
        var warning = cameraProtoWarning(); // the page and the service do not speak the same contract: say so before anything else
        if (warning) return warning;
        if (!cameraCanDo("tech_terms")) return cameraPlainState(e, cameraState && cameraState.load, i18nT); // fps, kB/s and "relay" are for the technician
        if (e.drop) return i18nT('service.not_answering_for_n_min', { n: Math.round((e.without_response_s || 0) / 60) });
        var load = cameraState && cameraState.load && cameraState.load.level;
        if (e.state === "connected")
          return (e.fps != null ? e.fps + " fps" : "") + (e.kbps != null ? " · " + Math.round(e.kbps) + " kB/s" : "") + " · " + i18nT('service.n_watching', { n: e.clients }) + (load >= 2 ? " · " + i18nT('service.system_very_loaded') : load >= 1 ? " · " + i18nT('service.system_loaded') : "");
        if (e.state === "reconnecting" || e.state === "connecting") return i18nT('service.connecting');
        return i18nT('service.at_rest') + (e.delay_photo_ms != null ? " · " + i18nT('service.photo_in_n_ms', { n: e.delay_photo_ms }) : "");
      }

      function cameraStateColor(e) {
        if (!e) return "#b0bec5";
        if (e.drop) return "#ef9a9a";
        if (e.state === "connected") return "#a5d6a7";
        if (e.state === "reconnecting" || e.state === "connecting") return "#ffb74d";
        return "#b0bec5";
      }

      // ---- capturas y servicio ----
      function cameraCapture(rid) {
        return fetch(cameraRelayBase() + cameraCapturePathFor(cameraState) + "?c=" + encodeURIComponent(rid), { method: "POST" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
      }

      // camera service settings (API camera.service; without changes it only reads)
      function cameraService(cambios) {
        return workshopApiText("camera.service", cambios ? { changes: cambios } : {})
          .then(function (t) {
            var k = t.indexOf("{");
            if (k < 0) throw new Error(t.trim() || i18nT('common.no_response'));
            return JSON.parse(t.slice(k));
          });
      }

      function cameraEl(tag, css, text) {
        var e = document.createElement(tag);
        if (css) e.style.cssText = css;
        if (text != null) e.textContent = text;
        return e;
      }

      // A button of the design family (wf-btn). The callers still pass the colors they always did; they are read as the role of the button:
      // the blue fill = the main button (wf-main), a blue outline = the chosen one (ctl-on), a red fill = the dangerous one (ctl-danger);
      // any other color is dropped (a secondary button is a gray outline) and only the layout of the style (align-self...) is kept.
      function cameraBtn(text, estilo, onClick) {
        var st = estilo || "";
        var role = /border:1px solid #1976d2/.test(st) ? " ctl-on" : /background:#1976d2/.test(st) ? " wf-main" : /background:#c62828/.test(st) ? " ctl-danger" : "";
        var layout = st.replace(/(?:background|color|border)[a-z-]*:[^;]*;?/g, "");
        var b = cameraEl("button", "padding:6px 10px;min-height:32px;touch-action:manipulation;" + layout, text);
        b.className = "wf-btn" + role;
        b.type = "button";
        b.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        });
        b.addEventListener("click", function (ev) {
          ev.stopPropagation();
          onClick(b);
        });
        return b;
      }

      // Button with double tap (DESIGN.md 5): the second tap within 4 s
      function cameraBtnDouble(text, confirmar, estilo, onClick) {
        var armed = null;
        var b = cameraBtn(text, estilo, function () {
          if (!armed) {
            b.textContent = confirmar;
            b.classList.add("wf-armed"); // the second tap is pending (amber)
            armed = setTimeout(function () {
              armed = null;
              b.textContent = text;
              b.classList.remove("wf-armed");
            }, 4000);
            return;
          }
          clearTimeout(armed);
          armed = null;
          onClick(b);
        });
        return b;
      }

      // Sheets the viewer opens (list, gallery, settings): always whole on the
      // screen. Before they were placed with an estimated height and, with the camera
      // window at the bottom, they ended up outside (2026-10-10). They are repositioned every time the
      // sheet changes height and when the window size changes.
      function cameraFitSheet(sheet, topDeseado) {
        sheet.style.maxHeight = "calc(100vh - 16px)";
        sheet.style.overscrollBehavior = "contain"; // scrolling the sheet must not scroll the page behind it
        sheet.style.touchAction = "pan-y";
        function adjust() {
          if (!sheet.isConnected) {
            if (obs) obs.disconnect();
            window.removeEventListener("resize", adjust);
            return;
          }
          if (window.innerWidth <= CAMERA_NARROW_PX) { // a narrow screen: the sheet takes the whole width instead of a fixed 300-360 px
            sheet.style.left = sheet.style.right = "8px";
            sheet.style.width = "auto";
            sheet.style.maxWidth = "none";
            sheet.style.boxSizing = "border-box";
          }
          sheet.style.top = Math.max(8, Math.min(topDeseado, window.innerHeight - sheet.offsetHeight - 8)) + "px";
        }
        var obs = typeof ResizeObserver === "function" ? new ResizeObserver(adjust) : null;
        if (obs) obs.observe(sheet);
        window.addEventListener("resize", adjust);
        adjust();
      }

      var CAMERA_NARROW_PX = 520;
      var CAMERA_SECTIONS_KEY = "workshopCameraSections";
      function cameraSectionsClosed() {
        try {
          return JSON.parse(localStorage.getItem(CAMERA_SECTIONS_KEY) || "{}") || {};
        } catch (e) {
          return {};
        }
      }
      function cameraSectionsSave(c) {
        try {
          localStorage.setItem(CAMERA_SECTIONS_KEY, JSON.stringify(c));
        } catch (e) {
          /*  no storage: it stays as it is until the sheet is closed */
        }
      }

      function cameraFmtMB(n) {
        return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " kB";
      }

      function cameraFmtDur(s) {
        s = Math.round(s || 0);
        return s >= 3600 ? Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min" : s >= 60 ? Math.floor(s / 60) + " min " + (s % 60) + " s" : s + " s";
      }

      // Hoja "Capturas y timelapse": ajustes del servicio, timelapses y capturas.
      function cameraOpenGallery(panel) {
        var old = document.getElementById(CAMERA_GALLERY_ID);
        if (old) {
          old.remove();
          return;
        }
        var sheetCams = document.getElementById(CAMS_SHEET_ID);
        if (sheetCams) sheetCams.remove();
        var sheet = cameraEl("div", "position:fixed;z-index:2147483647;width:360px;max-width:calc(100vw - 16px);max-height:84vh;overflow-y:auto;background:#263238;color:#eceff1;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.6);font:13px Roboto,sans-serif;padding:12px;touch-action:pan-y;");
        sheet.id = CAMERA_GALLERY_ID;
        cameraTlCss();
        sheet.classList.add("ctl"); // variables de color (oscuras: es un panel flotante)
        sheet.setAttribute("data-workshop-i18n", "");
        document.body.appendChild(sheet);
        var r = panel.getBoundingClientRect();
        var x = r.right + 8;
        if (x + 360 > window.innerWidth - 8) x = r.left - 368;
        if (x < 8) x = Math.max(8, Math.min(window.innerWidth - 368, r.left));
        sheet.style.left = x + "px";
        cameraFitSheet(sheet, r.top);

        var cfg = null;
        var borrador = null;
        var captures = null;
        var tls = null;
        var msg = "";
        var viendo = null; // {tipo:"video"|"foto", archivo}

        function load() {
          cameraService(null)
            .then(function (c) {
              cfg = c;
              if (!borrador) borrador = JSON.parse(JSON.stringify(c));
            })
            .catch(function (e) {
              msg = i18nT('common.could_not_read_the_service', { error: String(e.message || e) });
            })
            .then(function () {
              return Promise.all([
                fetch(cameraRelayBase() + "/captures", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
                fetch(cameraRelayBase() + "/timelapses", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
                cameraStateRead(),
              ]);
            })
            .then(function (res) {
              captures = res[0];
              tls = res[1];
              if (document.body.contains(sheet)) render();
            });
        }

        function borrar(file) {
          fetch(cameraRelayBase() + "/remove?file=" + encodeURIComponent(file), { method: "POST" })
            .then(function (r) { return r.json(); })
            .then(function (d) { msg = d.ok ? i18nT('common.deleted') : i18nT('service.could_not_delete'); })
            .catch(function (e) { msg = i18nT('service.could_not_delete_error', { error: String(e) }); })
            .then(function () { viendo = null; load(); });
        }

        // Foldable sections (2026-10-10, "that they can be folded so it is not
        // so long"): tapping the title opens or closes; it is remembered on this
        // screen. What follows the title goes inside "cont".
        var cont = sheet;
        function seccion(title, key) {
          var cerradas = cameraSectionsClosed();
          var closed = !!cerradas[key];
          var cab = cameraEl("div", "display:flex;align-items:center;gap:6px;font-weight:bold;font-size:13px;margin:12px 0 4px 0;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;cursor:pointer;user-select:none;");
          cab.appendChild(cameraEl("span", "display:inline-block;width:12px;color:#90caf9;", closed ? "▸" : "▾"));
          cab.appendChild(cameraEl("span", null, title));
          var body = cameraEl("div", closed ? "display:none;" : "");
          cab.addEventListener("click", function () {
            var c = cameraSectionsClosed();
            c[key] = !c[key];
            cameraSectionsSave(c);
            body.style.display = c[key] ? "none" : "";
            cab.firstChild.textContent = c[key] ? "▸" : "▾";
          });
          sheet.appendChild(cab);
          sheet.appendChild(body);
          cont = body;
        }

        function casilla(text, value, alChange) {
          var l = cameraEl("label", "display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;min-height:28px;");
          var cb = cameraEl("input");
          cb.type = "checkbox";
          cb.checked = !!value;
          cb.style.cssText = "width:18px;height:18px;";
          cb.addEventListener("change", function () { alChange(cb.checked); });
          l.appendChild(cb);
          l.appendChild(document.createTextNode(text));
          return l;
        }

        function render() {
          sheet.textContent = "";
          cont = sheet;
          var cab = cameraEl("div", "display:flex;align-items:center;gap:6px;");
          cab.appendChild(cameraEl("div", "font-weight:bold;font-size:14px;flex:1;", i18nT('common.captures_and_timelapse')));
          cab.appendChild(cameraBtn(i18nT('service.open_large'), "", function () {
            // pagina Complementos > Timelapses y capturas (17-gallery.js): renombrar, editar, borrar varios
            sheet.remove();
            if (!workshopHostPush(CAMERA_GAL_PATH)) window.location.href = CAMERA_GAL_PATH;
          }));
          cab.appendChild(cameraBtn(i18nT('common.close'), "", function () { sheet.remove(); }));
          sheet.appendChild(cab);
          if (msg || cameraProtoWarning()) sheet.appendChild(cameraEl("div", "margin-top:6px;font-size:12px;color:#ffe082;", msg || cameraProtoWarning()));

          // -- timelapse: grabando ahora / empezar a mano --
          seccion(i18nT('common.timelapse'), "timelapse");
          cont.appendChild(cameraTlBox(function () { load(); }));

          // -- como funciona (plegable) --
          if (cameraCanDo("settings")) seccion(i18nT('common.how_it_works'), "how"); // the operator sees neither this nor the settings
          if (cameraCanDo("settings")) cont.appendChild(cameraAsWorks());

          // -- settings: the same as the page's, grouped (18-tl-settings.js) --
          if (cameraCanDo("settings")) seccion(i18nT('common.settings'), "settings");
          if (!cameraCanDo("settings")) {
            /* operator: no settings here */
          } else if (!borrador) {
            cont.appendChild(cameraEl("div", "font-size:12px;color:#b0bec5;", i18nT('common.reading')));
          } else {
            var tl0 = (cameraState && cameraState.timelapse) || {};
            cont.appendChild(cameraSettingsComplete(borrador, cfg, {
              rerender: render,
              usage: { videos_gb: tl0.videos_gb, free_gb: tl0.disk_free_gb, videos: tls ? tls.length : null, captures: captures ? captures.length : null },
              save: function (b) {
                msg = i18nT('common.saving');
                render();
                cameraService(b)
                  .then(function (c) {
                    cfg = c;
                    borrador = JSON.parse(JSON.stringify(c));
                    msg = i18nT('common.settings_saved_on_the_system_they');
                  })
                  .catch(function (e) { msg = i18nT('common.could_not_save') + (e.message || e); })
                  .then(render);
              },
              undo: function () {
                borrador = JSON.parse(JSON.stringify(cfg));
                render();
              },
            }));
          }

          // -- algo abierto en grande --
          if (viendo) sheet.appendChild(cameraGalleryOpened(viendo, function () { viendo = null; render(); }, borrar)); // outside the sections: it is seen even if they are folded

          // -- timelapses --
          seccion(i18nT('service.timelapses') + (tls ? " (" + tls.length + ")" : ""), "videos");
          if (!tls) cont.appendChild(cameraEl("div", "font-size:12px;color:#b0bec5;", i18nT('common.reading')));
          else if (!tls.length) cont.appendChild(cameraEl("div", "font-size:12px;color:#b0bec5;", i18nT('service.none_yet_tap_start_now_above')));
          else
            tls.forEach(function (t) {
              var f = cameraEl("div", "display:flex;gap:8px;align-items:center;margin-top:6px;cursor:pointer;");
              var mi = cameraEl("img", "width:72px;height:54px;object-fit:cover;border-radius:4px;background:#000;flex:none;");
              mi.src = cameraRelayBase() + "/timelapses/" + encodeURIComponent(t.thumbnail || t.miniatura);
              f.appendChild(mi);
              var tx = cameraEl("div", "flex:1;min-width:0;font-size:12px;");
              tx.appendChild(cameraEl("div", "font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", t.job || t.file));
              tx.appendChild(cameraEl("div", "color:#b0bec5;", (t.start || "") + " · " + cameraFmtDur(t.duration_s) + " · " + cameraFmtMB(t.bytes)));
              var as = t.camera || (t.cameras && t.cameras.length > 1 ? t.cameras.join(", ") : "");
              if (as) {
                var tc = cameraEl("div", "color:#90caf9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;");
                if (t.armed === "mosaic" || t.armed === "toggle") tc.appendChild(cameraEl("span", null, t.armed === "mosaic" ? i18nT('common.mosaic') : i18nT('service.alternated')));
                tc.appendChild(document.createTextNode((tc.firstChild ? ": " : "") + as));
                tx.appendChild(tc);
              }
              f.appendChild(tx);
              f.addEventListener("click", function () { viendo = { kind: "video", file: t.file }; render(); });
              cont.appendChild(f);
            });

          // -- capturas --
          seccion(i18nT('common.captures') + (captures ? " (" + captures.length + ")" : ""), "captures");
          if (!captures) cont.appendChild(cameraEl("div", "font-size:12px;color:#b0bec5;", i18nT('common.reading')));
          else if (!captures.length) cont.appendChild(cameraEl("div", "font-size:12px;color:#b0bec5;", i18nT('service.none_yet_tap_the_viewer_s')));
          else {
            var g = cameraEl("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:4px;");
            captures.slice(0, 60).forEach(function (c) {
              var ci = cameraEl("img", "width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;background:#000;cursor:pointer;");
              ci.src = cameraRelayBase() + "/captures/" + encodeURIComponent(c.file);
              ci.title = c.ts + " · " + (c.camera_name || c.camera) + (c.job ? " · " + c.job : "");
              ci.addEventListener("click", function () { viendo = { kind: "photo", file: c.file }; render(); });
              g.appendChild(ci);
            });
            cont.appendChild(g);
          }
        }

        render();
        load();
      }

      // ---- Mosaic: all the cameras at once ----
      function cameraOpenMosaic() {
        var old = document.getElementById(CAMERA_MOSAIC_ID);
        if (old) {
          old.remove();
          return;
        }
        var background = cameraEl("div", "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;");
        background.id = CAMERA_MOSAIC_ID;
        background.setAttribute("data-workshop-i18n", "");
        var box = cameraEl("div", "width:min(1200px,94vw);max-height:90vh;overflow-y:auto;background:#1e272c;color:#eceff1;border-radius:10px;padding:12px;font:13px Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,0.6);");
        background.appendChild(box);
        document.body.appendChild(background);
        var timers = [];
        function cerrar() {
          timers.forEach(clearInterval);
          cameraViewTeardown(background);
          cameraStateListeners = cameraStateListeners.filter(function (f) { return f !== paintStates; });
          background.remove();
        }
        // On a touch screen the button opens on pointerup and the "click" of that same
        // tap arrives later at the just-placed backdrop: it closed it instantly
        // ("seeing the mosaic on the Pi opened nothing", 2026-10-10). The
        // first half second is ignored.
        var openIn = Date.now();
        background.addEventListener("click", function (ev) {
          if (ev.target === background && Date.now() - openIn > 500) cerrar();
        });
        var cab = cameraEl("div", "display:flex;align-items:center;gap:8px;margin-bottom:8px;");
        cab.appendChild(cameraEl("div", "font-weight:bold;font-size:15px;flex:1;", i18nT('service.all_cameras')));
        cab.appendChild(cameraEl("div", "font-size:11px;color:#b0bec5;", i18nT('service.tap_one_to_see_it_in')));
        cab.appendChild(cameraBtn(i18nT('common.close'), "", cerrar));
        box.appendChild(cab);
        var grid = cameraEl("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;");
        box.appendChild(grid);
        var states = [];
        function paintStates() {
          states.forEach(function (x) {
            var e = cameraStateOf(x.rid);
            x.el.textContent = x.rid ? cameraStateText(e) || i18nT(cameraCanDo("tech_terms") ? 'service.no_data_from_the_relay' : 'roles.no_data') : i18nT(cameraCanDo("tech_terms") ? 'service.direct_not_through_the_relay' : 'roles.direct');
            x.el.style.color = cameraStateColor(e);
          });
        }
        cameraStateListeners.push(paintStates);
        cameraLoadList().then(function (items) {
          var elegida = cameraChosen();
          items.forEach(function (c) {
            var t = cameraEl("div", "border-radius:8px;overflow:hidden;background:#000;cursor:pointer;border:2px solid " + (c === elegida ? "#1976d2" : "rgba(255,255,255,0.15)") + ";");
            t.style.position = "relative";
            var badge = cameraBadge(t, "left:6px;top:6px;"); // 11-panel-parts.js: live video or photo
            var im = cameraEl("img", "width:100%;aspect-ratio:4/3;object-fit:contain;display:block;background:#000;");
            im.alt = c.name;
            t.appendChild(im);
            var pie = cameraEl("div", "padding:6px 8px;background:#263238;");
            pie.appendChild(cameraEl("div", "font-weight:bold;", c.name + (c === elegida ? i18nT('service.in_the_viewer') : "")));
            var est = cameraEl("div", "font-size:11px;");
            pie.appendChild(est);
            t.appendChild(pie);
            grid.appendChild(t);
            states.push({ rid: cameraRelayId(c), el: est });
            t.addEventListener("click", function () {
              cerrar();
              cameraChoose(c.id);
              if (typeof isCameraOpen === "function" && !isCameraOpen() && typeof cameraExpand === "function") cameraExpand();
            });
            // live video only for the camera the viewer has in live mode (and only if it can serve several screens:
            // the relay does, an ESP32 read directly serves one); photos every 3 s for the rest (light);
            // if no photo is possible, video
            cameraUrls(c).then(function (u) {
              if (!document.body.contains(background)) return;
              var direct = c.esp32 && c.relay === false;
              var live = !!u.video && !direct && (c.id === cameraLiveId || !u.photo);
              badge(live);
              if (live) {
                im.src = u.video;
              } else if (u.photo) {
                var put = function () { im.src = u.photo + (u.photo.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(); };
                put();
                timers.push(setInterval(put, 3000));
              } else {
                im.src = u.video;
              }
            });
          });
          paintStates();
        });
        cameraStateRead();
        timers.push(setInterval(function () {
          if (!document.hidden) cameraStateRead();
        }, 3000));
      }

      // ---- Digital zoom and pan ----
      // Wheel or +/- buttons; with zoom, dragging the image moves it (without zoom,
      // dragging moves the panel as always). Double tap: back to 1x.
      function cameraZoomAssemble(panel, img) {
        var z = 1, tx = 0, ty = 0;
        var layer = cameraEl("div", "position:absolute;inset:0;z-index:0;touch-action:none;");
        panel.insertBefore(layer, img.nextSibling);
        // The zoom moves the "frame" (panel coords: the drag and the pinch
        // follow the finger); the image inside carries the orientation (16-orientation.js):
        // rotated 90/270 its box goes with width and height swapped, centered.
        var frame = cameraEl("div", "position:absolute;inset:0;transform-origin:0 0;pointer-events:none;");
        img.parentNode.insertBefore(frame, img);
        frame.appendChild(img);
        var orient = { rotation: 0, h: false, v: false };
        function box() {
          var w = panel.clientWidth, h = panel.clientHeight;
          var de90 = orient.rotation % 180 !== 0;
          img.style.position = "absolute";
          img.style.width = (de90 ? h : w) + "px";
          img.style.height = (de90 ? w : h) + "px";
          img.style.left = (de90 ? (w - h) / 2 : 0) + "px";
          img.style.top = (de90 ? (h - w) / 2 : 0) + "px";
          img.style.transformOrigin = "50% 50%";
          // mirror first and then the turn (the order of Vision's /orientacion)
          img.style.transform = (orient.rotation ? "rotate(" + orient.rotation + "deg) " : "") + (orient.h || orient.v ? "scale(" + (orient.h ? -1 : 1) + "," + (orient.v ? -1 : 1) + ")" : "");
        }
        if (typeof ResizeObserver === "function") new ResizeObserver(function () { box(); apply(); }).observe(panel);
        box();
        var mark = cameraEl("button", "position:absolute;right:4px;top:34px;height:22px;padding:0 7px;border-radius:11px;border:none;background:rgba(0,0,0,0.6);color:#fff;font:bold 11px Roboto,sans-serif;cursor:pointer;z-index:1;display:none;touch-action:none;");
        mark.type = "button";
        mark.title = i18nT('service.back_to_1x');
        panel.appendChild(mark);

        function apply() {
          var w = panel.clientWidth, h = panel.clientHeight;
          if (z <= 1.001) {
            z = 1;
            tx = 0;
            ty = 0;
          }
          tx = Math.min(0, Math.max(w - w * z, tx));
          ty = Math.min(0, Math.max(h - h * z, ty));
          frame.style.transform = z === 1 ? "" : "translate(" + tx + "px," + ty + "px) scale(" + z + ")";
          mark.style.display = z === 1 ? "none" : "";
          mark.textContent = z.toFixed(1) + "x";
        }
        function zoomIn(nz, px, py) {
          nz = Math.max(1, Math.min(6, nz));
          tx = px - (px - tx) * (nz / z);
          ty = py - (py - ty) * (nz / z);
          z = nz;
          apply();
        }
        function reset() {
          z = 1;
          apply();
        }
        mark.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); ev.preventDefault(); });
        mark.addEventListener("pointerup", function (ev) { ev.stopPropagation(); reset(); });

        panel.addEventListener("wheel", function (ev) {
          var r = panel.getBoundingClientRect();
          ev.preventDefault();
          zoomIn(z * (ev.deltaY < 0 ? 1.25 : 0.8), ev.clientX - r.left, ev.clientY - r.top);
        }, { passive: false });

        // drag with zoom = move the image; two fingers = pinch
        var ptrs = {};
        var arr = null;
        var pinch = null;
        var lastTouch = 0;
        layer.addEventListener("pointerdown", function (ev) {
          var r = panel.getBoundingClientRect();
          var ahora = Date.now();
          if (ahora - lastTouch < 300 && z > 1) {
            reset();
            lastTouch = 0;
            ev.stopPropagation();
            return;
          }
          lastTouch = ahora;
          if (z === 1 && !Object.keys(ptrs).length) return; // without zoom: the panel is dragged as always
          ev.stopPropagation();
          ev.preventDefault();
          ptrs[ev.pointerId] = { x: ev.clientX - r.left, y: ev.clientY - r.top };
          try { layer.setPointerCapture(ev.pointerId); } catch (e) { /* no critico */ }
          var ids = Object.keys(ptrs);
          if (ids.length === 2) {
            var a = ptrs[ids[0]], b = ptrs[ids[1]];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: z };
            arr = null;
          } else {
            arr = { x: ev.clientX, y: ev.clientY, tx: tx, ty: ty };
          }
        });
        layer.addEventListener("pointermove", function (ev) {
          if (!ptrs[ev.pointerId]) return;
          ev.stopPropagation();
          var r = panel.getBoundingClientRect();
          ptrs[ev.pointerId] = { x: ev.clientX - r.left, y: ev.clientY - r.top };
          var ids = Object.keys(ptrs);
          if (pinch && ids.length === 2) {
            var a = ptrs[ids[0]], b = ptrs[ids[1]];
            var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            zoomIn(pinch.z * (d / pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
          } else if (arr) {
            tx = arr.tx + (ev.clientX - arr.x);
            ty = arr.ty + (ev.clientY - arr.y);
            apply();
          }
        });
        function release(ev) {
          if (!ptrs[ev.pointerId]) return;
          ev.stopPropagation();
          delete ptrs[ev.pointerId];
          if (Object.keys(ptrs).length < 2) pinch = null;
          if (!Object.keys(ptrs).length) arr = null;
        }
        layer.addEventListener("pointerup", release);
        layer.addEventListener("pointercancel", release);

        return {
          reset: reset,
          orient: function (o) {
            orient = { rotation: ((o && o.rotation) || 0) % 360, h: !!(o && o.h), v: !!(o && o.v) };
            box();
          },
          more: function () { zoomIn(z * 1.5, panel.clientWidth / 2, panel.clientHeight / 2); },
          minus: function () { zoomIn(z / 1.5, panel.clientWidth / 2, panel.clientHeight / 2); },
        };
      }
