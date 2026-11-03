      // ---- Page tab "Image" (informe-07) ----
      //
      // What the gear and the focus button of the floating viewer used to hold: a picture of the camera with the focus assistant (11-focus.js),
      // the orientation of the picture on this screen (16-orientation.js) and the settings of the ESP32-CAM (18-page-image-settings.js). For the
      // technician (feature "cameras"; the assistant also needs "focus"). The SERVICE applies the saved settings again when the camera restarts and
      // follows the job with the automatic profile (15-settings.js): that is behavior of the service, not interface.
      // The tab keeps ctx.state.image = { ctx, root, cam (the id of the camera this tab is on), urls: { id, u } | null (cameraUrls of it) }.

      function cameraImageTab(page, ctx) {
        var S = ctx.state.image || (ctx.state.image = { ctx: ctx, root: null, cam: cameraChosen().id, urls: null });
        studioCss(); // the rows, the sliders and the picture frame of the studio (18-tl-studio.js)
        var cam = cameraList.filter(function (c) { return c.id === S.cam; })[0] || cameraChosen();
        S.cam = cam.id;
        // ONE card (mockup 2026-11-01): the cameras, the picture with the profiles and the assistant, then Orientation and Fine tuning as subsections
        var card = studioCard(page, "mdi-camera-iris", i18nT('image.nav'), i18nT('image.lead'));
        S.root = card;
        if (cameraList.length > 1) card.appendChild(cameraImageChips(S));
        if (!S.urls || S.urls.id !== cam.id) {
          card.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
          cameraUrls(cam).then(function (u) {
            S.urls = { id: cam.id, u: u };
            S.ctx.rerender();
          });
          return;
        }
        var two = cameraEl("div", "");
        two.className = "ctl-live-two"; // the picture on the left, the profiles and the assistant on the right; one column when it is narrow
        var left = cameraEl("div", "min-width:0;");
        var right = cameraEl("div", "display:flex;flex-direction:column;gap:10px;min-width:0;");
        two.appendChild(left);
        two.appendChild(right);
        card.appendChild(two);
        cameraFocusCard(left, cam, S.urls.u, right, { go: ctx.go }); // 11-focus.js: the picture with its state and help, and the assistant when the view has it
        if (!cam.esp32) right.appendChild(cameraEl("div", null, i18nT('image.not_esp32'))).className = "ctl-muted";
        cameraImageOrientation(card, cam);
        if (cam.esp32) cameraImageSettings(card, cam, right); // the profiles go to the right column, the rest is the subsection Fine tuning
      }

      // One chip per camera: the tab shows one camera at a time.
      function cameraImageChips(S) {
        var chips = cameraEl("div", "margin-bottom:12px;");
        chips.className = "cst-chips";
        cameraList.forEach(function (c) {
          var b = cameraEl("button", null, c.name);
          b.type = "button";
          b.className = "cst-chip" + (c.id === S.cam ? " on" : "");
          b.addEventListener("click", function () {
            S.cam = c.id;
            S.ctx.rerender();
          });
          chips.appendChild(b);
        });
        return chips;
      }

      // The subsection "Orientation": it draws itself again (the preview above it is not redrawn).
      function cameraImageOrientation(card, cam) {
        var sub = cameraEl("div", "");
        sub.className = "wf-sub";
        sub.appendChild(cameraEl("div", "", i18nT('orientation.orientation'))).className = "wf-subt";
        sub.appendChild(cameraEl("div", null, cam.name + " · " + i18nT('orientation.this_screen_only'))).className = "ctl-muted";
        var holder = cameraEl("div", "");
        sub.appendChild(holder);
        card.appendChild(sub);
        function paint() {
          holder.textContent = "";
          holder.appendChild(cameraOrientControls(cam, paint));
        }
        paint();
      }
