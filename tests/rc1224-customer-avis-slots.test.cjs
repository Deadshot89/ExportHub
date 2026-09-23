'use strict';

const assert = require('assert');
const slots = require('../api/shared/customer-avis-slots');

assert.strictEqual(slots.WINDOW_MINUTES, 120, 'Zeitfenster müssen exakt 2 Stunden lang sein.');
assert.strictEqual(slots.MAX_CONCURRENT, 3, 'Maximal 3 gleichzeitige Sendungen sind erlaubt.');
assert.strictEqual(slots.SLOT_DEFINITIONS[0].from, '08:30');
assert.strictEqual(slots.SLOT_DEFINITIONS[0].to, '10:30');
assert.strictEqual(slots.SLOT_DEFINITIONS.at(-1).from, '14:00');
assert.strictEqual(slots.SLOT_DEFINITIONS.at(-1).to, '16:00');
assert(slots.SLOT_DEFINITIONS.every(s => slots.timeToMinutes(s.to) - slots.timeToMinutes(s.from) === 120), 'Jeder Slot muss 120 Minuten lang sein.');
assert.strictEqual(slots.isValidSlot('08:30','10:30'), true);
assert.strictEqual(slots.isValidSlot('08:30','09:30'), false);
assert.strictEqual(slots.isValidSlot('15:00','17:00'), false);

const shipments = [
  {id:'A',reference:'AAAAAA',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'08:30',customerAvisPickupTimeTo:'10:30'},
  {id:'B',reference:'BBBBBB',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'08:30',customerAvisPickupTimeTo:'10:30'},
  {id:'C',reference:'CCCCCC',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'08:30',customerAvisPickupTimeTo:'10:30'},
  // duplicate copy of A must not be counted twice
  {id:'A',reference:'AAAAAA',avisPickupDate:'2026-09-24',avisPickupTimeFrom:'08:30',avisPickupTimeTo:'10:30'}
];

let availability = slots.availabilityForDate(shipments, '2026-09-24');
let first = availability.slots.find(s => s.from === '08:30' && s.to === '10:30');
assert(first, '08:30-10:30 muss vorhanden sein.');
assert.strictEqual(first.available, false, 'Vierter Auftrag darf nicht in einen voll belegten Zeitraum.');
assert.strictEqual(first.remaining, 0);

let overlapping = availability.slots.find(s => s.from === '09:00' && s.to === '11:00');
assert.strictEqual(overlapping.available, false, 'Überlappende Slots müssen die Gleichzeitigkeit berücksichtigen.');

availability = slots.availabilityForDate(shipments, '2026-09-24', {subjectId:'A',reference:'AAAAAA'});
first = availability.slots.find(s => s.from === '08:30' && s.to === '10:30');
assert.strictEqual(first.available, true, 'Eigene bestehende Buchung muss beim Umbuchen ausgeschlossen werden.');
assert.strictEqual(first.remaining, 1);

const staggered = [
  {id:'D',reference:'DDDDDD',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'08:30',customerAvisPickupTimeTo:'09:30'},
  {id:'E',reference:'EEEEEE',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'09:30',customerAvisPickupTimeTo:'10:30'},
  {id:'F',reference:'FFFFFF',customerAvisPickupDate:'2026-09-24',customerAvisPickupTimeFrom:'10:30',customerAvisPickupTimeTo:'11:30'}
];
const staggeredSlot = slots.slotState(staggered,'2026-09-24','09:00','11:00');
assert.strictEqual(staggeredSlot.bookedPeak, 1, 'Kapazität muss nach tatsächlicher Gleichzeitigkeit berechnet werden.');
assert.strictEqual(staggeredSlot.remaining, 2);

console.log('RC1224 customer avis slots regression: OK');
