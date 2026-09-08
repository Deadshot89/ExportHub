(function(root){
  'use strict';

  const WEEKDAYS = Object.freeze({1:'Montag',2:'Dienstag',3:'Mittwoch',4:'Donnerstag',5:'Freitag'});
  let mountedRoot = null;
  let mountedState = null;
  let mountedOptions = null;
  let eventsBound = false;

  function number(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function positive(value){
    const n = number(value);
    return n > 0 ? Math.max(0, Math.round(n)) : 0;
  }
  function nonNegative(value){
    const n = number(value);
    return Math.max(0, Math.round(n));
  }
  function pad(value){ return String(value).padStart(2,'0'); }
  function dateKeyLocal(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function weekdayLabel(weekday){ return WEEKDAYS[Number(weekday)] || ''; }
  function plannedDateValue(value){
    if (value instanceof Date) return dateKeyLocal(value);
    const raw = String(value == null ? '' : value).trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }
  function shipmentPickupDate(shipment){
    const sh = shipment && typeof shipment === 'object' ? shipment : {};
    for (const key of ['plannedPickupDate','pickupDate','pickdate']) {
      const value = plannedDateValue(sh[key]);
      if (value) return value;
    }
    return '';
  }
  function shipmentColliState(shipment){
    const sh = shipment && typeof shipment === 'object' ? shipment : {};
    const expected = positive(sh.expectedColliCount || sh.totalCollis || sh.totalColli || sh.colliCount);
    const collected = nonNegative(sh.collectedPickupCollis ?? sh.pickupCollectedColliCount ?? 0);
    const explicitRemaining = sh.remainingPickupCollis ?? sh.pickupRemainingColliCount;
    const remaining = explicitRemaining != null ? nonNegative(explicitRemaining) : Math.max(0, expected - collected);
    return {
      expected,
      collected,
      remaining,
      partial: collected > 0 && remaining > 0,
      complete: expected > 0 && remaining === 0
    };
  }
  function mondayOfWeek(date){
    const out = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    const weekday = out.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    out.setDate(out.getDate() + offset);
    return out;
  }
  function buildCalendarModel(input){
    const options = input && typeof input === 'object' ? input : {};
    const todayDate = options.today instanceof Date && !Number.isNaN(options.today.getTime()) ? options.today : new Date();
    const fixedPickups = Array.isArray(options.fixedPickups) ? options.fixedPickups : [];
    const shipments = Array.isArray(options.shipments) ? options.shipments : [];
    const monday = mondayOfWeek(todayDate);
    const days = [];

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday - 1, 12, 0, 0, 0);
      const dateKey = dateKeyLocal(date);
      days.push({
        weekday,
        label: weekdayLabel(weekday),
        date,
        dateKey,
        fixed: fixedPickups.filter(item => item && item.active !== false && Number(item.weekday) === weekday),
        shipments: shipments.filter(shipment => shipmentPickupDate(shipment) === dateKey)
      });
    }

    const jsWeekday = todayDate.getDay();
    const regular = jsWeekday >= 1 && jsWeekday <= 5;
    const todayDay = regular ? days.find(day => day.weekday === jsWeekday) : null;
    return {
      days,
      today: todayDay ? {
        regular: true,
        weekday: todayDay.weekday,
        label: todayDay.label,
        date: todayDay.date,
        dateKey: todayDay.dateKey,
        fixed: todayDay.fixed,
        shipments: todayDay.shipments
      } : {
        regular: false,
        weekday: null,
        label: '',
        date: todayDate,
        dateKey: dateKeyLocal(todayDate),
        fixed: [],
        shipments: []
      }
    };
  }

  function createViewState(){
    return {
      fixedPickups: [],
      shipments: [],
      canEdit: false,
      fixedLoading: false,
      shipmentLoading: false,
      fixedError: null,
      shipmentError: null,
      editingFix: null,
      saveError: null
    };
  }
  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function formatDate(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    try { return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date); }
    catch (_) { return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()}`; }
  }
  function shipmentRef(shipment){ return String(shipment && (shipment.reference || shipment.ref || shipment.shipmentRef || shipment.id) || 'Ohne Referenz'); }
  function shipmentCustomer(shipment){ return String(shipment && (shipment.customer || shipment.customerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }
  function shipmentCarrier(shipment){ return String(shipment && (shipment.carrierName || shipment.speditionName || shipment.carrier || shipment.spedition) || 'Spedition offen'); }
  function shipmentStatus(shipment){
    const collis = shipmentColliState(shipment);
    if (collis.complete) return 'Abgeholt';
    if (collis.partial) return 'Teilweise abgeholt';
    return String(shipment && (shipment.pickupStatus || shipment.status) || 'Angemeldet');
  }
  function renderFixCard(item, manage){
    const note = item && item.note ? `<div class="pickup-item-note">${esc(item.note)}</div>` : '';
    const inactive = item && item.active === false ? ' <span class="pickup-muted">Inaktiv</span>' : '';
    const actions = manage ? `<div class="pickup-item-actions"><button type="button" data-pickup-action="edit" data-pickup-id="${esc(item.id)}">Bearbeiten</button><button type="button" data-pickup-action="toggle" data-pickup-id="${esc(item.id)}">${item.active === false ? 'Reaktivieren' : 'Deaktivieren'}</button></div>` : '';
    return `<article class="pickup-item pickup-item-fix"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-fix">FIX</span><strong>${esc(item && item.siteLabel)}</strong>${inactive}</div>${note}${actions}</article>`;
  }
  function renderShipmentCard(shipment){
    const collis = shipmentColliState(shipment);
    const colli = collis.expected > 0 ? `<div class="pickup-colli"><span>Gesamt: <strong>${collis.expected}</strong></span><span>Bereits abgeholt: <strong>${collis.collected}</strong></span><span>Noch offen: <strong>${collis.remaining}</strong></span></div>` : '';
    return `<article class="pickup-item pickup-item-shipment"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-shipment">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class="pickup-item-grid"><span>${esc(shipmentCustomer(shipment))}</span><span>${esc(shipmentCarrier(shipment))}</span><span class="pickup-status">${esc(shipmentStatus(shipment))}</span></div>${colli}</article>`;
  }
  function renderSection(title, items, renderer, emptyText){
    return `<section class="pickup-source"><h4>${esc(title)}</h4>${items.length ? items.map(renderer).join('') : `<div class="pickup-empty">${esc(emptyText)}</div>`}</section>`;
  }
  function renderToday(model){
    if (!model.today.regular) {
      return `<section class="pickup-today"><div class="pickup-section-title"><div><span class="pickup-eyebrow">Heute</span><h3>${formatDate(model.today.date)}</h3></div></div><div class="pickup-weekend-note">Heute ist kein regulärer Abholkalendertag.</div></section>`;
    }
    return `<section class="pickup-today"><div class="pickup-section-title"><div><span class="pickup-eyebrow">Heute</span><h3>${esc(model.today.label)} · ${formatDate(model.today.date)}</h3></div><span class="pickup-count">${model.today.fixed.length + model.today.shipments.length} Einträge</span></div><div class="pickup-today-grid">${renderSection('Fixe Abholungen',model.today.fixed,item=>renderFixCard(item,false),'Keine fixe Abholung')}${renderSection('Angemeldete Sendungen',model.today.shipments,renderShipmentCard,'Keine angemeldete Sendung')}</div></section>`;
  }
  function renderDay(day){
    return `<section class="pickup-day"><header><span>${esc(day.label)}</span><small>${formatDate(day.date)}</small></header>${renderSection('FIX',day.fixed,item=>renderFixCard(item,false),'Keine')}${renderSection('SENDUNG',day.shipments,renderShipmentCard,'Keine')}</section>`;
  }
  function renderForm(state){
    if (!state.canEdit) return '';
    const edit = state.editingFix;
    const selected = edit || {siteLabel:'',weekday:1,note:'',active:true};
    const options = [1,2,3,4,5].map(day=>`<option value="${day}"${Number(selected.weekday)===day?' selected':''}>${weekdayLabel(day)}</option>`).join('');
    const inactive = state.fixedPickups.filter(item=>item && item.active === false);
    const list = state.fixedPickups.length ? state.fixedPickups.map(item=>renderFixCard(item,true)).join('') : '<div class="pickup-empty">Noch keine fixen Abholungen angelegt.</div>';
    return `<section class="pickup-admin"><div class="pickup-section-title"><div><span class="pickup-eyebrow">Administration</span><h3>Fixe Abholungen verwalten</h3></div><button type="button" class="pickup-primary" data-pickup-action="new">Neue fixe Abholung</button></div>${state.saveError?`<div class="pickup-error">${esc(state.saveError)}</div>`:''}${edit?`<form class="pickup-form" data-pickup-form="fix"><input type="hidden" name="id" value="${esc(edit.id||'')}"><label>Standort / Kunde<input name="siteLabel" maxlength="180" required value="${esc(selected.siteLabel||'')}"></label><label>Wochentag<select name="weekday" required>${options}</select></label><label class="pickup-form-wide">Hinweis<textarea name="note" maxlength="500" rows="3">${esc(selected.note||'')}</textarea></label><label class="pickup-check"><input name="active" type="checkbox"${selected.active!==false?' checked':''}> Aktiv</label><div class="pickup-form-actions"><button type="submit" class="pickup-primary">Speichern</button><button type="button" data-pickup-action="cancel">Abbrechen</button></div></form>`:''}<div class="pickup-admin-list">${list}</div>${inactive.length?`<p class="pickup-admin-hint">${inactive.length} deaktivierte fixe Abholung${inactive.length===1?'':'en'} kann reaktiviert werden.</p>`:''}</section>`;
  }
  function render(rootElement, state, today){
    if (!rootElement || !state) return;
    const model = buildCalendarModel({today:today || new Date(),fixedPickups:state.fixedPickups,shipments:state.shipments});
    const loading = state.fixedLoading || state.shipmentLoading;
    rootElement.innerHTML = `<div class="pickup-calendar"><div class="pickup-calendar-head"><div><span class="pickup-eyebrow">ExportHUB</span><h2>Abholkalender</h2><p>Fixe Abholungen und angemeldete Sendungen bleiben getrennt und werden gemeinsam übersichtlich dargestellt.</p></div>${loading?'<span class="pickup-loading">Wird aktualisiert …</span>':''}</div>${state.fixedError?`<div class="pickup-error">FIX: ${esc(state.fixedError)}</div>`:''}${state.shipmentError?`<div class="pickup-error">SENDUNG: ${esc(state.shipmentError)}</div>`:''}${renderToday(model)}<div class="pickup-week">${model.days.map(renderDay).join('')}</div>${renderForm(state)}</div>`;
  }
  function environmentOf(options){
    const env = String(options && options.environment || 'production').toLowerCase();
    return env === 'testservice' ? 'testservice' : env === 'demo' ? 'demo' : 'production';
  }
  function requestHeaders(options){
    const headers = {'Accept':'application/json','Content-Type':'application/json','X-ExportHUB-Environment':environmentOf(options)};
    const company = String(options && options.companyId || '').trim();
    if (company) headers['X-ExportHUB-Company-Id'] = company;
    return headers;
  }
  async function readResponse(response){
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || data.ok === false) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
  }
  async function loadFixedPickups(){
    if (!mountedState || !mountedOptions || !mountedRoot) return;
    if (environmentOf(mountedOptions) === 'demo') {
      mountedState.fixedPickups = [];
      mountedState.canEdit = false;
      mountedState.fixedError = null;
      render(mountedRoot,mountedState,mountedOptions.today);
      return;
    }
    mountedState.fixedLoading = true;
    mountedState.fixedError = null;
    render(mountedRoot,mountedState,mountedOptions.today);
    try {
      const response = await fetch('/api/fixed-pickups?includeInactive=1',{method:'GET',credentials:'same-origin',headers:requestHeaders(mountedOptions)});
      const data = await readResponse(response);
      mountedState.fixedPickups = Array.isArray(data.items) ? data.items : [];
      mountedState.canEdit = data.canEdit === true;
    } catch (e) {
      mountedState.fixedError = e && e.message || 'Fixe Abholungen konnten nicht geladen werden.';
    } finally {
      mountedState.fixedLoading = false;
      render(mountedRoot,mountedState,mountedOptions.today);
    }
  }
  async function saveFixed(method, payload){
    if (!mountedState || !mountedOptions || !mountedRoot || !mountedState.canEdit) return;
    mountedState.saveError = null;
    render(mountedRoot,mountedState,mountedOptions.today);
    try {
      const response = await fetch('/api/fixed-pickups',{method,credentials:'same-origin',headers:requestHeaders(mountedOptions),body:JSON.stringify(payload)});
      await readResponse(response);
      mountedState.editingFix = null;
      await loadFixedPickups();
    } catch (e) {
      mountedState.saveError = e && e.message || 'Fixe Abholung konnte nicht gespeichert werden.';
      render(mountedRoot,mountedState,mountedOptions.today);
    }
  }
  function findFix(id){ return mountedState && mountedState.fixedPickups.find(item=>String(item && item.id)===String(id)) || null; }
  function bindEvents(){
    if (!mountedRoot || eventsBound || typeof mountedRoot.addEventListener !== 'function') return;
    eventsBound = true;
    mountedRoot.addEventListener('click',event=>{
      const button = event.target && event.target.closest && event.target.closest('[data-pickup-action]');
      if (!button || !mountedState) return;
      const action = button.getAttribute('data-pickup-action');
      const id = button.getAttribute('data-pickup-id');
      if (action === 'new') mountedState.editingFix = {id:'',siteLabel:'',weekday:1,note:'',active:true};
      if (action === 'cancel') { mountedState.editingFix = null; mountedState.saveError = null; }
      if (action === 'edit') {
        const item = findFix(id);
        mountedState.editingFix = item ? Object.assign({},item) : null;
      }
      if (action === 'toggle') {
        const item = findFix(id);
        if (item) saveFixed('PATCH',{id:item.id,active:item.active===false});
        return;
      }
      render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
    });
    mountedRoot.addEventListener('submit',event=>{
      const form = event.target;
      if (!form || form.getAttribute('data-pickup-form') !== 'fix') return;
      event.preventDefault();
      const fields = new FormData(form);
      const id = String(fields.get('id') || '');
      const payload = {
        siteLabel: String(fields.get('siteLabel') || '').trim(),
        weekday: Number(fields.get('weekday')),
        note: String(fields.get('note') || '').trim(),
        active: fields.get('active') === 'on'
      };
      if (id) payload.id = id;
      saveFixed(id ? 'PATCH' : 'POST',payload);
    });
  }
  function mount(rootElement, options){
    if (!rootElement) return null;
    mountedRoot = rootElement;
    mountedOptions = Object.assign({environment:'production',companyId:'',shipments:[],today:null},options || {});
    mountedState = createViewState();
    mountedState.shipments = Array.isArray(mountedOptions.shipments) ? mountedOptions.shipments : [];
    bindEvents();
    render(mountedRoot,mountedState,mountedOptions.today);
    loadFixedPickups();
    return { state: mountedState, refresh: loadFixedPickups, setShipments };
  }
  function setShipments(shipments, errorMessage){
    if (!mountedState || !mountedRoot) return;
    mountedState.shipments = Array.isArray(shipments) ? shipments : [];
    mountedState.shipmentError = errorMessage ? String(errorMessage) : null;
    mountedState.shipmentLoading = false;
    render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  }
  function setShipmentLoading(loading){
    if (!mountedState || !mountedRoot) return;
    mountedState.shipmentLoading = loading === true;
    render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  }

  const api = {
    buildCalendarModel,
    shipmentPickupDate,
    shipmentColliState,
    weekdayLabel,
    dateKeyLocal,
    createViewState,
    render,
    mount,
    setShipments,
    setShipmentLoading,
    loadFixedPickups
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportHubPickupCalendar = Object.assign(root.ExportHubPickupCalendar || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
