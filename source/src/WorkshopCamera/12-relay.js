      // ---- The system camera relay inside the tab "Cameras" of the page (2026-10-30, moved to the page by informe-07) ----
      //
      // The relay (port 8090) is the process of the system that shares the camera video with every screen and makes the captures and the
      // timelapses. Its card used to be in the Control bar (GLOBAL > Relay: state, Stop / Start and a copy of the manual timelapse, with every
      // open browser asking :8090 every 30 s), then in the sheet of the viewer's gear. It is in the page now, in the tab that lists the cameras and
      // lists the cameras: a technician sees whether it runs and can stop or start it. The address of the camera it reads is the one of the "Main"
// camera of that list (cameras.json): there is no second place to type it. The manual timelapse needs nothing
      // new: the Record tab of the page starts and stops it.
      // The state comes from the service (camera.status), never from probing :8090. One plain object holds it (cameraRelayModel) and the
      // tab draws itself from it; the functions below take that object (docs-internal/ARQUITECTURA.md).

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

      // Pure: what each button can do now. Stop only while it runs and Start only while it is stopped; while it is being read neither, and when
      // the service did not answer both are offered (the answer of the action says what went wrong).
      function cameraRelayCan(state) {
        return { stop: state === "running" || state === "unknown", start: state === "stopped" || state === "unknown" };
      }

      // Pure: the line that tells the state, [text, color]. t = i18nT.
      function cameraRelayLine(state, status, t) {
        if (state === "running") return [t('relay.state_running', { n: (status && status.clients) || 0 }), "var(--c-green,#a5d6a7)"];
        if (state === "stopped") return [t('relay.state_stopped'), "var(--c-error,#ef9a9a)"];
        if (state === "nocam") return [t('relay.state_no_camera'), "var(--c-notice,#ffb74d)"];
        if (state === "reading") return [t('relay.state_reading'), "var(--c-sec,#b0bec5)"];
        return [t('relay.state_unknown'), "var(--c-sec,#b0bec5)"];
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

      // "Stop relay" needs two taps within 4 s because it cuts the camera for everyone: the first arms it (the tab draws the amber button),
      // the second stops. Any other change to the tab leaves the arming alone until the timer ends.
      function cameraRelayStopTap(rs) {
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
        cameraRelayAct(rs, "stop");
      }

      // "Start relay": a pending "Stop relay" is let go and the relay starts (it harms nobody, so one tap).
      function cameraRelayStartTap(rs) {
        if (rs.armed) clearTimeout(rs.armed);
        rs.armed = null;
        cameraRelayAct(rs, "start");
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

      // The card of the tab: state, Stop relay, Start relay, the last message and the help. el / btn are the page's own makers (cameraEl, cameraBtn).
      // Only the technician's view (feature "relay") gets it: stopping the relay cuts the camera for everyone.
      function cameraRelayCard(rs, el, btn, asSub) {
        var box = el("div", "");
        box.className = asSub ? "wf-sub" : "ctl-card wf-card"; // asSub: a subsection of the card of Storage and system
        if (!cameraCanDo("relay")) {
          box.style.display = "none";
          return box;
        }
        var state = cameraRelayStateOf(rs.status);
        var can = cameraRelayCan(state);
        var line = cameraRelayLine(state, rs.status, i18nT);
        var head = el("div", "");
        if (asSub) {
          head.className = "wf-subt";
          head.textContent = i18nT('relay.title');
        } else {
          head.className = "ctl-title";
          head.appendChild(el("span", "")).className = "mdi mdi-server-network";
          head.appendChild(el("span", null, i18nT('relay.title')));
        }
        box.appendChild(head);
        var st = el("div", asSub ? "min-height:16px;" : "font-weight:bold;min-height:16px;color:" + line[1] + ";", line[0]);
        if (asSub) st.className = "wf-state " + (state === "running" ? "ok" : state === "stopped" ? "err" : state === "nocam" ? "warn" : "info"); // a dot and the word
        box.appendChild(st);
        var tall = "min-height:" + (window.matchMedia && window.matchMedia("(pointer: coarse)").matches === true ? 44 : 32) + "px;"; // DESIGN.md: touch targets
        var row = el("div", "display:flex;gap:6px;flex-wrap:wrap;");
        // the red outline is the danger look; the amber one is the pending second tap of the double tap; a button that cannot be used is disabled
        var stop = btn(i18nT(rs.armed ? "relay.stop_confirm" : "relay.stop"), (rs.armed ? "background:#ff8f00;color:#111;" : "background:#c62828;color:#fff;") + tall, function () {
          cameraRelayStopTap(rs);
        });
        var start = btn(i18nT('relay.start'), "background:#1976d2;color:#fff;" + tall, function () {
          cameraRelayStartTap(rs);
        });
        [[stop, can.stop], [start, can.start]].forEach(function (x) {
          x[0].disabled = !x[1];
          row.appendChild(x[0]);
        });
        box.appendChild(row);
        if (rs.msg) box.appendChild(el("div", "color:var(--c-amber,#ffe082);", rs.msg));
        box.appendChild(el("div", "", i18nT('relay.help'))).className = "ctl-muted";
        return box;
      }
