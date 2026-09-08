import fs from 'node:fs';

const files = ['index.html', 'TESTVERSION.html'];
const needles = [
  'function activeShipmentRoute',
  'function shipmentLoad',
  'function syncCostFromShipment',
  'function gateConfiguredBase',
  'function calcGate',
  'function loadCostFromShipment',
  'function newCostRequest',
  'function gateHtml',
  'function updateGateLive'
];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  console.log(`\n===== ${file} bytes=${Buffer.byteLength(html)} =====`);
  for (const needle of needles) {
    let pos = 0;
    let count = 0;
    const contexts = [];
    while ((pos = html.indexOf(needle, pos)) !== -1) {
      count++;
      if (contexts.length < 3) {
        const start = Math.max(0, pos - 250);
        const end = Math.min(html.length, pos + needle.length + 5200);
        contexts.push(html.slice(start, end).replace(/\s+/g, ' '));
      }
      pos += needle.length;
    }
    console.log(`\n--- ${needle}: ${count} Treffer ---`);
    contexts.forEach((ctx, i) => console.log(`[${i + 1}] ${ctx}`));
  }
}
