import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../assets/sop/rc1550-sop-active-catalog.js');
const catalog=globalThis.ExportHubSopActiveCatalog;

function repoPath(src){return path.join(process.cwd(),String(src||'').replace(/^\//,''));}
function isPng(buffer){return buffer.length>=24&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));}
function pngSize(buffer){return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};}

test('RC1550: BSH referenziert genau elf echte, eindeutige PNG-Schrittbilder',()=>{
  const bsh=catalog.get('SOP-CUST-BSH-001');
  assert.ok(bsh);
  assert.equal(bsh.visuals.length,11);
  assert.equal(new Set(bsh.visuals.map(item=>item.src)).size,11);
  const stepIds=new Set(bsh.sections.steps.map(step=>step.id));
  for(const visual of bsh.visuals){
    assert.equal(visual.type,'screenshot');
    assert.equal(visual.required,true);
    assert.ok(stepIds.has(visual.stepId),`Unbekannte stepId ${visual.stepId}`);
    assert.ok(visual.caption&&visual.caption.trim(),`Caption fehlt für ${visual.src}`);
    const file=repoPath(visual.src);
    assert.equal(fs.existsSync(file),true,`${visual.src} fehlt`);
    const bytes=fs.readFileSync(file);
    assert.ok(bytes.length>=10_000,`${visual.src} ist zu klein (${bytes.length} Bytes)`);
    assert.equal(isPng(bytes),true,`${visual.src} ist kein gültiges PNG`);
    const {width,height}=pngSize(bytes);
    assert.ok(width>0&&height>0,`${visual.src} hat ungültige Abmessungen ${width}x${height}`);
  }
});

test('RC1550: jeder bebilderte BSH-Arbeitsschritt hat mindestens ein Bild',()=>{
  const bsh=catalog.get('SOP-CUST-BSH-001');
  const imageStepIds=new Set(bsh.visuals.map(item=>item.stepId));
  for(const step of bsh.sections.steps){
    if(step.id==='bsh-08-exporthub-mail') continue;
    assert.ok(imageStepIds.has(step.id),`${step.id} hat kein Schrittbild`);
  }
});
