import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const page=fs.readFileSync('customer-avis.html','utf8');
const builder=fs.readFileSync('.github/rc1018/build-three-env.mjs','utf8');

test('RC1350: öffentliche AVIS-Seite koalesziert nur gleichzeitig laufende Refresh-GETs',()=>{
  assert.match(page,/customerUploadInteraction=false,appointmentInteraction=false,refreshInFlight=false/);
  assert.match(page,/if\(!session\|\|customerUploadInteraction\|\|appointmentInteraction\|\|refreshInFlight\)return;refreshInFlight=true;return api\('\?_='\+Date\.now\(\)\)/);
  assert.match(page,/\.then\(function\(value\)\{refreshInFlight=false;return value\},function\(err\)\{refreshInFlight=false;throw err\}\)/);
});

test('RC1350: Aktualisierungsfrequenz und Trigger bleiben unverändert',()=>{
  assert.match(page,/setInterval\(function\(\)\{if\(!document\.hidden&&session\)refresh\(\)\},15000\)/);
  assert.match(page,/window\.addEventListener\('focus',function\(\)\{if\(session\)refresh\(\)\}\)/);
  assert.match(page,/document\.addEventListener\('visibilitychange',function\(\)\{if\(!document\.hidden&&session\)refresh\(\)\}\)/);
  assert.match(page,/fetch\('\/api\/customer-avis'\+path/);
});

test('RC1350: Release-Build übernimmt Guard und behält Formularschutz',()=>{
  assert.match(builder,/guardedRc1224Refresh/);
  assert.match(builder,/avisFormDirty\|\|avisFormFocused\(\)\|\|customerUploadInteraction\|\|appointmentInteraction\|\|refreshInFlight/);
  execFileSync(process.execPath,['--check','.github/rc1018/build-three-env.mjs'],{stdio:'pipe'});
});
