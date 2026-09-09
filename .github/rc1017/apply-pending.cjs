'use strict';
const fs=require('fs');

function replaceOnce(path,from,to){
  const src=fs.readFileSync(path,'utf8');
  if(src.includes(to)) return false;
  const count=src.split(from).length-1;
  if(count!==1) throw new Error(`${path}: expected exactly one anchor, found ${count}`);
  fs.writeFileSync(path,src.replace(from,to));
  return true;
}

let changed=false;
changed=replaceOnce(
  'assets/abholkalender.js',
  "  function shipmentCustomer(shipment){ return String(shipment && (shipment.customer || shipment.customerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }",
  "  function shipmentCustomer(shipment){ return String(shipment && (shipment.customerName || shipment.customer || shipment.recipientCustomerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }"
)||changed;

changed=replaceOnce(
  'assets/abholkalender.js',
  "    return `<article class=\"pickup-item pickup-item-shipment\"><div class=\"pickup-item-head\"><span class=\"pickup-badge pickup-badge-shipment\">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class=\"pickup-item-grid\"><span>${esc(shipmentCustomer(shipment))}</span><span>${esc(shipmentCarrier(shipment))}</span><span class=\"pickup-status\">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;",
  "    const customer = shipmentCustomer(shipment);\n    return `<article class=\"pickup-item pickup-item-shipment\"><div class=\"pickup-item-head\"><span class=\"pickup-badge pickup-badge-shipment\">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class=\"pickup-item-grid\"><span>Kunde: <strong>${esc(customer)}</strong></span><span>${esc(shipmentCarrier(shipment))}</span><span class=\"pickup-status\">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;"
)||changed;

changed=replaceOnce(
  'assets/abholkalender.css',
  '.pickup-badge-fix{background:rgba(245,158,11,.16);color:#9a5b00}',
  '.pickup-item-fix{background:rgba(34,197,94,.10);border-color:rgba(22,163,74,.28)}\n.pickup-item-shipment{background:rgba(37,99,235,.09);border-color:rgba(37,99,235,.26)}\n.pickup-badge-fix{background:rgba(34,197,94,.16);color:#166534}'
)||changed;

console.log(changed?'RC1017 task1 patch applied':'RC1017 task1 patch already applied');
