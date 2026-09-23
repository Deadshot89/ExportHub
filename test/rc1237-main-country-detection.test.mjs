import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}
function read(file){build();return fs.readFileSync('dist-rc1112/'+file,'utf8')}
function countryProbe(html){
  const a=html.indexOf('function addressCountryCode(v){');
  const b=a<0?-1:html.indexOf('\nfunction shippingPackagingList(){',a);
  assert.ok(a>=0&&b>a,'Länderparser im finalen Build fehlt');
  const block=html.slice(a,b);
  const ctx={result:null};
  vm.runInNewContext(
    "function q(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}"+
    "function low(v){return q(v).toLowerCase()}"+
    "function countryCode(v){return q(v).toUpperCase()}"+
    "function countryName(v){var x=countryCode(v);return x==='IT'?'Italien':x==='NL'?'Niederlande':x==='DE'?'Deutschland':x}"+
    block+
    ";result={italy:countryFromAddress('60044 Albacina-Fabriano AN'),mg:countryFromAddress('41189 Mönchengladbach MG'),named:countryFromAddress('41189 Mönchengladbach, Deutschland')};",
    ctx
  );
  return ctx.result;
}

test('RC1237: Hauptseite erkennt 60044 Albacina-Fabriano AN als Italien',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read(file),result=countryProbe(html);
    assert.equal(result.italy,'Italien',file+': italienischer Lieferstandort wird nicht erkannt');
    assert.equal(result.mg,'',file+': MG darf weiterhin nicht als Länderkennzeichen gelten');
    assert.equal(result.named,'Deutschland',file+': ausgeschriebenes Deutschland muss erkannt werden');
  }
});

test('RC1237: Lieferadresse hat vor Kunden-Stammland Vorrang',()=>{
  const addressFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const customerFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)";
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read(file);
    assert.ok(html.includes(addressFirst),file+': Lieferadresse hat nicht Vorrang');
    assert.ok(!html.includes(customerFirst),file+': alte Kundenland-Priorität ist noch aktiv');
  }
});

test('RC1237: geänderter finaler Builder ist syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
});
