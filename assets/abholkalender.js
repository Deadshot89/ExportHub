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
  function shipmentIdentity(shipment){
    const sh = shipment && typeof shipment === 'object' ? shipment : {};
    for (const key of ['id','shipmentId','reference','ref','shipmentRef','referenceNumber','referenceNo']) {
      const value = String(sh[key] == null ? '' : sh[key]).trim();
      if (value) return value;
    }
    return '';
  }
  function mondayOfWeek(date){
    const out = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    const weekday = out.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    out.setDate(out.getDate() + offset);
    return out;
  }
  function shiftedWeekMonday(todayDate, weekOffset){
    const monday = mondayOfWeek(todayDate);
    monday.setDate(monday.getDate() + Math.trunc(number(weekOffset)) * 7);
    return monday;
  }
  function itemsForDate(fixedPickups, shipments, date){
    const weekday = date.getDay();
    const dateKey = dateKeyLocal(date);
    return {
      fixed: weekday >= 1 && weekday <= 5 ? fixedPickups.filter(item => item && item.active !== false && Number(item.weekday) === weekday) : [],
      shipments: shipments.filter(shipment => shipmentPickupDate(shipment) === dateKey)
    };
  }
  function buildCalendarModel(input){
    const options = input && typeof input === 'object' ? input : {};
    const todayDate = options.today instanceof Date && !Number.isNaN(options.today.getTime()) ? options.today : new Date();
    const fixedPickups = Array.isArray(options.fixedPickups) ? options.fixedPickups : [];
    const shipments = Array.isArray(options.shipments) ? options.shipments : [];
    const weekOffset = Math.trunc(number(options.weekOffset));
    const monday = shiftedWeekMonday(todayDate,weekOffset);
    const days = [];

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday - 1, 12, 0, 0, 0);
      const dateKey = dateKeyLocal(date);
      const source = itemsForDate(fixedPickups,shipments,date);
      days.push({
        weekday,
        label: weekdayLabel(weekday),
        date,
        dateKey,
        fixed: source.fixed,
        shipments: source.shipments
      });
    }

    const jsWeekday = todayDate.getDay();
    const regular = jsWeekday >= 1 && jsWeekday <= 5;
    const todaySource = regular ? itemsForDate(fixedPickups,shipments,todayDate) : {fixed:[],shipments:[]};
    const weekEnd = days.length ? days[days.length-1].date : monday;
    return {
      weekOffset,
      weekStart: monday,
      weekEnd,
      days,
      today: regular ? {
        regular: true,
        weekday: jsWeekday,
        label: weekdayLabel(jsWeekday),
        date: todayDate,
        dateKey: dateKeyLocal(todayDate),
        fixed: todaySource.fixed,
        shipments: todaySource.shipments
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
      weekOffset: 0,
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
  function formatWeekLabel(model){
    if (!model || !(model.weekStart instanceof Date) || !(model.weekEnd instanceof Date)) return '';
    const start = `${pad(model.weekStart.getDate())}.${pad(model.weekStart.getMonth()+1)}.`;
    return `${start} – ${formatDate(model.weekEnd)}`;
  }
  function shipmentRef(shipment){ return String(shipment && (shipment.reference || shipment.ref || shipment.shipmentRef || shipment.id) || 'Ohne Referenz'); }
  function calendarScalarText(value){
    if (value == null || typeof value === 'object' || typeof value === 'boolean') return '';
    const text = String(value).trim();
    if (!text || /^(?:true|false|null|undefined|\[object Object\])$/i.test(text)) return '';
    return text;
  }
  function calendarObjectName(value){
    if (!value || typeof value !== 'object') return '';
    for (const candidate of [value.name,value.customerName,value.companyName,value.displayName]) {
      const text = calendarScalarText(candidate);
      if (text) return text;
    }
    return '';
  }
  function shipmentCustomer(shipment){
    const sh = shipment && typeof shipment === 'object' ? shipment : {};
    for (const candidate of [sh.customerName,sh.customerDisplay,sh.recipientCustomerName,sh.consigneeName,sh.recipientName,sh.companyName,sh.locationName]) {
      const text = calendarScalarText(candidate);
      if (text) return text;
    }
    const customer = calendarScalarText(sh.customer) || calendarObjectName(sh.customer);
    if (customer) return customer;
    const recipient = calendarScalarText(sh.recipient) || calendarObjectName(sh.recipient);
    return recipient || 'Ohne Kunde';
  }
  function shipmentCarrier(shipment){ return String(shipment && (shipment.carrierName || shipment.speditionName || shipment.carrier || shipment.spedition) || 'Spedition offen'); }
  function shipmentStatus(shipment){
    const collis = shipmentColliState(shipment);
    if (collis.complete) return 'Abgeholt';
    if (collis.partial) return 'Teilweise abgeholt';
    return String(shipment && (shipment.pickupStatus || shipment.status) || 'Angemeldet');
  }
  function triggerOpenShipment(shipment, options){
    const sh = shipment && typeof shipment === 'object' ? shipment : null;
    if (!sh || !shipmentIdentity(sh)) return false;
    const opts = options && typeof options === 'object' ? options : {};
    if (typeof opts.onOpenShipment === 'function') {
      opts.onOpenShipment(sh);
      return true;
    }
    const candidates = root ? [root.__EXPORTHUB_OPEN_SHIPMENT__,root.openShipment,root.openShipmentById,root.editShipment] : [];
    for (const fn of candidates) {
      if (typeof fn !== 'function') continue;
      fn(sh);
      return true;
    }
    if (root && typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      root.dispatchEvent(new root.CustomEvent('exporthub:open-shipment',{detail:{shipment:sh,shipmentId:shipmentIdentity(sh)}}));
      return true;
    }
    return false;
  }
  function renderFixCard(item, manage){
    const note = item && item.note ? `<div class="pickup-item-note">${esc(item.note)}</div>` : '';
    const inactive = item && item.active === false ? ' <span class="pickup-muted">Inaktiv</span>' : '';
    const actions = manage ? `<div class="pickup-item-actions"><button type="button" data-pickup-action="edit" data-pickup-id="${esc(item.id)}">Bearbeiten</button><button type="button" data-pickup-action="toggle" data-pickup-id="${esc(item.id)}">${item.active === false ? 'Reaktivieren' : 'Deaktivieren'}</button></div>` : '';
    return `<article class="pickup-item pickup-item-fix"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-fix">FIX</span><strong>${esc(item && item.siteLabel)}</strong>${inactive}</div>${note}${actions}</article>`;
  }
  function renderShipmentCard(shipment){
    const collis = shipmentColliState(shipment);
    const key = shipmentIdentity(shipment);
    const colli = collis.expected > 0 ? `<div class="pickup-colli"><span>Gesamt: <strong>${collis.expected}</strong></span><span>Bereits abgeholt: <strong>${collis.collected}</strong></span><span>Noch offen: <strong>${collis.remaining}</strong></span></div>` : '';
    const open = key ? `<div class="pickup-item-actions"><button type="button" data-pickup-action="open-shipment" data-pickup-shipment-key="${esc(key)}">Sendung öffnen</button></div>` : '';
    const customer = shipmentCustomer(shipment);
    return `<article class="pickup-item pickup-item-shipment"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-shipment">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class="pickup-item-grid"><span>Kunde: <strong>${esc(customer)}</strong></span><span>${esc(shipmentCarrier(shipment))}</span><span class="pickup-status">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;
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
  function renderWeekToolbar(model){
    return `<div class="pickup-week-toolbar"><div><span class="pickup-eyebrow">Wochenansicht</span><h3 class="pickup-week-label">${esc(formatWeekLabel(model))}</h3></div><div class="pickup-week-actions"><button type="button" data-pickup-action="week-prev">← Vorherige Woche</button><button type="button" data-pickup-action="week-current"${model.weekOffset===0?' aria-current="true"':''}>Aktuelle Woche</button><button type="button" data-pickup-action="week-next">Nächste Woche →</button></div></div>`;
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
    const model = buildCalendarModel({today:today || new Date(),weekOffset:state.weekOffset,fixedPickups:state.fixedPickups,shipments:state.shipments});
    const loading = state.fixedLoading || state.shipmentLoading;
    rootElement.innerHTML = `<div class="pickup-calendar"><div class="pickup-calendar-head"><div><span class="pickup-eyebrow">ExportHUB</span><h2>Abholkalender</h2><p>Fixe Abholungen und angemeldete Sendungen bleiben getrennt und werden gemeinsam übersichtlich dargestellt.</p></div>${loading?'<span class="pickup-loading">Wird aktualisiert …</span>':''}</div>${state.fixedError?`<div class="pickup-error">FIX: ${esc(state.fixedError)}</div>`:''}${state.shipmentError?`<div class="pickup-error">SENDUNG: ${esc(state.shipmentError)}</div>`:''}${renderToday(model)}${renderWeekToolbar(model)}<div class="pickup-week">${model.days.map(renderDay).join('')}</div>${renderForm(state)}</div>`;
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
  function findShipment(key){ return mountedState && mountedState.shipments.find(item=>shipmentIdentity(item)===String(key || '')) || null; }
  function setWeekOffset(offset){
    if (!mountedState || !mountedRoot) return;
    mountedState.weekOffset = Math.trunc(number(offset));
    render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  }
  function bindEvents(){
    if (!mountedRoot || eventsBound || typeof mountedRoot.addEventListener !== 'function') return;
    eventsBound = true;
    mountedRoot.addEventListener('click',event=>{
      const button = event.target && event.target.closest && event.target.closest('[data-pickup-action]');
      if (!button || !mountedState) return;
      const action = button.getAttribute('data-pickup-action');
      const id = button.getAttribute('data-pickup-id');
      if (action === 'week-prev') { setWeekOffset(mountedState.weekOffset-1); return; }
      if (action === 'week-current') { setWeekOffset(0); return; }
      if (action === 'week-next') { setWeekOffset(mountedState.weekOffset+1); return; }
      if (action === 'open-shipment') {
        const shipment = findShipment(button.getAttribute('data-pickup-shipment-key'));
        if (shipment) triggerOpenShipment(shipment,mountedOptions);
        return;
      }
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
    mountedOptions = Object.assign({environment:'production',companyId:'',shipments:[],today:null,onOpenShipment:null},options || {});
    mountedState = createViewState();
    mountedState.shipments = Array.isArray(mountedOptions.shipments) ? mountedOptions.shipments : [];
    mountedState.weekOffset = Math.trunc(number(mountedOptions.weekOffset));
    bindEvents();
    render(mountedRoot,mountedState,mountedOptions.today);
    loadFixedPickups();
    return { state: mountedState, refresh: loadFixedPickups, setShipments, setWeekOffset };
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
    shipmentIdentity,
    triggerOpenShipment,
    weekdayLabel,
    dateKeyLocal,
    createViewState,
    render,
    mount,
    setShipments,
    setShipmentLoading,
    setWeekOffset,
    loadFixedPickups
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportHubPickupCalendar = Object.assign(root.ExportHubPickupCalendar || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);