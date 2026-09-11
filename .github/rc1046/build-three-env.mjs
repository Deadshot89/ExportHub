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

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchGate41Autofill(html,file);
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

console.log('RC1046 build ready: Gate41 übernimmt und zeigt vollständige Sendungsdaten; Laufzeit nutzt vorhandene Sendungs-, Kunden- oder Tarifquelle.');
