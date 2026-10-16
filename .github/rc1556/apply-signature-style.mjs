import fs from 'node:fs';

function replaceExact(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`RC1556 patch miss: ${label}`);
  return source.replace(oldText, newText);
}

const wrapperPath='assets/document-print-name.js';
let wrapper=fs.readFileSync(wrapperPath,'utf8');
const oldLegacy="'[data-rc1503-pickup-field] .rc390-txt,[data-rc1503-pickup-field] .rc352-txt{display:none!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}'";
const newLegacy="'[data-rc1556-legacy-pickup-hidden]{display:none!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}'";
wrapper=replaceExact(wrapper,oldLegacy,newLegacy,'legacy marker CSS');
const oldSignature="'.rc1503-signature-value{display:flex!important;align-items:center!important;justify-content:flex-start!important;height:16mm!important;min-height:0!important;max-height:16mm!important;margin-top:.6mm!important;overflow:hidden!important}'+'.rc1503-signature-value .rc1305-signature-image{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:15mm!important;object-fit:contain!important;object-position:left center!important}'";
const newSignature="'[data-rc1503-pickup-field] [data-rc1503-pickup-value].rc1503-signature-value{display:flex!important;align-items:center!important;justify-content:flex-start!important;height:16mm!important;min-height:16mm!important;max-height:16mm!important;margin-top:.6mm!important;overflow:hidden!important}'+ '[data-rc1503-pickup-field] [data-rc1503-pickup-value].rc1503-signature-value .rc1305-signature-image{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:15mm!important;object-fit:contain!important;object-position:left center!important}'";
wrapper=replaceExact(wrapper,oldSignature,newSignature,'signature specificity');
fs.writeFileSync(wrapperPath,wrapper);

const staticPath='test/rc1550-pod-print-layout.test.mjs';
let staticTest=fs.readFileSync(staticPath,'utf8');
staticTest=replaceExact(staticTest,
`  assert.match(wrapper,/height:16mm!important;min-height:0!important;max-height:16mm!important/);`,
`  assert.match(wrapper,/height:16mm!important;min-height:16mm!important;max-height:16mm!important/);\n  assert.match(wrapper,/\\[data-rc1503-pickup-field\\] \\[data-rc1503-pickup-value\\]\\.rc1503-signature-value/);`,
'static signature contract');
staticTest=replaceExact(staticTest,
`  assert.match(wrapper,/\\[data-rc1503-pickup-field\\] \\.rc390-txt/);\n  assert.match(wrapper,/\\[data-rc1503-pickup-field\\] \\.rc352-txt/);\n  assert.match(wrapper,/data-rc1556-legacy-pickup-hidden/);`,
`  assert.match(wrapper,/\\[data-rc1556-legacy-pickup-hidden\\]\\{display:none!important/);\n  assert.doesNotMatch(wrapper,/\\[data-rc1503-pickup-field\\] \\.rc390-txt/);\n  assert.doesNotMatch(wrapper,/\\[data-rc1503-pickup-field\\] \\.rc352-txt/);\n  assert.match(wrapper,/data-rc1556-legacy-pickup-hidden/);`,
'static legacy CSS contract');
fs.writeFileSync(staticPath,staticTest);

const e2ePath='e2e/specs/rc1550-pod-print-layout.spec.mjs';
let e2e=fs.readFileSync(e2ePath,'utf8');
e2e=replaceExact(e2e,
`      signatureData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',`,
`      signatureData:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik01IDI4IEMyNSA1IDQwIDM1IDYwIDEyIFM5NSAzMCAxMTUgOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIi8+PC9zdmc+',`,
'visible test signature');
e2e=replaceExact(e2e,
`  expect(result.signatureImageHeight,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);`,
`  expect(result.signatureImageHeight,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);\n  expect(result.signatureImageHeight,'Signaturbild muss sichtbar bleiben').toBeGreaterThan(0);`,
'signature image visibility assertion');
fs.writeFileSync(e2ePath,e2e);

console.log('RC1556 signature style patch applied');
