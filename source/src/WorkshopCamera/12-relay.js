      // ---- The system camera relay, as the Camera plugin uses it (2026-11-04: the CONTROL moved to the service) ----
      //
      // The relay (port 8090) is the process of the system that shares the camera video with every screen and makes the captures and the
      // timelapses. It runs inside WorkshopService (dsf/camera_relay.py), so the service owns its control: Stop / Start in the row of the process
      // of the service page and the optional tile of the control bar (WorkshopService/dwc-src/camera-relay.js). It used to be here, in the
      // control bar, then in the gear of the viewer, then in the tab Cameras and then in Storage and system; a plugin that only USES the relay
      // cannot own its control (it vanished with the plugin). What stays here is what the page needs from it: the state (the line of each camera
      // says where its video comes from, the start-up chip has a row for it) and the Restart relay of the help of a camera that does not respond
      // (14-health-recover.js).
      // The state comes from the service (camera.status), never from probing :8090. One plain object holds it (cameraRelayModel); the functions
      // below take that object (docs-internal/ARQUITECTURA.md).

      // The state of one tab. status = camera.status ({running, configured, clients, url, port...}, {error}, or null while it is unread);
      // draft = the address typed for the camera the relay reads (null = untouched); msg = the last result of an action; armed = the timer of
      // the pending second tap of "Stop relay" (null = none). alive() says whether the tab is still on screen; repaint() draws it again;
      // changed() draws it again and re-checks the start-up chip (the relay state is one of its rows).
      function cameraRelayModel(alive, repaint, changed) {
        return { status: null, draft: null, msg: "", armed: null, alive: alive, repaint: repaint, changed: changed };
      }

      // Pure: the answer of camera.status (text, maybe with a line before the JSON) -> its object, or {error}.
      function cameraRelayParse(text) {
        var t = String(text || "");
        var k = t.indexOf("{");
        if (k < 0) return { error: t.trim() };
        try {
          return JSON.parse(t.slice(k));
        } catch (e) {
          return { error: t.trim() };
        }
      }

      // Pure: "reading" (not read yet) | "running" | "stopped" | "nocam" (no camera address yet: nothing to start) | "unknown" (the service did not answer).
      function cameraRelayStateOf(status) {
        if (!status) return "reading";
        if (status.error) return "unknown";
        if (status.running) return "running";
        return status.configured === false ? "nocam" : "stopped";
      }

      // Reads camera.status into rs.status and draws the tab again. An answer that comes after the tab went away is dropped.
      function cameraRelayLoad(rs) {
        return workshopApiText("camera.status")
          .then(cameraRelayParse)
          .catch(function (e) {
            return { error: String(e && e.message ? e.message : e) };
          })
          .then(function (s) {
            rs.status = s;
            if (rs.alive()) rs.changed();
          });
      }

      // camera.start / camera.stop: it acts for EVERYONE. The state is read again 1.5 s and 4 s later (the loop of the service takes a second to
      // open or close the port, so the first read can still see the old state).
      function cameraRelayAct(rs, action) {
        rs.msg = i18nT(action === "stop" ? "relay.stopping" : "relay.starting");
        rs.repaint();
        return workshopApiText(action === "stop" ? "camera.stop" : "camera.start")
          .then(function (txt) {
            rs.msg = String(txt || "").trim() || i18nT(action === "stop" ? "relay.stopped" : "relay.started");
          })
          .catch(function (e) {
            rs.msg = i18nT('common.couldn_t_error', { error: String(e && e.message ? e.message : e) });
          })
          .then(function () {
            if (rs.alive()) rs.repaint();
            [1500, 4000].forEach(function (ms) {
              setTimeout(function () {
                cameraRelayLoad(rs);
              }, ms);
            });
          });
      }

      // "Restart relay" (the help of a camera that does not respond, 14-health-recover.js): the same two taps as Stop, since it cuts the video for
      // everyone; then Stop and, two seconds later (the loop of the service takes a second to close the port), Start.
      function cameraRelayRestartTap(rs) {
        if (!rs.armed) {
          rs.armed = setTimeout(function () {
            rs.armed = null;
            if (rs.alive()) rs.repaint();
          }, 4000);
          rs.repaint();
          return;
        }
        clearTimeout(rs.armed);
        rs.armed = null;
        cameraRelayAct(rs, "stop").then(function () {
          setTimeout(function () { cameraRelayAct(rs, "start"); }, 2000);
        });
      }
