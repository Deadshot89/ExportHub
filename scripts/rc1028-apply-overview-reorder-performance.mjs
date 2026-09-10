import fs from 'node:fs';

const path='TESTVERSION.html';
let source=fs.readFileSync(path,'utf8');

const before="function overviewReorderExistingCards(desired){var r=root();if(!r)return false;desired=Array.isArray(desired)?desired:overviewFiltered();var rank=new Map();desired.forEach(function(sh,i){rank.set(shipmentId(sh),i)});r.querySelectorAll('.rc543-overview-group-body').forEach(function(body){Array.from(body.querySelectorAll(':scope>.rc524-shipment-card')).sort(function(a,b){var ar=rank.has(Q(a.getAttribute('data-shipment')))?rank.get(Q(a.getAttribute('data-shipment'))):999999,br=rank.has(Q(b.getAttribute('data-shipment')))?rank.get(Q(b.getAttribute('data-shipment'))):999999;return ar-br}).forEach(function(card){body.appendChild(card)})});return true}";
const after="function overviewReorderExistingCards(desired){var r=root();if(!r)return false;desired=Array.isArray(desired)?desired:overviewFiltered();var rank=new Map();desired.forEach(function(sh,i){rank.set(shipmentId(sh),i)});r.querySelectorAll('.rc543-overview-group-body').forEach(function(body){var current=Array.from(body.querySelectorAll(':scope>.rc524-shipment-card'));var sorted=current.slice().sort(function(a,b){var ar=rank.has(Q(a.getAttribute('data-shipment')))?rank.get(Q(a.getAttribute('data-shipment'))):999999,br=rank.has(Q(b.getAttribute('data-shipment')))?rank.get(Q(b.getAttribute('data-shipment'))):999999;return ar-br});if(current.length===sorted.length&&current.every(function(card,i){return card===sorted[i]}))return;sorted.forEach(function(card){body.appendChild(card)})});return true}";

const first=source.indexOf(before);
if(first<0)throw new Error('RC1028 Patchanker overviewReorderExistingCards fehlt');
if(source.indexOf(before,first+before.length)>=0)throw new Error('RC1028 Patchanker ist nicht eindeutig');
source=source.slice(0,first)+after+source.slice(first+before.length);
fs.writeFileSync(path,source);
console.log('RC1028 Overview-Reorder-Patch angewendet.');
