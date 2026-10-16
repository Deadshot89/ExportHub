import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8')}
function write(file,source){fs.writeFileSync(file,source,'utf8')}
function replaceRequired(file,before,after,label){
  let source=read(file);
  if(source.includes(after)&&!source.includes(before))return false;
  if(!source.includes(before))throw new Error(`RC1552 ${label||file}: erwarteter Altstand fehlt`);
  source=source.replace(before,after);
  write(file,source);
  return true;
}
function replaceAllRequired(file,before,after,label){
  let source=read(file);
  const count=source.split(before).length-1;
  if(!count&&source.includes(after))return 0;
  if(!count)throw new Error(`RC1552 ${label||file}: kein Treffer`);
  source=source.split(before).join(after);
  write(file,source);
  return count;
}

// Produktiver Source-of-Truth: .de. .com bleibt nur als akzeptierter Legacy-Host erhalten.
replaceRequired('assets/rc1027-lieferavis-immediate.js',
  "var RC1333_PROD_AVIS_ORIGIN='https://exporthub360.com';",
  "var RC1333_PROD_AVIS_ORIGIN='https://www.exporthub360.de';",
  'Lieferavis Runtime');
replaceRequired('assets/rc1166-avis-reminder-overview.js',
  "var RC1333_PROD_AVIS_ORIGIN='https://exporthub360.com';",
  "var RC1333_PROD_AVIS_ORIGIN='https://www.exporthub360.de';",
  'Reminder Runtime');
replaceRequired('api/customer-avis/index.js',
  "const PRODUCTION_AVIS_ORIGIN='https://exporthub360.com';",
  "const PRODUCTION_AVIS_ORIGIN='https://www.exporthub360.de';",
  'Customer AVIS API');
replaceRequired('api/avis-reminder-mail/index.js',
  "const PRODUCTION_PUBLIC_HOST='exporthub360.com';\nconst LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST='www.exporthub360.de';\nconst LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360.de';\nconst LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST='www.exporthub360.com';",
  "const PRODUCTION_PUBLIC_HOST='www.exporthub360.de';\nconst LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST='exporthub360.de';\nconst LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360.com';\nconst LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST='www.exporthub360.com';",
  'Reminder Mail API');

// Historische, durch RC1545 umgedrehte Verträge wieder auf den bestätigten .de-Stand setzen.
replaceRequired('test/rc1166-avis-reminder-overview.test.mjs',
  "assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://exporthub360.com/avis/abc');",
  "assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://www.exporthub360.de/avis/abc');",
  'Reminder Normal-Link');
replaceRequired('test/rc1166-avis-reminder-overview.test.mjs',
  "test('RC1545: gespeicherter .com-Avis-Link bleibt kanonisch auf .com',()=>{\n  const api=load();\n  const sh={reference:'ABC123',customerName:'Testkunde',customerAvisUrl:'https://exporthub360.com/avis/legacy-token'};\n  assert.equal(api.avisLink(sh),'https://exporthub360.com/avis/legacy-token');\n});",
  "test('RC1552: gespeicherter alter .com-Avis-Link wird in der Oberfläche zwingend auf .de normalisiert',()=>{\n  const api=load();\n  const sh={reference:'ABC123',customerName:'Testkunde',customerAvisUrl:'https://exporthub360.com/avis/legacy-token'};\n  assert.equal(api.avisLink(sh),'https://www.exporthub360.de/avis/legacy-token');\n});",
  'Legacy .com Normalisierung');

replaceRequired('test/avis-reminder-outlook.test.mjs',
  "wanted:'https://exporthub360.com/avis/abc?lang=de'",
  "wanted:'https://www.exporthub360.de/avis/abc?lang=de'",
  'Outlook Produktionslink');
replaceRequired('test/essentra-avis-domain.test.mjs',
  "const branded='https://exporthub360.com/avis/abc';",
  "const branded='https://www.exporthub360.de/avis/abc';",
  'gebrandeter AVIS-Link');
replaceAllRequired('test/rc1027-lieferavis-immediate-link-mail-only.test.mjs',
  'exporthub360\\.com','www\\.exporthub360\\.de','Mail-Link Regex-Verträge');
replaceAllRequired('test/rc1027-lieferavis-immediate-link-mail-only.test.mjs',
  'https://exporthub360.com/avis/server-token','https://www.exporthub360.de/avis/server-token','Mail-Link Literal-Verträge');
replaceRequired('test/rc1031-diagnostics-lieferavis-storage.test.mjs',
  '/^https:\\/\\/exporthub360\\.com\\/avis\\/[A-Za-z0-9_-]+$/',
  '/^https:\\/\\/www\\.exporthub360\\.de\\/avis\\/[A-Za-z0-9_-]+$/',
  'API-Link Regex');
replaceRequired('test/rc1031-diagnostics-lieferavis-storage.test.mjs',
  "const canonical='https://exporthub360.com/avis/server-token';",
  "const canonical='https://www.exporthub360.de/avis/server-token';",
  'lokaler kanonischer Link');
replaceRequired('test/rc1326-avis-exporthub360.test.mjs',
  'assert.match(api,/https:\\/\\/exporthub360\\.com/);',
  'assert.match(api,/https:\\/\\/www\\.exporthub360\\.de/);',
  'Server Link');
replaceRequired('test/rc1326-avis-exporthub360.test.mjs',
  'assert.match(reminder,/exporthub360\\.com/);',
  'assert.match(reminder,/www\\.exporthub360\\.de/);',
  'Reminder Link');

{
  const file='test/rc1331-canonical-avis-url.test.mjs';
  let source=read(file);
  source=source.split("RC1333_PROD_AVIS_ORIGIN='https:\\/\\/exporthub360\\.com'").join("RC1333_PROD_AVIS_ORIGIN='https:\\/\\/www\\.exporthub360\\.de'");
  source=source.split("PRODUCTION_AVIS_ORIGIN='https:\\/\\/exporthub360\\.com'").join("PRODUCTION_AVIS_ORIGIN='https:\\/\\/www\\.exporthub360\\.de'");
  const stale=/\n\ntest\('RC1545: neue Produktions-AVIS-Links bleiben verbindlich auf exporthub360\.com',[\s\S]*?\n\}\);\s*$/;
  if(!stale.test(source))throw new Error('RC1552 rc1331: RC1545 Abschlussvertrag fehlt');
  source=source.replace(stale,'\n');
  write(file,source);
}

// Cache-Busting: Browser dürfen die bereits ausgelieferte .com-Runtime nicht weiterverwenden.
const cacheFiles=[
  '.github/rc1112/build-three-env.mjs',
  '.github/rc1018/fix-mail-wording.mjs',
  '.github/rc1521/build-three-env.mjs',
  '.github/rc1505/verify-production-live.mjs',
  '.github/rc1505/verify-build-contract.mjs',
  'test/rc1521-sop-current-main-builder.test.mjs',
  'test/rc1331-canonical-avis-url.test.mjs'
];
for(const file of cacheFiles){
  let source=read(file),before=source;
  source=source.split('rc1027-lieferavis-immediate.js?v=20261005').join('rc1027-lieferavis-immediate.js?v=20261016-rc1552');
  source=source.split('rc1166-avis-reminder-overview.js?v=20261005-outlook').join('rc1166-avis-reminder-overview.js?v=20261016-rc1552');
  if(source!==before)write(file,source);
}

console.log('RC1552: AVIS production domain restored to https://www.exporthub360.de/avis/<TOKEN>; .com remains legacy-compatible.');
