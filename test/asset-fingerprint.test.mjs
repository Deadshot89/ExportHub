import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fingerprintHtml,fingerprintAssets,withHash,hashFile} from '../.github/asset-fingerprint/fingerprint-assets.mjs';

function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asset-fingerprint-'));
  const root=path.join(dir,'root'),out=path.join(dir,'out');
  fs.mkdirSync(path.join(root,'assets/sop'),{recursive:true});
  fs.mkdirSync(path.join(out,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/menu.css'),'a{}');
  fs.writeFileSync(path.join(root,'assets/sop/tour.js'),'1');
  fs.writeFileSync(path.join(root,'assets/shared.js'),'repo');
  fs.writeFileSync(path.join(out,'assets/shared.js'),'dist');
  return {root,out};
}

test('Asset-Fingerprint: lokale Verweise bekommen einen Inhalts-Hash, ?v= bleibt erhalten', ()=>{
  const {root,out}=fixture();
  const html='<link href="/assets/menu.css?v=1579"><script src="assets/sop/tour.js"></script><script src="/assets/missing.js?v=1"></script><a href="https://example.invalid/assets/x.js">x</a>';
  const result=fingerprintHtml(html,{root,out});
  const menuHash=hashFile(path.join(root,'assets/menu.css'));
  assert.ok(result.html.includes(`href="/assets/menu.css?v=1579&h=${menuHash}"`));
  assert.match(result.html,/src="assets\/sop\/tour\.js\?h=[0-9a-f]{10}"/);
  assert.ok(result.html.includes('src="/assets/missing.js?v=1"'),'unbekannte Datei bleibt unverändert');
  assert.ok(result.html.includes('href="https://example.invalid/assets/x.js"'),'fremde Hosts bleiben unverändert');
  assert.deepEqual(result.missing,['/assets/missing.js']);
});

test('Asset-Fingerprint: ausgelieferte dist-Datei hat Vorrang vor der Repo-Datei', ()=>{
  const {root,out}=fixture();
  const {html}=fingerprintHtml('<script src="/assets/shared.js?v=1"></script>',{root,out});
  assert.ok(html.includes(`h=${hashFile(path.join(out,'assets/shared.js'))}`));
});

test('Asset-Fingerprint: erneuter Lauf ersetzt den Hash statt ihn zu verdoppeln', ()=>{
  const {root,out}=fixture();
  fs.writeFileSync(path.join(out,'index.html'),'<link href="/assets/menu.css?v=1579">');
  fingerprintAssets({root,out,files:['index.html']});
  fs.writeFileSync(path.join(root,'assets/menu.css'),'a{color:red}');
  fingerprintAssets({root,out,files:['index.html']});
  const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  assert.equal((html.match(/h=/g)||[]).length,1);
  assert.ok(html.includes(`h=${hashFile(path.join(root,'assets/menu.css'))}`));
  assert.equal(withHash('?v=1&h=old','new'),'?v=1&h=new');
});

test('Asset-Fingerprint: beide Build-Pipelines hängen den Schritt als letzten an', ()=>{
  for(const file of ['.github/rc1112/build-three-env.mjs','.github/packmeldungen/build-three-env.mjs']){
    const source=fs.readFileSync(file,'utf8');
    const call=source.lastIndexOf('fingerprintAssets(');
    assert.ok(call>0,`${file}: fingerprintAssets fehlt`);
    for(const step of ['integrateCoverageAdmin(','integrateGuidedWorkspace(','finalizeAutoUpdate(']){
      const at=source.lastIndexOf(step);
      if(at>0)assert.ok(at<call,`${file}: ${step} muss vor fingerprintAssets laufen`);
    }
  }
});

test('Router-Ansichten: Packmeldungen und Verpackungen fallen nicht auf das alte Dashboard zurück', ()=>{
  assert.match(fs.readFileSync('assets/pack-notification-nav.js','utf8'),/root\.packnotifications=function\(\)\{openInbox\(\);\}/);
  assert.match(fs.readFileSync('assets/rc1555-packaging-management.js','utf8'),/root\.packagingmasterdata=function\(\)/);
});
