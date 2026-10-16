import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../assets/sop/rc1550-sop-active-catalog.js');
const catalog=globalThis.ExportHubSopActiveCatalog;

function repoPath(src){return path.join(process.cwd(),String(src||'').replace(/^\//,''));}
function isImageMagic(buffer){
  const png=buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const jpg=buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
  return png||jpg;
}

test('RC1550: BSH verwendet genau elf reale, eindeutige Schrittbilder',()=>{
  const bsh=catalog.get('SOP-CUST-BSH-001');
  const stepIds=new Set(bsh.sections.steps.map(step=>step.id));
  assert.equal(bsh.visuals.length,11);
  assert.equal(new Set(bsh.visuals.map(item=>item.src)).size,11);
  for(const visual of bsh.visuals){
    assert.equal(visual.type,'screenshot');
    assert.ok(stepIds.has(visual.stepId),`Unbekannte stepId ${visual.stepId}`);
    assert.ok(visual.caption&&visual.caption.trim(),`Caption fehlt für ${visual.src}`);
    const file=repoPath(visual.src);
    assert.equal(fs.existsSync(file),true,`${visual.src} fehlt`);
    const bytes=fs.readFileSync(file);
    assert.ok(bytes.length>=10_000,`${visual.src} ist zu klein (${bytes.length} Bytes)`);
    assert.equal(isImageMagic(bytes),true,`${visual.src} ist kein PNG/JPEG`);
  }
});

test('RC1550: alle BSH-Arbeitsschritte besitzen mindestens ein Bild oder sind der abschließende ExportHUB-/Mail-Schritt',()=>{
  const bsh=catalog.get('SOP-CUST-BSH-001');
  const imageStepIds=new Set(bsh.visuals.map(item=>item.stepId));
  for(const step of bsh.sections.steps){
    if(step.id==='bsh-08-exporthub-mail')continue;
    assert.ok(imageStepIds.has(step.id),`${step.id} hat kein Schrittbild`);
  }
});
