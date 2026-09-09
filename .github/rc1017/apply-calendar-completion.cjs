const fs = require('node:fs');

const file = 'assets/abholkalender.js';
let source = fs.readFileSync(file,'utf8');

if (source.includes('function calendarScalarText(value)')) {
  console.log('RC1017 calendar customer fix already applied');
  process.exit(0);
}

const before = "  function shipmentCustomer(shipment){ return String(shipment && (shipment.customerName || shipment.customer || shipment.recipientCustomerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }";
const after = String.raw`  function calendarScalarText(value){
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
  }`;

if (!source.includes(before)) {
  throw new Error('RC1017 calendar customer anchor not found');
}

source = source.replace(before,after);
fs.writeFileSync(file,source);
console.log('RC1017 calendar customer fix applied');
