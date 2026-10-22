import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const releaseBuilder='.github/rc1521/build-three-env.mjs';
const screenshotGenerator='browser/training-center-screenshots.mjs';
const read=file=>fs.readFileSync(file,'utf8');

test('RC1521 delegiert auf den neuen Training-Center-Build und verdrahtet keine SOPMaster-Overlays mehr',()=>{
  assert.ok(fs.existsSync(releaseBuilder),'RC1521 Build-Wrapper fehlt');
  const src=read(releaseBuilder);
  assert.match(src,/training-center\/build-three-env\.mjs/);
  assert.match(src,/build(?:TrainingCenter)?\s*\(/);
  assert.doesNotMatch(src,/rc1501\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/rc1502\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/rc1503\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/rc1506\/build-three-env\.mjs/);
  assert.doesNotMatch(src,/SOPMaster/i);
});

test('Screenshot-Generator ist demo-only, netzwerkfrei und erzeugt ausschließlich die neue Screenshot-Registry',()=>{
  assert.ok(fs.existsSync(screenshotGenerator),'Training-Center Screenshot-Generator fehlt');
  const src=read(screenshotGenerator);
  assert.match(src,/DEMO-/);
  assert.match(src,/assets\/training-center\/screenshots/);
  assert.match(src,/shipment-open\.png/);
  assert.match(src,/shipment-completion\.png/);
  assert.doesNotMatch(src,/https?:\/\//i);
  assert.doesNotMatch(src,/fetch\s*\(/i);
  assert.doesNotMatch(src,/localStorage|sessionStorage/i);
  assert.doesNotMatch(src,/assets\/sop\//i);
});

test('Task-7 Build- und Screenshot-Pipeline enthalten keine produktiven Schreib- oder Deployment-Aktionen',()=>{
  const sources=[
    '.github/training-center/build-three-env.mjs',
    releaseBuilder,
    screenshotGenerator
  ];
  for(const file of sources){
    assert.ok(fs.existsSync(file),`Pflichtdatei fehlt: ${file}`);
    const src=read(file);
    assert.doesNotMatch(src,/Azure\/static-web-apps-deploy/i,`${file}: Deployment-Aktion unzulässig`);
    assert.doesNotMatch(src,/PRODUCTION FREIGEBEN/i,`${file}: Produktionsfreigabe unzulässig`);
    assert.doesNotMatch(src,/\/api\/state|\/api\/team-state|saveTeamData|persistTeamData/i,`${file}: produktiver Write-Pfad unzulässig`);
  }
});
