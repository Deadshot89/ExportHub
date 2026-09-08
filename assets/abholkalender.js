(function(root){
  'use strict';

  const WEEKDAYS = Object.freeze({1:'Montag',2:'Dienstag',3:'Mittwoch',4:'Donnerstag',5:'Freitag'});

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

  const api = {
    buildCalendarModel,
    shipmentPickupDate,
    shipmentColliState,
    weekdayLabel,
    dateKeyLocal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportHubPickupCalendar = Object.assign(root.ExportHubPickupCalendar || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
