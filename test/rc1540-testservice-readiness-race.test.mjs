import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const recoverySource=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');

function recoveryRuntime({view='',text='',interactive=false,adminSession=false,inlinePayloadCount=0}={}){
  const content={textContent:text};
  const appended=[];
  const body={
    textContent:text,
    getAttribute(name){return name==='data-exporthub-view'?view:'';},
    appendChild(node){appended.push(node);}
  };
  const document={
    readyState:'complete',
    body,
    getElementById(id){return id==='content'?content:null;},
    querySelector(){return interactive?{}:null;},
    createElement(tag){return {tag,style:{},children:[],appendChild(child){this.children.push(child);},remove(){this.removed=true;},setAttribute(){}};}
  };
  const sessionValue=adminSession?JSON.stringify({token:'rc1541-test-token',user:{role:'admin'}}):null;
  const redirects=[];
  const reloads=[];
  const root={
    document,
    location:{
      hostname:'example.test',
      pathname:'/',
      replace(url){redirects.push(url);},
      reload(){reloads.push(true);}
    },
    sessionStorage:{
      length:adminSession?1:0,
      getItem(key){return key==='exporthub_rc301_tab_session'?sessionValue:null;},
      key(index){return adminSession&&index===0?'exporthub_rc301_tab_session':null;}
    },
    setTimeout(){return 1;},
    clearTimeout(){},
    addEventListener(){},
    fetch:async()=>({
      ok:true,
      json:async()=>({stateDiagnostics:{inlinePayloadCount}})
    })
  };
  if(interactive)root.setView=()=>{};
  vm.runInNewContext(recoverySource,{window:root,AbortController});
  return {recovery:root.ExportHUBRC1067StartupRecovery,root,redirects,reloads,appended};
}

test('RC1540: Live-waitReady wartet bis der bekannte Startup-Ladezustand beendet ist',()=>{
  const start=helper.indexOf('export async function waitReady(page)');
  const end=helper.indexOf('function responsiveViewport',start);
  assert.ok(start>=0&&end>start,'waitReady-Block fehlt');
  const block=helper.slice(start,end);
  assert.match(block,/process\.env\.EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(block,/ExportHUBRC1067StartupRecovery/,'kanonische Startup-Ladeerkennung wird nicht verwendet');
  assert.match(block,/typeof recovery\.isBroken==='function'/,'Live-Gate muss die Recovery-Zustandsbewertung verwenden');
});

test('RC1541: echter 11-Prozent-Startup bleibt gebrochen',()=>{
  const {recovery}=recoveryRuntime({
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.isBroken(),true);
});

test('RC1541: bedienbare Runtime ist trotz stale Startup-Text nicht gebrochen',()=>{
  const {recovery}=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true
  });
  assert.equal(typeof recovery.isBroken,'function');
  assert.equal(recovery.loading(),true,'Fixture muss den stale Ladehinweis wirklich erkennen');
  assert.equal(recovery.isBroken(),false);
});

test('RC1542: real beobachteter Azure-Teamdaten-Ladezustand wird zentral erkannt',()=>{
  const {recovery}=recoveryRuntime({
    text:'Azure-Teamdaten werden geladen … · 9 s',
    view:'',
    interactive:false
  });
  assert.equal(recovery.loading(),true,'Der im RC1540-Live-Artefakt beobachtete Azure-Teamdaten-Hinweis muss als Startup-Ladezustand erkannt werden');
  assert.equal(recovery.isBroken(),true,'Azure-Teamdaten-Ladezustand ohne bedienbare Runtime muss gebrochen bleiben');
});

test('RC1542: bedienbare Runtime darf trotz stale Azure-Teamdaten-Hinweis fortfahren',()=>{
  const {recovery}=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · Azure-Teamdaten werden geladen … · 9 s',
    view:'dashboard',
    interactive:true
  });
  assert.equal(recovery.loading(),true,'Stale Azure-Teamdaten-Hinweis muss durch denselben zentralen Vertrag laufen');
  assert.equal(recovery.isBroken(),false,'Bedienbare Runtime mit stale Azure-Teamdaten-Hinweis darf nicht blockiert werden');
});

test('RC1541: Recovery-Check leitet benutzbare Runtime mit stale Startup-Text nicht um',async()=>{
  const {recovery,redirects}=recoveryRuntime({
    text:'Dashboard · Sendungsübersicht · ExportHUB wird geladen · 11 %',
    view:'dashboard',
    interactive:true,
    adminSession:true,
    inlinePayloadCount:3
  });
  assert.equal(recovery.isBroken(),false);
  await recovery.check();
  assert.deepEqual(redirects,[],'benutzbare Runtime darf nicht zur Migration-Recovery umgeleitet werden');
});

test('RC1541: Recovery-Check leitet echten gebrochenen Startup weiterhin um',async()=>{
  const {recovery,redirects}=recoveryRuntime({
    text:'ExportHUB wird geladen · 11 %',
    view:'',
    interactive:false,
    adminSession:true,
    inlinePayloadCount:3
  });
  assert.equal(recovery.isBroken(),true);
  await recovery.check();
  assert.equal(redirects.length,1,'echter gebrochener Startup muss weiterhin die Recovery starten');
  assert.match(redirects[0],/^\/migration-recovery\.html\?/);
});
test('RC1574: blockierter Azure-Teamdaten-Start bietet sichere Wiederholung auch ohne Administratorrecht',()=>{
  const {recovery,redirects,reloads,appended}=recoveryRuntime({
    text:'ExportHUB wird vorbereitet\\nAzure-Teamdaten werden geladen … · 52 s\\n15 %',
    view:'',
    interactive:false,
    adminSession:false
  });
  assert.equal(recovery.isBroken(),true);
  assert.equal(recovery.showStall(),true);
  assert.equal(appended.length,1,'sichtbare Fehleranzeige fuer alle Benutzer');
  const retry=appended[0].children.find(node=>node.tag==='button');
  assert.ok(retry,'Wiederholungsaktion vorhanden');
  assert.match(retry.textContent,/Erneut laden/);
  retry.onclick();
  assert.deepEqual(reloads,[true],'Wiederholung ohne Loeschen lokaler Daten');
  assert.deepEqual(redirects,[],'ohne Nachweis keine Migration und kein Redirect');
});

test('RC1574: bereits bedienbare App darf trotz altem Ladehinweis keine Fehlermeldung zeigen',()=>{
  const {recovery,appended}=recoveryRuntime({
    text:'Dashboard · Azure-Teamdaten werden geladen … · 52 s',
    view:'dashboard',
    interactive:true
  });
  assert.equal(recovery.isBroken(),false);
  assert.equal(recovery.showStall(),false);
  assert.equal(appended.length,0);
});

test('RC1574: Start-Watchdog ist zeitlich begrenzt und die Datenmigration bleibt an Health gebunden',()=>{
  assert.ok(recoverySource.includes('w.setTimeout(function(){if(isBroken())showStall()},25000)'),
    '25-Sekunden-Failsafe muss registriert sein');
  assert.ok(recoverySource.includes('if(count>0&&isBroken())'),
    'Migration darf weiterhin nur bei positivem Health-Nachweis erfolgen');
  assert.ok(recoverySource.includes('clearStall()'),
    'Fehleranzeige wird bei erfolgreichem Start entfernt');
});
