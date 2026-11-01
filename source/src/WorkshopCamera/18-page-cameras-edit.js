      // ---- The editor of one camera, in the tab "Cameras" (informe-07: it used to be inside the sheet of the viewer's gear) ----
      //
      // The editor works on a COPY of the camera (S.editing.c); nothing changes until Save. Saving asks the relay whether the address is an
      // ESP32-CAM and whether it has a flash (camera.detect: the browser cannot ask it, CORS), then saves the whole list through the settings store.

      // A labelled text field of the page: label, current value, a help line (or ""), onChange(text).
      function cameraField(label, value, help, onChange) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:2px;margin-top:6px;");
        box.appendChild(cameraEl("label", "color:var(--c-sec,#b0bec5);font-size:11px;", label));
        var input = cameraEl("input", "width:100%;box-sizing:border-box;");
        input.value = value;
        input.addEventListener("input", function () { onChange(input.value); });
        box.appendChild(input);
        if (help) box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:10px;", help));
        return box;
      }

      // "It is an ESP32-camera" (+ "no flash detected") and "go through the system relay"
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
        if (e.esp32 && e.flash && e.flash.capable === false) box.appendChild(el("div", "font-size:10px;color:var(--c-sec,#b0bec5);margin-left:22px;", i18nT('cameras.no_flash_detected_the_viewer_doesn')));
        if (e.esp32) {
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

      // "The flash turns on: Camera LED | Light strip" row of the camera editor (el / btn are the page's makers, render draws the page again)
      function cameraFlashSourceRow(e, el, btn, render) {
        var row = el("div", "margin-top:6px;font-size:12px;");
        row.appendChild(el("div", "margin-bottom:4px;", i18nT('cameras.flash_turns_on'))); // the label on its own line, the two options side by side below it
        var line = el("div", "display:flex;gap:6px;");
        [["camera", i18nT('cameras.flash_camera_led')], ["strip", i18nT('cameras.flash_light_strip')]].forEach(function (o) {
          line.appendChild(btn(o[1], "flex:1 1 0;min-width:0;white-space:nowrap;" + ((e.flash_source || "camera") === o[0] ? "border:1px solid #1976d2;" : ""), function () { e.flash_source = o[0]; render(); }));
        });
        row.appendChild(line);
        if (e.flash_source === "strip") row.appendChild(el("div", "font-size:10px;color:var(--c-sec,#b0bec5);", i18nT('cameras.flash_light_strip_help')));
        return row;
      }

      // "When the viewer opens: Photo | Live video" row of the camera editor
      function cameraOpenModeRow(e, el, btn, render) {
        var row = el("div", "display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;flex-wrap:wrap;");
        row.appendChild(document.createTextNode(i18nT('cameras.when_the_viewer_opens')));
        [["photo", i18nT('cameras.photo_light')], ["video", i18nT('cameras.live_video')]].forEach(function (o) {
          row.appendChild(btn(o[1], e.open === o[0] ? "border:1px solid #1976d2;" : "", function () { e.open = o[0]; render(); }));
        });
        return row;
      }

      // Asks the service (camera.detect) whether the camera is an ESP32-camera and whether it has a flash
      // (it cannot be asked directly from the browser: CORS). Changes e.
      function cameraDetect(e) {
        var u = cameraResolverUrl(e.url);
        return cameraRelayDetect(u)
          .then(function (d) {
            if (!d.ok) return i18nT('cameras.could_not_ask', { error: d.error || "" });
            e.esp32 = !!d.esp32;
            return d.esp32 ? (d.flash ? i18nT('cameras.it_is_an_esp32_camera_with_flash') : i18nT('cameras.it_is_an_esp32_camera_without_flash')) : i18nT('cameras.it_doesn_t_answer_as_an');
          })
          .catch(function (er) {
            return i18nT('cameras.could_not_ask_service', { error: String(er.message || er) });
          });
      }

      // The editor card. S = the state of 18-page-cameras.js.
      function cameraCamerasEditor(grid, S) {
        var e = S.editing.c;
        var rerender = function () { S.ctx.rerender(); };
        var card = studioCard(grid, "mdi-pencil-outline", S.editing.i < 0 ? i18nT('cameras.new_camera') : i18nT('cameras.edit_camera'), null);
        card.appendChild(cameraField(i18nT('common.name'), e.name, "", function (v) { e.name = v; }));
        card.appendChild(cameraField(i18nT('cameras.video_mjpeg_stream'), e.url, i18nT('cameras.e_g_http_192_168_1'), function (v) { e.url = v; }));
        card.appendChild(cameraField(i18nT('cameras.photo_optional_jpeg_image'), e.photo, i18nT('cameras.for_photo_mode_lightweight_empty_worked'), function (v) { e.photo = v; }));
        cameraEspChecks(e, card, cameraEl);
        card.appendChild(cameraFlashSourceRow(e, cameraEl, cameraBtn, rerender));
        card.appendChild(cameraOpenModeRow(e, cameraEl, cameraBtn, rerender));
        if (String(e.url || "").trim()) {
          card.appendChild(cameraBtn(i18nT('cameras.detect_esp32_and_flash'), "align-self:flex-start;margin-top:6px;", function () {
            cameraCamerasSay(S, i18nT('cameras.asking_the_camera'));
            cameraDetect(e).then(function (text) { cameraCamerasSay(S, text); });
          }));
        }
        card.appendChild(cameraCamerasEditorButtons(S, e));
        if (S.msg) card.appendChild(cameraEl("div", "color:var(--c-amber,#ffe082);", S.msg));
      }

      function cameraCamerasEditorButtons(S, e) {
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;");
        row.appendChild(cameraBtn(i18nT('common.save'), "background:#1976d2;color:#fff;", function () { cameraCamerasSaveEdit(S, e); }));
        row.appendChild(cameraBtn(i18nT('common.cancel'), "", function () {
          S.editing = null;
          cameraCamerasSay(S, "");
        }));
        if (S.editing.i >= 0 && cameraList.length > 1) {
          row.appendChild(cameraBtn(i18nT('common.remove'), "background:#c62828;color:#fff;", function () {
            cameraList.splice(S.editing.i, 1);
            S.editing = null;
            cameraCamerasPersist(S, null);
          }));
        }
        return row;
      }

      // Save: the name and the address are needed; a new camera or a changed address is asked to the relay first (ESP32? flash?).
      function cameraCamerasSaveEdit(S, e) {
        var editing = S.editing;
        if (!String(e.name).trim()) return cameraCamerasSay(S, i18nT('cameras.the_name_is_missing'));
        if (!String(e.url).trim()) return cameraCamerasSay(S, i18nT('cameras.the_video_address_is_missing'));
        function follow() {
          var c = cameraNormalize(e, cameraList.length);
          if (editing.i < 0) cameraList.push(c);
          else cameraList[editing.i] = c;
          S.editing = null;
          cameraCamerasPersist(S, c.id);
        }
        var before = editing.i >= 0 ? cameraList[editing.i] : null;
        if (String(e.url || "").trim() && (!before || before.url !== e.url)) {
          cameraCamerasSay(S, i18nT('cameras.asking_the_camera_whether_it_s'));
          cameraDetect(e).then(function (text) { S.msg = text; follow(); });
        } else follow();
      }

      // Saves the whole list through the settings store, then chooses the camera (chooseId) or tells the viewer the list changed. The first camera
      // saved brings the viewer (cameraRefreshAddress asks the service again); a viewer that is already there is left alone.
      function cameraCamerasPersist(S, chooseId) {
        cameraCamerasSay(S, i18nT('common.saving'));
        cameraSaveList()
          .then(function () {
            S.msg = i18nT('common.saved');
          })
          .catch(function (er) {
            S.msg = i18nT('cameras.couldn_t_save_on_the_system_error', { error: er.message });
          })
          .then(function () {
            if (chooseId) cameraChoose(chooseId);
            else if (cameraChangeFn) cameraChangeFn(cameraChosen());
            cameraRefreshAddress();
            S.ctx.rerender();
            S.ctx.startup.refresh();
          });
      }
