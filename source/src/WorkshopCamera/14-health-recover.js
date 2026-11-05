      // ---- The help to bring a camera back: a short checklist, cheapest first, under the picture it is about (owner report 2026-11-03) ----
      //
      // Pure first: which steps for which state and which view (cameraHealthSteps, tests/camera-health.test.js). Then the panel
      // (cameraHealthPanel): the state line (a dot and the words of 14-health.js), one hint, and the steps. Every step carries its help (what it
      // is, what it is for, what happens without it, how to do it), a button when the plugin can do it by itself (ask for the picture again,
      // check again, ask whether the camera answers, switch the light on, restart the system relay: the technician's, two taps, it cuts the
      // video for everyone), and the result of what was tried, in words that say what it means. Restarting the CAMERA itself is not an
      // operation of the service, so it is a manual step written out (power cycle), never a button that pretends to do it.

      var CAMERA_RECOVER_BY_STATE = {
        fresh: [],
        waiting: [],
        stale: ["retry", "recheck", "reach", "relay", "power", "network", "pi"],
        black: ["light", "retry", "recheck", "reach", "power"],
        down: ["retry", "recheck", "reach", "relay", "power", "network", "pi"],
        unreachable: ["recheck", "relay", "service"],
      };
      var CAMERA_RECOVER_AUTO = ["retry", "recheck", "reach", "light", "relay"]; // the plugin does these by itself (a button); the rest is a person's

      // Pure. The steps for a state, in order, for a view with caps = { relay (may restart the relay and the camera goes through it), light (may
      // switch the flash and the camera has one) }.
      function cameraHealthSteps(state, caps) {
        caps = caps || {};
        return (CAMERA_RECOVER_BY_STATE[state] || []).filter(function (id) {
          if (id === "relay") return !!caps.relay;
          if (id === "light") return !!caps.light;
          return true;
        });
      }

      // Pure. Whether the plugin does a step by itself.
      function cameraRecoverAuto(id) {
        return CAMERA_RECOVER_AUTO.indexOf(id) >= 0;
      }

      // Pure. What "does the camera answer?" means: who asked (service | screen), whether something answered, the address. t = i18nT.
      function cameraRecoverReachText(asked, ok, address, t) {
        if (asked === "service") return t(ok ? "recover.reach_service_yes" : "recover.reach_service_no", { address: address });
        return t(ok ? "recover.reach_screen_yes" : "recover.reach_screen_no", { address: address });
      }

      // Pure. What the relay says of its camera after "check again". e = the camera of /state (null: the relay does not know it). t = i18nT.
      function cameraRecoverRelayText(e, t) {
        if (!e) return t("recover.recheck_no_camera");
        var bad = cameraHealthFromRelay(e);
        var words = bad ? cameraHealthWord(bad, t)
          : e.state === "connected" ? t("recover.rs_connected", { s: typeof e.last_frame_s === "number" ? Math.round(e.last_frame_s) : "?" })
          : e.state === "reconnecting" || e.state === "connecting" ? t("recover.rs_connecting")
          : t("recover.rs_idle");
        return t("recover.recheck_relay_says", { state: words }) + (e.last_error ? " · " + t("recover.last_error", { error: e.last_error }) : "");
      }

      // ---- what touches the page ----

      // The caps of this view for the camera cam (what the buttons may do).
      function cameraRecoverCaps(cam) {
        var own = !!(cam && cam.esp32) && !(cam && cam.flash && cam.flash.capable === false);
        return {
          relay: cameraCanDo("relay") && !!cameraRelayId(cam),
          light: cameraCanDo("flash") && cameraFlashShown(cam, own),
        };
      }

      // The address of the camera itself (its own stream, not the relay's), for the person and for the probes. "" when it has none.
      function cameraRecoverAddress(cam) {
        return cam ? cameraResolverUrl(String(cam.url || "").trim()) : "";
      }

      function cameraRecoverHost(cam) {
        var u = cameraRecoverAddress(cam);
        try {
          return u ? new URL(u, window.location.href).hostname : "";
        } catch (e) {
          return "";
        }
      }

      function cameraRecoverClock() {
        var d = new Date();
        var dd = function (n) { return (n < 10 ? "0" : "") + n; };
        return dd(d.getHours()) + ":" + dd(d.getMinutes()) + ":" + dd(d.getSeconds());
      }

      // The state line and the help under a picture. parent = where they go; W = the watch of the picture (14-health.js); o = { go(tab) (the
      // page, to open its Cameras tab), notify(text, ok) }. Returns ui = { root, line, hint, box, paint() }; the owner calls ui.paint() when W changes.
      function cameraHealthPanel(parent, W, o) {
        var ui = { W: W, o: o || {}, shown: null, results: {}, rs: null, relayBtn: null };
        ui.root = cameraEl("div", "");
        ui.root.className = "ctl-health";
        ui.line = cameraEl("div", "");
        ui.line.className = "wf-state";
        ui.hint = cameraEl("div", "");
        ui.hint.className = "ctl-muted";
        ui.box = cameraEl("details", "");
        ui.box.className = "ctl-recover";
        ui.box.appendChild(cameraEl("summary", null, i18nT("recover.title")));
        ui.body = cameraEl("div", "");
        ui.body.className = "ctl-rsteps";
        ui.box.appendChild(ui.body);
        [ui.line, ui.hint, ui.box].forEach(function (n) { ui.root.appendChild(n); });
        parent.appendChild(ui.root);
        ui.paint = function () { cameraHealthPaint(ui); };
        ui.paint();
        return ui;
      }

      // Paints the state and the steps of the state (the steps are drawn again only when the list changes; the results stay).
      function cameraHealthPaint(ui) {
        var h = ui.W.h || { state: "waiting", since_s: 0 };
        ui.line.className = "wf-state " + cameraHealthTone(h.state);
        ui.line.textContent = cameraHealthWord(h, i18nT);
        ui.hint.textContent = cameraHealthHint(h, i18nT);
        var steps = cameraHealthSteps(h.state, cameraRecoverCaps(ui.W.cam));
        var key = steps.join(",");
        ui.box.style.display = steps.length ? "" : "none";
        if (key !== ui.shown) {
          ui.shown = key;
          ui.body.textContent = "";
          ui.results = {};
          steps.forEach(function (id, i) { ui.body.appendChild(cameraRecoverStep(ui, id, i + 1)); });
          if (steps.length && !ui.o.compact) ui.box.open = true; // compact (a tile of the grid of all the cameras): the help stays folded, it was a long strip
        }
        cameraRecoverResults(ui);
      }

      // One step: number, name, the button (when the plugin does it), how to do it, the help fold (what, what for, without it) and the result.
      function cameraRecoverStep(ui, id, n) {
        var row = cameraEl("div", "");
        row.className = "ctl-rstep";
        var head = cameraEl("div", "");
        head.className = "ctl-rstep-h";
        head.appendChild(cameraEl("span", null, String(n))).className = "ctl-rnum";
        head.appendChild(cameraEl("b", null, i18nT("recover." + id)));
        var btn = cameraRecoverButton(ui, id);
        if (btn) head.appendChild(btn);
        row.appendChild(head);
        row.appendChild(cameraEl("div", null, cameraRecoverHow(ui, id))).className = "ctl-muted";
        var extra = cameraRecoverExtra(ui, id);
        if (extra) row.appendChild(extra);
        var help = cameraEl("details", "");
        help.className = "ctl-rhelp";
        help.appendChild(cameraEl("summary", null, i18nT("recover.what_is_it")));
        [["h_what", "_what"], ["h_why", "_why"], ["h_missing", "_missing"]].forEach(function (p) {
          var l = cameraEl("div", "");
          l.appendChild(cameraEl("b", null, i18nT("recover." + p[0]) + " "));
          l.appendChild(cameraEl("span", null, i18nT("recover." + id + p[1])));
          help.appendChild(l);
        });
        row.appendChild(help);
        var res = cameraEl("div", "");
        res.className = "ctl-rresult";
        ui.results[id] = res;
        row.appendChild(res);
        return row;
      }

      // The "how" of a step, with the address of the camera where it helps.
      function cameraRecoverHow(ui, id) {
        var address = cameraRecoverAddress(ui.W.cam) || i18nT("recover.no_address");
        return i18nT("recover." + id + "_how", { address: address, host: cameraRecoverHost(ui.W.cam) || "<ip>" });
      }

      // What some steps add: the commands for the person at the system (pi), the way to the Cameras tab (network).
      function cameraRecoverExtra(ui, id) {
        if (id === "pi") {
          var host = cameraRecoverHost(ui.W.cam) || "<ip>";
          var code = cameraEl("div", "");
          code.className = "ctl-mono";
          code.textContent = "ping -c 3 " + host + "\ncurl -s --max-time 4 http://" + host + "/status";
          return code;
        }
        if (id === "network" && ui.o.go && cameraCanDo("cameras")) {
          return cameraBtn(i18nT("recover.network_go"), "align-self:flex-start;", function () { ui.o.go("cameras"); });
        }
        return null;
      }

      // The button of a step the plugin does by itself; null for a person's step.
      function cameraRecoverButton(ui, id) {
        if (!cameraRecoverAuto(id)) return null;
        if (id === "relay") return cameraRecoverRelayButton(ui);
        return cameraBtn(i18nT("recover." + id + "_go"), "", function () { cameraRecoverRun(ui, id); });
      }

      // "Restart the relay": two taps (it cuts the video for everyone), through the relay module (12-relay.js: the only one that calls camera.start / stop).
      function cameraRecoverRelayButton(ui) {
        var W = ui.W;
        if (!ui.rs) {
          ui.rs = cameraRelayModel(function () { return !W.stopped; }, function () { cameraRecoverRelayPaint(ui); }, function () { cameraRecoverRelayPaint(ui); });
        }
        ui.relayBtn = cameraBtn(i18nT("recover.relay_go"), "", function () { cameraRelayRestartTap(ui.rs); });
        return ui.relayBtn;
      }

      function cameraRecoverRelayPaint(ui) {
        var rs = ui.rs, b = ui.relayBtn;
        if (!b) return;
        b.textContent = i18nT(rs.armed ? "recover.relay_confirm" : "recover.relay_go");
        if (b.classList) b.classList[rs.armed ? "add" : "remove"]("wf-armed");
        if (rs.msg) ui.W.results.relay = { text: rs.msg, live: true };
        cameraRecoverResults(ui);
      }

      // Runs a step and writes what it did; the result line says what it means.
      function cameraRecoverRun(ui, id) {
        var W = ui.W, cam = W.cam;
        var say = function (text, live) {
          W.results[id] = { text: cameraRecoverClock() + " · " + text, live: !!live };
          cameraRecoverResults(ui);
        };
        if (id === "retry") {
          cameraHealthRetry(W);
          return say(i18nT("recover.retry_sent"), true);
        }
        if (id === "recheck") {
          if (typeof cameraStartupRelayMemo !== "undefined") cameraStartupRelayMemo.t = 0;
          say(i18nT("recover.recheck_asking"));
          return cameraStateRead().then(function (d) {
            say(d ? cameraRecoverRelayText(cameraStateOf(W.rid), i18nT) : i18nT("recover.recheck_relay_down"));
          });
        }
        if (id === "reach") return cameraRecoverReach(ui, say);
        if (id === "light") {
          say(i18nT("recover.light_asking"));
          return cameraFlashSet(cam, true).then(function (r) { say(r.ok ? i18nT("recover.light_on") : i18nT("common.couldn_t_error", { error: r.error || "" }), !!r.ok); });
        }
      }

      // "Does the camera answer?": the service asks it (camera.detect, the technician's; it is on the camera's own network) or, for the other
      // views, this screen asks the camera's address for its headers (nothing of the stream is read).
      function cameraRecoverReach(ui, say) {
        var cam = ui.W.cam;
        var address = cameraRecoverAddress(cam);
        if (!address) return say(i18nT("recover.reach_no_address"));
        say(i18nT("recover.reach_asking", { address: address }));
        if (cameraCanDo("cameras")) {
          return cameraRelayDetect(address).then(
            function (r) { say(r && r.ok ? cameraRecoverReachText("service", !!r.reachable, address, i18nT) : i18nT("common.couldn_t_error", { error: (r && r.error) || "" })); },
            function (e) { say(i18nT("common.couldn_t_error", { error: String(e && e.message ? e.message : e) })); }
          );
        }
        return cameraStartupAnswers(address).then(function (ok) { say(cameraRecoverReachText("screen", ok, address, i18nT)); });
      }

      // The result lines: what was tried and, for the steps whose effect shows in the state, the state now.
      function cameraRecoverResults(ui) {
        Object.keys(ui.results).forEach(function (id) {
          var r = ui.W.results[id];
          var el = ui.results[id];
          if (!r) { el.textContent = ""; el.style.display = "none"; return; }
          el.style.display = "";
          el.textContent = r.text + (r.live && ui.W.h ? " → " + cameraHealthWord(ui.W.h, i18nT) : "");
        });
      }
