      // ---- Block with reason in the Camera (step 8 of the access control, document PASO8-PLUGINS: "Despues: los que ya comprueban por nivel") ----
      // The plugin decides what a view SHOWS by feature (09-camera-roles.js: cameraCanDo("capture"), "timelapse", "settings"...) and says the role in the
      // panel (cameraRoleBind). This EXTENDS it: under each group of sensitive buttons ONE note (class wf-reason, the shared 09-access-reason.js) says why the
      // service would refuse the group to this person (profile and rule, ceiling, no rule, condition, or the role) from ONE batched auth.can per screen. The
      // buttons keep what they do and how they are confirmed; where the panel already shows the role sentence the note is not added (it would say it twice).
      //   capture    camera.capture, camera.burst                        live tab, studio (burst), floating panel      target workshop:camera:camera/<id>
      //   light      camera.flash                                        live tab                                      target workshop:camera:camera/<id>
      //   timelapse  camera.timelapse, camera.schedule                   live tab, studio (take)                       (the name is not known beforehand)
      //   library    camera.edit, keep, remove, rename, rerender         library tab, studio (rebuild)                 (a file each: no target)
      //   image      camera.image.set                                    image tab, quick profiles of the live tab     target workshop:camera:camera/<id>
      //   cameras    settings.set, camera.detect                         cameras tab (the list and the address scan)
      //   relay      camera.start, camera.stop                           the relay step of the recovery assistant (video system, not a machine stop)
      // Reads (camera.status, camera.image.get, vision.get) are not asked: a page that cannot read says it with its own cover. camera.service reads or writes
      // by its arguments (the service raises the role when `changes` is present) and the answers are asked without arguments: it is left to the role sentence.
      // The relay on port 8090 keeps its own table (what it SERVES: the video and the photos); only what it DOES goes through the API, and that is the list above.
      // The machine has no stop here: nothing of this plugin is in STOP_OPS, and no handler of a stop reads this file.
      var CAMERA_REASON_OPS = {
        capture: ["camera.capture", "camera.burst"],
        light: ["camera.flash"],
        timelapse: ["camera.timelapse", "camera.schedule"],
        library: ["camera.edit", "camera.keep", "camera.remove", "camera.rename", "camera.rerender"],
        image: ["camera.image.set"],
        cameras: ["settings.set", "camera.detect"],
        relay: ["camera.start", "camera.stop"],
      };
      // the operations of a group the service names by camera (access_targets.py)
      var CAMERA_REASON_TARGETED = {
        capture: ["camera.capture", "camera.burst"],
        light: ["camera.flash"],
        image: ["camera.image.set"],
      };
      var CAMERA_REASON_NEED = { capture: "operator", light: "operator", timelapse: "operator", library: "technician", image: "technician", cameras: "technician", relay: "technician" };

      // The items asked for a group: operation names, or { operation, target } for the ones the camera names
      function cameraReasonItems(group, cameraId) {
        var targeted = CAMERA_REASON_TARGETED[group] || [];
        return (CAMERA_REASON_OPS[group] || []).map(function (op) {
          return cameraId && targeted.indexOf(op) >= 0 ? { operation: op, target: "workshop:camera:camera/" + String(cameraId) } : op;
        });
      }

      // The note of a group: an empty element that fills itself when something blocks (and says nothing when nothing does)
      function cameraReasonEl(group, cameraId) {
        if (typeof workshopReasonGroupEl !== "function") return document.createComment("");
        var box = workshopReasonGroupEl(cameraReasonItems(group, cameraId), { need: CAMERA_REASON_NEED[group], subject: i18nT("subjects_camera." + group) });
        box.style.marginTop = "6px";
        return box;
      }
