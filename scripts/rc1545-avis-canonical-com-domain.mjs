import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();

function replaceRequired(rel,before,after,label){
  const target=path.join(ROOT,rel);
  let source=fs.readFileSync(target,'utf8');
  if(source.includes(after))return false;
  if(!source.includes(before))throw new Error(`RC1545 ${label||rel}: erwarteter Patch-Anker fehlt.`);
  source=source.replace(before,after);
  fs.writeFileSync(target,source,'utf8');
  return true;
}

replaceRequired(
  'assets/rc1027-lieferavis-immediate.js',
  "var RC1333_PROD_AVIS_ORIGIN='https://www.exporthub360.de';",
  "var RC1333_PROD_AVIS_ORIGIN='https://exporthub360.com';",
  'Lieferavis Runtime'
);

replaceRequired(
  'assets/rc1166-avis-reminder-overview.js',
  "var RC1333_PROD_AVIS_ORIGIN='https://www.exporthub360.de';",
  "var RC1333_PROD_AVIS_ORIGIN='https://exporthub360.com';",
  'Reminder Runtime'
);

replaceRequired(
  'api/customer-avis/index.js',
  "const PRODUCTION_AVIS_ORIGIN='https://www.exporthub360.de';",
  "const PRODUCTION_AVIS_ORIGIN='https://exporthub360.com';",
  'Customer AVIS API'
);

replaceRequired(
  'api/avis-reminder-mail/index.js',
  "const PRODUCTION_PUBLIC_HOST='www.exporthub360.de';\nconst LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST='exporthub360.de';\nconst LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360.com';\nconst LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST='www.exporthub360.com';",
  "const PRODUCTION_PUBLIC_HOST='exporthub360.com';\nconst LEGACY_BRANDED_PRODUCTION_PUBLIC_HOST='www.exporthub360.de';\nconst LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360.de';\nconst LEGACY_COM_WWW_PRODUCTION_PUBLIC_HOST='www.exporthub360.com';",
  'Reminder Mail API'
);

replaceRequired(
  'test/rc1166-avis-reminder-overview.test.mjs',
  "assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://www.exporthub360.de/avis/abc');",
  "assert.equal(api.avisLink({reference:'ABC123',customerName:'Testkunde',testAvisLink:'https://example.test/customer-avis.html?token=abc'}),'https://exporthub360.com/avis/abc');",
  'Reminder Link Contract'
);

replaceRequired(
  'test/rc1166-avis-reminder-overview.test.mjs',
  "test('RC1400: gespeicherter alter .com-Avis-Link wird in der Oberfläche zwingend auf .de normalisiert',()=>{\n  const api=load();\n  const sh={reference:'ABC123',customerName:'Testkunde',customerAvisUrl:'https://exporthub360.com/avis/legacy-token'};\n  assert.equal(api.avisLink(sh),'https://www.exporthub360.de/avis/legacy-token');\n});",
  "test('RC1545: gespeicherter .com-Avis-Link bleibt kanonisch auf .com',()=>{\n  const api=load();\n  const sh={reference:'ABC123',customerName:'Testkunde',customerAvisUrl:'https://exporthub360.com/avis/legacy-token'};\n  assert.equal(api.avisLink(sh),'https://exporthub360.com/avis/legacy-token');\n});",
  'alte .de Normalisierung'
);

replaceRequired(
  'test/rc1331-canonical-avis-url.test.mjs',
  "https:\\\/\\\/www\\.exporthub360\\.de",
  "https:\\\/\\\/exporthub360\\.com",
  'RC1331 erster kanonischer Hostvertrag'
);

for(let i=0;i<3;i++)replaceRequired(
  'test/rc1331-canonical-avis-url.test.mjs',
  "https:\\\/\\\/www\\.exporthub360\\.de",
  "https:\\\/\\\/exporthub360\\.com",
  `RC1331 kanonischer Hostvertrag ${i+2}`
);

replaceRequired(
  'test/rc1331-canonical-avis-url.test.mjs',
  "test('RC1420: neue Produktions-AVIS-Links bleiben verbindlich auf exporthub360.de',()=>{\n  const canonical=/https:\\\/\\\/www\\.exporthub360\\.de/;\n  const wrongCanonical=/PROD(?:UCTION)?_AVIS_ORIGIN='https:\\\/\\\/(?:www\\.)?exporthub360\\.com'/;\n  assert.match(immediate,canonical,'Client muss neue Produktions-AVIS-Links auf exporthub360.de erzeugen');\n  assert.match(api,canonical,'Server muss neue Produktions-AVIS-Links auf exporthub360.de erzeugen');\n  assert.match(reminder,canonical,'Erinnerungslogik muss Produktions-AVIS-Links auf exporthub360.de normalisieren');\n  assert.doesNotMatch(immediate,wrongCanonical,'Client darf .com nicht als kanonischen Produktions-Host setzen');\n  assert.doesNotMatch(api,wrongCanonical,'Server darf .com nicht als kanonischen Produktions-Host setzen');\n  assert.doesNotMatch(reminder,wrongCanonical,'Erinnerungslogik darf .com nicht als kanonischen Produktions-Host setzen');\n});",
  "test('RC1545: neue Produktions-AVIS-Links bleiben verbindlich auf exporthub360.com',()=>{\n  const canonical=/https:\\\/\\\/exporthub360\\.com/;\n  const legacyCanonical=/PROD(?:UCTION)?_AVIS_ORIGIN='https:\\\/\\\/(?:www\\.)?exporthub360\\.de'/;\n  assert.match(immediate,canonical,'Client muss neue Produktions-AVIS-Links auf exporthub360.com erzeugen');\n  assert.match(api,canonical,'Server muss neue Produktions-AVIS-Links auf exporthub360.com erzeugen');\n  assert.match(reminder,canonical,'Erinnerungslogik muss Produktions-AVIS-Links auf exporthub360.com normalisieren');\n  assert.doesNotMatch(immediate,legacyCanonical,'Client darf .de nicht mehr als kanonischen Produktions-Host setzen');\n  assert.doesNotMatch(api,legacyCanonical,'Server darf .de nicht mehr als kanonischen Produktions-Host setzen');\n  assert.doesNotMatch(reminder,legacyCanonical,'Erinnerungslogik darf .de nicht mehr als kanonischen Produktions-Host setzen');\n});",
  'RC1420 veralteter .de Kanonikalvertrag'
);

replaceRequired(
  'test/essentra-avis-domain.test.mjs',
  "const branded='https://www.exporthub360.de/avis/abc';",
  "const branded='https://exporthub360.com/avis/abc';",
  'Essentra branded production link'
);

console.log('RC1545 AVIS canonical domain prepared: new production links use https://exporthub360.com/avis/<TOKEN>; legacy .de/.com hosts remain accepted.');
