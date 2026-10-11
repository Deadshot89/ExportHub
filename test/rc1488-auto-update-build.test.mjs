import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {finalizeAutoUpdate,injectAutoUpdate,ensureManifestNoStore} from '../.github/rc1488/finalize-auto-update.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1488-'));
  const out=path.join(root,'dist-rc1112');
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(root,'assets','rc1488-auto-update.js'),'window.__RC1488__=true;\n');
  fs.writeFileSync(path.join(root,'release-version.json'),JSON.stringify({visibleRelease:'RC1488',technicalBuild:'RC1112'}));
  fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><head><title>P</title></head><body></body></html>');
  fs.writeFileSync(path.join(out,'TESTVERSION.html'),'<!doctype html><html><head><title>T</title></head><body></body></html>');
  for(const name of ['staticwebapp.config.json','staticwebapp.testservice.config.json'])fs.writeFileSync(path.join(out,name),JSON.stringify({routes:[{route:'/',headers:{'Cache-Control':'no-store'}}]}));
  return {root,out};
}

test('RC1488: Finalizer erzeugt deploymentgenaues Manifest und bindet Runtime in Produktion + TESTSERVICE ein',()=>{
  const {root,out}=fixture();
  const sha='0123456789abcdef0123456789abcdef01234567';
  const manifest=finalizeAutoUpdate({root,out,env:{EXPORTHUB_BUILD_ID:sha},now:()=>new Date('2026-10-11T12:00:00.000Z')});
  assert.deepEqual(manifest,{schema:'exporthub-update-v1',buildId:sha,visibleRelease:'RC1488',technicalBuild:'RC1112',builtAt:'2026-10-11T12:00:00.000Z'});
  assert.equal(fs.existsSync(path.join(out,'assets','rc1488-auto-update.js')),true);
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    assert.match(html,/id="exporthub-rc1488-auto-update"/);
    assert.match(html,/src="\/assets\/rc1488-auto-update\.js\?v=1488"/);
    assert.match(html,new RegExp(`data-build-id="${sha}"`));
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'exporthub-update.json'),'utf8')),manifest);
});

test('RC1488: Finalizer ist idempotent und erzeugt niemals doppelte Script-Tags',()=>{
  const {root,out}=fixture();
  const env={EXPORTHUB_BUILD_ID:'abcdef0123456789abcdef0123456789abcdef01'};
  finalizeAutoUpdate({root,out,env});
  finalizeAutoUpdate({root,out,env});
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    assert.equal((html.match(/id="exporthub-rc1488-auto-update"/g)||[]).length,1);
  }
});

test('RC1488: Update-Manifest wird am Azure-CDN explizit auf no-store gesetzt',()=>{
  const next=ensureManifestNoStore({routes:[{route:'/'},{route:'/exporthub-update.json',headers:{'X-Test':'1'}}]});
  const route=next.routes.find(row=>row.route==='/exporthub-update.json');
  assert.match(route.headers['Cache-Control'],/no-store/);
  assert.equal(route.headers['X-Content-Type-Options'],'nosniff');
  assert.equal(route.headers['X-Test'],'1');
});

test('RC1488: bestehender Script-Tag wird auf den aktuellen Build aktualisiert statt dupliziert',()=>{
  const old='<html><head><script id="exporthub-rc1488-auto-update" defer src="/assets/rc1488-auto-update.js?v=1488" data-build-id="old"></script></head><body></body></html>';
  const html=injectAutoUpdate(old,{buildId:'abcdef0',visibleRelease:'RC1488',file:'index.html'});
  assert.equal((html.match(/id="exporthub-rc1488-auto-update"/g)||[]).length,1);
  assert.match(html,/data-build-id="abcdef0"/);
  assert.doesNotMatch(html,/data-build-id="old"/);
});
