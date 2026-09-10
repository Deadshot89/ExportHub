(function(window){
  'use strict';
  if (!window || window.__EXPORTHUB_RC1012_PICKUPCALENDAR_RUNTIME__) return;
  window.__EXPORTHUB_RC1012_PICKUPCALENDAR_RUNTIME__ = true;

  const nativePrint = typeof window.print === 'function' ? window.print.bind(window) : null;

  function installPickupPrintIsolation(){
    if (!nativePrint || !window.document || window.__EXPORTHUB_PICKUP_PRINT_ISOLATION__) return;
    window.__EXPORTHUB_PICKUP_PRINT_ISOLATION__ = true;
    window.print = function(){
      const doc = window.document;
      const body = doc.body;
      const portal = body && body.querySelector && body.querySelector('.pickup-print-portal');
      if (!body || !portal || !body.classList || !body.classList.contains('pickup-print-active')) return nativePrint();

      const frame = doc.createElement('iframe');
      frame.setAttribute('aria-hidden','true');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.border = '0';
      frame.style.opacity = '0';
      body.appendChild(frame);

      const printWindow = frame.contentWindow;
      const printDocument = frame.contentDocument || (printWindow && printWindow.document);
      if (!printWindow || !printDocument) {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
        return nativePrint();
      }

      const printHtml = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Abholplan</title><style>
@page{size:A4 landscape;margin:8mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
.pickup-print-sheet{display:grid;grid-template-rows:auto 1fr;gap:5mm;width:100%;height:190mm;overflow:hidden}
.pickup-print-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #555;padding:0 0 3mm}
.pickup-print-head h1{margin:0;font-size:22pt;line-height:1;font-weight:800}
.pickup-print-head p{margin:1.5mm 0 0;font-size:10pt}
.pickup-print-meta{display:grid;grid-template-columns:auto auto;gap:1mm 3mm;align-items:center;font-size:9pt}
.pickup-print-meta span{font-weight:400}.pickup-print-meta strong{font-weight:700}
.pickup-print-week{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid #666;min-height:0}
.pickup-print-day{display:block;min-width:0;border-right:1px solid #888;padding:0 3mm 3mm;overflow:hidden}
.pickup-print-day:last-child{border-right:0}
.pickup-print-day h3{display:block;margin:0 -3mm;padding:2.5mm 2mm;text-align:center;font-size:11pt;border-bottom:1px solid #999;background:#f2f2f2}
.pickup-print-date{display:block;text-align:center;font-size:7.5pt;color:#555;padding:1.5mm 0 2mm}
.pickup-print-entries{display:grid;gap:2.4mm}
.pickup-print-entry{display:block;padding:0 0 2mm;border-bottom:1px solid #ddd;line-height:1.2;break-inside:avoid}
.pickup-print-entry:last-child{border-bottom:0}
.pickup-print-entry strong{display:block;font-size:9.5pt;overflow-wrap:anywhere}
.pickup-print-entry small{display:block;margin-top:.7mm;font-size:7.5pt;color:#222;overflow-wrap:anywhere}
.pickup-print-empty{display:block;text-align:center;color:#777;font-size:10pt;padding-top:4mm}
</style></head><body>${portal.innerHTML}</body></html>`;

      printDocument.open();
      printDocument.write(printHtml);
      printDocument.close();

      let cleaned = false;
      const cleanup = function(){
        if (cleaned) return;
        cleaned = true;
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      };
      if (printWindow.addEventListener) printWindow.addEventListener('afterprint',cleanup,{once:true});
      if (printWindow.focus) printWindow.focus();
      printWindow.print();
      if (window.setTimeout) window.setTimeout(cleanup,1500);
    };
  }

  installPickupPrintIsolation();

  function getState(){
    try {
      if (typeof window.__EXPORTHUB_GET_STATE__ === 'function') return window.__EXPORTHUB_GET_STATE__() || {};
    } catch (_) {}
    return window.ExportHUBClean && window.ExportHUBClean.state || window.appState || {};
  }

  function environment(){
    const forced = String(window.__EXPORTHUB_FORCED_ENVIRONMENT__ || '').toLowerCase();
    if (forced === 'demo' || forced === 'testservice' || forced === 'production') return forced;
    const host = String(window.location && window.location.hostname || '').toLowerCase();
    const path = String(window.location && window.location.pathname || '').toLowerCase();
    if (path.includes('demo.html')) return 'demo';
    if (host.includes('-testservice.')) return 'testservice';
    return 'production';
  }

  function shipments(){
    const state = getState();
    return Array.isArray(state.shipments) ? state.shipments : [];
  }

  function companyId(){
    const state = getState();
    const user = state && state.currentUser && typeof state.currentUser === 'object' ? state.currentUser : {};
    const candidates = [
      state && state.companyId,
      state && state.currentCompanyId,
      state && state.activeCompanyId,
      state && state.companyKey,
      user.companyId,
      user.companyKey,
      window.__EXPORTHUB_COMPANY_ID__
    ];
    for (const candidate of candidates) {
      const value = String(candidate == null ? '' : candidate).trim();
      if (value) return value;
    }
    return '';
  }

  function shipmentTarget(shipment){
    if (shipment == null) return '';
    if (typeof shipment !== 'object') return String(shipment).trim();
    const candidates = [shipment.reference,shipment.ref,shipment.shipmentRef,shipment.referenceNumber,shipment.referenceNo,shipment.id,shipment.shipmentId];
    for (const candidate of candidates) {
      const value = String(candidate == null ? '' : candidate).trim();
      if (value) return value;
    }
    return '';
  }

  function openShipment(shipment){
    const target = shipmentTarget(shipment);
    if (!target) return false;
    if (typeof window.openShipment === 'function') return window.openShipment(target);
    if (typeof window.__EXPORTHUB_OPEN_SHIPMENT__ === 'function') return window.__EXPORTHUB_OPEN_SHIPMENT__(target);
    return false;
  }

  function allowed(){
    try {
      return typeof window.canRead !== 'function' || window.canRead('pickupcalendar');
    } catch (_) {
      return false;
    }
  }

  window.pickupcalendar = function(){
    const root = window.document && window.document.getElementById('content');
    if (!root) return false;
    if (!allowed()) {
      root.innerHTML = '<div class="noaccess"><h2>Kein Leserecht</h2><p>Der Abholkalender ist für deinen Benutzer nicht freigegeben.</p></div>';
      return true;
    }
    if (!window.ExportHubPickupCalendar || typeof window.ExportHubPickupCalendar.mount !== 'function') {
      root.innerHTML = '<section class="card"><h1>Abholkalender</h1><p>Der Kalender konnte nicht geladen werden.</p></section>';
      return false;
    }
    window.ExportHubPickupCalendar.mount(root,{
      environment: environment(),
      companyId: companyId(),
      shipments: shipments(),
      onOpenShipment: openShipment
    });
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
