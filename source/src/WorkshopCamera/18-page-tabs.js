      // ---- The tabs of the page "Timelapses and captures" (informe-07) ----
      //
      // The page is the home of everything that is not just LOOKING at a camera: the floating viewer keeps the image, the zoom, the camera
      // selector, the flash, the quick capture and one button that opens this page. One list says which tab each view gets, so the side bar,
      // the saved tab and the dispatch of the page cannot disagree about it.

      var CAMERA_PAGE_TAB_KEY = "workshopTlTab"; // the tab this screen had last (localStorage)

      // [id, icon, the view feature that shows it (09-camera-roles.js), group]. Six sections in three groups (informe-07, mockup approved 2026-11-01):
      //   Operate: live (look, capture, record a timelapse), library (videos and captures in one place)
      //   Video quality: studio
      //   Configure: cameras, image, store (space, limits, notices and the system relay)
      var CAMERA_PAGE_GROUPS = ["page.g_operate", "page.g_quality", "page.g_configure"]; // the i18n key of each group
      var CAMERA_PAGE_TABS = [
        ["live", "mdi-video", "gallery", 0],
        ["library", "mdi-folder-multiple-image", "gallery", 0],
        ["studio", "mdi-movie-edit-outline", "settings", 1],
        ["cameras", "mdi-cctv", "cameras", 2],
        ["image", "mdi-camera-iris", "cameras", 2],
        ["store", "mdi-harddisk", "settings", 2],
      ];

      // Pure. The id a saved or asked-for tab has today: the ids of the 7 tabs of before map to their section; anything else falls on "live".
      var CAMERA_PAGE_TAB_OLD = { record: "live", videos: "library", captures: "library", settings: "store" };
      function cameraPageTabMigrate(id) {
        if (typeof id !== "string") return "live";
        if (Object.prototype.hasOwnProperty.call(CAMERA_PAGE_TAB_OLD, id)) return CAMERA_PAGE_TAB_OLD[id];
        return CAMERA_PAGE_TABS.some(function (t) { return t[0] === id; }) ? id : "live";
      }

      // Pure. The ids of the tabs a view can use, in order; canDo(feature) says whether the view has a feature.
      function cameraPageTabsFor(canDo) {
        return CAMERA_PAGE_TABS.filter(function (t) { return canDo(t[2]); }).map(function (t) { return t[0]; });
      }

      // Pure. One quiet line for the tabs this view does not have (settings, cameras, image), or "" when it has them all: signed out -> signing in may
      // show them; a role that is too low -> only another role does.
      function cameraPageHiddenNote(canDo, signedOut, roleLabel, t, state) {
        var hidden = CAMERA_PAGE_TABS.some(function (x) { return !canDo(x[2]); });
        if (!hidden) return "";
        return signedOut ? t(typeof cameraSessionKeyOf === "function" ? cameraSessionKeyOf(state, "roles.hidden_signed_out") : "roles.hidden_signed_out") : t("roles.hidden_by_role", { role: roleLabel || "" });
      }

      // Pure. The same tabs by group: [{ label: the i18n key of the group, ids: [...] }], a group with no tab for the view is left out.
      function cameraPageGroupsFor(canDo) {
        return CAMERA_PAGE_GROUPS.map(function (key, g) {
          return { label: key, ids: CAMERA_PAGE_TABS.filter(function (t) { return t[3] === g && canDo(t[2]); }).map(function (t) { return t[0]; }) };
        }).filter(function (g) { return g.ids.length; });
      }

      function cameraPageTabIcon(id) {
        return CAMERA_PAGE_TABS.filter(function (t) { return t[0] === id; })[0][1];
      }

      // The words of a tab. The library carries how many files there are (null = not read yet); see cameraPageTabCount.
      function cameraPageTabLabel(id) {
        if (id === "live") return i18nT('page.live');
        if (id === "library") return i18nT('page.library');
        if (id === "studio") return i18nT('studio.nav');
        if (id === "cameras") return i18nT('cameras.cameras');
        if (id === "image") return i18nT('image.nav');
        return i18nT('page.store');
      }

      // Pure. The figure on the side of the library (videos + captures), or "" while neither list is read.
      function cameraPageTabCount(id, tls, caps) {
        if (id !== "library" || (!tls && !caps)) return "";
        return String((tls ? tls.length : 0) + (caps ? caps.length : 0));
      }

      // Pure. The tabs that hold what the person is typing (an editor, a draft, a slider) are not redrawn by the 3 s reload of the page; the
      // live tab keeps the form of the timelapse and the library its selection, so each is left alone while it holds something (busy = true).
      function cameraPageReloads(tab, busy) {
        if (["studio", "cameras", "image", "store"].indexOf(tab) >= 0) return false;
        if ((tab === "live" || tab === "library") && busy) return false;
        return true;
      }

      // Pure. What the page shows, as a short text: the two lists and the parts of the state that change what is drawn. The 3 s reload during a recording
      // draws the page again only when this changes: a new saved photo of the recording (frames: the grid of the Live tab shows the last one) or a list that changed, not every 3 s.
      function cameraPageSignature(tls, caps, est, noCam) {
        var t = (est && est.timelapse) || {};
        return JSON.stringify([tls, caps, !!noCam, !!t.recording, !!t.assembling, !!t.editing, t.job || "", t.error || "", t.frames || 0, (est && est.cameras || []).map(function (c) { return c.id; })]);
      }

      // What the page was last drawn from. changed(onlyIfChanged, sig): true when the page has to be drawn (always, unless onlyIfChanged === true and the
      // signature is the same as the last one); it remembers the signature either way.
      function cameraDrawnTracker() {
        var last = null;
        return { changed: function (onlyIfChanged, sig) { var same = last === sig; last = sig; return !(onlyIfChanged === true && same); } };
      }

      // Which cameras answer: changed(cams) is true when one stops answering or answers again since the last call (cameraAvailability, 14-health.js). The first call is false.
      function cameraAnswersTracker() {
        var last = null;
        return { changed: function (cams) { var k = (cams || []).map(function (c) { return c.id + ":" + (cameraAvailability(c).ok ? 1 : 0); }).join(","); var ch = last !== null && k !== last; last = k; return ch; } };
      }

      // The state the tabs keep between redraws of the page (the camera being edited, the relay model...): leaving a tab or pressing Refresh drops it.
      function cameraPageForget(state) {
        Object.keys(state).forEach(function (k) { delete state[k]; });
      }

      // The side bar of the page (same measures as the bar of Vision): pin, fold arrow and one button per tab the view can use.
      // o = { tab, folded, pinned, tls, caps, onFold(), onPin(), onTab(id) }
      function cameraPageNav(o) {
        var nav = cameraEl("nav", "");
        nav.className = "wf-nav ctl-nav" + (o.folded ? " collapsed" : "");
        var fold = cameraEl("button", "");
        fold.type = "button";
        fold.className = "ctln-fold";
        fold.title = i18nT("common.fold_bar");
        fold.setAttribute("aria-label", fold.title); // QA-11: icon-only button needs a name
        fold.appendChild(cameraEl("span", "")).className = "mdi " + (o.folded ? "mdi-chevron-double-right" : "mdi-chevron-double-left");
        fold.addEventListener("click", o.onFold);
        nav.appendChild(cameraNavHead(o.pinned, o.folded, fold, o.onPin));
        cameraPageGroupsFor(cameraCanDo).forEach(function (gr, gi) {
          var gt = cameraEl("div", "", i18nT(gr.label));
          gt.className = "wf-nav-group st-group ctl-nav-group"; // st-group: the family takes the border off the first one
          gt.setAttribute("data-group", String(gi));
          nav.appendChild(gt);
          gr.ids.forEach(function (id) {
            var label = cameraPageTabLabel(id);
            var count = cameraPageTabCount(id, o.tls, o.caps);
            var b = cameraEl("button", "");
            b.className = "wf-nav-item ctl-nav-item" + (o.tab === id ? " on" : "");
            b.type = "button";
            b.title = label + (count ? " (" + count + ")" : "");
            b.appendChild(cameraEl("span", "")).className = "wf-nav-icon mdi " + cameraPageTabIcon(id);
            b.appendChild(cameraEl("span", null, label)).className = "tx";
            if (count) b.appendChild(cameraEl("span", null, count)).className = "st-badge ctl-nav-count";
            b.addEventListener("click", function () { o.onTab(id); });
            nav.appendChild(b);
          });
        });
        var hiddenNote = cameraPageHiddenNote(cameraCanDo, cameraSignedOut(), cameraRoleLabel(), i18nT, typeof cameraStateNow === "function" ? cameraStateNow() : "");
        if (hiddenNote) nav.appendChild(workshopNoticeEl(cameraSignedOut() ? "session" : "role", "section", { text: hiddenNote, action: "" }));
        return nav;
      }

      // To the page of the plugin, on a tab (the Live tab holds the capture and the timelapse): the route is pushed through the host; without a
      // host to push it, a plain navigation. The button of the viewer and the page itself ask for it here.
      function cameraOpenPage(tab) {
        if (tab) {
          try { localStorage.setItem(CAMERA_PAGE_TAB_KEY, cameraPageTabMigrate(tab)); } catch (e) { /* the page opens on the tab it had */ }
        }
        if (!workshopHostPush(CAMERA_GAL_PATH)) window.location.href = CAMERA_GAL_PATH;
      }

      // Pure. Whether the viewer shows its button to the page: the view must have the gallery (a visitor would get a page that says
      // "no permission") and the page must be registered (the plugin that owns the route is running).
      function cameraPageLinkShown(canGallery, pageRegistered) {
        return !!canGallery && !!pageRegistered;
      }
