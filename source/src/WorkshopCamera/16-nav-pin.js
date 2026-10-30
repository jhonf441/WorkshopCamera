      // ---- Pin of the side bar of the Camera page (same behavior as the bars of Vision, Workbench and the Vue pages) ----
      // Pinned: the bar keeps its state when a section is chosen; not pinned: it folds to its icons. Remembered per browser.

      var CAMERA_NAV_PIN_KEY = "workshopCameraNavPinned";

      function cameraNavPinGet() {
        try {
          return localStorage.getItem(CAMERA_NAV_PIN_KEY) === "1";
        } catch (e) {
          return false;
        }
      }

      function cameraNavPinSet(on) {
        try {
          localStorage.setItem(CAMERA_NAV_PIN_KEY, on ? "1" : "0");
        } catch (e) {
          /* no storage: the pin is only kept while the page is open */
        }
      }

      // Head of the bar: pin button (only while the bar is open, with its name) + the fold arrow
      function cameraNavHead(pinned, folded, foldButton, onPin) {
        var pin = cameraEl("button", "");
        pin.type = "button";
        pin.className = "ctln-fold ctln-pin" + (pinned ? " pinned" : "");
        pin.title = pinned ? i18nT("common.unpin_bar") : i18nT("common.pin_bar");
        pin.setAttribute("aria-pressed", pinned ? "true" : "false");
        pin.appendChild(cameraEl("span", "")).className = "mdi " + (pinned ? "mdi-pin" : "mdi-pin-outline");
        if (!folded) pin.appendChild(cameraEl("span", null, i18nT("common.pin_label"))).className = "tx-pin";
        pin.addEventListener("click", onPin);
        var head = cameraEl("div", "");
        head.className = "ctln-head";
        if (!folded) head.appendChild(pin);
        head.appendChild(foldButton);
        return head;
      }
