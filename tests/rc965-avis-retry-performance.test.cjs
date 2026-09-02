'use strict';

const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('TESTVERSION.html', 'utf8');
const start = source.indexOf('<script id="exporthub-rc706-customer-avis-internal">');
const end = source.indexOf('</script>', start);
assert(start >= 0 && end > start, 'Kunden-Avis-Modul fehlt.');
const avis = source.slice(start, end);

const buildMatch = source.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)',loginReturn:'\/TESTVERSION\.html\?v=(\d+)'\}\);/);
assert(buildMatch, 'Build-Kennung fehlt.');
assert(Number(buildMatch[1]) >= 965, 'RC965 oder höher wird erwartet.');
assert.strictEqual(buildMatch[1], buildMatch[2], 'Build-Version und Cache-Version müssen identisch sein.');
assert.strictEqual(buildMatch[1], buildMatch[3], 'Build-Version und Login-Return-Version müssen identisch sein.');
assert(avis.includes('function render(){return false}'), 'Das interne Avis-UI muss weiterhin deaktiviert bleiben.');
assert(avis.includes('/* exporthub-rc896-avis-ui-disabled */'), 'RC896 Avis-UI-Sperre darf nicht entfernt werden.');
assert(avis.includes('/* exporthub-rc965-avis-retry-disabled */'), 'RC965 Performance-Marker fehlt.');
assert(avis.includes('function schedule(){return false}'), 'Der deaktivierte Avis-Renderer darf keinen Retry-Scheduler mehr starten.');
assert(!avis.includes('avisRetry<30'), 'Der alte 30-fache Avis-Retry ist noch aktiv.');
assert(!avis.includes('setTimeout(attempt,'), 'Der alte Avis-Retry-Timer ist noch aktiv.');

for (const required of [
  'function injectMailBody(',
  'async function toggle(on)',
  'async function persist(reason)',
  'function autoExpiresOn(',
  'window.ExportHUBCustomerAvis706=api',
  'window.ExportHUBCustomerAvis705=api',
  'SECURITY_VERSION=2'
]) {
  assert(avis.includes(required), 'Kunden-Avis-Funktion verloren: ' + required);
}

console.log('RC965 avis retry performance regression: OK');
