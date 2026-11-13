import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Abschnitt fehlt: '+start);
  return source.slice(a,b);
}
test('RC1147 aktualisiert: eigene Mail bleibt im sicheren Opt-in-Pfad',()=>{
  const inject=between('function injectMailBody','function syncVisibleMail');
  assert.match(inject,/type!=='customer'&&type!=='carrier'&&type!=='own'/);
  assert.match(inject,/return ownAvisMail\(source,avisUrl\(sh\),lang\)/);
  assert.match(source,/function hasAvisPlaceholder\(/);
});
test('RC1147 aktualisiert: sichtbare Mail wird beim Bearbeiten nicht automatisch umgeschrieben',()=>{
  const sync=between('function syncVisibleMail','function isCustomerField');
  assert.doesNotMatch(sync,/\.value\s*=/);
  assert.match(sync,/return false/);
});
test('RC1147 aktualisiert: nur expliziter Platzhalter wird durch zulässigen AVIS-Link ersetzt',()=>{
  const own=between('function ownAvisMail','function avisBlock');
  assert.match(own,/hasAvisPlaceholder\(source\)/);
  assert.match(own,/rc1333IsSafeAvisUrl\(url\)/);
  assert.match(own,/Hier zur Avisierung klicken/);
  assert.match(own,/used=true/);
});
