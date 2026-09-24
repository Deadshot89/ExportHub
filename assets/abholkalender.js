(function(root){
  'use strict';

  const WEEKDAY_KEYS = Object.freeze({1:'pickupCalendar.weekday.1',2:'pickupCalendar.weekday.2',3:'pickupCalendar.weekday.3',4:'pickupCalendar.weekday.4',5:'pickupCalendar.weekday.5'});
  let mountedRoot = null;
  let mountedState = null;
  let mountedOptions = null;
  let eventsBound = false;

  function tr(key,vars){
    try { if (root && root.ExportHUBI18n && typeof root.ExportHUBI18n.t === 'function') return root.ExportHUBI18n.t(key,vars); } catch (_) {}
    return key;
  }
  function lang(){
    try { if (root && root.ExportHUBI18n && typeof root.ExportHUBI18n.language === 'function') return root.ExportHUBI18n.language(); } catch (_) {}
    return 'de';
  }
  function locale(){ return ({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'})[lang()] || 'de-DE'; }
  function localized(record,key){
    try { if (root && root.ExportHUBI18n && typeof root.ExportHUBI18n.localized === 'function') return root.ExportHUBI18n.localized(record,key); } catch (_) {}
    return record && record[key] != null ? record[key] : '';
  }

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
  function weekdayLabel(weekday){ const key=WEEKDAY_KEYS[Number(weekday)]; return key ? tr(key) : ''; }
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
  function shipmentIsCompleted(shipment){
    const sh = shipment && typeof shipment === 'object' ? shipment : {};
    const collis = shipmentColliState(sh);
    if (collis.complete) return true;
    if (String(sh.pickedUpAt || sh.pickupConfirmedAt || sh.qrPickupConfirmedAt || sh.pickupCompletedAt || sh.actualPickupAt || sh.actualPickupDate || sh.collectedAt || sh.podServerVerifiedAt || '').trim()) return true;
    const status = String(sh.pickupStatus || sh.shipmentStatus || sh.processStatus || sh.status || '').trim().toLocaleLowerCase('de-DE');
    return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|storniert|picked up|pod available|completed|archived|cancelled)$/.test(status);
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
      shipments: shipments.filter(shipment => shipmentPickupDate(shipment) === dateKey && !shipmentIsCompleted(shipment))
    };
  }
  function buildCalendarModel(input){
    const options = input && typeof input === 'object' ? input : {};
    const suppliedToday = options.today && typeof options.today.getTime === 'function' && Number.isFinite(options.today.getTime()) ? options.today.getTime() : NaN;
    const todayDate = Number.isFinite(suppliedToday) ? new Date(suppliedToday) : new Date();
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
    try { if (root && root.ExportHUBI18n && typeof root.ExportHUBI18n.formatDate === 'function') return root.ExportHUBI18n.formatDate(date,{day:'2-digit',month:'2-digit',year:'numeric'}); } catch (_) {}
    try { return new Intl.DateTimeFormat(locale(),{day:'2-digit',month:'2-digit',year:'numeric'}).format(date); }
    catch (_) { return date.toISOString().slice(0,10); }
  }
  function formatWeekLabel(model){
    if (!model || !(model.weekStart instanceof Date) || !(model.weekEnd instanceof Date)) return '';
    return `${formatDate(model.weekStart)} – ${formatDate(model.weekEnd)}`;
  }
  function shipmentRef(shipment){ return String(shipment && (shipment.reference || shipment.ref || shipment.shipmentRef || shipment.id) || tr('pickupCalendar.noReference')); }
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
    return recipient || tr('pickupCalendar.noCustomer');
  }
  function shipmentCarrier(shipment){ return String(shipment && (shipment.carrierName || shipment.speditionName || shipment.carrier || shipment.spedition) || tr('pickupCalendar.carrierOpen')); }
  function shipmentStatus(shipment){
    const collis = shipmentColliState(shipment);
    if (collis.complete) return tr('pickupCalendar.status.pickedUp');
    if (collis.partial) return tr('pickupCalendar.status.partial');
    const raw=String(shipment && (shipment.pickupStatus || shipment.status) || '').trim();
    return raw || tr('pickupCalendar.status.registered');
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
    const noteValue = item ? localized(item,'note') : '';
    const note = noteValue ? `<div class="pickup-item-note">${esc(noteValue)}</div>` : '';
    const inactive = item && item.active === false ? ` <span class="pickup-muted">${esc(tr('pickupCalendar.card.inactive'))}</span>` : '';
    const actions = manage ? `<div class="pickup-item-actions"><button type="button" data-pickup-action="edit" data-pickup-id="${esc(item.id)}">${esc(tr('pickupCalendar.action.edit'))}</button><button type="button" data-pickup-action="toggle" data-pickup-id="${esc(item.id)}">${esc(tr(item.active === false ? 'pickupCalendar.action.reactivate' : 'pickupCalendar.action.deactivate'))}</button></div>` : '';
    return `<article class="pickup-item pickup-item-fix"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-fix">FIX</span><strong>${esc(item && item.siteLabel)}</strong>${inactive}</div>${note}${actions}</article>`;
  }
  function renderShipmentCard(shipment){
    const collis = shipmentColliState(shipment);
    const key = shipmentIdentity(shipment);
    const colli = collis.expected > 0 ? `<div class="pickup-colli"><span>${esc(tr('pickupCalendar.colli.total'))}: <strong>${collis.expected}</strong></span><span>${esc(tr('pickupCalendar.colli.collected'))}: <strong>${collis.collected}</strong></span><span>${esc(tr('pickupCalendar.colli.remaining'))}: <strong>${collis.remaining}</strong></span></div>` : '';
    const open = key ? `<div class="pickup-item-actions"><button type="button" data-pickup-action="open-shipment" data-pickup-shipment-key="${esc(key)}">${esc(tr('pickupCalendar.action.openShipment'))}</button></div>` : '';
    const customer = shipmentCustomer(shipment);
    return `<article class="pickup-item pickup-item-shipment"><div class="pickup-item-head"><span class="pickup-badge pickup-badge-shipment">${esc(tr('pickupCalendar.badge.shipment'))}</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class="pickup-item-grid"><span>${esc(tr('pickupCalendar.label.customer'))}: <strong>${esc(customer)}</strong></span><span>${esc(shipmentCarrier(shipment))}</span><span class="pickup-status">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;
  }
  function renderSection(title, items, renderer, emptyText){
    return `<section class="pickup-source"><h4>${esc(title)}</h4>${items.length ? items.map(renderer).join('') : `<div class="pickup-empty">${esc(emptyText)}</div>`}</section>`;
  }
  function renderToday(model){
    if (!model.today.regular) {
      return `<section class="pickup-today"><div class="pickup-section-title"><div><span class="pickup-eyebrow">${esc(tr('pickupCalendar.today'))}</span><h3>${formatDate(model.today.date)}</h3></div></div><div class="pickup-weekend-note">${esc(tr('pickupCalendar.nonWorkingDay'))}</div></section>`;
    }
    return `<section class="pickup-today"><div class="pickup-section-title"><div><span class="pickup-eyebrow">${esc(tr('pickupCalendar.today'))}</span><h3>${esc(model.today.label)} · ${formatDate(model.today.date)}</h3></div><span class="pickup-count">${esc(tr('pickupCalendar.entries',{count:model.today.fixed.length + model.today.shipments.length}))}</span></div><div class="pickup-today-grid">${renderSection(tr('pickupCalendar.section.fixedPickups'),model.today.fixed,item=>renderFixCard(item,false),tr('pickupCalendar.empty.fixedPickup'))}${renderSection(tr('pickupCalendar.section.registeredShipments'),model.today.shipments,renderShipmentCard,tr('pickupCalendar.empty.registeredShipment'))}</div></section>`;
  }
  function renderDay(day){
    return `<section class="pickup-day"><header><span>${esc(day.label)}</span><small>${formatDate(day.date)}</small></header>${renderSection('FIX',day.fixed,item=>renderFixCard(item,false),tr('pickupCalendar.empty.none'))}${renderSection(tr('pickupCalendar.badge.shipment'),day.shipments,renderShipmentCard,tr('pickupCalendar.empty.none'))}</section>`;
  }
  function renderPrintFixed(item){
    return `<div class="pickup-print-entry"><strong>${esc(item && item.siteLabel)}</strong></div>`;
  }
  function renderPrintShipment(shipment){
    const collis = shipmentColliState(shipment);
    const ref = shipmentRef(shipment);
    return `<div class="pickup-print-entry pickup-print-entry-confirmed"><strong>${esc(shipmentCustomer(shipment))}</strong><small>${esc(tr('pickupCalendar.print.reference'))}: ${esc(ref)} · ${esc(tr('pickupCalendar.print.quantity'))}: ${collis.expected}</small></div>`;
  }
  function renderPrintDay(day){
    const entries = [];
    for (const item of day.fixed || []) entries.push(renderPrintFixed(item));
    for (const shipment of day.shipments || []) entries.push(renderPrintShipment(shipment));
    return `<section class="pickup-print-day"><h3>${esc(day.label)}</h3><div class="pickup-print-date">${formatDate(day.date)}</div><div class="pickup-print-entries">${entries.length ? entries.join('') : '<span class="pickup-print-empty">—</span>'}</div></section>`;
  }
  function renderPrintWeek(model){
    const safeModel = model && Array.isArray(model.days) ? model : {days:[],weekStart:null,weekEnd:null};
    return `<section class="pickup-print-sheet"><header class="pickup-print-head"><div><h1>${esc(tr('pickupCalendar.print.title'))}</h1><p>${esc(tr('pickupCalendar.print.weekOverview'))}</p></div><div class="pickup-print-meta"><span>${esc(tr('pickupCalendar.print.week'))}</span><strong>${esc(formatWeekLabel(safeModel))}</strong></div></header><div class="pickup-print-week">${safeModel.days.map(renderPrintDay).join('')}</div></section>`;
  }
  function printCurrentWeek(){
    if (!mountedState || !root || !root.document || !root.document.body || typeof root.print !== 'function') return false;
    const model = buildCalendarModel({today:mountedOptions && mountedOptions.today || new Date(),weekOffset:mountedState.weekOffset,fixedPickups:mountedState.fixedPickups,shipments:mountedState.shipments});
    const doc = root.document;
    const body = doc.body;
    const previous = body.querySelector('.pickup-print-portal');
    if (previous) previous.remove();
    const portal = doc.createElement('div');
    portal.className = 'pickup-print-portal';
    portal.innerHTML = renderPrintWeek(model);
    body.appendChild(portal);
    body.classList.add('pickup-print-active');
    const cleanup = () => {
      body.classList.remove('pickup-print-active');
      if (portal.parentNode) portal.parentNode.removeChild(portal);
      if (root.removeEventListener) root.removeEventListener('afterprint',cleanup);
    };
    if (root.addEventListener) root.addEventListener('afterprint',cleanup,{once:true});
    root.print();
    if (root.setTimeout) root.setTimeout(cleanup,1000);
    return true;
  }
  function renderWeekToolbar(model){
    return `<div class="pickup-week-toolbar"><div><span class="pickup-eyebrow">${esc(tr('pickupCalendar.weekView'))}</span><h3 class="pickup-week-label">${esc(formatWeekLabel(model))}</h3></div><div class="pickup-week-actions"><button type="button" data-pickup-action="week-prev">${esc(tr('pickupCalendar.action.previousWeek'))}</button><button type="button" data-pickup-action="week-current"${model.weekOffset===0?' aria-current="true"':''}>${esc(tr('pickupCalendar.action.currentWeek'))}</button><button type="button" data-pickup-action="week-next">${esc(tr('pickupCalendar.action.nextWeek'))}</button><button type="button" class="pickup-primary" data-pickup-action="print-week">${esc(tr('pickupCalendar.action.printWeek'))}</button></div></div>`;
  }
  function renderForm(state){
    if (!state.canEdit) return '';
    const edit = state.editingFix;
    const selected = edit || {siteLabel:'',weekday:1,note:'',active:true};
    const options = [1,2,3,4,5].map(day=>`<option value="${day}"${Number(selected.weekday)===day?' selected':''}>${esc(weekdayLabel(day))}</option>`).join('');
    const inactive = state.fixedPickups.filter(item=>item && item.active === false);
    const list = state.fixedPickups.length ? state.fixedPickups.map(item=>renderFixCard(item,true)).join('') : `<div class="pickup-empty">${esc(tr('pickupCalendar.empty.noFixedCreated'))}</div>`;
    const inactiveHint = inactive.length ? tr(inactive.length===1?'pickupCalendar.inactiveHint.one':'pickupCalendar.inactiveHint.many',{count:inactive.length}) : '';
    return `<section class="pickup-admin"><div class="pickup-section-title"><div><span class="pickup-eyebrow">${esc(tr('pickupCalendar.admin'))}</span><h3>${esc(tr('pickupCalendar.admin.manageFixed'))}</h3></div><button type="button" class="pickup-primary" data-pickup-action="new">${esc(tr('pickupCalendar.action.newFixed'))}</button></div>${state.saveError?`<div class="pickup-error">${esc(state.saveError)}</div>`:''}${edit?`<form class="pickup-form" data-pickup-form="fix"><input type="hidden" name="id" value="${esc(edit.id||'')}"><label>${esc(tr('pickupCalendar.field.locationCustomer'))}<input name="siteLabel" maxlength="180" required value="${esc(selected.siteLabel||'')}"></label><label>${esc(tr('pickupCalendar.field.weekday'))}<select name="weekday" required>${options}</select></label><label class="pickup-form-wide">${esc(tr('pickupCalendar.field.note'))}<textarea name="note" maxlength="500" rows="3">${esc(selected.note||'')}</textarea></label><label class="pickup-check"><input name="active" type="checkbox"${selected.active!==false?' checked':''}> ${esc(tr('pickupCalendar.field.active'))}</label><div class="pickup-form-actions"><button type="submit" class="pickup-primary">${esc(tr('pickupCalendar.action.save'))}</button><button type="button" data-pickup-action="cancel">${esc(tr('pickupCalendar.action.cancel'))}</button></div></form>`:''}<div class="pickup-admin-list">${list}</div>${inactiveHint?`<p class="pickup-admin-hint">${esc(inactiveHint)}</p>`:''}</section>`;
  }
  function render(rootElement, state, today){
    if (!rootElement || !state) return;
    const model = buildCalendarModel({today:today || new Date(),weekOffset:state.weekOffset,fixedPickups:state.fixedPickups,shipments:state.shipments});
    const loading = state.fixedLoading || state.shipmentLoading;
    rootElement.innerHTML = `<div class="pickup-calendar"><div class="pickup-calendar-head"><div><span class="pickup-eyebrow">ExportHUB</span><h2>${esc(tr('pickupCalendar.title'))}</h2><p>${esc(tr('pickupCalendar.subtitle'))}</p></div>${loading?`<span class="pickup-loading">${esc(tr('pickupCalendar.updating'))}</span>`:''}</div>${state.fixedError?`<div class="pickup-error">FIX: ${esc(state.fixedError)}</div>`:''}${state.shipmentError?`<div class="pickup-error">${esc(tr('pickupCalendar.badge.shipment'))}: ${esc(state.shipmentError)}</div>`:''}${renderToday(model)}${renderWeekToolbar(model)}<div class="pickup-week">${model.days.map(renderDay).join('')}</div>${renderForm(state)}</div>`;
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
  function mountedCalendarIsCurrent(rootElement,state,options){
    if (!rootElement || rootElement !== mountedRoot || state !== mountedState || options !== mountedOptions) return false;
    try {
      const body = root && root.document && root.document.body;
      const view = String(body && body.getAttribute && body.getAttribute('data-exporthub-view') || '').trim().toLowerCase();
      if (view && view !== 'pickupcalendar') return false;
    } catch (_) {}
    try {
      return typeof rootElement.querySelector !== 'function' || !!rootElement.querySelector('.pickup-calendar');
    } catch (_) {
      return false;
    }
  }
  async function loadFixedPickups(){
    if (!mountedState || !mountedOptions || !mountedRoot) return;
    const requestRoot = mountedRoot;
    const requestState = mountedState;
    const requestOptions = mountedOptions;
    if (!mountedCalendarIsCurrent(requestRoot,requestState,requestOptions)) return;
    requestState.fixedLoading = true;
    requestState.fixedError = null;
    render(requestRoot,requestState,requestOptions.today);
    try {
      const response = await fetch('/api/fixed-pickups?includeInactive=1',{method:'GET',credentials:'same-origin',headers:requestHeaders(requestOptions)});
      const data = await readResponse(response);
      if (!mountedCalendarIsCurrent(requestRoot,requestState,requestOptions)) return;
      requestState.fixedPickups = Array.isArray(data.items) ? data.items : [];
      requestState.canEdit = data.canEdit === true;
    } catch (e) {
      if (!mountedCalendarIsCurrent(requestRoot,requestState,requestOptions)) return;
      requestState.fixedError = e && e.message || tr('pickupCalendar.error.fixedLoad');
    } finally {
      if (!mountedCalendarIsCurrent(requestRoot,requestState,requestOptions)) return;
      requestState.fixedLoading = false;
      render(requestRoot,requestState,requestOptions.today);
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
      mountedState.saveError = e && e.message || tr('pickupCalendar.error.fixedSave');
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
      if (action === 'print-week') { printCurrentWeek(); return; }
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
    return { state: mountedState, refresh: loadFixedPickups, setShipments, setWeekOffset, printWeek: printCurrentWeek };
  }
  function setShipments(shipments, errorMessage){
    if (!mountedState || !mountedRoot || !mountedCalendarIsCurrent(mountedRoot,mountedState,mountedOptions)) return;
    mountedState.shipments = Array.isArray(shipments) ? shipments : [];
    mountedState.shipmentError = errorMessage ? String(errorMessage) : null;
    mountedState.shipmentLoading = false;
    render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  }
  function setShipmentLoading(loading){
    if (!mountedState || !mountedRoot || !mountedCalendarIsCurrent(mountedRoot,mountedState,mountedOptions)) return;
    mountedState.shipmentLoading = loading === true;
    render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  }

  const api = {
    buildCalendarModel,
    shipmentPickupDate,
    shipmentColliState,
    shipmentIsCompleted,
    shipmentIdentity,
    triggerOpenShipment,
    weekdayLabel,
    dateKeyLocal,
    createViewState,
    renderPrintWeek,
    printCurrentWeek,
    render,
    mount,
    setShipments,
    setShipmentLoading,
    setWeekOffset,
    loadFixedPickups
  };

  if (root && typeof root.addEventListener === 'function') root.addEventListener('exporthub:language-changed',()=>{
    if (mountedRoot && mountedState) render(mountedRoot,mountedState,mountedOptions && mountedOptions.today);
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportHubPickupCalendar = Object.assign(root.ExportHubPickupCalendar || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);