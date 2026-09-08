import fs from 'node:fs';

const files = ['index.html', 'TESTVERSION.html'];
const needles = [
  'Gate41',
  'Paletten – Gate41',
  'gateRate',
  'calcGate',
  'gateHtml',
  'shippingCosts',
  'ExportHUBRC626',
  'Versandkosten'
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
      if (contexts.length < 4) {
        const start = Math.max(0, pos - 900);
        const end = Math.min(html.length, pos + needle.length + 1800);
        contexts.push(html.slice(start, end).replace(/\s+/g, ' '));
      }
      pos += needle.length;
    }
    console.log(`\n--- ${needle}: ${count} Treffer ---`);
    contexts.forEach((ctx, i) => console.log(`[${i + 1}] ${ctx}`));
  }
}
