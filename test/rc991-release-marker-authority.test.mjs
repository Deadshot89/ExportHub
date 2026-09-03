import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function extractFunction(name){
  const re=new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m=re.exec(html);
  if(!m)return '';
  let i=m.index+m[0].length-1,depth=0,quote='',esc=false;
  for(;i<html.length;i++){
    const ch=html[i];
    if(quote){
      if(esc)esc=false;
      else if(ch==='\\\\')esc=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return html.slice(m.index,i+1);
  }
  return '';
}

test('RC991: kanonischer Build ist RC991 und der Release-Center-Punkt ist sichtbar',()=>{
  assert.match(html,/var\s+BUILD\s*=\s*Object\.freeze\(\{version:'RC991',cache:'991',loginReturn:'\/TESTVERSION\.html\?v=991'\}\)/);
  assert.match(html,/RC991 verhindert, dass ein älterer TESTSERVICE-Snapshot den geprüften Produktions-index oder den aktuellen Produktionsmarker überschreibt\./);
});

test('RC991: Snapshot darf autoritativen Produktionsmarker und index.html nicht überschreiben',()=>{
  const src=extractFunction('releaseFiles');
  assert.ok(src,'releaseFiles fehlt');

  const factory=new Function(
    'VERSION','RELEASE_ASSETS','REQUIRED_RELEASE_FILES','releasePath',
    `${src}; return releaseFiles;`
  );
  const releaseFiles=factory('RC991',{},[],path=>String(path||''));
  const indexHtml='<!doctype html><title>RC991</title>';
  const bundle={
    files:{
      'production-version.js':"window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC883';",
      'index.html':'ALTER SNAPSHOT INDEX',
      'staticwebapp.config.json':'{}'
    },
    gitSha:'deadbeef',
    generatedAt:'2026-09-03T20:00:00.000Z'
  };

  const files=releaseFiles(indexHtml,bundle);

  assert.equal(files['index.html'],indexHtml,'Snapshot hat den geprüften Produktions-index überschrieben');
  assert.equal(
    files['production-version.js'],
    "window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC991';",
    'Snapshot hat den aktuellen Produktionsmarker überschrieben'
  );
});
