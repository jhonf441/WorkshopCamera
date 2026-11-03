      // ---- Tab "Library" of the page (informe-07, mockup 2026-11-01): the videos and the captures in one place ----
      //
      // The second level tabs (wf-tabs) are All | Videos (n) | Captures (n) | Kept. These pure functions say what each one lists; the cards, the
      // player with its editor, the rename / keep / download / delete are the ones of 17-gallery.js (cameraAssembleGallery).

      var CAMERA_LIBRARY_SUBS = ["all", "video", "photo", "keep"];

      // Pure. "all" when the id is not one of the second level tabs.
      function cameraLibrarySub(id) {
        return CAMERA_LIBRARY_SUBS.indexOf(id) >= 0 ? id : "all";
      }

      // Pure. How many each second level tab holds: { all, video, photo, keep }; a list that is null (the relay did not answer) counts as empty.
      function cameraLibraryCounts(tls, caps) {
        var v = tls || [], c = caps || [];
        var keep = function (l) { return l.filter(function (x) { return !!x.keep; }).length; };
        return { all: v.length + c.length, video: v.length, photo: c.length, keep: keep(v) + keep(c) };
      }

      // Pure. What a second level tab lists: [{kind: "video" | "photo", x}] of the lists the relay gave, the ones that pass(x) (the search),
      // the newest first. "keep" = the ones the person asked not to delete by themselves.
      function cameraLibraryItems(tls, caps, sub, passes) {
        var out = [];
        if (sub !== "photo") (tls || []).forEach(function (x) { out.push({ kind: "video", x: x }); });
        if (sub !== "video") (caps || []).forEach(function (x) { out.push({ kind: "photo", x: x }); });
        return out
          .filter(function (it) { return (sub !== "keep" || it.x.keep) && passes(it.x); })
          .sort(function (a, b) {
            var da = String(a.x.start || a.x.ts || ""), db = String(b.x.start || b.x.ts || "");
            return da < db ? 1 : da > db ? -1 : 0;
          });
      }

      // Pure. Whether the library holds something the page must not redraw over (the 3 s reload): a player open (it would restart and lose its
      // trim points) or a selection in progress.
      function cameraLibraryBusy(viewing, chosenCount) {
        return !!viewing || chosenCount > 0;
      }
