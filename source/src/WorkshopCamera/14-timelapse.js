      // ---- Timelapse: by hand, several cameras and how it is assembled (2026-10-10) ----
      //
      // Request: "from where do I start a timelapse and choose how I want it, I have
      // several cameras, can I assemble with nice transitions". The relay
      // (camera_relay.py) records up to 4 cameras at once and when finished it builds:
      // one video per camera, a mosaic or a single one that alternates between cameras
      // with a fade; with an opening title (name and date) and a still end card.
      // It starts by itself with each job or by hand (POST /timelapse), from the
      // "Captures and timelapse" sheet or the viewer's record button.

      var CAMERA_TL_MAX = 4;

      function cameraTimelapse(action, nombre, extra) {
        var q = "?action=" + action + (nombre ? "&name=" + encodeURIComponent(nombre) : "") + (extra || "");
        return fetch(cameraRelayBase() + "/timelapse" + q, { method: "POST" }).then(function (r) {
          return r.json().catch(function () {
            return { ok: false, error: "HTTP " + r.status };
          });
        });
      }

      function cameraTlNames(ids) {
        var cs = (cameraState && cameraState.cameras) || [];
        return (ids || []).map(function (id) {
          id = cameraId(id);
          for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i].name;
          return id;
        });
      }

      function cameraFmtDoes(s) {
        s = Math.max(0, Math.round(s || 0));
        return s >= 3600 ? Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min" : s >= 60 ? Math.floor(s / 60) + " min" : s + " s";
      }

      // Timelapse state + start / stop. It repaints with /estado (every 3 s
      // with the viewer open) and stops listening when it leaves the page.
      function cameraTlBox(alFinish) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:6px;");
        var nombre = "";
        var busy = false;
        var notice = "";
        var before = null;
        var estuvo = false;
        var armandoAntes = (cameraState && cameraState.timelapse && cameraState.timelapse.assembling) || null;

        function paint() {
          if (box.isConnected) estuvo = true;
          else if (estuvo) {
            // the sheet was redrawn or closed: this box is no longer visible
            cameraStateListeners = cameraStateListeners.filter(function (f) {
              return f !== paint;
            });
            return;
          }
          var tl = (cameraState && cameraState.timelapse) || {};
          // a video finished assembling: the list below must show it
          var ended = armandoAntes && !tl.assembling;
          armandoAntes = tl.assembling;
          if (ended && alFinish) setTimeout(alFinish, 0);
          var key = JSON.stringify([tl.recording, tl.assembling, tl.frames, tl.job, busy, notice, tl.scheduled]);
          if (key === before) return;
          before = key;
          box.textContent = "";
          if (tl.recording) {
            var g = cameraEl("div", "padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(239,83,80,0.5);display:flex;flex-direction:column;gap:3px;font-size:12px;");
            var t1 = cameraEl("div", "display:flex;align-items:center;gap:6px;font-weight:bold;font-size:13px;");
            t1.appendChild(cameraEl("span", "width:10px;height:10px;border-radius:50%;background:#ef5350;flex:none;"));
            t1.appendChild(cameraEl("span", null, i18nT('common.recording')));
            t1.appendChild(cameraEl("span", "font-weight:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", tl.job || ""));
            g.appendChild(t1);
            var t2 = cameraEl("div", "color:var(--c-text,#cfd8dc);");
            t2.appendChild(cameraEl("span", null, String(tl.frames || 0)));
            t2.appendChild(document.createTextNode(" "));
            t2.appendChild(cameraEl("span", null, i18nT('timelapse.frames')));
            t2.appendChild(document.createTextNode(" · " + cameraFmtDoes(tl.since_s) + " · " + cameraTlNames(tl.cameras).join(", ")));
            g.appendChild(t2);
            g.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", tl.manual ? i18nT('timelapse.started_by_hand_keeps_going_until') : i18nT('timelapse.from_the_current_job_it_ends')));
            if (tl.max_min) g.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);", i18nT('timelapse.stops_by_itself_after_max', { t: cameraFmtDoes(tl.max_min * 60) })));
            var bp = cameraBtn(busy ? i18nT('timelapse.stopping') : i18nT('timelapse.stop_and_build_the_video'), "background:#c62828;color:#fff;align-self:flex-start;", function () {
              if (busy) return;
              busy = true;
              notice = "";
              paint();
              cameraTimelapse("stop")
                .then(function (d) {
                  notice = d.ok ? i18nT('timelapse.stopped_the_video_is_built_on') : i18nT('common.couldn_t_error', { error: d.error || "" });
                })
                .catch(function (e) {
                  notice = i18nT('common.couldn_t_error', { error: String(e.message || e) });
                })
                .then(function () {
                  busy = false;
                  return cameraStateRead();
                })
                .then(function () {
                  paint();
                  if (alFinish) alFinish();
                });
            });
            g.appendChild(bp);
            box.appendChild(g);
          } else {
            if (tl.assembling) box.appendChild(cameraEl("div", "padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,0.35);font-size:12px;", i18nT('timelapse.building_the_timelapse_video')));
            var row = cameraEl("div", "display:flex;gap:6px;align-items:center;");
            var inp = cameraEl("input", "flex:1;min-width:0;min-height:32px;padding:4px 8px;border-radius:6px;border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));background:var(--c-field,#1e272c);color:var(--c-text,#fff);font:inherit;");
            inp.placeholder = i18nT('timelapse.name_optional');
            inp.maxLength = 60;
            inp.value = nombre;
            inp.addEventListener("input", function () {
              nombre = inp.value;
            });
            row.appendChild(inp);
            row.appendChild(
              cameraBtn(busy ? i18nT('timelapse.starting') : i18nT('timelapse.start_now'), "background:#1976d2;color:#fff;", function () {
                if (busy) return;
                busy = true;
                notice = "";
                paint();
                cameraTimelapse("begin", nombre.trim())
                  .then(function (d) {
                    notice = d.ok ? "" : i18nT('common.couldn_t_error', { error: d.error || "" });
                    if (d.ok) nombre = "";
                  })
                  .catch(function (e) {
                    notice = i18nT('common.couldn_t_error', { error: String(e.message || e) });
                  })
                  .then(function () {
                    busy = false;
                    return cameraStateRead();
                  })
                  .then(paint);
              })
            );
            box.appendChild(row);
            box.appendChild(cameraEl("div", "font-size:11px;color:var(--c-sec,#b0bec5);", i18nT('timelapse.by_hand_records_with_the_cameras')));
            if (tl.disk_free_gb != null)
              box.appendChild(cameraEl("div", "font-size:11px;color:" + (tl.disk_free_gb < 4 ? "var(--c-notice,#ffb74d)" : "var(--c-sec,#b0bec5)") + ";",
                i18nT('timelapse.free_space_on_the_system', { gb: tl.disk_free_gb })));
          }
          if (tl.scheduled) {
            var pr = tl.scheduled;
            var tp = cameraEl("div", "display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--c-blue,#90caf9);");
            tp.appendChild(cameraEl("span", null, pr.since && !pr.started
              ? (pr.until ? i18nT('timelapse.scheduled_starts_and_stops', { start: cameraDateTl(pr.since), end: cameraDateTl(pr.until) }) : i18nT('timelapse.scheduled_starts', { start: cameraDateTl(pr.since) }))
              : (pr.until ? i18nT('timelapse.scheduled_stops', { end: cameraDateTl(pr.until) }) : i18nT('timelapse.scheduled_dot'))));
            tp.appendChild(cameraBtn(i18nT('timelapse.cancel_schedule'), "", function () {
              cameraTimelapse("unschedule").then(cameraStateRead).then(paint);
            }));
            box.appendChild(tp);
          }
          if (notice) box.appendChild(cameraEl("div", "font-size:12px;color:var(--c-amber,#ffe082);", notice));
        }

        cameraStateListeners.push(paint);
        paint();
        return box;
      }

      // Timelapse settings (over the sheet's draft; saved with
      // "Save settings"). t = borrador.timelapse.
      // parte: "grabar" (cameras, photos, duration), "video" (how it is assembled) or
      // nothing = both (2026-10-10: the settings are grouped in Settings).
      function cameraTlSettings(t, rerender, part) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:8px;margin:6px 0 0 " + (part ? "0" : "26px") + ";font-size:12px;");
        var verRecord = part !== "video", verVideo = part !== "record";
        var inputCss = "width:56px;padding:4px;border-radius:4px;border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));background:var(--c-field,#1e272c);color:var(--c-text,#fff);font:inherit;";
        var selCss = "padding:4px;border-radius:4px;background:var(--c-field,#1e272c);color:var(--c-text,#fff);border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));font:inherit;";
        // without a saved list it is "camara" (without touching the draft: it does not mark changes)
        var chosen = t.cameras && t.cameras.length ? t.cameras.slice() : [cameraId(t.camera || "main")];
        if (!t.armed) t.armed = "separate";
        if (t.segment_s == null) t.segment_s = 4;
        if (t.fade_s == null) t.fade_s = 0.8;
        if (t.title == null) t.title = true;
        if (t.final_s == null) t.final_s = 2;

        function line() {
          var l = cameraEl("div", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            l.appendChild(typeof a === "string" ? cameraEl("span", null, a) : a);
          }
          return l;
        }
        function numero(valor, min, max, paso, alChange) {
          var n = cameraEl("input", inputCss);
          n.type = "number";
          n.min = String(min);
          n.max = String(max);
          n.step = String(paso);
          n.value = valor;
          n.addEventListener("input", function () {
            var v = parseFloat(n.value);
            if (!isNaN(v)) alChange(Math.max(min, Math.min(max, v)));
          });
          n.addEventListener("change", rerender);
          return n;
        }
        function title(text) {
          return cameraEl("div", "font-weight:bold;color:var(--c-text,#cfd8dc);margin-top:2px;", text);
        }

        // -- camaras --
        if (verRecord) {
        box.appendChild(title(i18nT('timelapse.cameras_up_to_4')));
        var cs = ((cameraState && cameraState.cameras) || []).map(function (c) {
          return [c.id, c.name];
        });
        if (!cs.length) cs = [["main", i18nT('timelapse.main')]];
        var gridCams = cameraEl("div", "display:flex;flex-wrap:wrap;gap:6px;");
        cs.forEach(function (c) {
          var on = chosen.indexOf(c[0]) >= 0;
          var chip = cameraBtn(c[1], on ? "background:#1976d2;color:#fff;border:1px solid #1976d2;" : "", function () {
            var i = chosen.indexOf(c[0]);
            if (i >= 0) {
              if (chosen.length > 1) chosen.splice(i, 1);
            } else if (chosen.length < CAMERA_TL_MAX) chosen.push(c[0]);
            t.cameras = chosen;
            t.camera = chosen[0];
            rerender();
          });
          gridCams.appendChild(chip);
        });
        box.appendChild(gridCams);

        // -- photos: by time or one per layer (3D printing, only with jobs) --
        var selDisp = cameraEl("select", selCss);
        [["time", i18nT('timelapse.by_time')], ["layer", i18nT('timelapse.one_per_layer_3d_printing')]].forEach(function (o) {
          var op = cameraEl("option", null, o[1]);
          op.value = o[0];
          if (o[0] === (t.trigger || "time")) op.selected = true;
          selDisp.appendChild(op);
        });
        selDisp.addEventListener("change", function () {
          t.trigger = selDisp.value;
          rerender();
        });
        box.appendChild(line(i18nT('common.photos'), selDisp));
        if ((t.trigger || "time") === "layer")
          box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('timelapse.in_printing_jobs_it_takes_a')));
        box.appendChild(
          line((t.trigger || "time") === "layer" ? i18nT('timelapse.without_layers_by_hand_one_photo') : i18nT('common.one_photo_every'), numero(t.each_s || 10, 2, 600, 1, function (v) {
            t.each_s = Math.round(v);
          }), "s")
        );
        var ls = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;");
        var cs2 = cameraEl("input");
        cs2.type = "checkbox";
        cs2.checked = !!t.stamp;
        cs2.style.cssText = "width:18px;height:18px;";
        cs2.addEventListener("change", function () {
          t.stamp = cs2.checked;
          rerender();
        });
        ls.appendChild(cs2);
        ls.appendChild(document.createTextNode(i18nT('timelapse.date_and_time_written_on_each')));
        box.appendChild(ls);

        }
        // -- how it is assembled (with 2 or more cameras) --
        if (verVideo && chosen.length < 2 && part) {
          box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('timelapse.with_a_single_camera_you_get')));
        }
        if (verVideo && chosen.length > 1) {
          box.appendChild(title(i18nT('common.how_the_video_is_built')));
          var options = [
            ["separate", i18nT('timelapse.one_video_per_camera'), i18nT('timelapse.each_camera_in_its_own_video')],
            ["mosaic", i18nT('common.mosaic'), i18nT('timelapse.all_at_once_in_a_grid')],
            ["toggle", i18nT('timelapse.alternate_with_crossfade'), i18nT('timelapse.a_single_video_that_switches_from')],
          ];
          options.forEach(function (o) {
            var on = t.armed === o[0];
            var b = cameraEl("div", "display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:6px;cursor:pointer;border:1px solid " + (on ? "#1976d2" : "rgba(255,255,255,0.2)") + ";background:" + (on ? "rgba(25,118,210,0.22)" : "transparent") + ";");
            b.appendChild(cameraEl("div", "font-weight:bold;", o[1]));
            b.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", o[2]));
            b.addEventListener("click", function () {
              t.armed = o[0];
              rerender();
            });
            box.appendChild(b);
          });
          if (t.armed === "toggle") {
            box.appendChild(
              line(i18nT('timelapse.switch_camera_every'), numero(t.segment_s, 1, 60, 0.5, function (v) {
                t.segment_s = v;
              }), i18nT('timelapse.s_of_video'))
            );
            box.appendChild(
              line(i18nT('timelapse.crossfade_of'), numero(t.fade_s, 0, 3, 0.1, function (v) {
                t.fade_s = v;
              }), i18nT('timelapse.s_0_hard_cut'))
            );
          }
        }

        // -- cuanto puede grabar --
        if (verRecord) {
        box.appendChild(title(i18nT('timelapse.maximum_duration')));
        var selMax = cameraEl("select", selCss);
        [[15, "15 min"], [30, "30 min"], [60, "1 h"], [120, "2 h"], [240, "4 h"], [480, "8 h"], [720, "12 h"], [1440, "24 h"]].forEach(function (o) {
          var op = cameraEl("option", null, o[1]);
          op.value = String(o[0]);
          if (o[0] === (t.max_min || 720)) op.selected = true;
          selMax.appendChild(op);
        });
        selMax.addEventListener("change", function () {
          t.max_min = parseInt(selMax.value, 10) || 720;
          rerender();
        });
        box.appendChild(line(i18nT('common.stops_by_itself_after'), selMax));
        box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('timelapse.applies_to_manual_ones_and_to')));
        }
        if (!verVideo) return box;

        // -- video --
        box.appendChild(title(i18nT('common.video')));
        var sel = cameraEl("select", selCss);
        [[10, i18nT('timelapse.slow_10_frames_s')], [15, i18nT('timelapse.normal_15_frames_s')], [24, i18nT('timelapse.fast_24_frames_s')], [30, i18nT('timelapse.very_fast_30_frames_s')]].forEach(function (o) {
          var op = cameraEl("option", null, o[1]);
          op.value = String(o[0]);
          if (o[0] === (t.fps || 15)) op.selected = true;
          sel.appendChild(op);
        });
        if ([10, 15, 24, 30].indexOf(t.fps || 15) < 0) {
          var other = cameraEl("option", null, t.fps + " " + i18nT('common.frames_per_s'));
          other.value = String(t.fps);
          other.selected = true;
          sel.appendChild(other);
        }
        sel.addEventListener("change", function () {
          t.fps = parseInt(sel.value, 10) || 15;
          rerender();
        });
        box.appendChild(line(i18nT('common.speed'), sel));
        var lt = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;");
        var ct = cameraEl("input");
        ct.type = "checkbox";
        ct.checked = !!t.title;
        ct.style.cssText = "width:18px;height:18px;";
        ct.addEventListener("change", function () {
          t.title = ct.checked;
          rerender();
        });
        lt.appendChild(ct);
        lt.appendChild(document.createTextNode(i18nT('timelapse.name_and_date_at_the_start')));
        box.appendChild(lt);
        if (t.title) {
          // small at the bottom right (default) or large title in the center (2026-10-10)
          var selTit = cameraEl("select", selCss);
          [["small", i18nT('timelapse.small_bottom_right')], ["large", i18nT('timelapse.large_centered_the_video_pauses_for')]].forEach(function (o) {
            var op = cameraEl("option", null, o[1]);
            op.value = o[0];
            if (o[0] === (t.title_style || "small")) op.selected = true;
            selTit.appendChild(op);
          });
          selTit.addEventListener("change", function () {
            t.title_style = selTit.value;
            rerender();
          });
          var lTit = line(i18nT('timelapse.size'), selTit);
          lTit.style.marginLeft = "26px";
          box.appendChild(lTit);
        }
        var ld = cameraEl("label", "display:flex;align-items:center;gap:8px;min-height:28px;");
        var cd = cameraEl("input");
        cd.type = "checkbox";
        cd.checked = !!t.deflicker;
        cd.style.cssText = "width:18px;height:18px;";
        cd.addEventListener("change", function () {
          t.deflicker = cd.checked;
          rerender();
        });
        ld.appendChild(cd);
        ld.appendChild(document.createTextNode(i18nT('timelapse.smooth_light_changes_flicker_from_the')));
        box.appendChild(ld);
        box.appendChild(
          line(i18nT('timelapse.hold_still_at_the_end_for'), numero(t.final_s, 0, 10, 0.5, function (v) {
            t.final_s = v;
          }), "s")
        );

        var sec = Math.max(2, t.each_s || 10);
        var photos = Math.round(3600 / sec);
        var res = cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;");
        res.appendChild(cameraEl("span", null, i18nT('timelapse.one_hour_of_recording_gives')));
        res.appendChild(document.createTextNode(" " + photos + " "));
        res.appendChild(cameraEl("span", null, i18nT('timelapse.photos_per_camera_and')));
        res.appendChild(document.createTextNode(" " + Math.round(photos / (t.fps || 15)) + " s "));
        res.appendChild(cameraEl("span", null, i18nT('timelapse.of_video_the_video_is_built')));
        box.appendChild(res);
        return box;
      }

      function cameraDateTl(ts) {
        var d = new Date(ts * 1000);
        var dd = function (n) { return (n < 10 ? "0" : "") + n; };
        return dd(d.getDate()) + "/" + dd(d.getMonth() + 1) + " " + dd(d.getHours()) + ":" + dd(d.getMinutes());
      }

      // Schedule (2026-10-10, advanced functions): start and/or stop at a
      // time. Without "Starts" = starts now and stops at the time; without "Stops" = continues
      // until Stop or the maximum duration. The Pi does it (schedule.json).
      // same field look as the other inputs of the plugins (dark field, 32 px, dark picker)
      var CAMERA_CSS_FIELD = "min-height:32px;padding:4px 8px;border-radius:4px;border:1px solid var(--c-field-edge,rgba(255,255,255,0.3));background:var(--c-field,#1e272c);color:var(--c-text,#fff);font:inherit;box-sizing:border-box;color-scheme:dark;";
      function cameraTlSchedule(alChange) {
        var box = cameraEl("div", "display:flex;flex-direction:column;gap:8px;font-size:12px;");
        function field(text) {
          var f = cameraEl("label", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
          f.appendChild(cameraEl("span", "min-width:70px;", text));
          var i = cameraEl("input", CAMERA_CSS_FIELD + "min-width:170px;");
          i.type = "datetime-local";
          f.appendChild(i);
          box.appendChild(f);
          return i;
        }
        var iSince = field(i18nT('timelapse.starts'));
        var iUntil = field(i18nT('timelapse.stops'));
        var fn = cameraEl("label", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
        fn.appendChild(cameraEl("span", "min-width:70px;", i18nT('common.name')));
        var iNom = cameraEl("input", CAMERA_CSS_FIELD + "min-width:170px;");
        iNom.type = "text";
        iNom.maxLength = 60;
        iNom.placeholder = i18nT('timelapse.optional');
        fn.appendChild(iNom);
        box.appendChild(fn);
        var msg = cameraEl("div", "font-size:12px;");
        function ts(i) {
          return i.value ? Math.round(new Date(i.value).getTime() / 1000) : 0;
        }
        box.appendChild(cameraBtn(i18nT('common.schedule'), "background:#1976d2;color:#fff;align-self:flex-start;", function () {
          var d = ts(iSince), h = ts(iUntil);
          if (!d && !h) {
            msg.style.color = "var(--c-error,#ef9a9a)";
            msg.textContent = i18nT('timelapse.choose_the_start_time_the_stop');
            return;
          }
          cameraTimelapse("schedule", iNom.value.trim(), "&since=" + d + "&until=" + h).then(function (r) {
            msg.style.color = r.ok ? "var(--c-green,#a5d6a7)" : "var(--c-error,#ef9a9a)";
            msg.textContent = r.ok ? i18nT('timelapse.scheduled_the_system_starts_and_stops') : i18nT('common.couldn_t') + " " + (r.error || "");
            cameraStateRead();
            if (alChange) alChange();
          });
        }));
        box.appendChild(msg);
        box.appendChild(cameraEl("div", "color:var(--c-sec,#b0bec5);font-size:11px;", i18nT('timelapse.uses_the_cameras_and_layout_from')));
        return box;
      }
