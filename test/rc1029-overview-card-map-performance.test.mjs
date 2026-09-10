import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function block(start,end,max=9000){
  const s=html.indexOf(start);
  assert.ok(s>=0,`${start} fehlt`);
  const e=end?html.indexOf(end,s+start.length):-1;
  return html.slice(s,e>s?e:s+max);
}

test('RC1029: ruhiger Overview-Patch scannt Karten einmal und reicht eine Map weiter',()=>{
  const quiet=block('function rc640PatchOverviewQuietly(','function rc640ScheduleOverviewPatch(');
  assert.match(quiet,/var\s+cards\s*=\s*Array\.from\(r\.querySelectorAll\('\.rc524-shipment-card\[data-shipment\]'\)\)/,'DOM-Karten müssen einmal erfasst werden');
  assert.match(quiet,/var\s+cardMap\s*=\s*new Map\(\)/,'Kartenmap fehlt');
  assert.match(quiet,/cards\.forEach\(function\(card\)\{cardMap\.set\(/,'Kartenmap muss aus demselben DOM-Scan entstehen');
  assert.match(quiet,/window\.rc485PatchOverviewCards\(desired,cardMap\)/,'Kartenmap muss an den Karten-Patch weitergegeben werden');
  assert.match(quiet,/expected\.every\(function\(id\)\{return cardMap\.has\(id\)\}\)/,'Bestandsvergleich muss dieselbe Map statt indexOf verwenden');
});

test('RC1029: Karten-Patch nutzt vorberechnete Map statt N einzelner Root-querySelector',()=>{
  const patch=block('window.rc485PatchOverviewCards=function','var rc640OverviewPatchTimer=');
  assert.match(patch,/function\(desired,cardMap\)/,'Karten-Patch muss die Map annehmen');
  assert.match(patch,/cardMap instanceof Map\?cardMap\.get\(shipmentId\(sh\)\)/,'vorbereitete Map muss bevorzugt werden');
  assert.match(patch,/:selector&&r\.querySelector\(selector\)/,'Fallback für direkte Altaufrufe muss erhalten bleiben');
});
