      // ---- Image orientation (2026-10-10) ----
      //
      // Request: "the image is badly oriented: it looks different standing in front of the
      // PC than in front of the printer; a manual adjustment and an Auto mode". It is
      // saved per camera and per SCREEN (localStorage): it depends on where the
      // viewer is standing. By hand: rotate 0/90/180/270 and mirror horizontally or
      // vertically. Auto: Vision (GET :8095/orientacion) knows, through its calibration,
      // how to leave the image as seen standing in front of the machine (X+ to the
      // right, Y+ toward the back). Only for the camera calibrated in Vision.

      var CAMERA_ORIENT_KEY = "workshopCameraOrient";
      var cameraOrientApplyFn = null; // set by the viewer (10-camera.js)
      var cameraOrientVision = null; // ultima respuesta de Vision {giro, espejo} o {error}

      function cameraOrientAll() {
        try {
          return JSON.parse(localStorage.getItem(CAMERA_ORIENT_KEY) || "{}") || {};
        } catch (e) {
          return {};
        }
      }
      function cameraOrientSave(id, o) {
        var t = cameraOrientAll();
        t[id] = o;
        try {
          localStorage.setItem(CAMERA_ORIENT_KEY, JSON.stringify(t));
        } catch (e) {
          /*  no storage: valid until reload */
        }
        if (cameraOrientApplyFn) cameraOrientApplyFn();
      }
      // {giro, h, v} to apply now (Auto uses the last thing Vision said)
      function cameraOrientOf(camera) {
        var t = cameraOrientAll();
        var o = (camera && (t[camera.id] || (camera.id === "main" && t.main))) || null;
        if (!o) return { rotation: 0, h: false, v: false };
        // Auto asks the Vision plugin: without it there is no Auto (the saved choice counts as no rotation)
        if (o.auto && !workshopPathExists("/Plugins/Vision")) return { rotation: 0, h: false, v: false };
        if (o.auto) {
          if (cameraOrientVision && cameraOrientVision.ok) return { rotation: cameraOrientVision.rotation || 0, h: !!cameraOrientVision.mirror, v: false };
          if (!cameraOrientVision) cameraOrientRequestVision();
          return { rotation: 0, h: false, v: false };
        }
        return { rotation: o.rotation || 0, h: !!o.h, v: !!o.v };
      }
      function cameraOrientRequestVision() {
        return workshopApi("vision.get", { path: "/orientation" }, { noLogin: true, quiet: true }) // through the service: with users on, Vision refuses a call from the page
          .then(function (r) {
            return r;
          })
          .catch(function () {
            return { ok: false, error: i18nT('orientation.vision_not_answering') };
          })
          .then(function (d) {
            cameraOrientVision = d || { ok: false, error: i18nT('common.no_response') };
            if (cameraOrientApplyFn) cameraOrientApplyFn();
            return cameraOrientVision;
          });
      }

      // Controls (in the cameras sheet, for the camera being viewed)
      function cameraOrientControls(camera, rerender) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12);font-size:12px;");
        var tit = cameraEl("div", "display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;");
        tit.appendChild(cameraEl("span", "font-weight:bold;font-size:13px;", i18nT('orientation.orientation')));
        tit.appendChild(cameraEl("span", "color:#b0bec5;", camera.name));
        tit.appendChild(cameraEl("span", "color:#b0bec5;", i18nT('orientation.this_screen_only')));
        box.appendChild(tit);
        var o = cameraOrientAll()[camera.id] || { rotation: 0, h: false, v: false, auto: false };
        var hasVision = workshopPathExists("/Plugins/Vision"); // the Auto option and its hints are about the Vision plugin
        if (!hasVision && o.auto) o = { rotation: 0, h: false, v: false, auto: false };
        var on = "background:#1976d2;color:#fff;border:1px solid #1976d2;";
        var fila1 = cameraEl("div", "display:flex;gap:4px;flex-wrap:wrap;");
        if (hasVision) fila1.appendChild(cameraBtn(i18nT('orientation.auto'), o.auto ? on : "", function () {
          cameraOrientSave(camera.id, { auto: true });
          cameraOrientRequestVision().then(rerender);
        }));
        [0, 90, 180, 270].forEach(function (g) {
          fila1.appendChild(cameraBtn(g + "°", !o.auto && (o.rotation || 0) === g ? on : "", function () {
            cameraOrientSave(camera.id, { rotation: g, h: !!o.h && !o.auto, v: !!o.v && !o.auto });
            rerender();
          }));
        });
        box.appendChild(fila1);
        var fila2 = cameraEl("div", "display:flex;gap:4px;flex-wrap:wrap;");
        fila2.appendChild(cameraBtn(i18nT('common.horizontal_mirror'), !o.auto && o.h ? on : "", function () {
          cameraOrientSave(camera.id, { rotation: o.auto ? 0 : o.rotation || 0, h: o.auto ? true : !o.h, v: o.auto ? false : !!o.v });
          rerender();
        }));
        fila2.appendChild(cameraBtn(i18nT('orientation.mirror_vertically'), !o.auto && o.v ? on : "", function () {
          cameraOrientSave(camera.id, { rotation: o.auto ? 0 : o.rotation || 0, h: o.auto ? false : !!o.h, v: o.auto ? true : !o.v });
          rerender();
        }));
        box.appendChild(fila2);
        if (o.auto) {
          var v = cameraOrientVision;
          box.appendChild(
            cameraEl(
              "div",
              "color:" + (v && v.ok ? "#a5d6a7" : "#ffb74d") + ";",
              !v ? i18nT('orientation.asking_vision') : v.ok ? i18nT('orientation.auto_as_seen_standing_in_front') : i18nT('orientation.auto_not_available', { error: v.error || i18nT('orientation.vision_not_answering') })
            )
          );
          if (v && v.ok && v.notice) box.appendChild(cameraEl("div", "color:#b0bec5;", v.notice));
        } else if (hasVision) {
          box.appendChild(cameraEl("div", "color:#b0bec5;", i18nT('orientation.auto_uses_the_vision_calibration_only')));
        }
        return box;
      }
