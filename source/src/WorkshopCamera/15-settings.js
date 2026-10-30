      // ---- Camera settings (panel gear) -- 2026-10-09 ----
      //
      // The ESP32-camera (CameraWebServer firmware) exposes /status (JSON with
      // the current settings) and /control?var=X&val=N; the Pi's relay
      // forwards both (camera_relay.py). The ESP32 FORGETS everything when
      // it restarts, so what is chosen is saved in 0:/sys/workshop/config/camera.json
      // (for all screens) and applied again when the panel is opened.
      //
      // Profiles: a "suggested" setting according to what happens on the machine
      // (cutting with laser -> less exposure; otherwise -> balanced).
      // "Apply the suggested one automatically" changes it when a job starts/ends.

      var CAMERA_CFG_FILE = "0:/sys/workshop/config/camera.json";
      var CAMERA_SHEET_ID = "workshop-camera-settings";

      // framesize: the new firmware (esp32-camera >= 2.0, carries "xclk" in
      // /status) added 96x96, 128x128, 240x240 and 320x320 and shifted the
      // numbers. Measured on the workshop camera 2026-10-09 (/capture):
      // 6=320x240 9=480x320 10=640x480 11=800x600 12=1024x768 13=1280x720
      // 14=1280x1024. 15 (UXGA) and above return an error with this firmware.
      // (The old table on this side was shifted 2 places: "VGA" gave
      // 400x296.)
      var CAMERA_FS_NEW = { QQVGA: 1, QVGA: 6, CIF: 8, HVGA: 9, VGA: 10, SVGA: 11, XGA: 12, HD: 13, SXGA: 14, UXGA: 15 };
      var CAMERA_FS_OLD = { QQVGA: 0, QVGA: 4, CIF: 5, VGA: 6, SVGA: 7, XGA: 8, SXGA: 9, UXGA: 10 };
      var CAMERA_FS_NAMES = [
        ["QVGA", i18nT('settings.320x240_very_smooth')],
        ["CIF", "400x296"],
        ["VGA", i18nT('settings.640x480_very_smooth')],
        ["SVGA", i18nT('settings.800x600_recommended')],
        ["XGA", i18nT('settings.1024x768_slow')],
        ["HD", i18nT('settings.1280x720_slow')],
        ["SXGA", i18nT('settings.1280x1024_very_slow_max')],
      ];

      var CAMERA_PROFILES = [
        {
          id: "balanced",
          name: i18nT('settings.balanced'),
          desc: i18nT('settings.good_smooth_image_for_everyday_use'),
          settings: { framesize: "SVGA", quality: 12, brightness: 0, contrast: 0, saturation: 0, awb: 1, aec: 1, aec2: 0, ae_level: 0, agc: 1, gainceiling: 2, lenc: 1, bpc: 1, wpc: 1, raw_gma: 1 },
        },
        {
          id: "cut",
          name: i18nT('settings.during_cut'),
          desc: i18nT('settings.less_exposure_the_laser_dot_doesn'),
          settings: { framesize: "SVGA", quality: 12, brightness: -1, contrast: 1, saturation: -1, awb: 1, aec: 1, aec2: 0, ae_level: -2, agc: 1, gainceiling: 0, lenc: 1, bpc: 1, wpc: 1, raw_gma: 1 },
        },
        {
          id: "detail",
          name: i18nT('settings.detail'),
          desc: i18nT('settings.more_resolution_to_align_or_focus'),
          settings: { framesize: "XGA", quality: 10, brightness: 0, contrast: 1, saturation: 0, awb: 1, aec: 1, aec2: 0, ae_level: 0, agc: 1, gainceiling: 2, lenc: 1, bpc: 1, wpc: 1, raw_gma: 1 },
        },
        {
          id: "little_light",
          name: i18nT('settings.low_light'),
          desc: i18nT('settings.more_exposure_and_gain_some_noise'),
          settings: { framesize: "SVGA", quality: 12, brightness: 1, contrast: 0, saturation: 0, awb: 1, aec: 1, aec2: 1, ae_level: 2, agc: 1, gainceiling: 4, lenc: 1, bpc: 1, wpc: 1, raw_gma: 1 },
        },
        {
          id: "smooth",
          name: i18nT('settings.smooth_slow_network'),
          desc: i18nT('settings.small_light_image_for_weak_wifi'),
          settings: { framesize: "QVGA", quality: 15, brightness: 0, contrast: 0, saturation: 0, awb: 1, aec: 1, aec2: 0, ae_level: 0, agc: 1, gainceiling: 2, lenc: 1, bpc: 1, wpc: 1, raw_gma: 1 },
        },
      ];

      var cameraCfg = null; // {perfil, ajustes:{var: val (framesize por NOMBRE)}, auto, espejo:{hmirror,vflip}}
      var cameraCfgLoaded = null; // promesa
      var cameraStatus = null; // ultimo /status del ESP32
      var cameraAppliedInSession = false;
      var cameraLastSuggested = null;

      function cameraCfgRead() {
        if (!cameraCfgLoaded) {
          cameraCfgLoaded = fetch("/machine/file/" + encodeURIComponent(CAMERA_CFG_FILE), { cache: "no-store" })
            .then(function (r) {
              return r.ok ? r.json() : null;
            })
            .catch(function () {
              return null;
            })
            .then(function (j) {
              cameraCfg = j && typeof j === "object" ? j : { profile: null, settings: {}, auto: false };
              cameraCfg.settings = cameraCfg.settings || {};
              return cameraCfg;
            });
        }
        return cameraCfgLoaded;
      }

      function cameraCfgSave() {
        return fetch("/machine/file/" + encodeURIComponent(CAMERA_CFG_FILE), {
          method: "PUT",
          body: JSON.stringify(cameraCfg, null, 2),
          headers: { "Content-Type": "application/json" },
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
        });
      }

      function cameraFsTable() {
        return cameraStatus && cameraStatus.xclk == null ? CAMERA_FS_OLD : CAMERA_FS_NEW;
      }

      function cameraReadStatus(cameraHost) {
        return fetch("http://" + cameraHost + "/status", { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (j) {
            cameraStatus = j;
            return j;
          });
      }

      function cameraControl(cameraHost, variable, value) {
        return fetch("http://" + cameraHost + "/control?var=" + encodeURIComponent(variable) + "&val=" + encodeURIComponent(value)).then(function (r) {
          if (!r.ok) throw new Error(variable + ": HTTP " + r.status);
        });
      }

      // Applies {var: val} one at a time (the ESP32 serves one request at a time).
      // framesize goes first: changing it restarts part of the sensor.
      function cameraApply(cameraHost, settings) {
        var claves = Object.keys(settings).sort(function (a, b) {
          return (a === "framesize" ? -1 : 0) - (b === "framesize" ? -1 : 0);
        });
        var p = cameraStatus ? Promise.resolve() : cameraReadStatus(cameraHost).catch(function () {});
        claves.forEach(function (k) {
          p = p.then(function () {
            var v = settings[k];
            if (k === "framesize") {
              v = cameraFsTable()[v];
              if (v == null) return;
            }
            if (cameraStatus && cameraStatus[k] === v) return; // it is already there
            return cameraControl(cameraHost, k, v).then(function () {
              if (cameraStatus) cameraStatus[k] = v;
            });
          });
        });
        return p;
      }

      function cameraSettingsSaved() {
        var a = {};
        var k;
        if (cameraCfg.profile) {
          var perf = CAMERA_PROFILES.filter(function (x) {
            return x.id === cameraCfg.profile;
          })[0];
          if (perf) for (k in perf.settings) a[k] = perf.settings[k];
        }
        for (k in cameraCfg.settings) a[k] = cameraCfg.settings[k];
        return a;
      }

      // When opening the panel (once per page load, or if the ESP32
      // restarted and came back with its factory values): re-apply what was saved.
      function cameraReapplySaved(cameraHost) {
        if (cameraAppliedInSession) return;
        cameraCfgRead().then(function () {
          var a = cameraSettingsSaved();
          if (!Object.keys(a).length) return;
          cameraAppliedInSession = true;
          cameraReadStatus(cameraHost)
            .then(function () {
              return cameraApply(cameraHost, a);
            })
            .catch(function () {
              cameraAppliedInSession = false; // camara apagada: reintentar la proxima vez
            });
        });
      }

      function cameraJobLaser() {
        var st = workshopCameraStateMachine();
        return st.status === "processing" && st.mode === "Laser";
      }

      function workshopCameraStateMachine() {
        try {
          var m = workshopHostModel();
          return { status: m.state.status, mode: m.state.machineMode };
        } catch (e) {
          return { status: "", mode: "" };
        }
      }

      function cameraProfileSuggested() {
        return cameraJobLaser() ? "cut" : "balanced";
      }

      // "Apply the suggested one automatically": check every 5 s if the suggested one changed
      function cameraWatchSuggested(cameraHost) {
        setInterval(function () {
          if (!cameraCfg || !cameraCfg.auto || !cameraPanelEl || cameraPanelEl.style.display === "none") return;
          // looking at another camera (12-cameras.js): the profiles belong to the ESP32-camera
          if (cameraHostLive !== cameraHost) return;
          var s = cameraProfileSuggested();
          if (s === cameraLastSuggested) return;
          cameraLastSuggested = s;
          var perf = CAMERA_PROFILES.filter(function (x) {
            return x.id === s;
          })[0];
          cameraApply(cameraHost, perf.settings)
            .then(function () {
              cameraRefreshSheet();
            })
            .catch(function () {});
        }, 5000);
      }

      var cameraSheetRender = null;

      function cameraRefreshSheet() {
        if (cameraSheetRender) cameraSheetRender();
      }

      function cameraCloseSheet() {
        var h = document.getElementById(CAMERA_SHEET_ID);
        if (h) h.remove();
        cameraSheetRender = null;
      }

      // Settings sheet: floating beside the panel, inside the screen.
      function cameraOpenSheet(panel, cameraHost) {
        if (document.getElementById(CAMERA_SHEET_ID)) {
          cameraCloseSheet();
          return;
        }
        var sheet = document.createElement("div");
        sheet.id = CAMERA_SHEET_ID;
        sheet.setAttribute("data-workshop-i18n", "");
        sheet.style.cssText = [
          "position:fixed",
          "z-index:2147483647",
          "width:300px",
          "max-height:80vh",
          "overflow-y:auto",
          "overflow-x:hidden",
          "box-sizing:border-box",
          "background:#263238",
          "color:#eceff1",
          "border-radius:10px",
          "box-shadow:0 4px 18px rgba(0,0,0,0.6)",
          "font:13px Roboto,sans-serif",
          "padding:12px",
          "touch-action:pan-y",
        ].join(";");
        document.body.appendChild(sheet);

        // position: to the right of the panel if it fits, otherwise to the left / below
        var r = panel.getBoundingClientRect();
        var x = r.right + 8;
        if (x + 300 > window.innerWidth - 8) x = r.left - 308;
        if (x < 8) x = Math.max(8, Math.min(window.innerWidth - 308, r.left));
        sheet.style.left = x + "px";
        cameraFitSheet(sheet, r.top); // whole on screen even if the camera is at the bottom

        var msg = "";
        var busy = false;

        function btn(text, estilo, onClick) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = text;
          b.style.cssText =
            "border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:inherit;touch-action:manipulation;" + (estilo || "background:#455a64;color:#eceff1;");
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

        function applyAndSave(settings, profileId) {
          if (busy) return;
          busy = true;
          msg = i18nT('settings.applying');
          render();
          cameraApply(cameraHost, settings)
            .then(function () {
              if (profileId !== undefined) {
                cameraCfg.profile = profileId;
                cameraCfg.settings = {};
              } else {
                for (var k in settings) cameraCfg.settings[k] = settings[k];
              }
              return cameraCfgSave();
            })
            .then(function () {
              msg = i18nT('settings.done_saved_for_all_screens');
            })
            .catch(function (e) {
              msg = i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: e.message });
            })
            .then(function () {
              busy = false;
              render();
            });
        }

        function row(label, control) {
          var d = document.createElement("div");
          d.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0";
          var l = document.createElement("span");
          l.textContent = label;
          d.appendChild(l);
          d.appendChild(control);
          return d;
        }

        function slider(variable, min, max, paso) {
          var i = document.createElement("input");
          i.type = "range";
          i.min = min;
          i.max = max;
          i.step = paso || 1;
          i.style.width = "130px";
          i.value = cameraStatus && cameraStatus[variable] != null ? cameraStatus[variable] : 0;
          i.addEventListener("pointerdown", function (ev) {
            ev.stopPropagation();
          });
          i.addEventListener("change", function () {
            var a = {};
            a[variable] = parseInt(i.value, 10);
            applyAndSave(a);
          });
          return i;
        }

        function interruptor(variable) {
          var i = document.createElement("input");
          i.type = "checkbox";
          i.checked = !!(cameraStatus && cameraStatus[variable]);
          i.style.cssText = "width:18px;height:18px";
          i.addEventListener("pointerdown", function (ev) {
            ev.stopPropagation();
          });
          i.addEventListener("change", function () {
            var a = {};
            a[variable] = i.checked ? 1 : 0;
            applyAndSave(a);
          });
          return i;
        }

        function render() {
          sheet.innerHTML = "";
          var cab = document.createElement("div");
          cab.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px";
          var t = document.createElement("b");
          t.textContent = i18nT('common.camera_settings');
          t.style.fontSize = "15px";
          cab.appendChild(t);
          cab.appendChild(btn("✕", "background:transparent;color:#eceff1;font-size:16px;padding:2px 6px", cameraCloseSheet));
          sheet.appendChild(cab);

          var est = document.createElement("div");
          est.style.cssText = "font-size:12px;margin-bottom:8px;color:" + (cameraStatus ? "#a5d6a7" : "#ffab91");
          est.textContent = cameraStatus ? i18nT('settings.camera_connected') : i18nT('settings.the_camera_isn_t_responding_off');
          sheet.appendChild(est);

          // Perfiles
          var sug = cameraProfileSuggested();
          // Profiles and Fine adjustment foldable; remembered on this screen
          var perf = document.createElement("details");
          perf.open = !cameraSectionsClosed().profiles;
          perf.addEventListener("toggle", function () {
            var c = cameraSectionsClosed();
            c.profiles = !perf.open;
            cameraSectionsSave(c);
          });
          var h = document.createElement("summary");
          h.textContent = i18nT('settings.profiles');
          h.style.cssText = "cursor:pointer;font-weight:500;padding:4px 0";
          perf.appendChild(h);
          sheet.appendChild(perf);
          CAMERA_PROFILES.forEach(function (p) {
            var active = cameraCfg.profile === p.id && !Object.keys(cameraCfg.settings).length;
            var c = document.createElement("div");
            c.style.cssText =
              "border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:pointer;border:1px solid " +
              (active ? "#42a5f5" : "rgba(255,255,255,0.12)") +
              ";background:" +
              (active ? "rgba(66,165,245,0.15)" : "rgba(255,255,255,0.04)");
            var n = document.createElement("div");
            n.style.cssText = "display:flex;align-items:center;gap:6px;font-weight:500";
            n.textContent = p.name;
            if (p.id === sug) {
              var chip = document.createElement("span");
              chip.textContent = i18nT('settings.suggested_now');
              chip.style.cssText = "font-size:10px;background:#66bb6a;color:#000;border-radius:8px;padding:1px 6px;font-weight:500";
              n.appendChild(chip);
            }
            if (active) {
              var chip2 = document.createElement("span");
              chip2.textContent = i18nT('settings.in_use');
              chip2.style.cssText = "font-size:10px;background:#42a5f5;color:#000;border-radius:8px;padding:1px 6px;font-weight:500";
              n.appendChild(chip2);
            }
            c.appendChild(n);
            var dsc = document.createElement("div");
            dsc.textContent = p.desc;
            dsc.style.cssText = "font-size:12px;color:#b0bec5";
            c.appendChild(dsc);
            c.addEventListener("pointerdown", function (ev) {
              ev.stopPropagation();
            });
            c.addEventListener("click", function (ev) {
              ev.stopPropagation();
              applyAndSave(p.settings, p.id);
            });
            perf.appendChild(c);
          });

          var autoLbl = document.createElement("label");
          autoLbl.style.cssText = "display:flex;align-items:center;gap:8px;margin:8px 0;font-size:12px;cursor:pointer";
          var auto = document.createElement("input");
          auto.type = "checkbox";
          auto.checked = !!cameraCfg.auto;
          auto.style.cssText = "width:18px;height:18px";
          auto.addEventListener("change", function () {
            cameraCfg.auto = auto.checked;
            cameraLastSuggested = null;
            cameraCfgSave().catch(function () {});
          });
          autoLbl.appendChild(auto);
          var autoTxt = document.createElement("span");
          autoTxt.textContent = i18nT('settings.switch_automatically_to_the_suggested_one');
          autoLbl.appendChild(autoTxt);
          perf.appendChild(autoLbl);

          // Ajuste fino
          var det = document.createElement("details");
          det.style.cssText = "margin-top:6px";
          det.open = !!cameraSectionsClosed().fineOpen;
          det.addEventListener("toggle", function () {
            var c = cameraSectionsClosed();
            c.fineOpen = det.open;
            cameraSectionsSave(c);
          });
          var sum = document.createElement("summary");
          sum.textContent = i18nT('settings.fine_tuning');
          sum.style.cssText = "cursor:pointer;font-weight:500;padding:4px 0";
          det.appendChild(sum);

          var sel = document.createElement("select");
          // max-width + min-width:0: the longest option ("1280x1024 (very slow; ...")
          // stretched the select beyond the sheet (300 px) and a horizontal scroll showed up
          sel.style.cssText = "background:#455a64;color:#eceff1;border:none;border-radius:4px;padding:4px;min-width:0;max-width:170px;flex:0 1 auto";
          var table = cameraFsTable();
          var currentFs = cameraStatus ? cameraStatus.framesize : null;
          CAMERA_FS_NAMES.forEach(function (fs) {
            if (table[fs[0]] == null) return;
            var o = document.createElement("option");
            o.value = fs[0];
            o.textContent = fs[1];
            if (table[fs[0]] === currentFs) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("pointerdown", function (ev) {
            ev.stopPropagation();
          });
          sel.addEventListener("change", function () {
            applyAndSave({ framesize: sel.value });
          });
          det.appendChild(row(i18nT('settings.resolution'), sel));
          det.appendChild(row(i18nT('settings.quality_left_better'), slider("quality", 8, 40)));
          det.appendChild(row(i18nT('settings.brightness'), slider("brightness", -2, 2)));
          det.appendChild(row(i18nT('settings.contrast'), slider("contrast", -2, 2)));
          det.appendChild(row(i18nT('settings.saturation'), slider("saturation", -2, 2)));
          det.appendChild(row(i18nT('settings.exposure'), slider("ae_level", -2, 2)));
          det.appendChild(row(i18nT('settings.auto_exposure'), interruptor("aec")));
          det.appendChild(row(i18nT('settings.auto_gain'), interruptor("agc")));
          det.appendChild(row(i18nT('settings.gain_limit'), slider("gainceiling", 0, 6)));
          det.appendChild(row(i18nT('settings.auto_white_balance'), interruptor("awb")));
          det.appendChild(row(i18nT('common.horizontal_mirror'), interruptor("hmirror")));
          det.appendChild(row(i18nT('settings.flip_vertical'), interruptor("vflip")));
          var note = document.createElement("div");
          note.style.cssText = "font-size:11px;color:#b0bec5;margin-top:4px";
          note.textContent = i18nT('settings.what_you_change_here_is_saved');
          det.appendChild(note);
          sheet.appendChild(det);

          if (msg) {
            var m = document.createElement("div");
            m.textContent = msg;
            m.style.cssText = "font-size:12px;margin-top:8px;color:#ffe082";
            sheet.appendChild(m);
          }
        }

        cameraSheetRender = render;
        cameraCfgRead().then(function () {
          render();
          cameraReadStatus(cameraHost)
            .catch(function () {
              cameraStatus = null;
            })
            .then(render);
        });
      }
