import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1328-multi-truck-ui-refresh.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function load(){
  const listeners=new Map();
  const documentListeners=new Map();
  const timers=[];
  let panelPresent=false;
  let cardPresent=true;
  let syncCalls=0;
  let state=null;
  let visibleRef='';
  let lastSyncRef='';

  const document={
    getElementById(id){
      if(id==='rc380StowPlan')return cardPresent?{id}:null;
      if(id==='rc1017-subshipments')return panelPresent?{id}:null;
      return null;
    },
    querySelector(selector){
      if(/maxlength/.test(String(selector)))return{value:visibleRef};
      return null;
    },
    addEventListener(name,fn){documentListeners.set(name,fn)}
  };

  const window={
    document,
    console,
    setTimeout(fn){timers.push(fn);return timers.length},
    addEventListener(name,fn){listeners.set(name,fn)},
    rc1017SyncSubShipments(sh){
      syncCalls++;
      assert.ok(Array.isArray(sh.subShipments)&&sh.subShipments.length>1);
      lastSyncRef=String(sh.ref||sh.reference||sh.shipmentRef||'').toUpperCase();
      panelPresent=true;
      return{requiredTruckCount:sh.subShipments.length};
    },
    __EXPORTHUB_GET_STATE__(){return state}
  };

  vm.runInContext(runtime,vm.createContext({window,document,console,Object,Array,String}));
  return{
    window,
    listeners,
    documentListeners,
    flush(){
      let guard=0;
      while(timers.length&&guard++<200){
        const fn=timers.shift();
        fn();
      }
    },
    runNextTimer(){
      const fn=timers.shift();
      if(fn)fn();
      return !!fn;
    },
    pendingTimers(){return timers.length},
    setPanel(v){panelPresent=!!v},
    setCard(v){cardPresent=!!v},
    setState(v){state=v},
    setVisibleRef(v){visibleRef=String(v||'')},
    syncCalls(){return syncCalls},
    lastSyncRef(){return lastSyncRef},
    panel(){return panelPresent}
  };
}

test('RC1333: Runtime ist syntaktisch gültig und hört auf Save, Render, Sync und Viewwechsel',()=>{
  new vm.Script(runtime);
  assert.match(runtime,/exporthub:shipment-saved/);
  assert.match(runtime,/exporthub:viewchange/);
  assert.match(runtime,/exporthub:rendered/);
  assert.match(runtime,/exporthub:sync/);
  assert.match(runtime,/exporthub:state-loaded/);
  assert.match(runtime,/exporthub:shipment-updated/);
  assert.match(runtime,/rc363SaveShipment/);
  assert.match(runtime,/watchCurrent/);
  assert.match(runtime,/watchRemaining/);
  assert.match(runtime,/state\.shipments|arr\(s\.shipments\)/);
  assert.match(runtime,/currentMultiTruckShipment/);
  assert.match(runtime,/rc1017SyncSubShipments/);
  assert.match(runtime,/rc1017-subshipments/);
});

test('RC1333: Mehr-LKW-Bereich wird nach Save erneut gerendert und nach DOM-Ersatz wiederhergestellt',()=>{
  const app=load();
  const shipment={id:'ABC123',ref:'ABC123',subShipments:[{subShipmentId:'ABC123-TRUCK-1'},{subShipmentId:'ABC123-TRUCK-2'}]};
  app.listeners.get('exporthub:shipment-saved')({detail:{shipment}});
  app.flush();
  assert.equal(app.syncCalls(),1);
  assert.equal(app.panel(),true);

  app.setPanel(false);
  app.setState({shipment});
  app.listeners.get('exporthub:viewchange')({detail:{view:'shipment'}});
  app.flush();
  assert.equal(app.syncCalls(),2);
  assert.equal(app.panel(),true);
});

test('RC1333: Live-Fall findet Mehr-LKW-Sendung in state.shipments obwohl aktueller Draft keine Teilsendungen enthält',()=>{
  const app=load();
  const saved={id:'ABC123',ref:'ABC123',subShipments:[{subShipmentId:'ABC123-TRUCK-1'},{subShipmentId:'ABC123-TRUCK-2'}]};
  app.setVisibleRef('ABC123');
  app.setState({
    shipment:{id:'ABC123',ref:'ABC123',subShipments:[]},
    shipments:[
      {id:'OTHER1',ref:'OTHER1',subShipments:[{},{}]},
      saved
    ]
  });
  app.listeners.get('exporthub:viewchange')({detail:{view:'shipment'}});
  app.flush();
  assert.equal(app.syncCalls(),1);
  assert.equal(app.lastSyncRef(),'ABC123');
  assert.equal(app.panel(),true);
});

