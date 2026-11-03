      // ---- Profiles and "Fine tuning" of the tab Image (informe-07: it was the card "Camera settings", the sheet of the viewer's gear; informe-06 B-P6: the service keeps the settings) ----
      //
      // Profiles and fine tuning of the ESP32-CAM. What is chosen is saved by the service for every screen and applied again by it when the camera
      // restarts (15-settings.js: camera.image.get / camera.image.set), so this only asks and draws what the service answers. It draws ITSELF
      // again: it never redraws the page, so the preview and the focus assistant next to it keep running.
      // The profiles are chips in the right column (`side`, next to the picture); the rest is the subsection "Fine tuning" of the card.
      // I = { cam (the id of the camera), data (the answer of camera.image.get, null while it is read), error, msg, busy, holder (the subsection), profs (the chips) }

      function cameraImageSettings(card, cam, side) {
        var profs = cameraEl("div", "display:flex;flex-direction:column;gap:8px;");
        profs.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
        (side || card).appendChild(profs);
        var sub = cameraEl("div", "");
        sub.className = "wf-sub";
        sub.appendChild(cameraEl("div", "", i18nT('settings.fine_tuning'))).className = "wf-subt";
        sub.appendChild(cameraEl("div", null, i18nT('settings.what_you_change_here_is_saved'))).className = "ctl-muted";
        var holder = cameraEl("div", "display:flex;flex-direction:column;gap:8px;");
        sub.appendChild(holder);
        card.appendChild(sub);
        var I = { cam: cam.id, data: null, error: "", msg: "", busy: false, holder: holder, profs: profs };
        cameraImageLoad(I);
        return I;
      }

      // Asks the service how the camera is and draws the card (a card that already left the screen is not drawn)
      function cameraImageLoad(I) {
        return cameraImageGet(I.cam)
          .then(function (d) {
            I.data = d && d.ok ? d : null;
            I.error = d && d.ok ? "" : (d && d.error) || "";
          })
          .catch(function (e) {
            I.data = null;
            I.error = String(e && e.message ? e.message : e);
          })
          .then(function () {
            if (I.holder.isConnected) cameraImagePaint(I);
          });
      }

      function cameraImagePaint(I) {
        I.holder.textContent = "";
        I.profs.textContent = "";
        if (!I.data) {
          I.holder.appendChild(cameraEl("div", "color:var(--c-notice,#ffb74d);", I.error || i18nT('common.no_response')));
          return;
        }
        var color = I.data.reachable ? "var(--c-green,#a5d6a7)" : "var(--c-notice,#ffb74d)";
        I.holder.appendChild(cameraEl("div", "color:" + color + ";", I.data.reachable ? i18nT('settings.camera_connected') : i18nT('settings.the_camera_isn_t_responding_off')));
        cameraImageProfiles(I);
        cameraImageFine(I);
        if (I.msg) I.holder.appendChild(cameraEl("div", "color:var(--c-amber,#ffe082);", I.msg));
      }

      // Asks the service to apply and save a change ({profile}, {settings}, {auto}); the answer says how the camera is now
      function cameraImageApply(I, patch) {
        if (I.busy) return;
        I.busy = true;
        I.msg = i18nT('settings.applying');
        cameraImagePaint(I);
        cameraImageSet(I.cam, patch)
          .then(function (d) {
            if (d && d.ok) {
              I.data = d;
              I.msg = i18nT('settings.done_saved_for_all_screens');
            } else {
              I.msg = i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: (d && d.error) || "" });
            }
          })
          .catch(function (e) {
            I.msg = i18nT('settings.the_camera_didn_t_respond_is_it_on', { error: String(e && e.message ? e.message : e) });
          })
          .then(function () {
            I.busy = false;
            cameraImagePaint(I);
          });
      }

      function cameraImageChip(text, color) {
        return cameraEl("span", "font-size:10px;background:" + color + ";color:#000;border-radius:8px;padding:1px 6px;font-weight:500;", text);
      }

      // The profiles of the service as compact chips, the active one marked and only ITS description under them; one tap applies and saves it.
      // "suggested now" follows what the machine is doing; the switch below lets the service change it by itself.
      function cameraImageProfiles(I) {
        var d = I.data, box = I.profs;
        box.appendChild(cameraEl("div", "font-size:12px;opacity:.7;", i18nT('settings.profiles')));
        var chips = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
        var activeId = !Object.keys(d.settings).length ? d.profile : null;
        d.profiles.forEach(function (p) {
          var chip = cameraBtn(cameraProfileInfo(p.id)[0], activeId === p.id ? "border:1px solid #1976d2;" : "", function () { cameraImageApply(I, { profile: p.id }); });
          chip.className += " ctl-profile-chip";
          chip.setAttribute("aria-pressed", activeId === p.id ? "true" : "false");
          if (p.id === d.suggested) chip.appendChild(cameraImageChip(i18nT('settings.suggested_now'), "#66bb6a"));
          if (activeId === p.id) chip.appendChild(cameraImageChip(i18nT('settings.in_use'), "#42a5f5"));
          chips.appendChild(chip);
        });
        box.appendChild(chips);
        if (activeId) box.appendChild(cameraEl("div", null, cameraProfileInfo(activeId)[1])).className = "ctl-muted";
        var label = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;");
        var cb = cameraEl("input", "width:18px;height:18px;flex:none;");
        cb.type = "checkbox";
        cb.checked = !!d.auto;
        cb.addEventListener("change", function () { cameraImageApply(I, { auto: cb.checked }); });
        label.appendChild(cb);
        label.appendChild(cameraEl("span", null, i18nT('settings.switch_automatically_to_the_suggested_one')));
        box.appendChild(label);
      }

      // The fine tuning: the resolution, the sliders and the switches of the camera (what the camera answered is what they show).
      function cameraImageFine(I) {
        var h = I.holder;
        h.appendChild(studioRow(i18nT('settings.resolution'), cameraImageResolution(I)));
        h.appendChild(studioRow(i18nT('settings.quality_left_better'), cameraImageSlider(I, "quality", 8, 40)));
        h.appendChild(studioRow(i18nT('settings.brightness'), cameraImageSlider(I, "brightness", -2, 2)));
        h.appendChild(studioRow(i18nT('settings.contrast'), cameraImageSlider(I, "contrast", -2, 2)));
        h.appendChild(studioRow(i18nT('settings.saturation'), cameraImageSlider(I, "saturation", -2, 2)));
        h.appendChild(studioRow(i18nT('settings.exposure'), cameraImageSlider(I, "ae_level", -2, 2)));
        h.appendChild(studioRow(i18nT('settings.auto_exposure'), cameraImageSwitch(I, "aec")));
        h.appendChild(studioRow(i18nT('settings.auto_gain'), cameraImageSwitch(I, "agc")));
        h.appendChild(studioRow(i18nT('settings.gain_limit'), cameraImageSlider(I, "gainceiling", 0, 6)));
        h.appendChild(studioRow(i18nT('settings.auto_white_balance'), cameraImageSwitch(I, "awb")));
        h.appendChild(studioRow(i18nT('common.horizontal_mirror'), cameraImageSwitch(I, "hmirror")));
        h.appendChild(studioRow(i18nT('settings.flip_vertical'), cameraImageSwitch(I, "vflip")));
      }

      // what the camera has now for one variable (null when it did not answer)
      function cameraImageLive(I, variable) {
        return I.data.live && I.data.live[variable] != null ? I.data.live[variable] : null;
      }

      function cameraImageResolution(I) {
        var sel = cameraEl("select", CAMERA_CSS_SEL + "min-width:0;max-width:100%;");
        var current = cameraImageLive(I, "framesize");
        I.data.resolutions.forEach(function (r) {
          var o = cameraEl("option", null, cameraResolutionText(r));
          o.value = r.name;
          if (r.number === current) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () { cameraImageApply(I, { settings: { framesize: sel.value } }); });
        return sel;
      }

      function cameraImageSlider(I, variable, min, max) {
        var input = cameraEl("input", "width:100%;min-width:0;accent-color:#1976d2;");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = "1";
        input.value = cameraImageLive(I, variable) != null ? cameraImageLive(I, variable) : 0;
        input.addEventListener("change", function () {
          var a = {};
          a[variable] = parseInt(input.value, 10);
          cameraImageApply(I, { settings: a });
        });
        return input;
      }

      function cameraImageSwitch(I, variable) {
        var input = cameraEl("input", "width:18px;height:18px;");
        input.type = "checkbox";
        input.checked = !!cameraImageLive(I, variable);
        input.addEventListener("change", function () {
          var a = {};
          a[variable] = input.checked ? 1 : 0;
          cameraImageApply(I, { settings: a });
        });
        return input;
      }
