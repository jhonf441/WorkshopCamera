      // ---- The tabs of the page "Timelapses and captures" (informe-07) ----
      //
      // The page is the home of everything that is not just LOOKING at a camera: the floating viewer keeps the image, the zoom, the camera
      // selector, the flash, the quick capture and one button that opens this page. One list says which tab each view gets, so the side bar,
      // the saved tab and the dispatch of the page cannot disagree about it.

      var CAMERA_PAGE_TAB_KEY = "workshopTlTab"; // the tab this screen had last (localStorage)

      // [id, icon, the view feature that shows it (09-camera-roles.js)]
      var CAMERA_PAGE_TABS = [
        ["record", "mdi-record-rec", "gallery"],
        ["studio", "mdi-movie-edit-outline", "settings"],
        ["videos", "mdi-movie-open-outline", "gallery"],
        ["captures", "mdi-image-multiple-outline", "gallery"],
        ["cameras", "mdi-cctv", "cameras"],
        ["image", "mdi-camera-iris", "cameras"],
        ["settings", "mdi-cog-outline", "settings"],
      ];

      // Pure. The ids of the tabs a view can use, in order; canDo(feature) says whether the view has a feature.
      function cameraPageTabsFor(canDo) {
        return CAMERA_PAGE_TABS.filter(function (t) { return canDo(t[2]); }).map(function (t) { return t[0]; });
      }

      function cameraPageTabIcon(id) {
        return CAMERA_PAGE_TABS.filter(function (t) { return t[0] === id; })[0][1];
      }

      // The words of a tab; the videos and captures carry how many there are (null = not read yet).
      function cameraPageTabLabel(id, tls, caps) {
        if (id === "record") return i18nT('gallery.record');
        if (id === "studio") return i18nT('studio.nav');
        if (id === "videos") return i18nT('common.videos') + (tls ? " (" + tls.length + ")" : "");
        if (id === "captures") return i18nT('common.captures') + (caps ? " (" + caps.length + ")" : "");
        if (id === "cameras") return i18nT('cameras.cameras');
        if (id === "image") return i18nT('image.nav');
        return i18nT('common.settings');
      }

      // Pure. The tabs that hold what the person is typing (an editor, a draft, a slider) are not redrawn by the 3 s reload of the page.
      function cameraPageReloads(tab) {
        return ["studio", "cameras", "image"].indexOf(tab) < 0;
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
        cameraPageTabsFor(cameraCanDo).forEach(function (id) {
          var label = cameraPageTabLabel(id, o.tls, o.caps);
          var b = cameraEl("button", "");
          b.className = "wf-nav-item ctl-nav-item" + (o.tab === id ? " on" : "");
          b.type = "button";
          b.title = label;
          b.appendChild(cameraEl("span", "")).className = "wf-nav-icon mdi " + cameraPageTabIcon(id);
          b.appendChild(cameraEl("span", null, label)).className = "tx";
          b.addEventListener("click", function () { o.onTab(id); });
          nav.appendChild(b);
        });
        return nav;
      }

      // To the page of the plugin, on a tab (the Record tab holds the capture and the timelapse): the route is pushed through the host; without a
      // host to push it, a plain navigation. The button of the viewer and the page itself ask for it here.
      function cameraOpenPage(tab) {
        if (tab) {
          try { localStorage.setItem(CAMERA_PAGE_TAB_KEY, tab); } catch (e) { /* the page opens on the tab it had */ }
        }
        if (!workshopHostPush(CAMERA_GAL_PATH)) window.location.href = CAMERA_GAL_PATH;
      }

      // Pure. Whether the viewer shows its button to the page: the view must have the gallery (a visitor would get a page that says
      // "no permission") and the page must be registered (the plugin that owns the route is running).
      function cameraPageLinkShown(canGallery, pageRegistered) {
        return !!canGallery && !!pageRegistered;
      }
