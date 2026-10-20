import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Update ExportHUB: die alten Testhinweise (über 19 000 px hoch) sind eingeklappt,
// und Absatz und Kachel zeigen dieselbe sichtbare Version.

for(const file of ['index.html','TESTVERSION.html']){
  const html=fs.readFileSync(file,'utf8');
  const i=html.indexOf('function renderUpdate(){');
  const fn=html.slice(i,html.indexOf('\nfunction ',i+10));

  test(`Update-Seite (${file}): Testhinweise sind eingeklappt`,()=>{
    assert.match(fn,/<details class="rc524-release-tests-box"><summary>Testhinweise anzeigen <span>'\+tests\.length\+'<\/span><\/summary><div class="rc524-release-tests">/);
    assert.doesNotMatch(fn,/'\)\+\(tests\.length\?'<div class="rc524-release-tests">/);
  });

  test(`Update-Seite (${file}): Absatz nutzt dieselbe Versionsmarke wie die Kachel`,()=>{
    assert.match(fn,/Anwendungsversion: <b data-exporthub-version-label>'\+E\(BUILD\)\+'<\/b>/);
  });
}
