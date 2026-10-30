      // ---- Studio: the cards of settings and the page itself (see 18-tl-studio.js) ----

      function studioCaptureCard(parent, S) {
        var t = S.t;
        var c = studioCard(parent, "mdi-timer-outline", i18nT("studio.capture"), i18nT("studio.capture_hint"));
        c.appendChild(studioRow(i18nT("studio.interval"), studioNumber(S, "each_s", 2, 600, 1, "s")));
        var ramp = Number(t.each_end_s) >= 2;
        c.appendChild(studioCheck({ t: { ramp: ramp }, rerender: function () {
          t.each_end_s = ramp ? 0 : Math.max(2, (t.each_s || 10) * 3);
          S.rerender();
        } }, "ramp", i18nT("studio.ramp")));
        if (ramp) {
          c.appendChild(studioRow(i18nT("studio.ramp_to"), studioNumber(S, "each_end_s", 2, 3600, 1, "s")));
          c.appendChild(studioRow(i18nT("studio.ramp_over"), studioNumber(S, "ramp_min", 1, 1440, 1, "min")));
          c.appendChild(cameraEl("div", null, i18nT("studio.ramp_hint"))).className = "ctl-muted";
        }
        c.appendChild(studioCheck(S, "stamp", i18nT("studio.stamp")));
        c.appendChild(studioCheck(S, "deflicker", i18nT("studio.deflicker")));
        c.appendChild(studioCheck(S, "keep_frames", i18nT("studio.keep_frames")));
        c.appendChild(cameraEl("div", null, i18nT("studio.keep_frames_hint"))).className = "ctl-muted";
        return c;
      }

      var STUDIO_ASPECTS = [["source", "studio.aspect_source"], ["16:9", "16:9"], ["1.85:1", "1.85:1"], ["2:1", "2:1"], ["2.39:1", "2.39:1 (cinemascope)"], ["4:3", "4:3"], ["1:1", "1:1"], ["4:5", "4:5"], ["9:16", "9:16 (vertical)"]];

      function studioFramingCard(parent, S) {
        var t = S.t;
        var c = studioCard(parent, "mdi-crop", i18nT("studio.framing"), i18nT("studio.framing_hint"));
        c.appendChild(studioRow(i18nT("studio.aspect"), studioSelect(S, "aspect", STUDIO_ASPECTS.map(function (a) {
          return [a[0], a[1].indexOf("studio.") === 0 ? i18nT(a[1]) : a[1]];
        }))));
        c.appendChild(studioRow(i18nT("studio.resolution"), studioSelect(S, "resolution", [[0, i18nT("studio.res_source")], [720, "720p"], [1080, "1080p"], [1440, "1440p"], [2160, "4K (2160p)"]], true)));
        var pct = function (v) { return Math.round(v * 100) + " %"; };
        if (t.aspect !== "source") {
          c.appendChild(studioRow(i18nT("studio.pan_x"), studioRange(S, "pan_x", 0, 1, 0.01, pct)));
          c.appendChild(studioRow(i18nT("studio.pan_y"), studioRange(S, "pan_y", 0, 1, 0.01, pct)));
        }
        c.appendChild(studioRow(i18nT("studio.stabilize"), studioSelect(S, "stabilize", [[0, i18nT("studio.off")], [1, i18nT("studio.stab_light")], [2, i18nT("studio.stab_strong")]], true)));
        if (t.stabilize > 0) c.appendChild(cameraEl("div", null, i18nT("studio.stabilize_hint"))).className = "ctl-muted";
        c.appendChild(cameraEl("div", "font-weight:500;margin-top:6px;", i18nT("studio.push")));
        c.appendChild(studioRow(i18nT("studio.zoom_start"), studioRange(S, "zoom_start", 1, 3, 0.05, function (v) { return "x" + v.toFixed(2); })));
        c.appendChild(studioRow(i18nT("studio.zoom_end"), studioRange(S, "zoom_end", 1, 3, 0.05, function (v) { return "x" + v.toFixed(2); })));
        if (t.zoom_start > 1 || t.zoom_end > 1) {
          c.appendChild(studioRow(i18nT("studio.end_x"), studioRange(S, "end_x", 0, 1, 0.01, pct)));
          c.appendChild(studioRow(i18nT("studio.end_y"), studioRange(S, "end_y", 0, 1, 0.01, pct)));
          c.appendChild(cameraEl("div", null, i18nT("studio.push_hint"))).className = "ctl-muted";
        }
        return c;
      }

      function studioLutRow(c, S) {
        var luts = (S.est && S.est.luts) || [];
        var opts = [["", i18nT("studio.lut_none")]].concat(luts.map(function (n) { return [n, n]; }));
        c.appendChild(studioRow("LUT", studioSelect(S, "lut", opts)));
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;align-items:center;");
        var file = cameraEl("input", "display:none;");
        file.type = "file";
        file.accept = ".cube";
        file.addEventListener("change", function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () {
            fetch(cameraRelayBase() + "/luts?name=" + encodeURIComponent(f.name), { method: "POST", body: rd.result })
              .then(function (r) { return r.json(); })
              .then(function (d) {
                S.notice(d.ok ? i18nT("studio.lut_saved") : i18nT("common.couldn_t_error", { error: d.error || "" }), !!d.ok);
                if (d.ok) { S.t.lut = f.name; S.reload(); }
              })
              .catch(function (e) { S.notice(i18nT("common.couldn_t_error", { error: String(e.message || e) }), false); });
          };
          rd.readAsArrayBuffer(f);
        });
        row.appendChild(file);
        row.appendChild(cameraBtn(i18nT("studio.lut_upload"), "", function () { file.click(); }));
        if (S.t.lut) {
          row.appendChild(cameraBtnDouble(i18nT("studio.lut_delete"), i18nT("common.delete_confirm"), "", function () {
            fetch(cameraRelayBase() + "/luts/remove?name=" + encodeURIComponent(S.t.lut), { method: "POST" })
              .then(function () { S.t.lut = ""; S.reload(); });
          }));
        }
        c.appendChild(row);
        c.appendChild(cameraEl("div", null, i18nT("studio.lut_hint"))).className = "ctl-muted";
      }

      function studioColorCard(parent, S) {
        var c = studioCard(parent, "mdi-palette-outline", i18nT("studio.color"), i18nT("studio.color_hint"));
        studioLutRow(c, S);
        var two = function (v) { return (v > 0 ? "+" : "") + v.toFixed(2); };
        c.appendChild(studioRow(i18nT("studio.brightness"), studioRange(S, "brightness", -0.3, 0.3, 0.01, two)));
        c.appendChild(studioRow(i18nT("studio.contrast"), studioRange(S, "contrast", 0.5, 2, 0.01, function (v) { return v.toFixed(2); })));
        c.appendChild(studioRow(i18nT("studio.saturation"), studioRange(S, "saturation", 0, 3, 0.01, function (v) { return v.toFixed(2); })));
        c.appendChild(studioRow("Gamma", studioRange(S, "gamma", 0.3, 3, 0.01, function (v) { return v.toFixed(2); })));
        c.appendChild(cameraBtn(i18nT("studio.reset_color"), "align-self:flex-start;", function () {
          S.t.brightness = 0; S.t.contrast = 1; S.t.saturation = 1; S.t.gamma = 1; S.t.lut = "";
          S.rerender();
        }));
        c.appendChild(cameraEl("div", "font-weight:500;margin-top:6px;", i18nT("studio.shutter")));
        c.appendChild(studioRow(i18nT("studio.blend"), studioRange(S, "blend", 1, 8, 1, function (v) { return v <= 1 ? i18nT("studio.off") : v + " " + i18nT("studio.frames"); })));
        c.appendChild(cameraEl("div", null, i18nT("studio.blend_hint"))).className = "ctl-muted";
        return c;
      }

      var STUDIO_CODECS = [["h264", "H.264 (MP4)"], ["h265", "H.265 / HEVC (MP4)"], ["prores", "Apple ProRes (MOV)"], ["dnxhr", "Avid DNxHR (MOV)"]];

      function studioDeliveryCard(parent, S) {
        var t = S.t;
        var c = studioCard(parent, "mdi-movie-open-cog-outline", i18nT("studio.delivery"), i18nT("studio.delivery_hint"));
        c.appendChild(studioRow(i18nT("studio.codec"), studioSelect(S, "codec", STUDIO_CODECS, false, (S.est && S.est.encoders) || null)));
        var q = [[1, i18nT("studio.q_draft")], [2, i18nT("studio.q_standard")], [3, i18nT("studio.q_high")], [4, i18nT("studio.q_master")]];
        c.appendChild(studioRow(i18nT("studio.quality"), studioSelect(S, "quality", q, true)));
        if (t.codec === "h264" || t.codec === "h265") c.appendChild(studioCheck(S, "bit10", i18nT("studio.bit10")));
        c.appendChild(studioRow(i18nT("studio.fps"), studioSelect(S, "fps", STUDIO_FPS, true)));
        c.appendChild(studioRow(i18nT("studio.fade_in"), studioNumber(S, "fade_in_s", 0, 10, 0.5, "s")));
        c.appendChild(studioRow(i18nT("studio.fade_out"), studioNumber(S, "fade_out_s", 0, 10, 0.5, "s")));
        c.appendChild(studioCheck(S, "title", i18nT("studio.title")));
        c.appendChild(studioRow(i18nT("studio.end_card"), studioNumber(S, "final_s", 0, 10, 0.5, "s")));
        c.appendChild(cameraEl("div", null, i18nT(t.codec === "prores" || t.codec === "dnxhr" ? "studio.codec_edit_hint" : "studio.codec_web_hint"))).className = "ctl-muted";
        return c;
      }

      // How much material an event gives with the present settings (the interval ramp is averaged)
      function studioEstimate(parent, S) {
        var t = S.t;
        var c = studioCard(parent, "mdi-calculator-variant-outline", i18nT("studio.estimate"), i18nT("studio.estimate_hint"));
        var hours = S.hours || 8;
        var box = cameraEl("div", "display:flex;gap:6px;align-items:center;");
        box.appendChild(cameraEl("span", "color:var(--c-sec);", i18nT("studio.event_of")));
        var sel = cameraEl("select", CAMERA_CSS_SEL);
        [1, 2, 4, 8, 12, 24].forEach(function (h) {
          var o = cameraEl("option", null, h + " h");
          o.value = String(h);
          if (h === hours) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () { S.hours = parseInt(sel.value, 10); cameraTlStudio.keep.hours = S.hours; S.rerender(); });
        box.appendChild(sel);
        c.appendChild(box);
        var every = Math.max(2, t.each_s || 10), end = Number(t.each_end_s) >= 2 ? t.each_end_s : every;
        var secs = hours * 3600, ramp = Math.min(secs, (t.ramp_min || 60) * 60);
        var frames = Math.round(ramp / ((every + end) / 2) + (secs - ramp) / end);
        var fps = parseFloat(t.fps) || 15;
        var cams = (t.cameras && t.cameras.length) || 1;
        var grid = cameraEl("div", "");
        grid.className = "cst-est";
        [[i18nT("studio.est_frames"), String(frames)], [i18nT("studio.est_video"), cameraFmtDoes(frames / fps)],
         [i18nT("studio.est_speed"), "x" + Math.round(secs / Math.max(1, frames / fps))],
         [i18nT("studio.est_stills"), t.keep_frames ? "~" + Math.round(frames * cams * 0.15) + " MB" : "-"]].forEach(function (e) {
          var d = cameraEl("div", "");
          d.appendChild(cameraEl("span", "color:var(--c-sec);font-size:11px;", e[0]));
          d.appendChild(cameraEl("b", null, e[1]));
          grid.appendChild(d);
        });
        c.appendChild(grid);
        if (frames >= 20000) c.appendChild(cameraEl("div", "color:var(--c-notice);font-size:12px;", i18nT("studio.est_limit")));
        return c;
      }

      function studioActions(parent, S) {
        var c = studioCard(parent, "mdi-rocket-launch-outline", i18nT("studio.take"), i18nT("studio.take_hint"));
        var name = cameraEl("input", CAMERA_CSS_SEL + "width:100%;box-sizing:border-box;");
        name.placeholder = i18nT("timelapse.name_optional");
        name.maxLength = 60;
        c.appendChild(name);
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;");
        row.appendChild(cameraBtn(i18nT("studio.record_take"), "background:#c62828;color:#fff;", function () { S.startTake(name.value.trim()); }));
        var changed = S.cfg && JSON.stringify(S.cfg) !== JSON.stringify(S.draft);
        row.appendChild(cameraBtn(i18nT("tlSettings.save_settings"), changed ? "background:#1976d2;color:#fff;" : "", function () { S.save(S.draft); }));
        if (changed) row.appendChild(cameraBtn(i18nT("tlSettings.discard_changes"), "", function () { S.undo(); }));
        c.appendChild(row);
        c.appendChild(cameraEl("div", null, changed ? i18nT("tlSettings.there_are_unsaved_changes") : i18nT("studio.take_saved_hint"))).className = "ctl-muted";
        return c;
      }

      // c = { draft, cfg, est, rerender, notice(text, ok), reload(), go(tab), saved(config), discard() } (17-gallery.js ctx())
      function cameraStudioSaver(c) {
        return function (b) {
          c.notice(i18nT('common.saving'));
          cameraService(b)
            .then(function (r) {
              c.saved(r);
              c.notice(i18nT('common.settings_saved_on_the_system_they'));
            })
            .catch(function (e) { c.notice(i18nT('common.could_not_save') + (e.message || e), false); });
        };
      }

      function cameraStudioPage(page, c) {
        if (!c.draft) {
          page.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('gallery.reading_the_system_s_settings')));
          return;
        }
        page.appendChild(cameraTlStudio({
          draft: c.draft, cfg: c.cfg, est: c.est, rerender: c.rerender, notice: c.notice, reload: c.reload, save: cameraStudioSaver(c),
          undo: function () { c.discard(); c.rerender(); },
          startTake: function (name) {
            cameraTimelapse("begin", name, "&cfg=" + encodeURIComponent(JSON.stringify(studioTake(c.draft.timelapse))))
              .then(function (d) {
                c.notice(d.ok ? i18nT('studio.take_started') : i18nT('common.couldn_t_error', { error: d.error || "" }), !!d.ok);
                if (d.ok) cameraStateRead().then(function () { c.go("record"); c.reload(); });
              })
              .catch(function (e) { c.notice(i18nT('common.couldn_t_error', { error: String(e.message || e) }), false); });
          },
        }));
      }

      // o = { draft, cfg, est, rerender, save(b), undo(), notice(text, ok), reload(), startTake(name) }
      function cameraTlStudio(o) {
        studioCss();
        if (!cameraTlStudio.keep) cameraTlStudio.keep = {};
        var S = { draft: o.draft, cfg: o.cfg, est: o.est, t: o.draft.timelapse, rerender: o.rerender, save: o.save, undo: o.undo, notice: o.notice,
                  reload: o.reload, startTake: o.startTake, cam: cameraTlStudio.keep.cam, hours: cameraTlStudio.keep.hours, preview: function () {} };
        var root = cameraEl("div", "");
        root.className = "cst-cols";
        var left = cameraEl("div", "display:flex;flex-direction:column;gap:12px;min-width:0;");
        var right = cameraEl("div", "display:flex;flex-direction:column;gap:12px;min-width:0;");
        studioPreviewCard(left, S);
        studioPresetsCard(left, S);
        studioActions(left, S);
        studioEstimate(left, S);
        studioBurstCard(left, S);
        studioRebuildCard(left, S);
        studioCaptureCard(right, S);
        studioFramingCard(right, S);
        studioColorCard(right, S);
        studioDeliveryCard(right, S);
        root.appendChild(left);
        root.appendChild(right);
        cameraTlStudio.keep.cam = S.cam;
        cameraTlStudio.keep.hours = S.hours;
        return root;
      }
