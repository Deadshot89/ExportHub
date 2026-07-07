"use strict";
/* RC274.2: Referenzordner nur direkt beim Lieferschein-Upload anzeigen */
(function () {
  if (window.__EXPORTHUB_RC274_2__) return;
  window.__EXPORTHUB_RC274_2__ = true;

  function s() {
    try { return typeof state !== "undefined" ? state : null; } catch (e) { return null; }
  }

  function isShipment() {
    var st = s();
    return String((st && st.view) || "") === "shipment";
  }

  function text(el) {
    return String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function style() {
    if (document.getElementById("rc274-2-style")) return;
    var el = document.createElement("style");
    el.id = "rc274-2-style";
    el.textContent = `
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
      #rc270RefBox,
      #rc271RefBox,
      #rc272RefBox,
      .rc246-ref-doc-box,
      #rc258RefUploadBar,
      #rc259RefFolderBar,
      #rc260RefFolderBar,
      #rc265RefBox{
        display:none!important;
      }
    `;
    document.head.appendChild(el);
  }

  function currentRef() {
    var st = s();
    var sh = st && (st.shipment || st.currentShipment || null);

    if (st && st.activeShipmentId && Array.isArray(st.shipments)) {
      var found = st.shipments.find(function (x) {
        return String(x.id) === String(st.activeShipmentId);
      });
      if (found) sh = found;
    }

    return String((sh && (sh.ref || sh.reference || sh.referenceNumber)) || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 24);
  }

  function findUploadBlock() {
    var fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));

    var input = fileInputs.find(function (el) {
      var area = el.closest("label,.field,div,section,article") || el.parentElement;
      var nearby = text(area) + " " + text(area && area.parentElement);
      return /Lieferscheine|DNC/i.test(nearby);
    });

    if (!input && fileInputs.length) input = fileInputs[0];
    if (!input) return null;

    return input.closest("label,.field,div,section,article") || input.parentElement;
  }

  function hideOldRefBlocks() {
    Array.from(document.querySelectorAll("#rc270RefBox,#rc271RefBox,#rc272RefBox,.rc246-ref-doc-box,#rc258RefUploadBar,#rc259RefFolderBar,#rc260RefFolderBar,#rc265RefBox"))
      .forEach(function (el) {
        el.style.display = "none";
      });

    Array.from(document.querySelectorAll("div,section,article")).forEach(function (el) {
      if (el.id === "rc274RefFolderBox") return;
      var t = text(el);
      if (/^Referenzordner\s*(Ref\.-Ordner öffnen|Dateien aus Ref\.-Ordner)/i.test(t)) {
        el.style.display = "none";
      }
      if (/Referenzordner\s+[A-Z0-9]{4,}/i.test(t) && /Ref\.-Ordner/i.test(t)) {
        el.style.display = "none";
      }
    });
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

  function run() {
    style();
    hideOldRefBlocks();

    if (!isShipment()) {
      var old = document.getElementById("rc274RefFolderBox");
      if (old) old.remove();
      return;
    }

    var target = findUploadBlock();
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

  setInterval(run, 700);

  var oldRender = window.render || null;
  if (typeof oldRender === "function" && !oldRender.__rc274_2_wrapped) {
    window.render = function () {
      var result = oldRender.apply(this, arguments);
      setTimeout(run, 100);
      setTimeout(run, 400);
      return result;
    };
    window.render.__rc274_2_wrapped = true;
    try { render = window.render; } catch (e) {}
  }

  setTimeout(run, 100);
  setTimeout(run, 1000);
})();
