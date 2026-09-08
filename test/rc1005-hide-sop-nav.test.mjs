import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  test(`${file}: SOP ist nicht mehr als Hauptnavigation sichtbar`, () => {
    const html = fs.readFileSync(file,'utf8');
    assert.doesNotMatch(html,/data-view=["']sop["']/i,`${file}: statischer SOP-Reiter ist noch sichtbar`);
    assert.doesNotMatch(html,/\{view:["']sop["'],label:["']SOP & Portale["'],right:["']sop["']\}/i,`${file}: SOP steht noch in der aktuellen Navigationsdefinition`);
    assert.doesNotMatch(html,/\{id:["']sop["'],label:["']SOP & Portale["'],icon:/i,`${file}: SOP steht noch in einer sichtbaren Legacy-Navigation`);
  });
}

test('SOP-Funktion und Rechte bleiben intern erhalten', () => {
  const policy = fs.readFileSync('api/shared/user-policy.js','utf8');
  const merge = fs.readFileSync('api/shared/merge.js','utf8');
  assert.match(policy,/['"]sop['"]/, 'SOP-Recht darf nicht entfernt werden');
  assert.match(merge,/sopId/, 'SOP-Zustand sopId muss erhalten bleiben');
  assert.match(merge,/sopStep/, 'SOP-Zustand sopStep muss erhalten bleiben');
});
