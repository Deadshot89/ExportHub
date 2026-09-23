'use strict';

const BUSINESS_START = 8 * 60 + 30;
const BUSINESS_END = 16 * 60;
const WINDOW_MINUTES = 120;
const SLOT_STEP_MINUTES = 30;
const MAX_CONCURRENT = 3;

function text(v){ return String(v == null ? '' : v).trim(); }

function timeToMinutes(value){
  const m = text(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function minutesToTime(value){
  const n = Math.max(0, Math.round(Number(value) || 0));
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

function slotDefinitions(){
  const out = [];
  for(let start = BUSINESS_START; start + WINDOW_MINUTES <= BUSINESS_END; start += SLOT_STEP_MINUTES){
    out.push({from: minutesToTime(start), to: minutesToTime(start + WINDOW_MINUTES), start, end: start + WINDOW_MINUTES});
  }
  return out;
}

const SLOT_DEFINITIONS = Object.freeze(slotDefinitions().map(slot => Object.freeze(slot)));

function isValidSlot(from, to){
  from = text(from);
  to = text(to);
  return SLOT_DEFINITIONS.some(slot => slot.from === from && slot.to === to);
}

function identityOf(sh){
  if(!sh || typeof sh !== 'object') return '';
  const ref = text(sh.reference || sh.ref || sh.shipmentRef || sh.referenceNumber || sh.shipmentNumber || sh.customerAvisShipmentNumber || sh.avisShipmentNumber).toUpperCase();
  if(ref) return 'REF|'+ref;
  const id = text(sh.id || sh.shipmentId || sh.uuid);
  return id ? 'ID|'+id : '';
}

function appointmentOf(sh){
  if(!sh || typeof sh !== 'object') return null;
  const date = text(sh.customerAvisPickupDate || sh.avisPickupDate || sh.plannedPickupDate || sh.pickupDate);
  const from = text(sh.customerAvisPickupTimeFrom || sh.avisPickupTimeFrom);
  const to = text(sh.customerAvisPickupTimeTo || sh.avisPickupTimeTo);
  const start = timeToMinutes(from);
  const end = timeToMinutes(to);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {date, from, to, start, end};
}

function isExcluded(sh, exclude){
  if(!exclude) return false;
  const sid = text(sh && (sh.id || sh.shipmentId || sh.uuid || sh.ref || sh.reference || sh.shipmentRef || sh.referenceNumber));
  const ref = text(sh && (sh.reference || sh.ref || sh.shipmentRef || sh.referenceNumber || sh.shipmentNumber || sh.customerAvisShipmentNumber || sh.avisShipmentNumber)).toUpperCase();
  const excludeId = text(exclude.subjectId || exclude.shipmentId || exclude.id);
  const excludeRef = text(exclude.reference || exclude.ref).toUpperCase();
  return Boolean((excludeId && sid && excludeId === sid) || (excludeRef && ref && excludeRef === ref));
}

function intervalsForDate(shipments, date, exclude){
  const seen = new Set();
  const intervals = [];
  (Array.isArray(shipments) ? shipments : []).forEach(sh => {
    if(!sh || typeof sh !== 'object' || isExcluded(sh, exclude)) return;
    const key = identityOf(sh);
    if(key && seen.has(key)) return;
    if(key) seen.add(key);
    const appt = appointmentOf(sh);
    if(appt && appt.date === date) intervals.push(appt);
  });
  return intervals;
}

function peakConcurrency(intervals, start, end){
  const points = new Set([start]);
  intervals.forEach(item => {
    if(item.start >= start && item.start < end) points.add(item.start);
    if(item.end > start && item.end < end) points.add(item.end);
  });
  let peak = 0;
  for(const point of points){
    let active = 0;
    intervals.forEach(item => {
      if(item.start <= point && item.end > point) active += 1;
    });
    if(active > peak) peak = active;
  }
  return peak;
}

function availabilityForDate(shipments, date, exclude){
  date = text(date);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    return {
      date,
      businessHours:{from:'08:30',to:'16:00'},
      windowMinutes:WINDOW_MINUTES,
      stepMinutes:SLOT_STEP_MINUTES,
      maxConcurrent:MAX_CONCURRENT,
      slots:[]
    };
  }
  const intervals = intervalsForDate(shipments, date, exclude);
  return {
    date,
    businessHours:{from:'08:30',to:'16:00'},
    windowMinutes:WINDOW_MINUTES,
    stepMinutes:SLOT_STEP_MINUTES,
    maxConcurrent:MAX_CONCURRENT,
    slots:SLOT_DEFINITIONS.map(slot => {
      const bookedPeak = peakConcurrency(intervals, slot.start, slot.end);
      const remaining = Math.max(0, MAX_CONCURRENT - bookedPeak);
      return {from:slot.from,to:slot.to,available:remaining > 0,remaining,bookedPeak};
    })
  };
}

function slotState(shipments, date, from, to, exclude){
  const availability = availabilityForDate(shipments, date, exclude);
  return availability.slots.find(slot => slot.from === text(from) && slot.to === text(to)) || null;
}

module.exports = {
  BUSINESS_START,
  BUSINESS_END,
  WINDOW_MINUTES,
  SLOT_STEP_MINUTES,
  MAX_CONCURRENT,
  SLOT_DEFINITIONS,
  timeToMinutes,
  minutesToTime,
  isValidSlot,
  appointmentOf,
  availabilityForDate,
  slotState
};
