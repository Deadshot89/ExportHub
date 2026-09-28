import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1328-multi-truck-ui-refresh.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function load(){
  const listeners=new Map();
  const timers=[];
  let panelPresent=false;
  let cardPresent=true;
  let syncCalls=0;
  let state=null;

  const document={
    getElementById(id){
      if(id==='rc380StowPlan')return cardPresent?{id}:null;
      if(id==='rc1017-subshipments')return panelPresent?{id}:null;
      return null;
    }
  };

  const window={
    document,
    console,
    setTimeout(fn){timers.push(fn);return timers.length},
    addEventListener(name,fn){listeners.set(name,fn)},
    rc1017SyncSubShipments(sh){syncCalls++;assert.ok(Array.isArray(sh.subShipments)&&sh.subShipments.length>1);panelPresent=true;return{requiredTruckCount:sh.subShipments.length}},
    __EXPORTHUB_GET_STATE__(){return state}
  };

  vm.runInContext(runtime,vm.createContext({window,document,console,Object,Array}));
  return{
    window,
    listeners,
    flush(){
      while(timers.length){
        const fn=timers.shift();
        fn();
      }
    },
    setPanel(v){panelPresent=!!v},
    setCard(v){cardPresent=!!v},
    setState(v){state=v},
    syncCalls(){return syncCalls},
    panel(){return panelPresent}
  };
}

test('RC1328: Runtime ist syntaktisch gültig und hört auf Save sowie Viewwechsel',()=>{
  new vm.Script(runtime);
  assert.match(runtime,/exporthub:shipment-saved/);
  assert.match(runtime,/exporthub:viewchange/);
  assert.match(runtime,/rc1017SyncSubShipments/);
  assert.match(runtime,/rc1017-subshipments/);
});

test('RC1328: Mehr-LKW-Bereich wird nach Save erneut gerendert und nach DOM-Ersatz wiederhergestellt',()=>{
  const app=load();
  const shipment={id:'ABC123',subShipments:[{subShipmentId:'ABC123-TRUCK-1'},{subShipmentId:'ABC123-TRUCK-2'}]};
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

test('RC1328: Single-LKW und fehlender Stauplan lösen keinen Render aus',()=>{
  const app=load();
  app.listeners.get('exporthub:shipment-saved')({detail:{shipment:{id:'ONE',subShipments:[{subShipmentId:'ONE-TRUCK-1'}]}}});
  app.flush();
  assert.equal(app.syncCalls(),0);

  app.setCard(false);
  app.listeners.get('exporthub:shipment-saved')({detail:{shipment:{id:'TWO',subShipments:[{},{}]}}});
  app.flush();
  assert.equal(app.syncCalls(),0);
});

test('RC1328: Drei-Umgebungen-Build lädt und kopiert den Refresh-Hook',()=>{
  assert.match(build,/RC1328_MULTI_TRUCK_REFRESH_TAG/);
  assert.match(build,/patchRc1328MultiTruckRefresh/);
  assert.match(build,/assets\/rc1328-multi-truck-ui-refresh\.js\?v=1328/);
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
