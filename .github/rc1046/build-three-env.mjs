import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1045');
const OUT=path.join(ROOT,'dist-rc1046');
const VERSION='RC1046';
const NUMBER='1046';

function replaceBetween(source,start,end,replacement,label){
  const a=source.indexOf(start),b=a>=0?source.indexOf(end,a+start.length):-1;
  if(a<0||b<0)throw new Error(label+': Anker fehlt');
  return source.slice(0,a)+replacement+source.slice(b);
}

function replaceOne(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(label+': Anker '+count+'x gefunden');
  return source.replace(before,after);
}

function patchGate41Autofill(html,file){
  let out=html;

  const gateTransit=`function gateTransit(g,national){var customer=activeCustomer()||{},sh=activeShipmentSource()||{},s=state(),tar=s.shippingTariffs||{},settings=s.settings||{},cc=countryCode(g.country),direct=[sh.gate41Transit,sh.gateTransit,sh.transitTime,sh.transit,sh.runtime,sh.leadTime,sh.deliveryTime,customer.gate41Transit,customer.gateTransit,customer.transitTime,customer.transit,customer.runtime,customer.leadTime,tar.gate41Transit,tar.gateTransit,tar.defaultGate41Transit,settings.gate41Transit,settings.gateTransit,settings.defaultGate41Transit,s.gate41Transit,s.gateTransit,s.defaultGate41Transit];for(var d=0;d<direct.length;d++)if(q(direct[d]))return q(direct[d]);var sources=[customer.gate41TransitTimes,tar.gate41TransitTimes,settings.gate41TransitTimes,s.gate41TransitTimes];for(var i=0;i<sources.length;i++){var src=sources[i];if(!src)continue;if(Array.isArray(src)){var row=src.find(function(r){return !q(r&&(r.service||r.name||r.label))&&(!q(r.country||r.countryCode)||countryCode(r.country||r.countryCode)===cc)});if(row&&q(row.transit||row.transitTime||row.runtime))return q(row.transit||row.transitTime||row.runtime)}else if(obj(src)){var node=src[cc]||src[q(g.country)]||src.default;if(obj(node))node=node.transit||node.transitTime||node.runtime||node.default;if(q(node))return q(node)}}return''}`;

  out=replaceBetween(
    out,
    'function gateTransit(g,national){',
    '\n\nfunction tableSources(name){',
    gateTransit,
    file+' Gate41-Laufzeit'
  );

  const resultAnchor='<aside class="rc501-result-card"><section class="rc626-result"><b>Gate41-Ergebnis</b><div class="rc501-result-lines"><div class="rc501-result-line"><span>Verpackung</span><b id="rc501GateResultPackaging">';
  const resultReplacement='<aside class="rc501-result-card"><section class="rc626-result"><b>Gate41-Ergebnis</b><div class="rc501-result-lines">'+
    '<div class="rc501-result-line"><span>Kunde</span><b id="rc1046GateResultCustomer">'+
    "'+esc((q(g.customerName)+(q(g.customerNumber)?' · '+q(g.customerNumber):''))||'—')+'"+
    '</b></div><div class="rc501-result-line"><span>Referenz</span><b id="rc1046GateResultReference">'+
    "'+esc(q(g.reference)||'—')+'"+
    '</b></div><div class="rc501-result-line"><span>Route</span><b id="rc1046GateResultRoute">'+
    "'+esc((r.origin||'—')+' → '+(r.destination||'—'))+'"+
    '</b></div><div class="rc501-result-line"><span>Zielland</span><b id="rc1046GateResultCountry">'+
    "'+esc(r.country||'—')+'"+
    '</b></div><div class="rc501-result-line"><span>Paletten</span><b id="rc1046GateResultPallets">'+
    "'+esc(String(r.pallets||0))+'"+
    '</b></div><div class="rc501-result-line"><span>Gesamtgewicht</span><b id="rc1046GateResultWeight">'+
    "'+esc(num(r.totalKg).toFixed(2)+' kg')+'"+
    '</b></div><div class="rc501-result-line"><span>Gewicht je Palette</span><b id="rc1046GateResultKgPerPallet">'+
    "'+esc(num(r.kgPerPallet).toFixed(2)+' kg')+'"+
    '</b></div><div class="rc501-result-line"><span>Lademeter</span><b id="rc1046GateResultLdm">'+
    "'+esc(num(r.totalLdm).toFixed(2))+'"+
    '</b></div><div class="rc501-result-line"><span>Verpackung</span><b id="rc501GateResultPackaging">';
  out=replaceOne(out,resultAnchor,resultReplacement,file+' Gate41-Ergebnisdaten');

  const liveAnchor="setLiveText('rc501GateResultPackaging',r.packaging||'—');setLiveText('rc501GateResultTransit',r.transit||'nicht hinterlegt');";
  const liveReplacement="setLiveText('rc1046GateResultCustomer',(q(g.customerName)+(q(g.customerNumber)?' · '+q(g.customerNumber):''))||'—');setLiveText('rc1046GateResultReference',q(g.reference)||'—');setLiveText('rc1046GateResultRoute',(r.origin||'—')+' → '+(r.destination||'—'));setLiveText('rc1046GateResultCountry',r.country||'—');setLiveText('rc1046GateResultPallets',String(r.pallets||0));setLiveText('rc1046GateResultWeight',num(r.totalKg).toFixed(2)+' kg');setLiveText('rc1046GateResultKgPerPallet',num(r.kgPerPallet).toFixed(2)+' kg');setLiveText('rc1046GateResultLdm',num(r.totalLdm).toFixed(2));setLiveText('rc501GateResultPackaging',r.packaging||'—');setLiveText('rc501GateResultTransit',r.transit||'nicht hinterlegt');";
  out=replaceOne(out,liveAnchor,liveReplacement,file+' Gate41-Liveergebnis');

  const required=[
    'rc1046GateResultCustomer',
    'rc1046GateResultReference',
    'rc1046GateResultRoute',
    'rc1046GateResultCountry',
    'rc1046GateResultPallets',
    'rc1046GateResultWeight',
    'rc1046GateResultKgPerPallet',
    'rc1046GateResultLdm',
    'sh.gate41Transit',
    'customer.gate41Transit',
    'tar.defaultGate41Transit'
  ];
  for(const marker of required)if(!out.includes(marker))throw new Error(file+': RC1046 Gate41-Autofill fehlt '+marker);
  return out;
}

