      // ---- Several cameras (request 2026-10-10) ----
      //
      // "I want the surveillance plugin to allow any camera (I am going
      // to publish the plugin) and the floating viewer to support several,
      // with a selector to choose which one to see when opening it."
      //
      // List in 0:/sys/workshop/config/cameras.json (the same for all
      // screens): {version: 1, camaras: [{id, nombre, url, foto, esp32}]}
      //   url   MJPEG stream (empty in "main" = the Pi's relay)
      //   foto  still image (JPEG) for photo mode, lightweight; empty = it is
      //         deduced (/stream -> /snapshot) if it is an ESP32-camera or the relay, and if
      //         there is no way to take a photo the viewer goes straight to video
      //   esp32 ESP32-camera (CameraWebServer): flash and image settings
      //   flash false = the camera has no flash (the relay detects it when adding it)
      //   relay ESP32-camera: the video goes through the Pi's relay (:8090/c/<id>/...)
      //         so several screens can watch it without choking it (false = direct)
      //   abrir "foto" (lightweight, default) | "video": how the viewer opens
      // [HOSTNAME] in any URL = the machine this screen connects to.
      // The chosen camera belongs to THIS screen (localStorage).
      // The "work" camera (below the Zones / Vision map) is something else
      // and is not touched from here.
      //
      // 2026-10-12 (request 29d): the camera does NOT use DWC's webcam
      // (main.webcam of 0:/sys/dwc-settings.json) nor writes that file: DWC
      // keeps its own copy and they fought. All the config lives in this file.

      var CAMS_FILE = "0:/sys/workshop/config/cameras.json";
      var CAMS_SEL_KEY = "workshopCameraChosen";
      var CAMS_SHEET_ID = "workshop-camera-list";
      // 2026-10-11: Id "main" (antes "principal"; cameraId() traduce lo guardado)
      var CAMS_MAIN = { id: "main", name: i18nT('cameras.main'), url: "", photo: "", esp32: true };

      var cameraList = [JSON.parse(JSON.stringify(CAMS_MAIN))];
      var cameraHostLive = null; // host:port of the ESP32-camera being viewed (null = another camera)
      var cameraChangeFn = null; // set by buildCameraPanel: (cam) -> switches the viewer

      function cameraResolverUrl(u) {
        return String(u || "")
          .trim()
          .replace("[HOSTNAME]", window.location.hostname);
      }

      function cameraId(id) {
        return id === "main" ? "main" : id;
      }

      function cameraNormalize(c, i) {
        return {
          id: cameraId(String((c && c.id) || "c" + Date.now().toString(36) + i)),
          name: String((c && c.name) || i18nT('cameras.camera_n', { n: i + 1 })).slice(0, 30),
          url: String((c && c.url) || ""),
          photo: String((c && c.photo) || ""),
          esp32: !!(c && c.esp32),
          flash: c && c.flash === false ? false : c && c.flash === true ? true : null,
          relay: !(c && c.relay === false),
          flash_source: c && c.flash_source === "strip" ? "strip" : "camera",
          open: c && c.open === "video" ? "video" : "photo",
        };
      }

      function cameraLoadList() {
        return fetch("/machine/file/" + encodeURI(CAMS_FILE) + "?_=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            var arr = d && Array.isArray(d.cameras) ? d.cameras.map(cameraNormalize) : [];
            if (!arr.length) arr = [JSON.parse(JSON.stringify(CAMS_MAIN))];
            cameraList = arr;
            cameraListBase = JSON.stringify(d && Array.isArray(d.cameras) ? d.cameras : []);
            return cameraList;
          })
          .catch(function () {
            return cameraList;
          });
      }

      // The list is edited as a whole, so the revision is not enough: cameraListBase is the list EXACTLY as the file had it
      // when this page loaded it. Saving through the settings store (workshopSettings, 02-settings.js) refuses (error
      // "conflict": "Another person changed this: reload or save as a copy") if the file's list is no longer that one, so
      // nobody's cameras are erased by a page that was open with an old copy.
      var cameraListBase = "[]";
      function cameraSaveList() {
        var mine = JSON.stringify(cameraList);
        return workshopSettings
          .save("cameras", function (cfg) {
            if (JSON.stringify(cfg.cameras || []) !== cameraListBase) throw workshopApiError("conflict", i18nT('core.settings_conflict'), null);
            cfg.version = 1;
            cfg.cameras = JSON.parse(mine);
          })
          .then(function () {
            cameraListBase = JSON.stringify(JSON.parse(mine));
          });
      }

      // Video address of the Main camera (empty = the Pi's relay).
      function cameraUrlMain() {
        var main = cameraList.filter(function (c) {
          return c.id === "main";
        })[0];
        return cameraResolverUrl((main && String(main.url || "").trim()) || WORKSHOP_CAMERA_DEFAULT_URL);
      }

      function cameraChosenId() {
        try {
          return cameraId(localStorage.getItem(CAMS_SEL_KEY) || "");
        } catch (e) {
          return "";
        }
      }

      function cameraChosen() {
        var id = cameraChosenId();
        return (
          cameraList.filter(function (c) {
            return c.id === id;
          })[0] || cameraList[0]
        );
      }

      function cameraChoose(id) {
        try {
          localStorage.setItem(CAMS_SEL_KEY, id);
        } catch (e) {
          /* no critico */
        }
        if (cameraChangeFn) cameraChangeFn(cameraChosen());
      }

      // -> Promise {video, foto, host, esp32}
      function cameraUrls(camera) {
        // ESP32-camera through the Pi's relay (2026-10-10): several screens at once
        var rid = camera.id !== "main" ? cameraRelayId(camera) : null;
        if (rid) {
          var base = cameraRelayBase() + "/c/" + encodeURIComponent(rid);
          return Promise.resolve({
            video: base + "/stream",
            photo: cameraResolverUrl(camera.photo) || base + "/snapshot",
            host: window.location.hostname + ":" + CAMERA_RELAY_PORT + "/c/" + encodeURIComponent(rid),
            esp32: true,
          });
        }
        var pVideo = Promise.resolve(cameraResolverUrl(String(camera.url || "").trim() || WORKSHOP_CAMERA_DEFAULT_URL));
        return pVideo.then(function (video) {
          var photo = cameraResolverUrl(camera.photo);
          var relay = /:8090\/stream$/.test(video);
          if (!photo && (camera.esp32 || relay) && /\/stream$/.test(video)) photo = video.replace(/\/stream$/, "/snapshot");
          var host = null;
          if (camera.esp32) {
            try {
              host = new URL(video, window.location.href).host;
            } catch (e) {
              host = null;
            }
          }
          return { video: video, photo: photo, host: host, esp32: !!camera.esp32 && !!host };
        });
      }

      // "It is an ESP32-camera" (+ "no flash detected") and, for the cameras other than the main one, "go through the system relay" of the camera editor
      function cameraEspChecks(e, box, el) {
        var l = el("label", "display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;");
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = e.esp32;
        cb.addEventListener("change", function () {
          e.esp32 = cb.checked;
        });
        l.appendChild(cb);
        l.appendChild(document.createTextNode(i18nT('cameras.it_s_an_esp32_camera_flash')));
        box.appendChild(l);
        if (e.esp32 && e.flash === false) box.appendChild(el("div", "font-size:10px;color:#b0bec5;margin-left:22px;", i18nT('cameras.no_flash_detected_the_viewer_doesn')));
        if (e.esp32 && e.id !== "main") {
          var lr = el("label", "display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;");
          var cr = el("input");
          cr.type = "checkbox";
          cr.checked = e.relay !== false;
          cr.addEventListener("change", function () { e.relay = cr.checked; });
          lr.appendChild(cr);
          lr.appendChild(document.createTextNode(i18nT('cameras.go_through_the_system_relay_several')));
          box.appendChild(lr);
      }
      }

      // Hoja "Camaras" (engranaje del visor): elegir, agregar, editar, quitar.
      // "The flash turns on: Camera LED | Light strip" row of the camera editor (el / btn / render are the editor's own)
      function cameraFlashSourceRow(e, el, btn, render) {
        var row = el("div", "margin-top:6px;font-size:12px;");
        row.appendChild(el("div", "margin-bottom:4px;", i18nT('cameras.flash_turns_on'))); // the label on its own line, the two options side by side below it
        var line = el("div", "display:flex;gap:6px;");
        [["camera", i18nT('cameras.flash_camera_led')], ["strip", i18nT('cameras.flash_light_strip')]].forEach(function (o) {
          line.appendChild(btn(o[1], "flex:1 1 0;min-width:0;white-space:nowrap;" + ((e.flash_source || "camera") === o[0] ? "background:#1976d2;color:#fff;" : "background:#455a64;color:#eceff1;"), function () { e.flash_source = o[0]; render(); }));
        });
        row.appendChild(line);
        if (e.flash_source === "strip") row.appendChild(el("div", "font-size:10px;color:#b0bec5;", i18nT('cameras.flash_light_strip_help')));
        return row;
      }

      // "When the viewer opens: Photo | Live video" row of the camera editor
      function cameraOpenModeRow(e, el, btn, render) {
        var row = el("div", "display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;");
        row.appendChild(document.createTextNode(i18nT('cameras.when_the_viewer_opens')));
        [["photo", i18nT('cameras.photo_light')], ["video", i18nT('cameras.live_video')]].forEach(function (o) {
          row.appendChild(btn(o[1], e.open === o[0] ? "background:#1976d2;color:#fff;" : "", function () { e.open = o[0]; render(); }));
        });
        return row;
      }

      function cameraOpenList(panel) {
        var old = document.getElementById(CAMS_SHEET_ID);
        if (old) {
          old.remove();
          return;
        }
        if (typeof cameraCloseSheet === "function") cameraCloseSheet();
        var sheet = document.createElement("div");
        sheet.id = CAMS_SHEET_ID;
        sheet.setAttribute("data-workshop-i18n", "");
        sheet.style.cssText =
          "position:fixed;z-index:2147483647;width:300px;max-height:80vh;overflow-y:auto;background:#263238;color:#eceff1;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.6);font:13px Roboto,sans-serif;padding:12px;touch-action:pan-y;";
        document.body.appendChild(sheet);
        var r = panel.getBoundingClientRect();
        var x = r.right + 8;
        if (x + 300 > window.innerWidth - 8) x = r.left - 308;
        if (x < 8) x = Math.max(8, Math.min(window.innerWidth - 308, r.left));
        sheet.style.left = x + "px";
        cameraFitSheet(sheet, r.top); // whole on screen even if the camera is at the bottom

        var editing = null; // copy of the camera being edited (or new)
        var msg = "";
        // 2026-10-10 ("in the main camera I cannot see what settings it has"): with an empty address the Main one uses the Pi's relay,
        // which reads the camera whose address lives in WorkshopService (config.json
        // camera_relay.url). It is shown and can be changed from here.
        var relay = null; // {url, puerto, corriendo, clientes} o {error}
        var relayNew = null;
        var scanOpen = false, scanEl = null; // "Search cameras" (18-no-camera.js)
        function loadRelay() {
          workshopApiText("camera.status")
            .then(function (t) {
              var k = t.indexOf("{");
              relay = k >= 0 ? JSON.parse(t.slice(k)) : { error: t.trim() };
            })
            .catch(function (e) { relay = { error: String(e && e.message ? e.message : e) }; })
            .then(function () { if (document.body.contains(sheet)) { render(); puesta.refresh(); } });
        }
        function saveRelay(url) {
          msg = i18nT('common.saving');
          render();
          workshopApiText("camera.url", { url: String(url) })
            .then(function (t) {
              msg = /error/i.test(t) ? t.trim() : i18nT('cameras.saved_the_relay_reads_the_new');
              relayNew = null;
              loadRelay();
            })
            .catch(function (e) { msg = i18nT('common.could_not_save') + e; render(); });
        }
        var puesta = cameraStartupCreate(); // start-up card (19-startup.js)
        loadRelay();

        function el(tag, css, text) {
          var e = document.createElement(tag);
          if (css) e.style.cssText = css;
          if (text != null) e.textContent = text;
          return e;
        }
        function btn(text, estilo, onClick) {
          var b = el("button", "border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:inherit;touch-action:manipulation;" + (estilo || "background:#455a64;color:#eceff1;"), text);
          b.type = "button";
          b.addEventListener("pointerdown", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          });
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            onClick();
          });
          return b;
        }
        function field(label, valor, help, alChange) {
          var d = el("div", "display:flex;flex-direction:column;gap:2px;margin-top:6px;");
          d.appendChild(el("label", "font-size:11px;color:#b0bec5;", label));
          var i = el("input", "width:100%;box-sizing:border-box;padding:5px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:#1e272c;color:#fff;font:12px monospace;");
          i.value = valor;
          i.addEventListener("input", function () {
            alChange(i.value);
          });
          d.appendChild(i);
          if (help) d.appendChild(el("div", "font-size:10px;color:#b0bec5;", help));
          return d;
        }

        function render() {
          sheet.textContent = "";
          var cab = el("div", "display:flex;align-items:center;gap:6px;margin-bottom:8px;");
          cab.appendChild(el("div", "font-weight:bold;font-size:14px;flex:1;", i18nT('cameras.cameras')));
          cab.appendChild(puesta.el);
          cab.appendChild(
            btn(i18nT('common.close'), "", function () {
              sheet.remove();
            })
          );
          sheet.appendChild(cab);
          sheet.appendChild(el("div", "font-size:11px;color:#b0bec5;margin-bottom:6px;", i18nT('cameras.the_list_is_the_same_on')));

          var elegida = cameraChosen();
          cameraList.forEach(function (c, i) {
            var f = el("div", "display:flex;align-items:center;gap:6px;padding:6px;border-radius:6px;margin-top:4px;background:" + (c === elegida ? "rgba(33,150,243,0.25)" : "rgba(255,255,255,0.05)") + ";");
            var n = el("div", "flex:1;min-width:0;cursor:pointer;");
            n.appendChild(el("div", "font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", c.name + (c === elegida ? "  " + i18nT('cameras.watching') : "")));
            n.appendChild(el("div", "font-size:10px;color:#b0bec5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", c.url || (relay && relay.url ? i18nT('cameras.system_relay') + relay.port + " <- " + relay.url : i18nT('cameras.system_relay_2'))));
            var rid = cameraRelayId(c);
            var est = rid ? cameraStateOf(rid) : null;
            n.appendChild(el("div", "font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:" + cameraStateColor(est) + ";",
              rid ? (est ? cameraStateText(est) : i18nT('cameras.through_the_system_relay')) : i18nT('cameras.direct_without_the_relay_no_captures')));
            n.addEventListener("click", function () {
              cameraChoose(c.id);
              render();
            });
            f.appendChild(n);
            f.appendChild(
              btn(i18nT('common.edit'), "", function () {
                editing = { i: i, c: JSON.parse(JSON.stringify(c)) };
                render();
              })
            );
            sheet.appendChild(f);
          });

          if (editing) {
            var e = editing.c;
            var box = el("div", "margin-top:10px;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);");
            box.appendChild(el("div", "font-weight:bold;", editing.i < 0 ? i18nT('cameras.new_camera') : i18nT('cameras.edit_camera')));
            box.appendChild(
              field(i18nT('common.name'), e.name, "", function (v) {
                e.name = v;
              })
            );
            box.appendChild(
              field(
                i18nT('cameras.video_mjpeg_stream'),
                e.url,
                e.id === "main" ? i18nT('cameras.empty_the_system_relay') : i18nT('cameras.e_g_http_192_168_1'),
                function (v) {
                  e.url = v;
                }
              )
            );
            if (e.id === "main" && !String(e.url || "").trim()) {
              var org = el("div", "margin-top:8px;padding:6px;border-radius:6px;background:rgba(255,255,255,0.06);");
              org.appendChild(el("div", "font-size:11px;font-weight:bold;", i18nT('cameras.where_the_video_comes_from')));
              if (!relay) org.appendChild(el("div", "font-size:11px;color:#b0bec5;", i18nT('cameras.reading_the_system_relay')));
              else if (relay.error) org.appendChild(el("div", "font-size:11px;color:#ffb74d;", i18nT('cameras.could_not_read_the_system_relay_error', { error: relay.error })));
              else {
                org.appendChild(el("div", "font-size:11px;color:#b0bec5;", i18nT('cameras.system_relay_port_shares_the_video', { port: relay.port }) + " " + (relay.running ? i18nT('cameras.running_n_watching', { n: relay.clients }) : i18nT('cameras.stopped'))));
                org.appendChild(
                  field(i18nT('cameras.camera_the_relay_reads'), relayNew != null ? relayNew : relay.url || "", i18nT('cameras.address_of_the_camera_stream_esp32'), function (v) {
                    relayNew = v;
                  })
                );
                var rb = el("div", "display:flex;gap:6px;margin-top:4px;");
                rb.appendChild(
                  btn(i18nT('cameras.save_address'), "background:#1565c0;color:#fff;", function () {
                    var u = String(relayNew != null ? relayNew : relay.url || "").trim();
                    if (!/^https?:\/\//i.test(u)) {
                      msg = i18nT('cameras.the_address_has_to_start_with');
                      return render();
                    }
                    saveRelay(u);
                  })
                );
                org.appendChild(rb);
              }
              box.appendChild(org);
            }
            box.appendChild(
              field(i18nT('cameras.photo_optional_jpeg_image'), e.photo, i18nT('cameras.for_photo_mode_lightweight_empty_worked'), function (v) {
                e.photo = v;
              })
            );
            cameraEspChecks(e, box, el);
            box.appendChild(cameraFlashSourceRow(e, el, btn, render));
            box.appendChild(cameraOpenModeRow(e, el, btn, render));
            if (String(e.url || "").trim())
              box.appendChild(
                btn(i18nT('cameras.detect_esp32_and_flash'), "margin-top:6px;background:#455a64;color:#eceff1;", function () {
                  msg = i18nT('cameras.asking_the_camera');
                  render();
                  cameraDetect(e).then(function (t) { msg = t; render(); });
                })
              );
            var acc = el("div", "display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;");
            acc.appendChild(
              btn(i18nT('common.save'), "background:#2e7d32;color:#fff;", function () {
                if (!String(e.name).trim()) {
                  msg = i18nT('cameras.the_name_is_missing');
                  return render();
                }
                if (e.id !== "main" && !String(e.url).trim()) {
                  msg = i18nT('cameras.the_video_address_is_missing');
                  return render();
                }
                var follow = function () {
                  var c = cameraNormalize(e, cameraList.length);
                  if (editing.i < 0) cameraList.push(c);
                  else cameraList[editing.i] = c;
                  editing = null;
                  save(c.id);
                };
                // camara nueva o direccion cambiada: preguntarle si es ESP32 y si tiene flash
                var before = editing.i >= 0 ? cameraList[editing.i] : null;
                if (String(e.url || "").trim() && (!before || before.url !== e.url || e.flash == null)) {
                  msg = i18nT('cameras.asking_the_camera_whether_it_s');
                  render();
                  cameraDetect(e).then(function (t) { msg = t; follow(); });
                } else follow();
              })
            );
            acc.appendChild(
              btn(i18nT('common.cancel'), "", function () {
                editing = null;
                msg = "";
                render();
              })
            );
            if (editing.i >= 0 && cameraList.length > 1)
              acc.appendChild(
                btn(i18nT('common.remove'), "background:#6d4c41;color:#fff;", function () {
                  cameraList.splice(editing.i, 1);
                  editing = null;
                  save(null);
                })
              );
            box.appendChild(acc);
            sheet.appendChild(box);
          } else {
            sheet.appendChild(cameraOrientControls(cameraChosen(), render)); // girar / espejar (16-orientation.js)
            var row = el("div", "display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;");
            row.appendChild(
              btn(i18nT('cameras.add_camera'), "background:#1976d2;color:#fff;", function () {
                editing = { i: -1, c: { id: "c" + Date.now().toString(36), name: "", url: "", photo: "", esp32: false } };
                render();
              })
            );
            row.appendChild(btn(i18nT('noCamera.scan_go'), "", function () { scanOpen = !scanOpen; render(); }));
            row.appendChild(
              btn(i18nT('common.captures_and_timelapse'), "", function () {
                sheet.remove();
                cameraOpenGallery(panel);
              })
            );
            row.appendChild(
              btn(i18nT('cameras.see_all'), "", function () {
                sheet.remove();
                cameraOpenMosaic();
              })
            );
            if (cameraHostLive && cameraChosen().esp32 && typeof cameraOpenSheet === "function")
              row.appendChild(
                btn(i18nT('cameras.image_settings'), "", function () {
                  sheet.remove();
                  cameraOpenSheet(panel, cameraHostLive);
                })
              );
            sheet.appendChild(row);
            if (scanOpen) sheet.appendChild(scanEl || (scanEl = cameraSheetScan(el, btn, { known: knownHost, pick: addFound })));
          }
          if (msg) sheet.appendChild(el("div", "margin-top:6px;font-size:11px;color:#ffe082;", msg));
        }

        // a camera found by the search: already added? / add it (the first one is the camera the relay reads, the next ones go to the list)
        function knownHost(u) {
          var h = cameraHostOf(u);
          return cameraHostOf(relay && relay.url) === h || cameraList.some(function (c) { return cameraHostOf(c.url) === h; });
        }
        function addFound(u) {
          if (relay && !relay.error && !relay.url) return saveRelay(u);
          var c = cameraNormalize({ id: "c" + Date.now().toString(36), name: "", url: u, esp32: true }, cameraList.length);
          msg = i18nT('cameras.asking_the_camera_whether_it_s');
          render();
          cameraDetect(c).then(function (t) { msg = t; cameraList.push(c); save(c.id); });
        }

        function save(chooseId) {
          msg = i18nT('common.saving');
          render();
          cameraSaveList()
            .then(function () {
              msg = i18nT('common.saved');
            })
            .catch(function (er) {
              msg = i18nT('cameras.couldn_t_save_on_the_system_error', { error: er.message });
            })
            .then(function () {
              if (chooseId) cameraChoose(chooseId);
              else if (cameraChangeFn) cameraChangeFn(cameraChosen());
              render();
              puesta.refresh();
            });
        }

        render();
        cameraLoadList().then(render);
        cameraStateRead().then(function () { if (document.body.contains(sheet) && !editing) render(); });
      }

      // Asks the Pi's relay whether the camera is an ESP32-camera and whether it has a flash
      // (it cannot be asked directly from the browser: CORS). Changes e.
      function cameraDetect(e) {
        var u = cameraResolverUrl(e.url);
        return fetch(cameraRelayBase() + "/detect?url=" + encodeURIComponent(u), { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (d) {
            if (!d.ok) return i18nT('cameras.could_not_ask', { error: d.error || "" });
            e.esp32 = !!d.esp32;
            e.flash = d.esp32 ? !!d.flash : null;
            return d.esp32 ? (d.flash ? i18nT('cameras.it_is_an_esp32_camera_with_flash') : i18nT('cameras.it_is_an_esp32_camera_without_flash')) : i18nT('cameras.it_doesn_t_answer_as_an');
          })
          .catch(function (er) {
            return i18nT('cameras.could_not_ask_relay_off', { error: String(er.message || er) });
          });
      }
