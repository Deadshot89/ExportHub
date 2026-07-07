"use strict";
/* RC271 externe Patch-Datei */
(function () {
  if (window.__EXPORTHUB_RC271__) return;
  window.__EXPORTHUB_RC271__ = true;

  function css(id, text) {
    if (document.getElementById(id)) return;
    var s = document.createElement("style");
    s.id = id;
    s.textContent = text;
    document.head.appendChild(s);
  }

  css("rc271-css", `
    #rc271ColliActions{
      display:flex!important;
      gap:8px!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      margin:12px 0!important;
      padding:10px!important;
      border:1px solid #bfdbfe!important;
      background:#eff6ff!important;
      border-radius:12px!important;
    }
    #rc271ColliActions button{
      min-height:38px!important;
      padding:8px 14px!important;
      border-radius:10px!important;
      font-weight:900!important;
      cursor:pointer!important;
    }
    #rc271ColliActions .primary{
      background:linear-gradient(135deg,#2563eb,#05b8ff)!important;
      color:white!important;
      border:0!important;
    }
    #rc271ColliActions .secondary{
      background:white!important;
      color:#0f172a!important;
      border:1px solid #bfdbfe!important;
    }
    #rc271RefBox{
      display:block!important;
      margin:10px 0!important;
      padding:10px!important;
      border:1px solid #bfdbfe!important;
      background:#eff6ff!important;
      border-radius:12px!important;
    }
    #rc271RefBox button{
      margin-right:8px!important;
      margin-top:6px!important;
    }
    #rc268ColliActions,
    .rc246-ref-doc-box,
    #rc258RefUploadBar,
    #rc259RefFolderBar,
    #rc260RefFolderBar,
    #rc265RefBox{
      display:none!important;
    }
  `);

  function getState() {
    try { return typeof state !== "undefined" ? state : null; } catch (e) { return null; }
  }

  function currentView() {
    var s = getState();
    return String((s && s.view) || "");
  }

  function text(el) {
    return String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function findColliCard() {
    var heads = Array.from(document.querySelectorAll("h2,h3,h4"));
    var h = heads.find(function (x) {
      return /Collis,\s*(Masse|Maße),\s*Gewicht,\s*Lademeter/i.test(x.textContent || "");
    });
    if (h) return h.closest(".card,section,article,div");
    var rows = document.getElementById("rowsBox");
    return rows ? rows.closest(".card,section,article,div") : null;
  }

  function findDeliveryField() {
    return Array.from(document.querySelectorAll("label,.field,div")).find(function (el) {
      return /Lieferscheine\s*\/\s*DNCs\s*manuell/i.test(el.textContent || "");
    });
  }

  function hideDuplicateButtons() {
    if (currentView() !== "shipment") return;

    Array.from(document.querySelectorAll("button,a")).forEach(function (el) {
      if (el.closest("#rc271ColliActions")) return;
      if (el.closest("#rc271RefBox")) return;

      var t = text(el);

      if (/^(CMR\/Ladeliste Vorschau|Ladeliste\/CMR Vorschau)$/i.test(t)) {
        el.style.display = "none";
      }

      if (/^ABD erstellen$/i.test(t) || /^ABD Anfrage$/i.test(t) || /^ABD Anfrage an GPZ$/i.test(t)) {
        el.style.display = "none";
      }

      if (/Sendung speichern.*Aufgaben/i.test(t)) {
        el.style.display = "none";
      }
    });
  }

  window.rc271SaveShipment = function () {
    try {
      if (typeof saveShipment === "function") {
        saveShipment();
        return false;
      }
    } catch (e) {}
    alert("Speicherfunktion nicht gefunden.");
    return false;
  };

  window.rc271ShowCmr = function () {
    try {
      if (typeof showCurrentCmr === "function") {
        showCurrentCmr();
        return false;
      }
    } catch (e) {}

    try {
      if (typeof setView === "function") {
        setView("cmr");
        return false;
      }
    } catch (e) {}

    alert("CMR/Ladeliste Vorschau nicht gefunden.");
    return false;
  };

  window.rc271OpenAbd = function () {
    try {
      if (typeof rc265OpenAbdPanel === "function") {
        rc265OpenAbdPanel();
        return false;
      }
    } catch (e) {}

    try {
      if (typeof rc260OpenAbdRequest === "function") {
        rc260OpenAbdRequest();
        return false;
      }
    } catch (e) {}

    alert("ABD erstellen ist nicht geladen.");
    return false;
  };

  window.rc271OpenReferenceFolder = function () {
    try {
      if (typeof rc265OpenReferenceFolder === "function") return rc265OpenReferenceFolder();
    } catch (e) {}

    try {
      if (typeof rc246OpenReferenceFolder === "function") return rc246OpenReferenceFolder();
    } catch (e) {}

    alert("Referenzordner-Funktion nicht gefunden.");
    return false;
  };

  window.rc271ImportReferenceFolder = function () {
    try {
      if (typeof rc265ImportReferenceFolder === "function") return rc265ImportReferenceFolder();
    } catch (e) {}

    try {
      if (typeof rc246OpenReferenceFolderPicker === "function") return rc246OpenReferenceFolderPicker();
    } catch (e) {}

    alert("Dateien aus Ref.-Ordner übernehmen ist nicht geladen.");
    return false;
  };

  function ensureActionBar() {
    if (currentView() !== "shipment") return;

    var card = findColliCard();
    if (!card) return;

    var bar = document.getElementById("rc271ColliActions");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "rc271ColliActions";

      var anchor =
        card.querySelector(".summaryGrid") ||
        Array.from(card.querySelectorAll(".okbox,.badbox,.notice")).find(function (x) {
          return /Colli-Daten|Collis/i.test(x.textContent || "");
        });

      if (anchor) anchor.insertAdjacentElement("afterend", bar);
      else card.appendChild(bar);
    }

    bar.innerHTML =
      '<button type="button" class="primary" onclick="return rc271SaveShipment()">Sendung speichern + Aufgaben prüfen</button>' +
      '<button type="button" class="secondary" onclick="return rc271ShowCmr()">Ladeliste/CMR Vorschau</button>' +
      '<button type="button" class="secondary" onclick="return rc271OpenAbd()">ABD erstellen</button>';
  }

  function ensureReferenceBox() {
    if (currentView() !== "shipment") return;

    var target = findDeliveryField();
    if (!target) return;

    var box = document.getElementById("rc271RefBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "rc271RefBox";
      box.innerHTML =
        '<strong>Referenzordner</strong><br>' +
        '<button type="button" onclick="return rc271OpenReferenceFolder()">Ref.-Ordner öffnen</button>' +
        '<button type="button" onclick="return rc271ImportReferenceFolder()">Dateien aus Ref.-Ordner übernehmen</button>';
    }

    if (!target.nextElementSibling || target.nextElementSibling.id !== "rc271RefBox") {
      target.insertAdjacentElement("afterend", box);
    }
  }

  function run() {
    hideDuplicateButtons();
    ensureActionBar();
    ensureReferenceBox();
  }

  setInterval(run, 700);
  setTimeout(run, 200);
  setTimeout(run, 1000);
})();