function patchDashboardDueTasks(html,file){
  let out=html;

  const oldTaskOpen=`function taskOpenList(){
    var seen=new Map();
    tasks().filter(function(t){return t && !isDone(t)}).forEach(function(t,index){
      var key=low([itemTitle(t,''),t.owner||t.assignee||'Alle',t.day||t.originalDay||'',t.area||t.category||t.section||'',customer(t),t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref||'',t.time||''].join('|'));
      if(!key)key='task:'+q(t.id||t.taskId||index);
      if(!seen.has(key))seen.set(key,t)
    });
    return Array.from(seen.values())
  }`;

  const newTaskOpen=`function workspaceCurrentUserName(){try{var u=window.__EXPORTHUB_GET_CURRENT_USER__?window.__EXPORTHUB_GET_CURRENT_USER__():(window.currentUser||{});return q(u&&(u.name||u.user||u.login||u.username))}catch(_){return''}}
  function workspaceTaskOwner(t){return q(t&&(t.eowner||t.owner||t.assignee||t.responsible||t.zustaendig||''))}
  function workspaceTaskForCurrentUser(t){var owner=low(workspaceTaskOwner(t)),u=low(workspaceCurrentUserName());if(!owner||owner==='alle'||owner==='all')return true;if(!u)return false;return owner.indexOf(u)>=0||u.indexOf(owner)>=0}
  function workspaceTaskBacklog(t){return !!(t&&(t.isBacklog||t.backlog||low(t.day)==='rückstand'||low(t.day)==='ruckstand'||low(t.area)==='rückstand'||low(t.area)==='ruckstand'))}
  function workspaceIsoWeekKey(value){var d=value instanceof Date?new Date(value.getTime()):new Date(value);if(isNaN(d.getTime()))return'';var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);var y=x.getUTCFullYear(),start=new Date(Date.UTC(y,0,1)),week=Math.ceil((((x-start)/86400000)+1)/7);return y+'-W'+String(week).padStart(2,'0')}
  function workspaceTaskCurrentWeekVisible(t){if(!t||workspaceTaskBacklog(t))return true;try{if(typeof window.taskVisibleInCurrentWeek==='function'&&typeof window.taskWeekKey==='function')return !!window.taskVisibleInCurrentWeek(t,window.taskWeekKey())}catch(_){}var current=workspaceIsoWeekKey(new Date()),explicit=q(t.weekKey||t.createdForWeek),source=q(t.sourceWeekStart).slice(0,10);if(explicit&&explicit!==current)return false;if(/^\\d{4}-\\d{2}-\\d{2}$/.test(source)&&workspaceIsoWeekKey(new Date(source+'T12:00:00'))!==current)return false;return true}
  function taskOpenList(){
    var seen=new Map();
    tasks().filter(function(t){return t && !isDone(t) && workspaceTaskForCurrentUser(t) && workspaceTaskCurrentWeekVisible(t)}).forEach(function(t,index){
      var key=low([itemTitle(t,''),t.owner||t.assignee||'Alle',t.day||t.originalDay||'',t.area||t.category||t.section||'',customer(t),t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref||'',t.time||''].join('|'));
      if(!key)key='task:'+q(t.id||t.taskId||index);
      if(!seen.has(key))seen.set(key,t)
    });
    return Array.from(seen.values())
  }`;
  out=replaceOne(out,oldTaskOpen,newTaskOpen,file+' persönliche offene Aufgaben');

  const oldDue=`function dueTask(t){
    var d=dateValue(t);
    if(!d) return false;
    return dayKey(d)<=todayKey()
  }`;
  const newDue=`function workspaceTaskDueDate(t){var keys=['dueDate','due','date','plannedDate','targetDate'];for(var i=0;i<keys.length;i++){var v=q(t&&t[keys[i]]);if(!v)continue;var m=v.match(/^(\\d{4}-\\d{2}-\\d{2})/),d=m?new Date(m[1]+'T12:00:00'):new Date(v);if(!isNaN(d.getTime()))return d}return null}
  function workspaceWeekdayIndex(v){var n=low(v),map={montag:1,monday:1,dienstag:2,tuesday:2,mittwoch:3,wednesday:3,donnerstag:4,thursday:4,freitag:5,friday:5,samstag:6,saturday:6,sonntag:7,sunday:7};return map[n]||0}
  function dueTask(t){
    if(!t||isDone(t))return false;
    if(workspaceTaskBacklog(t))return true;
    var d=workspaceTaskDueDate(t);
    if(d)return dayKey(d)<=todayKey();
    var ti=workspaceWeekdayIndex(t.day||t.originalDay),ci=(new Date().getDay()||7);
    return ti>0&&ci<=5&&ti<=ci
  }`;
  out=replaceOne(out,oldDue,newDue,file+' Fälligkeit ohne Erstellungsdatum');

  const oldRender="var r=root();if(!r)return false;var s=state(),p=prefs(),modules=availableModules(),tasks=arr(s.tasks).filter(taskMeaningfulDashboardRC818).filter(function(t){return !dashboardTaskIsTestRC818(t)}),owned=tasks.filter(taskForUser);if(owned.length)tasks=owned;";
  const newRender="var r=root();if(!r)return false;var s=state(),p=prefs(),modules=availableModules(),tasks=arr(s.tasks).filter(taskMeaningfulDashboardRC818).filter(function(t){return !dashboardTaskIsTestRC818(t)}).filter(taskForUser);";
  out=replaceOne(out,oldRender,newRender,file+' Meine-Aufgaben ohne Fremdnutzer-Fallback');

  if(!out.includes("var keys=['dueDate','due','date','plannedDate','targetDate']"))throw new Error(file+': Fälligkeitslogik verwendet nicht die fachlichen Aufgabendaten');
  if(out.includes("var keys=['dueDate','due','date','plannedPickupDate','pickupDate','plannedDate','createdAt'];")&&!out.includes('workspaceTaskDueDate'))throw new Error(file+': Dashboard-Aufgaben nutzen weiterhin createdAt als Fälligkeit');
  if(!out.includes('workspaceTaskForCurrentUser(t)'))throw new Error(file+': persönlicher Aufgabenfilter fehlt');
  if(!out.includes('.filter(taskForUser);'))throw new Error(file+': zentrale Meine-Aufgaben-Kachel filtert nicht strikt auf Benutzer');
  if(out.includes('owned=tasks.filter(taskForUser);if(owned.length)tasks=owned;'))throw new Error(file+': Fremdnutzer-Fallback ist weiterhin aktiv');
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchGate41Autofill(html,file);
  html=patchDashboardDueTasks(html,file);
  html=html.replace(/ExportHUB RC1045 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1045',cache:'1045',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1045/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1045(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(`${file}: BUILD ${VERSION} fehlt`);
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(`${file}: Environment ${VERSION} fehlt`);
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1045/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1045'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1046 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1045-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1046-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1046-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1045',
  sourceManifest:previousManifest,
  shippingCosts:{
    gate41Autofill:'complete-visible-shipment-data',
    transitSources:['shipment','customer','tariff','settings'],
    fallback:'not-invented'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1046 build ready: Gate41 vollständig sowie Dashboard mit korrekten persönlichen fälligen Aufgaben und nicht abgeholten Sendungen.');
