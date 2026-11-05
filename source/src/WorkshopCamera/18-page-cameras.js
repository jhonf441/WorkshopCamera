      // ---- Page tab "Cameras" (informe-07) ----
      //
      // What the gear of the floating viewer used to open: the list of cameras (the one this screen shows, add, edit, remove), the search on the
      // network and "See all" (the mosaic). The control of the system relay (state, stop, start) is not in this plugin: it belongs to the service
      // (its page and an optional tile of the control bar); the tab only reads the relay's state to say where each camera's video comes from. The viewer only looks now;
      // the setting of the cameras is here, for the technician (feature "cameras" of 09-camera-roles.js).
      // One plain object holds the tab between redraws of the page (ctx.state.cameras); the functions take it (docs-internal/ARQUITECTURA.md):
      //   S = { ctx, root (the grid on screen), editing: { i, c } | null (i < 0: a new camera), msg, scanOpen, scan: { box, status } | null,
      //         rs (the relay model of 12-relay.js) }

      function cameraCamerasState(ctx) {
        var S = { ctx: ctx, root: null, editing: null, msg: "", scanOpen: false, scan: null, rs: null };
        S.rs = cameraRelayModel(
          function () { return !!(S.root && S.root.isConnected); },
          function () { ctx.rerender(); },
          function () { ctx.rerender(); ctx.startup.refresh(); }
        );
        cameraRelayLoad(S.rs);
        cameraLoadList().then(function () { ctx.rerender(); });
        return S;
      }

      function cameraCamerasTab(page, ctx) {
        var S = ctx.state.cameras || (ctx.state.cameras = cameraCamerasState(ctx));
        var grid = cameraEl("div", "");
        grid.className = "ctl-grid";
        S.root = grid;
        page.appendChild(grid);
        cameraCamerasListCard(grid, S);
        if (S.editing) cameraCamerasEditor(grid, S); // 18-page-cameras-edit.js
        if (S.scanOpen) cameraCamerasScanCard(grid, S);
      }

      function cameraCamerasSay(S, text) {
        S.msg = text;
        S.ctx.rerender();
      }

      // The line under each camera: where its video comes from.
      function cameraCamerasAddress(S, cam) {
        if (cam.url) return cam.url;
        var relay = S.rs.status;
        var why = cameraRelayStateOf(relay);
        if (why === "signed_out") return i18nT("roles.signed_out_files");
        if (why === "forbidden") return i18nT("roles.no_permission_files", { role: cameraRoleLabel() });
        return relay && relay.url ? i18nT('cameras.system_relay') + relay.port + " <- " + relay.url : i18nT('cameras.system_relay_2');
      }

      function cameraCamerasListCard(grid, S) {
        var card = studioCard(grid, "mdi-cctv", i18nT('cameras.cameras'), i18nT('cameras.the_list_is_the_same_on'));
        var current = cameraChosen();
        var lines = [];
        cameraList.forEach(function (cam, i) { card.appendChild(cameraCamerasRow(S, cam, i, cam === current, lines)); });
        cameraCamerasLive(lines);
        var row = cameraEl("div", "display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;");
        row.appendChild(cameraBtn(i18nT('cameras.add_camera'), "background:#1976d2;color:#fff;", function () {
          S.editing = { i: -1, c: { id: "c" + Date.now().toString(36), name: "", url: "", photo: "", esp32: false } };
          cameraCamerasSay(S, "");
        }));
        row.appendChild(cameraBtn(i18nT('noCamera.scan_go'), "", function () { S.scanOpen = !S.scanOpen; S.ctx.rerender(); }));
        row.appendChild(cameraBtn(i18nT('cameras.see_all'), "", function () { cameraOpenMosaic(); })); // the same mosaic as the viewer's button
        card.appendChild(row);
        if (S.msg && !S.editing) card.appendChild(cameraEl("div", "color:var(--c-amber,#ffe082);", S.msg));
      }

      // One camera of the list: tap = the one this screen's viewer shows; Edit opens the editor. lines collects the state lines (cameraCamerasLive).
      function cameraCamerasRow(S, cam, i, current, lines) {
        var edge = current ? "var(--wf-accent,#1976d2)" : "var(--c-edge,rgba(128,128,128,0.3))";
        var row = cameraEl("div", "display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid " + edge + ";");
        var text = cameraEl("div", "flex:1;min-width:0;cursor:pointer;");
        text.appendChild(cameraEl("div", "font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", cam.name + (current ? "  " + i18nT('cameras.watching') : "")));
        text.appendChild(cameraEl("div", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", cameraCamerasAddress(S, cam))).className = "ctl-muted";
        var state = cameraEl("div", "font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;");
        text.appendChild(state);
        lines.push({ rid: cameraRelayId(cam), el: state });
        text.addEventListener("click", function () {
          cameraChoose(cam.id);
          S.ctx.rerender();
        });
        row.appendChild(text);
        row.appendChild(cameraBtn(i18nT('common.edit'), "", function () {
          S.editing = { i: i, c: JSON.parse(JSON.stringify(cam)) };
          cameraCamerasSay(S, "");
        }));
        return row;
      }

      // The state of each camera, drawn now and again with every read of the relay's state while the rows are on screen.
      function cameraCamerasLive(lines) {
        var seen = false;
        function paint() {
          if (lines[0] && lines[0].el.isConnected) seen = true;
          else if (seen) {
            cameraStateListeners = cameraStateListeners.filter(function (f) { return f !== paint; });
            return;
          }
          lines.forEach(function (x) {
            var e = x.rid ? cameraStateOf(x.rid) : null;
            x.el.textContent = x.rid ? (e ? cameraStateText(e) : i18nT('cameras.through_the_system_relay')) : i18nT('cameras.direct_without_the_relay_no_captures');
            x.el.style.color = cameraStateColor(e);
          });
        }
        cameraStateListeners.push(paint);
        paint();
      }

      // The search of the network (18-no-camera.js): the box is built once and kept in the state (a scan in progress survives a redraw).
      function cameraCamerasScanCard(grid, S) {
        var card = studioCard(grid, "mdi-radar", i18nT('noCamera.scan_title'), i18nT('noCamera.scan_hint'));
        if (!S.scan) {
          var status = cameraEl("div", "min-height:18px;color:var(--c-amber,#ffe082);");
          S.scan = {
            status: status,
            box: cameraScanBox(cameraEl, cameraBtn, {
              inputCss: CAMERA_CSS_SEL,
              known: function (u) { return cameraCamerasKnownHost(S, u); },
              pick: function (u) { cameraCamerasAddFound(S, u); },
              say: function (text) { status.textContent = text || ""; },
            }),
          };
        }
        card.appendChild(S.scan.box);
        card.appendChild(S.scan.status);
      }

      // A camera found by the search: already added? / add it (the first one is the main camera, which was waiting for an address; the next ones are added to the list).
      function cameraCamerasKnownHost(S, url) {
        var host = cameraHostOf(url);
        return cameraList.some(function (c) { return cameraHostOf(c.url) === host; });
      }

      function cameraCamerasAddFound(S, url) {
        var main = cameraList.filter(function (c) { return c.id === "main"; })[0];
        var waiting = main && !String(main.url || "").trim();
        var cam = waiting ? main : cameraNormalize({ id: "c" + Date.now().toString(36), name: "", url: url, esp32: true }, cameraList.length);
        cam.url = url;
        cam.esp32 = true;
        S.scan.status.textContent = i18nT('cameras.asking_the_camera_whether_it_s');
        cameraDetect(cam).then(function (text) {
          S.scan.status.textContent = text;
          if (!waiting) cameraList.push(cam);
          cameraCamerasPersist(S, cam.id);
        });
      }
