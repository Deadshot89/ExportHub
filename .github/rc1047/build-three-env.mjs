import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1046');
const OUT=path.join(ROOT,'dist-rc1047');
const VERSION='RC1047';
const NUMBER='1047';

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

function patchCountryDetection(html,file){
  let out=html;

  const parser=`function addressCountryCode(v){var cc=countryCode(v);return /^(DE|AT|BE|BG|CH|CZ|DK|ES|EE|FI|FR|GB|HU|IE|IT|LU|LT|LV|NL|PL|PT|RO|SI|SK|HR|GR|SE|NO|TR|US|RS|BA|MK|AL|CY|MT)$/.test(cc)?cc:''}
function countryFromAddress(v){
 var raw=String(v||''),t=low(raw),names=['Deutschland','Germany','Österreich','Austria','Belgien','Belgium','Bulgarien','Bulgaria','Schweiz','Switzerland','Tschechien','Czechia','Czech Republic','Dänemark','Denmark','Spanien','Spain','Estland','Estonia','Finnland','Finland','Frankreich','France','Großbritannien','Grossbritannien','United Kingdom','Great Britain','Ungarn','Hungary','Irland','Ireland','Italien','Italy','Luxemburg','Luxembourg','Litauen','Lithuania','Lettland','Latvia','Niederlande','Netherlands','The Netherlands','Holland','Polen','Poland','Portugal','Rumänien','Rumanien','Romania','Slowenien','Slovenia','Slowakei','Slovakia','Kroatien','Croatia','Griechenland','Greece','Schweden','Sweden','Norwegen','Norway','Türkei','Turkei','Turkey','Serbien','Serbia','Bosnien und Herzegowina','Bosnia and Herzegovina','Nordmazedonien','North Macedonia','Albanien','Albania','Zypern','Cyprus','Malta','USA','United States','United States of America'];
 for(var i=0;i<names.length;i++)if(t.indexOf(low(names[i]))>=0)return countryName(names[i]);
 var lines=raw.split(/[\\n,;|]+/).map(q).filter(Boolean);
 for(var j=lines.length-1;j>=0;j--){
   var line=lines[j],m=line.match(/(?:^|\\s|[-/])([A-Za-z]{2})(?:\\s*$|\\s*[-/]\\s*\\d|\\s+\\d)/);
   if(m){var cc=addressCountryCode(m[1]);if(cc)return countryName(cc)}
   if(line.length<=3){var lc=addressCountryCode(line);if(lc)return countryName(lc)}
 }
 var pref=raw.match(/\\b([A-Za-z]{2})\\s*-\\s*[A-Z0-9]{3,10}\\b/i);
 if(pref){var pc=addressCountryCode(pref[1]);if(pc)return countryName(pc)}
 return''
}`;

  out=replaceBetween(out,'function countryFromAddress(v){','\nfunction shippingPackagingList(){',parser+'\n',file+' sichere Ländererkennung');

  const oldOrder="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const newOrder="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)";
  out=replaceOne(out,oldOrder,newOrder,file+' Kundenland vor Adressheuristik');

  const required=[
    'function addressCountryCode(v)',
    "firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)",
    "addressCountryCode(m[1])"
  ];
  for(const marker of required)if(!out.includes(marker))throw new Error(file+': RC1047 Ländererkennung fehlt '+marker);
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchCountryDetection(html,file);
  html=html.replace(/ExportHUB RC1046 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1046',cache:'1046',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1046/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1046(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1046/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1046'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1047 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1046-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1047-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1047-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1046',
  sourceManifest:previousManifest,
  shippingCosts:{
    gate41CountryDetection:'customer-master-before-address-heuristic',
    addressCountryGuard:'only-known-country-codes',
    regressionCase:'41189 MG must not become country MG'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1047 build ready: Ortskürzel wie MG werden nicht mehr als Zielland interpretiert; Kunden-/Standortland hat Vorrang.');
