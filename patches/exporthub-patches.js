"use strict";
/* RC274.1: Referenzordner nur im Lieferschein-Uploadbereich */
(function () {
  if (window.__EXPORTHUB_RC274_1__) return;
  window.__EXPORTHUB_RC274_1__ = true;

  function stateSafe() {
    try { return typeof state !== "undefined" && state ? state : null; } catch (e) { return null; }
  }

  function inShipment() {
    var s = stateSafe();
    return String((s && s.view) || "") === "shipment";
  }

  function text(el) {
    return String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function css() {
    if (document.getElementById("rc274-1-style")) return;
    var s = document.createElement("style");
    s.id = "rc274-1-style";
    s.textContent = `
      #rc274RefFolderBox{
        margin:8px 0 10px!important;
        padding:10px!important;
        border:1px solid #93c5fd!important;
        background:#eff6ff!important;
        border-radius:12px!important;
      }
      #rc274RefFolderBox .title{
        font-weight:1000!important;
        color:#08245d!important;
        margin-bottom:6px!important;
      }
      #rc274RefFolderBox button{
        min-height:34px!important;
        padding:7px 12px!important;
        border-radius:9px!important;
        border:1px solid #bfdbfe!important;
        background:#fff!important;
        color:#0f172a!important;
        font-weight:850!important;
        cursor:pointer!important;
        margin-right:8px!important;
      }
      #rc270RefBox,#rc271RefBox,#rc272RefBox{display:none!important;}
    `;
    document.head.appendChild(s);
  }

  function uploadArea() {
    var all = Array.from(document.querySelectorAll("label,.field,div,section,article"));
    var hit = all.find(function (el) {
      return /Lieferscheine\s+hochladen\s*\/\s*(anhaengen|anhängen)/i.test(text(el));
    });
    if (hit) return hit.closest("label,.field,section,article,div") || hit;

    var input = Array.from(document.querySelectorAll('input[type="file"]')).find(function (el) {
      return /Lieferscheine|DNC/i.test(text(el.closest("div,section,article") || document.body));
    });
    return input ? (input.closest("label,.field,section,article,div") || input.parentElement) : null;
  }

  function currentRef() {
    var s = stateSafe();
    var sh = s && (s.shipment || s.currentShipment || null);

    if (s && s.activeShipmentId && Array.isArray(s.shipments)) {
      var found = s.shipments.find(function (x) {
        return String(x.id) === String(s.activeShipmentId);
      });
      if (found) sh = found;
    }

    return String((sh && (sh.ref || sh.reference || sh.referenceNumber)) || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 24);
  }

  window.rc274OpenReferenceFolder = function () {
    try { if (typeof rc265OpenReferenceFolder === "function") return rc265OpenReferenceFolder(); } catch (e) {}
    try { if (typeof rc246OpenReferenceFolder === "function") return rc246OpenReferenceFolder(); } catch (e) {}
    try { if (typeof rc260OpenReferenceFolder === "function") return rc260OpenReferenceFolder(); } catch (e) {}

    var ref = currentRef();
    if (!ref) {
      alert("Bitte zuerst eine Referenznummer erstellen.");
      return false;
    }

    window.open(
      "https://essentra-my.sharepoint.com/:f:/r/personal/tobiaslimberg_essentra_com/Documents/003%20Export/ExportHub/Sendungen/" +
      encodeURIComponent(ref) +
      "?csf=1&web=1",
      "_blank",
      "noopener,noreferrer"
    );
    return false;
  };

  window.rc274ImportReferenceFolder = function () {
    try { if (typeof rc265ImportReferenceFolder === "function") return rc265ImportReferenceFolder(); } catch (e) {}
    try { if (typeof rc246OpenReferenceFolderPicker === "function") return rc246OpenReferenceFolderPicker(); } catch (e) {}
    alert("Dateien aus Ref.-Ordner übernehmen ist noch nicht geladen.");
    return false;
  };

  function hideOld() {
    Array.from(document.querySelectorAll("#rc270RefBox,#rc271RefBox,#rc272RefBox")).forEach(function (el) {
      el.style.display = "none";
    });
  }

  function run() {
    css();
    hideOld();

    if (!inShipment()) {
      var old = document.getElementById("rc274RefFolderBox");
      if (old) old.remove();
      return;
    }

    var target = uploadArea();
    if (!target) return;

    var box = document.getElementById("rc274RefFolderBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "rc274RefFolderBox";
      box.innerHTML =
        '<div class="title">Referenzordner</div>' +
        '<button type="button" onclick="return rc274OpenReferenceFolder()">Ref.-Ordner öffnen</button>' +
        '<button type="button" onclick="return rc274ImportReferenceFolder()">Dateien aus Ref.-Ordner übernehmen</button>';
    }

    if (target.nextElementSibling !== box) {
      target.insertAdjacentElement("afterend", box);
    }
  }

  setInterval(run, 800);

  var oldRender = window.render || null;
  if (typeof oldRender === "function" && !oldRender.__rc274_1_wrapped) {
    window.render = function () {
      var result = oldRender.apply(this, arguments);
      setTimeout(run, 100);
      setTimeout(run, 400);
      return result;
    };
    window.render.__rc274_1_wrapped = true;
    try { render = window.render; } catch (e) {}
  }

  setTimeout(run, 100);
  setTimeout(run, 1000);
})();
