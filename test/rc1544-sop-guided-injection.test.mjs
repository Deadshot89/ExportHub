import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {integrateGuidedWorkspace,GUIDED_MARKERS} from '../.github/rc1544/integrate-guided-workspace.mjs';

const ROOT=process.cwd();
const ANCHOR_ID='exporthub-rc1502-sop-persistence';

function count(value,needle){return String(value).split(needle).length-1;}

function productionLikeHtml(){
  const anchor=`<script id="${ANCHOR_ID}" defer src="/assets/sop/rc1502-sop-persistence.js?v=1502"></script>`;
  const embeddedPrint=`<script>function printStow(){const html='<!doctype html><html><head><style>.x{display:block}</style></head><body><h1>Stauplan</h1></body></html>';return html;}<\/script>`;
  const laterTemplate=`<script>const preview='<html><head><title>X</title></head><body>Preview</body></html>';window.__RC1544_PREVIEW__=preview;<\/script>`;
  // ExportHUB production is intentionally not required to end with a literal </body></html>.
  return `<!doctype html><html><head><meta charset="utf-8">${anchor}</head><body><main>ExportHUB</main>${embeddedPrint}${laterTemplate}<style>body{min-width:0}</style>`;
}

test('RC1544: Injection hängt ausschließlich an den eindeutigen SOPMaster-Persistenzanker',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'rc1544-injection-'));
  try{
    const original=productionLikeHtml();
    for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),original);

    integrateGuidedWorkspace(ROOT,out);

    for(const file of ['index.html','TESTVERSION.html','demo.html']){
      const built=fs.readFileSync(path.join(out,file),'utf8');
      assert.ok(built.includes("const html='<!doctype html><html><head><style>.x{display:block}</style></head><body><h1>Stauplan</h1></body></html>'"),`${file}: Stauplan-Template wurde beschädigt`);
      assert.ok(built.includes("const preview='<html><head><title>X</title></head><body>Preview</body></html>'"),`${file}: spätes HTML-Template wurde beschädigt`);
      for(const marker of GUIDED_MARKERS)assert.equal(count(built,`id="${marker}"`),1,`${file}: ${marker} muss genau einmal vorkommen`);

      const anchor=built.indexOf(`id="${ANCHOR_ID}"`);
      const anchorClose=built.indexOf('</script>',anchor);
      const style=built.indexOf('id="exporthub-rc1544-sop-guided-workspace-style"');
      const data=built.indexOf('id="exporthub-rc1544-sop-guided-i18n-data"');
      const i18n=built.indexOf('id="exporthub-rc1544-sop-guided-i18n"',data+1);
      const workspace=built.indexOf('id="exporthub-rc1544-sop-guided-workspace"',style+1);
      const embedded=built.indexOf("const html='<!doctype html");

      assert.ok(anchor>=0&&anchorClose>anchor,`${file}: SOPMaster-Persistenzanker fehlt`);
      assert.ok(style>anchorClose,`${file}: Guided-Style muss nach dem realen Persistenzanker stehen`);
      assert.ok(data>style&&i18n>data&&workspace>i18n,`${file}: Reihenfolge Style → Sprachdaten → i18n → Workspace ist falsch`);
      assert.ok(workspace<embedded,`${file}: Guided-Tags dürfen nicht in ein späteres eingebettetes HTML-Template geraten`);
    }
  }finally{
    fs.rmSync(out,{recursive:true,force:true});
  }
});

test('RC1544: fehlender SOPMaster-Persistenzanker bricht den Build sichtbar ab statt unsicher zu injizieren',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'rc1544-no-anchor-'));
  try{
    const html='<!doctype html><html><head></head><body><script>const x="</body>";<\/script>';
    for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),html);
    assert.throws(()=>integrateGuidedWorkspace(ROOT,out),/Persistenzanker|rc1502-sop-persistence/i);
  }finally{
    fs.rmSync(out,{recursive:true,force:true});
  }
});