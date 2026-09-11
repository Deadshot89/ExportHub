import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const PATCH=path.join(ROOT,'.github/rc1018/fix-mail-wording.mjs');
const WORKFLOW=fs.readFileSync(path.join(ROOT,'.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml'),'utf8');
const ASSET=fs.readFileSync(path.join(ROOT,'assets/rc1027-lieferavis-immediate.js'),'utf8');

test('RC1027/RC1033: Release-Vorbereitung injiziert oder aktualisiert den Avis-Layer mit frischem Cache-Key',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1027-'));
  try{
    fs.mkdirSync(path.join(tmp,'assets'),{recursive:true});
    fs.writeFileSync(path.join(tmp,'assets/rc1018-mail-language-standard.js'),'Eine zusätzliche Bestätigung der Sendungsdetails per E-Mail ist nicht erforderlich.');
    fs.writeFileSync(path.join(tmp,'index.html'),'<html><head><script id="exporthub-rc1027-lieferavis-immediate" defer src="/assets/rc1027-lieferavis-immediate.js?v=1031"></script></head><body></body></html>');
    for(const page of ['TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(tmp,page),'<html><head></head><body></body></html>');
    execFileSync(process.execPath,[PATCH],{cwd:tmp,stdio:'pipe'});
    for(const page of ['index.html','TESTVERSION.html','demo.html']){
      const html=fs.readFileSync(path.join(tmp,page),'utf8');
      assert.match(html,/id="exporthub-rc1027-lieferavis-immediate"/);
      assert.match(html,/assets\/rc1027-lieferavis-immediate\.js\?v=1033/);
      assert.doesNotMatch(html,/assets\/rc1027-lieferavis-immediate\.js\?v=1031/,'Alter Cache-Key darf nach der Release-Vorbereitung nicht bestehen bleiben.');
      assert.equal((html.match(/exporthub-rc1027-lieferavis-immediate/g)||[]).length,1,'RC1027 darf pro Oberfläche nur einmal geladen werden.');
    }
  }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});

test('RC1027: Standarddeploy führt Release-Vorbereitung vor dem gemeinsamen Drei-Umgebungen-Build aus',()=>{
  const patchAt=WORKFLOW.indexOf('node .github/rc1018/fix-mail-wording.mjs');
  const buildAt=WORKFLOW.indexOf('node .github/rc1043/build-three-env.mjs');
  assert.ok(patchAt>=0&&buildAt>patchAt,'RC1027-Injektion muss vor dem aktuellen gemeinsamen Build stattfinden.');
  assert.match(fs.readFileSync(path.join(ROOT,'.github/rc1043/build-three-env.mjs'),'utf8'),/\.github\/rc1018\/build-three-env\.mjs/,'RC1043 muss weiterhin die geprüfte RC1018-Buildbasis verwenden.');
  assert.match(WORKFLOW,/cp -R assets "\$dir\/assets"/,'Das neue RC1027-Asset muss in beide Deploypakete übernommen werden.');
});

test('RC1027: exklusive Avis-Mail enthält keinen Versanddetail-Renderer und eigene Mail wird delegiert',()=>{
  assert.match(ASSET,/function standaloneAvis\(/);
  assert.match(ASSET,/type===['"]own['"]/);
  const fn=ASSET.slice(ASSET.indexOf('function standaloneAvis('),ASSET.indexOf('function injectMailBody('));
  assert.doesNotMatch(fn,/SENDUNGSDETAILS|Shipment details|Details zur Sendung/i);
  assert.match(ASSET,/ensureCustomerAvis/);
  assert.match(ASSET,/previous\.toggle\(true\)/,'Kompatibilitätsfallback muss den bestehenden sicheren Avis-Serverpfad erhalten.');
});
