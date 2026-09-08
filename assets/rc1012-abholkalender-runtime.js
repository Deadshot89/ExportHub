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

  function openShipment(shipment){
    if (typeof window.openShipment === 'function') return window.openShipment(shipment);
    if (typeof window.__EXPORTHUB_OPEN_SHIPMENT__ === 'function') return window.__EXPORTHUB_OPEN_SHIPMENT__(shipment);
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
      shipments: shipments(),
      onOpenShipment: openShipment
    });
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
