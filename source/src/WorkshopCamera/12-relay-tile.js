      // ---- The relay as an optional tile of the control bar (2026-10-31) ----
      //
      // The control bar draws a card for what a plugin offers it (workshopRegisterBarTile, src/_shared/10-registry-tiles.js) and knows nothing about the
      // camera. The relay is the Camera's, so Camera offers the card: the state of the relay, Stop relay and Start relay, with the same operations
      // and the same two taps to stop as the card of the Cameras tab (12-relay.js; this file only adds the reading and the look of a bar card).
      // It is OFF by default: the relay controls live in the page of the plugin, and a bar that shows every card is what made the duplicates of
      // informe-06. A screen turns it on in the gear of the bar ("what is seen, order, on this screen"). It is the technician's (feature "relay":
      // camera.start and camera.stop are technician operations) and it exists only while Camera runs.
      // The state is camera.status of the service, read while the card is on screen (the bar says so through watch) and never asked of the relay
      // itself, so a screen that does not show the card reads nothing.

      var CAMERA_RELAY_TILE_ID = "camera-relay";
      var CAMERA_RELAY_TILE_POLL_MS = 15000; // how often camera.status is read while the card is on screen
      var CAMERA_RELAY_TILE_ICON = '<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>'; // a video camera
      // the colour of the line of each state over the dark bar (the family palette: green, red, amber, grey)
      var CAMERA_RELAY_TILE_COLORS = { running: "#a5d6a7", stopped: "#ef9a9a", nocam: "#ffb74d", reading: "#b0bec5", unknown: "#b0bec5" };

      // The model of the card (12-relay.js) and the timer that reads it while it is on screen
      var cameraRelayTileState = { rs: null, timer: null };

      function cameraRelayTileModel() {
        var st = cameraRelayTileState;
        if (!st.rs) {
          st.rs = cameraRelayModel(function () { return !pluginStopped; }, workshopNotify, workshopNotify);
        }
        return st.rs;
      }

      // Pure: the short state of the tile of the Hidden style. state = cameraRelayStateOf(...), t = i18nT.
      function cameraRelaySummary(state, status, t) {
        if (state === "running") return t('relay.summary_running', { n: (status && status.clients) || 0 });
        return t({ stopped: 'relay.summary_stopped', nocam: 'relay.summary_no_camera', reading: 'relay.summary_reading' }[state] || 'relay.summary_unknown');
      }

      // Pure: what the bar paints (the answer of state() of a bar tile) for a relay model rs = { status, msg, armed }; t = i18nT. The buttons come
      // without their taps: cameraRegisterBarTile adds them.
      function cameraRelayTileView(rs, t) {
        var state = cameraRelayStateOf(rs.status);
        var can = cameraRelayCan(state);
        return {
          status: cameraRelayLine(state, rs.status, t)[0],
          color: CAMERA_RELAY_TILE_COLORS[state],
          summary: cameraRelaySummary(state, rs.status, t),
          railColor: state === "stopped" ? "#c62828" : "#37474f", // a stopped relay is what the person has to notice
          message: rs.msg,
          buttons: [
            { id: "stop", label: t(rs.armed ? 'relay.stop_confirm' : 'relay.stop'), tone: rs.armed ? "stop" : "warning", disabled: !can.stop },
            { id: "start", label: t('relay.start'), tone: "primary", disabled: !can.start },
          ],
        };
      }

      // The bar says the card is on screen (true) or not (false): read now and every CAMERA_RELAY_TILE_POLL_MS, or stop reading. Safe to say true twice.
      function cameraRelayTileWatch(on) {
        var st = cameraRelayTileState;
        clearInterval(st.timer);
        st.timer = null;
        if (!on || pluginStopped) return;
        var rs = cameraRelayTileModel();
        cameraRelayLoad(rs);
        st.timer = setInterval(function () {
          if (pluginStopped) cameraRelayTileWatch(false);
          else cameraRelayLoad(rs);
        }, CAMERA_RELAY_TILE_POLL_MS);
      }

      function cameraRegisterBarTile() {
        var rs = cameraRelayTileModel();
        workshopRegisterBarTile(CAMERA_RELAY_TILE_ID, {
          title: i18nT('relay.tile_title'),
          icon: CAMERA_RELAY_TILE_ICON,
          order: 10,
          help: i18nT('relay.help'),
          plugin: "camera",
          defaultShown: false,
          visible: function () { return cameraCanDo("relay"); },
          state: function () {
            var v = cameraRelayTileView(rs, i18nT);
            v.buttons[0].onTap = function () { cameraRelayStopTap(rs); };
            v.buttons[1].onTap = function () { cameraRelayStartTap(rs); };
            return v;
          },
          watch: cameraRelayTileWatch,
        });
        workshopOnStop(function () { cameraRelayTileWatch(false); });
      }
