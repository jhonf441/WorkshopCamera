      // ---- Tab "Library" of the page (informe-07, mockup 2026-11-01): the videos and the captures in one place ----
      //
      // The second level tabs (wf-tabs) are All | Videos (n) | Captures (n) | Kept. These pure functions say what each one lists; the cards, the
      // player with its editor, the rename / keep / download / delete are the ones of 17-gallery.js (cameraAssembleGallery).

      var CAMERA_LIBRARY_SUBS = ["all", "video", "photo", "keep"];

      // A2b: the thumbnail of a card. Every draw of the library made a new <img> for each card, and an image that has to load again shows a blank frame:
      // changing the second level tab or any redraw flickered all the pictures. An image that already loaded fine is taken from `cache` (by address) and
      // moved into the new card; only its click is set again (the card it belongs to is new). One that failed or is still loading is made anew, so its note
      // ("no picture") is drawn in the card that is on screen. -> the <img>
      function cameraThumbEl(cache, src, onClick) {
        var im = cache[src];
        if (!(im && im.complete && im.naturalWidth > 0)) {
          im = cameraEl("img", "width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#000;cursor:pointer;"); // 16:9 like the picture of the cameras
          im.src = src;
          im.loading = "lazy";
          cameraOwnError(im); // appended by the caller: the note needs the parent
          cache[src] = im;
        }
        im.onclick = onClick;
        return im;
      }

      // The actions of a card of the library, always on screen (a touch screen has no hover; CAMARA-REDISENO.md): icons of 32 px touched over 40 -- download,
      // keep (pressed while it is kept) and delete with two taps (the first one arms it for CAMERA_ARM_MS, like every delete of the plugin).
      // h = { download(kind, file), keep(files, value), remove(files) }.
      function cameraLibraryCardActions(kind, x, h) {
        var row = cameraEl("div", "");
        row.className = "ctl-mini-acts";
        row.appendChild(cameraIconBtn("mdi-download", i18nT('common.download'), function () { h.download(kind === "video" ? "video" : "photo", x.file); }));
        var keep = cameraIconBtn(x.keep ? "mdi-pin" : "mdi-pin-outline", i18nT('gallery.keep'), function () { h.keep([x.file], !x.keep); });
        keep.setAttribute("aria-pressed", x.keep ? "true" : "false");
        row.appendChild(keep);
        var armed = null;
        var del = cameraIconBtn("mdi-delete-outline", i18nT('gallery.delete_now'), function () {
          if (!armed) {
            del.classList.add("wf-armed");
            del.title = i18nT('common.delete_confirm');
            del.setAttribute("aria-label", del.title);
            armed = setTimeout(function () { armed = null; del.classList.remove("wf-armed"); del.title = i18nT('gallery.delete_now'); del.setAttribute("aria-label", del.title); }, CAMERA_ARM_MS);
            return;
          }
          clearTimeout(armed);
          armed = null;
          h.remove([x.file]);
        });
        row.appendChild(del);
        return row;
      }

      // The family's range picker in the bar of the library, at the scale of the page (its opening button 32 px; the panel it opens keeps its own sizes)
      function cameraRangeCompact(el) {
        if (el && el.classList) el.classList.add("ctl-range");
        return el;
      }

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
