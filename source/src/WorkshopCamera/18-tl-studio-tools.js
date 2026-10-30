      // ---- Studio: burst of captures and rebuilding a video from its kept stills (phase 2, 2026-10-24; see 18-tl-studio.js) ----

      var STUDIO_BURST_COUNTS = [3, 5, 10, 20, 30];
      var STUDIO_BURST_GAPS = [0.5, 1, 2, 5];

      function studioBurstCard(parent, S) {
        var keep = cameraTlStudio.keep;
        var c = studioCard(parent, "mdi-camera-burst", i18nT("studio.burst"), i18nT("studio.burst_hint"));
        var box = { t: { count: keep.burstCount || 5, gap: keep.burstGap || 1 }, rerender: function () {
          keep.burstCount = box.t.count;
          keep.burstGap = box.t.gap;
          S.rerender();
        } };
        c.appendChild(studioRow(i18nT("studio.burst_count"), studioSelect(box, "count", STUDIO_BURST_COUNTS.map(function (n) { return [n, String(n)]; }), true)));
        c.appendChild(studioRow(i18nT("studio.burst_gap"), studioSelect(box, "gap", STUDIO_BURST_GAPS.map(function (g) { return [g, g + " s"]; }), true)));
        keep.burstCount = box.t.count;
        keep.burstGap = box.t.gap;
        c.appendChild(cameraBtn(i18nT("studio.burst_go"), "align-self:flex-start;", function () {
          keep.burstCount = box.t.count;
          keep.burstGap = box.t.gap;
          cameraPost("/burst?c=" + encodeURIComponent(S.cam || "main") + "&count=" + box.t.count + "&gap=" + box.t.gap).then(function (d) {
            S.notice(d.ok ? i18nT("studio.burst_started", { count: d.count }) : i18nT("common.couldn_t_error", { error: d.error || "" }), !!d.ok);
          }).catch(function (e) { S.notice(i18nT("common.couldn_t_error", { error: String(e.message || e) }), false); });
        }));
        return c;
      }

      // The videos that kept their stills can be built again with the settings now on screen (the original stays).
      function studioRebuildCard(parent, S) {
        var keep = cameraTlStudio.keep;
        var c = studioCard(parent, "mdi-movie-refresh-outline", i18nT("studio.rebuild"), i18nT("studio.rebuild_hint"));
        var body = cameraEl("div", "display:flex;flex-direction:column;gap:8px;");
        c.appendChild(body);
        fetch(cameraRelayBase() + "/timelapses", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (all) {
          var list = (all || []).filter(function (v) { return v.frames_zip; });
          if (!list.length) {
            body.appendChild(cameraEl("div", null, i18nT("studio.rebuild_none"))).className = "ctl-muted";
            return;
          }
          if (!list.some(function (v) { return v.file === keep.rebuild; })) keep.rebuild = list[0].file;
          var sel = cameraEl("select", CAMERA_CSS_SEL);
          list.forEach(function (v) {
            var o = cameraEl("option", null, (v.name || v.job || v.file) + " (" + v.file + ")");
            o.value = v.file;
            if (v.file === keep.rebuild) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("change", function () { keep.rebuild = sel.value; });
          body.appendChild(studioRow(i18nT("studio.rebuild_pick"), sel));
          body.appendChild(cameraBtn(i18nT("studio.rebuild_go"), "align-self:flex-start;", function () {
            fetch(cameraRelayBase() + "/rerender?file=" + encodeURIComponent(sel.value) + "&cfg=" + encodeURIComponent(JSON.stringify(studioTake(S.t))), { method: "POST" })
              .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
              .then(function (d) {
                S.notice(d.ok ? i18nT("studio.rebuild_started") : i18nT("common.couldn_t_error", { error: d.error || "" }), !!d.ok);
              })
              .catch(function (e) { S.notice(i18nT("common.couldn_t_error", { error: String(e.message || e) }), false); });
          }));
        });
        return c;
      }
