import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {finalizeAutoUpdate,injectAutoUpdate,ensureManifestNoStore,resolveBuildId} from '../.github/rc1488/finalize-auto-update.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1488-'));
  const out=path.join(root,'dist-rc1112');
  fs.mkdirSync(path.join(root,'assets','i18n'),{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(root,'assets','rc1488-auto-update.js'),'window.__RC1488__=true;\n');
  fs.writeFileSync(path.join(root,'assets','i18n','rc1488-auto-update.js'),'window.__RC1488_I18N__=true;\n');
  fs.writeFileSync(path.join(root,'release-version.json'),JSON.stringify({visibleRelease:'RC1488',technicalBuild:'RC1112'}));
  fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><head><title>P</title></head><body></body></html>');
  fs.writeFileSync(path.join(out,'TESTVERSION.html'),'<!doctype html><html><head><title>T</title></head><body></body></html>');
  fs.writeFileSync(path.join(out,'production-version.js'),"window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112';\n");
  for(const name of ['staticwebapp.config.json','staticwebapp.testservice.config.json'])fs.writeFileSync(path.join(out,name),JSON.stringify({routes:[{route:'/',headers:{'Cache-Control':'no-store'}}]}));
  return {root,out};
}

test('RC1538: ausgecheckter Release-SHA gewinnt gegen den Workflow-Dispatch GITHUB_SHA',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1538-git-'));
  execFileSync('git',['init'],{cwd:root,stdio:'ignore'});
  execFileSync('git',['config','user.email','rc1538@example.invalid'],{cwd:root,stdio:'ignore'});
  execFileSync('git',['config','user.name','RC1538 Test'],{cwd:root,stdio:'ignore'});
  fs.writeFileSync(path.join(root,'marker.txt'),'release sha fixture\n');
  execFileSync('git',['add','marker.txt'],{cwd:root,stdio:'ignore'});
  execFileSync('git',['commit','-m','fixture'],{cwd:root,stdio:'ignore'});
  const checkedOutSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim().toLowerCase();
  const workflowHead='ffffffffffffffffffffffffffffffffffffffff';
  assert.notEqual(checkedOutSha,workflowHead);
  assert.equal(resolveBuildId(root,{GITHUB_SHA:workflowHead}),checkedOutSha);
});

test('RC1488: Finalizer schreibt deploymentgenaue Marker und bindet Sprachpaket + Runtime ein',()=>{
  const {root,out}=fixture();
  const sha='0123456789abcdef0123456789abcdef01234567';
  const manifest=finalizeAutoUpdate({root,out,env:{EXPORTHUB_BUILD_ID:sha},now:()=>new Date('2026-10-11T12:00:00.000Z')});
  assert.deepEqual(manifest,{schema:'exporthub-update-v1',buildId:sha,visibleRelease:'RC1488',technicalBuild:'RC1112',builtAt:'2026-10-11T12:00:00.000Z'});
  assert.equal(fs.existsSync(path.join(out,'assets','rc1488-auto-update.js')),true);
  assert.equal(fs.existsSync(path.join(out,'assets','i18n','rc1488-auto-update.js')),true);
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    assert.match(html,/id="exporthub-rc1488-auto-update-i18n"/);
    assert.match(html,/src="\/assets\/i18n\/rc1488-auto-update\.js\?v=1488"/);
    assert.match(html,/id="exporthub-rc1488-auto-update"/);
    assert.match(html,/src="\/assets\/rc1488-auto-update\.js\?v=1488"/);
    assert.ok(html.indexOf('id="exporthub-rc1488-auto-update-i18n"')<html.indexOf('id="exporthub-rc1488-auto-update" defer'),'Sprachpaket steht nicht vor Runtime');
    assert.match(html,new RegExp(`data-build-id="${sha}"`));
  }
  const probe=fs.readFileSync(path.join(out,'production-version.js'),'utf8');
  assert.match(probe,new RegExp(`__EXPORTHUB_UPDATE_BUILD__='${sha}'`));
  assert.match(probe,/__EXPORTHUB_UPDATE_RELEASE__='RC1488'/);
  assert.match(probe,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'/);
});

test('RC1488: Finalizer ist idempotent und erzeugt niemals doppelte Script- oder Probe-Marker',()=>{
  const {root,out}=fixture();
  const env={EXPORTHUB_BUILD_ID:'abcdef0123456789abcdef0123456789abcdef01'};
  finalizeAutoUpdate({root,out,env});
  finalizeAutoUpdate({root,out,env});
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    assert.equal((html.match(/id="exporthub-rc1488-auto-update-i18n"/g)||[]).length,1);
    assert.equal((html.match(/id="exporthub-rc1488-auto-update" defer/g)||[]).length,1);
  }
  const probe=fs.readFileSync(path.join(out,'production-version.js'),'utf8');
  assert.equal((probe.match(/__EXPORTHUB_UPDATE_BUILD__/g)||[]).length,1);
  assert.equal((probe.match(/__EXPORTHUB_UPDATE_RELEASE__/g)||[]).length,1);
});

test('RC1488: production-version.js wird am Azure-CDN explizit auf no-store gesetzt',()=>{
  const next=ensureManifestNoStore({routes:[{route:'/'},{route:'/production-version.js',headers:{'X-Test':'1'}}]});
  const route=next.routes.find(row=>row.route==='/production-version.js');
  assert.match(route.headers['Cache-Control'],/no-store/);
  assert.equal(route.headers['X-Content-Type-Options'],'nosniff');
  assert.equal(route.headers['X-Test'],'1');
});

test('RC1488: bestehende Script-Tags werden auf den aktuellen Build aktualisiert statt dupliziert',()=>{
  const old='<html><head><script id="exporthub-rc1488-auto-update-i18n" defer src="/assets/i18n/rc1488-auto-update.js?v=1488"></script><script id="exporthub-rc1488-auto-update" defer src="/assets/rc1488-auto-update.js?v=1488" data-build-id="old"></script></head><body></body></html>';
  const html=injectAutoUpdate(old,{buildId:'abcdef0',visibleRelease:'RC1488',file:'index.html'});
  assert.equal((html.match(/id="exporthub-rc1488-auto-update-i18n"/g)||[]).length,1);
  assert.equal((html.match(/id="exporthub-rc1488-auto-update" defer/g)||[]).length,1);
  assert.match(html,/data-build-id="abcdef0"/);
  assert.doesNotMatch(html,/data-build-id="old"/);
});

test('RC1488: Standard-Finalgate und Packmeldungen-Build verwenden denselben Auto-Update-Finalizer',()=>{
  const verifier=fs.readFileSync('.github/rc1121/verify-final-html.mjs','utf8');
  const packBuild=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  assert.match(verifier,/from '\.\.\/rc1488\/finalize-auto-update\.mjs'/);
  assert.match(verifier,/finalizeAutoUpdate\(\{root:ROOT,out:OUT\}\)/);
  assert.match(packBuild,/from '\.\.\/rc1488\/finalize-auto-update\.mjs'/);
  assert.match(packBuild,/finalizeAutoUpdate\(\{root,out\}\)/);
});

test('RC1488: beide deployten Static-Web-App-Konfigurationen halten production-version.js cachefrei',()=>{
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    const route=(config.routes||[]).find(row=>row&&row.route==='/production-version.js');
    assert.ok(route,file+': production-version.js Route fehlt');
    assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/i,file+': production-version.js ist nicht no-store');
  }
});