test('RC1333: Save-Watcher bleibt aktiv bis die Mehr-LKW-Sendung verzögert im State erscheint',()=>{
  const app=load();
  app.setVisibleRef('ABC123');
  app.setState({shipment:{id:'ABC123',ref:'ABC123',subShipments:[]},shipments:[]});
  const click=app.listeners.get('click');
  assert.equal(typeof click,'function');
  click({target:{closest(selector){return selector==='#rc363SaveShipment'?{}:null}}});

  // Der alte RC1332-Watcher endete nach spätestens 6 Sekunden. Der neue Watcher
  // muss auch danach noch aktiv sein, ohne einen shipment-saved Event zu benötigen.
  for(let i=0;i<8;i++)app.runNextTimer();
  assert.equal(app.syncCalls(),0);
  assert.ok(app.pendingTimers()>0,'Watcher muss nach mehr als sechs Versuchen weiterlaufen');

  app.setState({
    shipment:{id:'ABC123',ref:'ABC123',subShipments:[]},
    shipments:[{id:'ABC123',ref:'ABC123',subShipments:[{subShipmentId:'ABC123-TRUCK-1'},{subShipmentId:'ABC123-TRUCK-2'}]}]
  });
  app.runNextTimer();
  assert.equal(app.syncCalls(),1);
  assert.equal(app.lastSyncRef(),'ABC123');
  assert.equal(app.panel(),true);
});

test('RC1333: Save-Klick wird auf window in der Capture-Phase überwacht',()=>{
  assert.match(runtime,/w\.addEventListener\('click'/);
  assert.match(runtime,/rc363SaveShipment/);
  assert.match(runtime,/watchCurrent\(50\)/);
  assert.match(runtime,/watchRemaining/);
  assert.match(runtime,/setTimeout\(run,1000\)/);
});

test('RC1333: Single-LKW und fehlender Stauplan lösen keinen Render aus',()=>{
  const app=load();
  app.listeners.get('exporthub:shipment-saved')({detail:{shipment:{id:'ONE',ref:'ONE',subShipments:[{subShipmentId:'ONE-TRUCK-1'}]}}});
  app.flush();
  assert.equal(app.syncCalls(),0);

  app.setCard(false);
  app.listeners.get('exporthub:shipment-saved')({detail:{shipment:{id:'TWO',ref:'TWO',subShipments:[{},{}]}}});
  app.flush();
  assert.equal(app.syncCalls(),0);
});

test('RC1333: Drei-Umgebungen-Build lädt den Refresh-Hook mit neuem Cache-Key',()=>{
  assert.match(build,/RC1328_MULTI_TRUCK_REFRESH_TAG/);
  assert.match(build,/patchRc1328MultiTruckRefresh/);
  assert.match(build,/assets\/rc1328-multi-truck-ui-refresh\.js\?v=1333/);
  assert.match(build,/'assets\/rc1328-multi-truck-ui-refresh\.js'/);
  assert.match(build,/html=patchRc1328MultiTruckRefresh\(html,file\)/);
});

test('RC1329: finaler RC1112-Build erzwingt den sichtbaren Mehr-LKW-Renderer in allen drei Umgebungen',()=>{
  assert.match(build,/function patchRc1329MultiTruckUiRuntime\(html,file\)/);
  assert.match(build,/section\.id='rc1017-subshipments'/);
  assert.match(build,/data-rc1017-subshipment/);
  assert.match(build,/html=patchRc1329MultiTruckUiRuntime\(html,file\)/);

  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const start=html.indexOf('var rc1017SubShipmentQrRuntime=Object.create(null);');
    const end=start<0?-1:html.indexOf('function rc1017SyncSubShipments(',start);
    assert.ok(start>=0&&end>start,file+': Mehr-LKW-Runtimeblock fehlt');
    const block=html.slice(start,end);
    assert.match(block,/section\.id='rc1017-subshipments'/,file+': sichtbarer Teilsendungsbereich fehlt');
    assert.match(block,/data-rc1017-subshipment/,file+': Teilsendungskarten fehlen');
    assert.match(block,/rc1017-qr-subshipment/,file+': QR-Aktion fehlt');
    assert.match(block,/rc1017-print-subshipment/,file+': Ladelisten-Aktion fehlt');
    assert.match(block,/rc1017-stow-subshipment/,file+': Stauplan-Aktion fehlt');
  }
});
