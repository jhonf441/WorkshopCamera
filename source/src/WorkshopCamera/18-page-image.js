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
        if (cameraList.length > 1) page.appendChild(cameraImageChips(S));
        var grid = cameraEl("div", "");
        grid.className = "ctl-grid";
        S.root = grid;
        page.appendChild(grid);
        if (!S.urls || S.urls.id !== cam.id) {
          grid.appendChild(cameraEl("div", "", i18nT('common.reading'))).className = "ctl-muted";
          cameraUrls(cam).then(function (u) {
            S.urls = { id: cam.id, u: u };
            S.ctx.rerender();
          });
          return;
        }
        var u = S.urls.u;
        cameraFocusCard(grid, cam, u);
        cameraImageOrientation(grid, cam);
        if (cam.esp32) cameraImageSettings(grid, cam);
        else studioCard(grid, "mdi-tune-variant", i18nT('common.camera_settings'), i18nT('image.not_esp32'));
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

      // The orientation card: it draws itself again (the preview next to it is not redrawn).
      function cameraImageOrientation(grid, cam) {
        var card = studioCard(grid, "mdi-screen-rotation", i18nT('orientation.orientation'), cam.name + " · " + i18nT('orientation.this_screen_only'));
        var holder = cameraEl("div", "");
        card.appendChild(holder);
        function paint() {
          holder.textContent = "";
          holder.appendChild(cameraOrientControls(cam, paint));
        }
        paint();
      }
