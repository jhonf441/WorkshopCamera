      // ---- Notices by cause for the JS plugins (DWC 3.6): the twin of SessionNotice.vue / LockReason.vue (ESTANDAR 2.2, 2026-11-05) ----
      //
      // A JS plugin never paints its own notice colors or sentences: it asks for one of these elements. Same DOM and class names as the Vue pieces, the
      // look is design/family.css (inject it with workshopInjectFamily()). Texts: i18n block "notice" (same sentences as shared.notice_* of Vue).
      //   workshopNoticeKindOf({ reason, serviceDown, error })   "session" | "role" | "down" | "error" | ""   (reason = workshopAccessReason)
      //   workshopNoticeText(kind, needed)                        the one sentence of a cause; needed = a role id ("operator"...)
      //   workshopNoticeEl(kind, variant, opts)                   N2 note (variant "section") or N4 cover (variant "cover");
      //                                                           opts = { text, title, needed, action: "sign-in" | "retry" | "", onRetry }
      //   workshopReasonEl(kind, text)                            N3, the reason next to a disabled control or group (text optional)
      //   workshopLockReasonEl(op, need, ctx)                     N3 decided by the access rule of the operation; null when the person may

      var WORKSHOP_NOTICE_ICONS = {
        session: "mdi-account-lock-outline",
        role: "mdi-lock-outline",
        down: "mdi-power-plug-off-outline",
        error: "mdi-alert-circle-outline",
        empty: "mdi-information-outline",
      };

      function workshopNoticeKindOf(o) {
        o = o || {};
        if (o.reason === "signed_out") return "session";
        if (o.reason === "role") return "role";
        if (o.serviceDown) return "down";
        if (o.error) return "error";
        return "";
      }

      function workshopNoticeRoleName(role) {
        var known = { viewer: "notice.lockrole_viewer", operator: "notice.lockrole_operator", technician: "notice.lockrole_technician", admin: "notice.lockrole_admin" };
        return i18nT(known[role] || known.viewer);
      }

      function workshopNoticeText(kind, needed) {
        if (kind === "session") return i18nT("notice.notice_session_reason");
        if (kind === "role") {
          var mine = typeof workshopRole === "function" ? workshopRole() : "";
          return i18nT("notice.notice_role_reason", { needed: workshopNoticeRoleName(needed || "technician"), role: workshopNoticeRoleName(mine) });
        }
        if (kind === "down") return i18nT("notice.notice_down_reason");
        return "";
      }

      function workshopNoticeDomEl(tag, cls, text) {
        if (typeof workshopInjectFamily === "function") workshopInjectFamily(); // the styles are design/family.css (once per page)
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
      }

      function workshopNoticeIconEl(kind, cls) {
        var ic = workshopNoticeDomEl("span", cls + " mdi " + (WORKSHOP_NOTICE_ICONS[kind] || WORKSHOP_NOTICE_ICONS.error));
        ic.setAttribute("aria-hidden", "true");
        return ic;
      }

      function workshopNoticeCoverTitle(kind) {
        var keys = { session: "notice.notice_session_cover_title", role: "notice.notice_role_cover_title", down: "notice.notice_down_cover_title", error: "notice.notice_error_cover_title" };
        return keys[kind] ? i18nT(keys[kind]) : "";
      }

      // the action of a notice: sign-in (the same dialog as the chip) or retry; the default is the one of ESTANDAR 2.2 (cover only)
      function workshopNoticeAction(kind, variant, opts) {
        if (opts.action !== undefined && opts.action !== null) return opts.action;
        if (variant !== "cover") return "";
        return kind === "session" ? "sign-in" : kind === "down" ? "retry" : "";
      }

      function workshopNoticeButton(act, cls, opts) {
        var b = workshopNoticeDomEl("button", "wf-btn " + cls, act === "retry" ? i18nT("notice.notice_retry") : i18nT("notice.notice_sign_in"));
        b.type = "button";
        b.addEventListener("click", function () {
          if (act === "retry") {
            if (typeof opts.onRetry === "function") opts.onRetry();
          } else if (typeof workshopLogin === "function") {
            workshopLogin();
          }
        });
        return b;
      }

      function workshopNoticeEl(kind, variant, opts) {
        opts = opts || {};
        var cover = variant === "cover";
        var css = !cover && kind === "empty" ? "role" : kind;
        var box = workshopNoticeDomEl("div", (cover ? "wf-cover wf-cover--" : "wf-notice wf-notice--") + css);
        box.setAttribute("role", cover ? "status" : "note");
        box.appendChild(workshopNoticeIconEl(kind, cover ? "wf-cover-icon" : "wf-notice-icon"));
        var text = opts.text || (kind === "session" && cover ? i18nT("notice.notice_session_cover") : workshopNoticeText(kind, opts.needed));
        var act = workshopNoticeAction(kind, variant, opts);
        if (cover) {
          var title = opts.title || workshopNoticeCoverTitle(kind);
          if (title) box.appendChild(workshopNoticeDomEl("div", "wf-cover-title", title));
          if (text) box.appendChild(workshopNoticeDomEl("div", "wf-cover-text", text));
          if (act) box.appendChild(workshopNoticeButton(act, "wf-main", opts));
        } else {
          var body = workshopNoticeDomEl("div", "wf-notice-body");
          body.appendChild(workshopNoticeDomEl("div", "wf-notice-text", text));
          box.appendChild(body);
          if (act) box.appendChild(workshopNoticeButton(act, "wf-notice-action", opts));
        }
        return box;
      }

      function workshopReasonEl(kind, text) {
        var box = workshopNoticeDomEl("div", "wf-reason wf-reason--" + kind);
        box.setAttribute("role", "note");
        box.appendChild(workshopNoticeIconEl(kind, "wf-reason-icon"));
        box.appendChild(workshopNoticeDomEl("span", "wf-reason-text", text || workshopNoticeText(kind)));
        return box;
      }

      function workshopLockReasonEl(op, need, ctx) {
        var reason = typeof workshopAccessReason === "function" ? workshopAccessReason(op, ctx) : "";
        var kind = workshopNoticeKindOf({ reason: reason });
        if (!kind) return null;
        return workshopReasonEl(kind, workshopNoticeText(kind, need));
      }
