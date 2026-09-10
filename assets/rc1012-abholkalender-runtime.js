(function(window){
  'use strict';
  if (!window || window.__EXPORTHUB_RC1012_PICKUPCALENDAR_RUNTIME__) return;
  window.__EXPORTHUB_RC1012_PICKUPCALENDAR_RUNTIME__ = true;

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
