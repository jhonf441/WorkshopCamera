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

      // Pure. The side bar lists EVERY tab (locked-in-place rule: what you cannot open stays in its place, locked, with the role that opens it): the groups with all the ids.
      function cameraPageNavGroupsFor() {
        return cameraPageGroupsFor(function () { return true; });
      }

      // Pure. The role that opens a tab for a view, or "" when the view has it: the tabs of the settings and of the cameras are the technician's.
      function cameraPageTabNeed(id, canDo) {
        var t = CAMERA_PAGE_TABS.filter(function (x) { return x[0] === id; })[0];
        return t && !canDo(t[2]) ? "technician" : "";
      }

      // Pure. The group of a tab (0 Operate, 1 Video quality, 2 Configure): the page takes its colour (the line of the cards and of the open entry)
      function cameraPageTabGroup(id) {
        var t = CAMERA_PAGE_TABS.filter(function (x) { return x[0] === id; })[0];
        return t ? t[3] : 0;
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
      // The SAME entries in three forms, chosen by the width of the page (data-w, cameraPageWidthWatch; criteria C7, the pattern of the service's
      // section bar): narrow (< 640 px) one "Section: <name>" button that opens a sheet with the whole list (owner 2026-11-23, note 17: the service
      // does it on an iPhone, the plugins did "anything"); medium one row that wraps; wide the rail.
      function cameraPageNav(o) {
        var nav = cameraEl("nav", "");
        nav.className = "wf-nav ctl-nav" + (o.folded ? " collapsed" : "");
        nav.setAttribute("aria-label", i18nT("page.section"));
        nav.appendChild(cameraPageNavPick(o));
        var fold = cameraEl("button", "");
        fold.type = "button";
        fold.className = "ctln-fold";
        fold.title = i18nT("common.fold_bar");
        fold.setAttribute("aria-label", fold.title); // QA-11: icon-only button needs a name
        fold.appendChild(cameraEl("span", "")).className = "mdi " + (o.folded ? "mdi-chevron-double-right" : "mdi-chevron-double-left");
        fold.addEventListener("click", o.onFold);
        nav.appendChild(cameraNavHead(o.pinned, o.folded, fold, o.onPin));
        cameraPageNavGroupsFor().forEach(function (gr, gi) {
          var gt = cameraEl("div", "", i18nT(gr.label));
          gt.className = "wf-nav-group st-group ctl-nav-group"; // st-group: the family takes the border off the first one
          gt.setAttribute("data-group", String(gi));
          nav.appendChild(gt);
          gr.ids.forEach(function (id) {
            nav.appendChild(cameraPageNavItem(id, o, function () { o.onTab(id); }));
          });
        });
        return nav; // no general note: each locked tab says why when it is opened (a cover), and the bar shows the lock and the role it needs
      }

      // One entry of the list (the rail, the row and the sheet draw the same one): the icon (with a small lock when the tab needs more), the name, under it
      // who may open it, and the count of the library. onPick() = what a tap does.
      function cameraPageNavItem(id, o, onPick) {
        var label = cameraPageTabLabel(id);
        var count = cameraPageTabCount(id, o.tls, o.caps);
        var need = cameraPageTabNeed(id, cameraCanDo);
        var out = !!need && cameraSignedOut();
        var b = cameraEl("button", "");
        b.className = "wf-nav-item ctl-nav-item" + (o.tab === id ? " on" : "") + (need ? " st-locked" + (out ? " st-locked-session" : "") : "");
        b.type = "button";
        if (o.tab === id) b.setAttribute("aria-current", "page");
        b.title = need ? label + ": " + (out ? i18nT("notice.notice_session_reason") : i18nT("notice.notice_role_needed", { needed: workshopNoticeRoleName(need) })) : label + (count ? " (" + count + ")" : "");
        var box = cameraEl("span", ""); // the real icon always; a locked tab gets a small lock on its corner (same as the side bar of the Vue pages)
        box.className = "st-iconbox";
        box.appendChild(cameraEl("span", "")).className = "wf-nav-icon mdi " + cameraPageTabIcon(id);
        if (need) box.appendChild(cameraEl("span", "")).className = "st-lockmark mdi " + (out ? "mdi-account-lock" : "mdi-lock");
        b.appendChild(box);
        var txt = cameraEl("span", ""); // the name, and under it who may open the tab; not drawn when the bar is folded
        txt.className = "st-text";
        txt.appendChild(cameraEl("span", null, label)).className = "tx";
        if (need) txt.appendChild(cameraEl("span", null, out ? i18nT("notice.need_session_tag") : workshopNoticeRoleName(need))).className = "st-need";
        b.appendChild(txt);
        if (count) b.appendChild(cameraEl("span", null, count)).className = "st-badge ctl-nav-count";
        b.addEventListener("click", onPick);
        return b;
      }

      // The narrow form: "Section" + the name of the open tab, 44 px at the whole width; it opens the sheet with every entry
      function cameraPageNavPick(o) {
        var b = cameraEl("button", "");
        b.type = "button";
        b.className = "wf-btn ctl-nav-pick"; // the family button (44 px, the control border); the page only lays it out
        b.setAttribute("aria-haspopup", "dialog");
        b.setAttribute("aria-expanded", "false");
        b.appendChild(cameraEl("span", "")).className = "mdi mdi-menu ctl-pick-icon";
        b.appendChild(cameraEl("span", null, i18nT("page.section"))).className = "ctl-pick-label";
        b.appendChild(cameraEl("span", null, cameraPageTabLabel(o.tab))).className = "ctl-pick-name";
        b.addEventListener("click", function () { cameraPageNavSheet(o, b); });
        return b;
      }

      // The sheet of the narrow form: a NON-modal <dialog> (dialog.show()) holding the family's sheet (wf-sheet and the header of every sheet) with the
      // same entries in one column. Owner's safety rule (2026-11-23): no veil, sheet or modal dialog covers an emergency stop. So it is NOT modal (a
      // modal dialog makes the whole page inert, the Emergency stop of DWC's top bar included) and NOT in the top layer (it would sit over the STOP /
      // E-STOP of the floating Jog): it sits in the box under DWC's top bar and left of the control bar (workshopVeilBox, 45-layers.js), below the
      // floating panels, with no dark background. Choosing an entry, the close button, Esc or a tap outside close it (the tap outside still reaches what
      // was tapped: a stop works on the first tap). Esc, choosing and the close button give the focus back to the picker. It lives on <body>: a redraw
      // of the page leaves it alone. Closed, it is removed.
      var CAMERA_PAGE_SHEET_ID = "workshop-camera-section-sheet";
      var cameraPageSheetOff = null; // removes the listeners of the open sheet (Esc, tap outside)
      function cameraPageNavSheet(o, opener) {
        cameraPageNavSheetClose();
        var dlg = cameraEl("dialog", "");
        dlg.id = CAMERA_PAGE_SHEET_ID;
        dlg.className = "ctl-sheet-dialog workshop-theme";
        dlg.setAttribute("data-tp-panel", "1"); // 03-theme.js: the light palette with DWC's light theme
        cameraPageSheetPlace(dlg);
        var sheet = cameraEl("div", "");
        sheet.className = "wf-sheet";
        var head = workshopSheetHeader(i18nT("page.section"), function () { cameraPageNavSheetClose(true); }, { noVersion: true });
        var title = head.firstElementChild; // the title of the family header names the dialog
        if (title && title.setAttribute) {
          title.id = CAMERA_PAGE_SHEET_ID + "-title";
          title.setAttribute("role", "heading");
          title.setAttribute("aria-level", "2");
          dlg.setAttribute("aria-labelledby", title.id);
        }
        sheet.appendChild(head);
        var list = cameraEl("div", "");
        list.className = "wf-sheet-body wf-nav ctl-sheet-list"; // wf-nav: the family draws the entries as in the bar
        var current = null, first = null;
        cameraPageNavGroupsFor().forEach(function (gr, gi) {
          var gt = list.appendChild(cameraEl("div", null, i18nT(gr.label)));
          gt.className = "wf-nav-group st-group ctl-nav-group";
          gt.setAttribute("data-group", String(gi)); // the family takes the line off the first group
          gr.ids.forEach(function (id) {
            var item = cameraPageNavItem(id, o, function () { cameraPageNavSheetClose(true); o.onTab(id); });
            if (!first) first = item;
            if (o.tab === id) current = item;
            list.appendChild(item);
          });
        });
        sheet.appendChild(list);
        dlg.appendChild(sheet);
        dlg.cameraOpener = opener || null;
        document.body.appendChild(dlg);
        if (typeof dlg.show === "function") dlg.show();
        else dlg.setAttribute("open", "");
        if (opener && opener.setAttribute) opener.setAttribute("aria-expanded", "true");
        cameraPageSheetMakeRoom(dlg); // the camera's own floating viewer never covers the entries
        var focus = current || first; // the list is read from where the person is
        if (focus && typeof focus.focus === "function") focus.focus();
        cameraPageSheetOff = cameraPageSheetDismiss(dlg);
      }

      // Pure: do two rectangles ({ left, top, right, bottom }) share any area?
      function cameraRectsOverlap(a, b) {
        return !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      }

      // The floating viewer of this plugin sits above the page (and above this sheet, which stays below the floating panels for the stops): when it would
      // cover the sheet (a phone, ux review 2026-11-23) it is folded while the sheet is open and comes back when it closes. One read of both boxes, once.
      function cameraPageSheetMakeRoom(dlg) {
        if (typeof isCameraOpen !== "function" || !isCameraOpen() || typeof cameraPanelEl === "undefined" || !cameraPanelEl) return;
        if (typeof dlg.getBoundingClientRect !== "function" || typeof cameraPanelEl.getBoundingClientRect !== "function") return;
        if (!cameraRectsOverlap(dlg.getBoundingClientRect(), cameraPanelEl.getBoundingClientRect())) return;
        cameraCollapse(true);
        dlg.cameraViewerFolded = true;
      }

      // Pure: where the sheet goes for the stops of the page. box = workshopVeilBox() ({ top: the bottom of DWC's bar, right: the width of the control bar })
      // -> the inline position: under the bar and left of the control bar with 8 px of air, at most 440 px wide, centred in what is left.
      function cameraPageSheetBox(box) {
        var top = Math.max(0, (box && box.top) || 0) + 8;
        var right = Math.max(0, (box && box.right) || 0) + 8;
        return {
          top: top + "px",
          right: right + "px",
          left: "8px",
          width: "min(440px, calc(100vw - " + (right + 8) + "px))",
          maxHeight: "calc(100dvh - " + (top + 8) + "px)",
        };
      }

      function cameraPageSheetPlace(dlg) {
        var p = cameraPageSheetBox(typeof workshopVeilBox === "function" ? workshopVeilBox() : null);
        dlg.style.top = p.top;
        dlg.style.right = p.right;
        dlg.style.left = p.left;
        dlg.style.width = p.width;
        dlg.style.maxHeight = p.maxHeight;
      }

      // Esc closes the sheet (a non-modal dialog does not do it by itself) and a press outside it closes it without stopping that press, so the button under
      // the finger (a stop) still gets it. The keyboard order stays where the person is: the sheet lives at the end of <body>, so Tab past its last control
      // (or Shift+Tab before its first) closes it and goes back to the picker instead of jumping to the end or the start of the page.
      // Returns the function that removes the listeners.
      function cameraPageSheetDismiss(dlg) {
        var onKey = function (e) {
          if (e.key === "Tab") {
            var f = cameraPageSheetEdges(dlg);
            var active = typeof document !== "undefined" ? document.activeElement : null;
            if (f && ((!e.shiftKey && active === f.last) || (e.shiftKey && active === f.first))) {
              e.preventDefault();
              cameraPageNavSheetClose(true);
            }
            return;
          }
          if (e.key !== "Escape") return;
          e.stopPropagation();
          cameraPageNavSheetClose(true);
        };
        var onDown = function (e) {
          if (!dlg.contains(e.target)) cameraPageNavSheetClose(false);
        };
        dlg.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onDown, true);
        return function () {
          dlg.removeEventListener("keydown", onKey);
          document.removeEventListener("pointerdown", onDown, true);
        };
      }

      // The first and the last control of the sheet that take the focus (its buttons: the close of the header and the entries), or null
      function cameraPageSheetEdges(dlg) {
        var list = typeof dlg.querySelectorAll === "function" ? Array.prototype.slice.call(dlg.querySelectorAll("button:not([disabled])")) : [];
        return list.length ? { first: list[0], last: list[list.length - 1] } : null;
      }

      // Closes and removes the sheet; refocus: give the focus back to the picker (Esc, Tab out, an entry, the close button), not for a tap somewhere else.
      // A viewer folded to make room for the sheet comes back.
      function cameraPageNavSheetClose(refocus) {
        if (typeof cameraPageSheetOff === "function") cameraPageSheetOff();
        cameraPageSheetOff = null;
        var old = typeof document !== "undefined" && document.getElementById ? document.getElementById(CAMERA_PAGE_SHEET_ID) : null;
        if (!old) return;
        var opener = old.cameraOpener;
        if (typeof old.close === "function" && old.open) old.close();
        if (old.parentNode) old.parentNode.removeChild(old);
        if (opener && opener.setAttribute) opener.setAttribute("aria-expanded", "false");
        if (refocus === true && opener && opener.isConnected !== false && typeof opener.focus === "function") opener.focus();
        if (old.cameraViewerFolded && !pluginStopped && typeof isCameraOpen === "function" && !isCameraOpen() && typeof cameraPanelEl !== "undefined" && cameraPanelEl) cameraExpand();
      }

      // Pure: the form of the bar for a page `w` px wide (criteria C7): "s" < 640 (the picker and its sheet), "m" < 900 (one row that wraps), "l" (the rail)
      function cameraPageWidthClass(w) {
        return w < 640 ? "s" : w < 900 ? "m" : "l";
      }

      // The page says its own width (data-w) to its style sheet: the bar follows the width of the page, not the window (the menu of DWC may take part
      // of it). The observer reads what the browser has just laid out and writes only when the form changes.
      function cameraPageWidthWatch(page) {
        if (typeof ResizeObserver !== "function") return;
        new ResizeObserver(function (entries) {
          var r = entries && entries[0] && entries[0].contentRect;
          if (!r || !(r.width > 0)) return;
          var w = cameraPageWidthClass(r.width);
          if (page.getAttribute("data-w") !== w) page.setAttribute("data-w", w);
          if (w !== "s") cameraPageNavSheetClose(); // the sheet belongs to the narrow form only
        }).observe(page);
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
