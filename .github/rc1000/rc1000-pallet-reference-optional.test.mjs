import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FILES=['index.html','TESTVERSION.html'];

function findMatching(text,openPos,openChar,closeChar){
  let depth=0,quote=null,escape=false;
  for(let i=openPos;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(ch===quote) quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch===openChar) depth++;
    else if(ch===closeChar){depth--;if(depth===0)return i;}
  }
  throw new Error(`Kein passendes ${closeChar} für Position ${openPos}`);
}

function owner(text,start){
  const a=text.indexOf(start);
  assert.notEqual(a,-1,`${start} fehlt`);
  const open=text.indexOf('{',a);
  assert.notEqual(open,-1,`${start}: öffnende Klammer fehlt`);
  const b=findMatching(text,open,'{','}')+1;
  return text.slice(a,b);
}

function runBlankReferenceBooking(html,direction){
  const source=owner(html,'window.rc542AddPalletBooking=function(){');
  const state={palletAccount:[],rc542PalletParty:'customer:demo',rc542PalDirection:direction};
  const fields={
    rc542PalCount:{value:'3'},
    rc542PalDate:{value:'2026-09-08'},
    rc542PalRef:{value:''},
    rc542PalNote:{value:'Test ohne Referenz'}
  };
  const alerts=[];
  const entry={party:{key:'customer:demo',type:'customer',name:'Demo Kunde'},customers:[{id:'c-demo',name:'Demo Kunde'}]};
  const context={
    window:{canWrite:()=>true},
    document:{getElementById:(id)=>fields[id]||null},
    parties:()=>[entry],
    S:()=>state,
    Q:(v)=>String(v==null?'':v).trim(),
    N:(v)=>Number(v)||0,
    isoDate:(v)=>String(v||''),
    A:(v)=>Array.isArray(v)?v:[],
    CU:()=>({name:'RC1000 Test'}),
    save:()=>{},
    renderPallet542:()=>{},
    alert:(msg)=>{alerts.push(String(msg));return false;},
    Date,
    Math
  };
  vm.runInNewContext(source+';',context);
  context.window.rc542AddPalletBooking();
  return {state,alerts};
}

for(const file of FILES){
  test(`${file}: Referenzfeld ist sichtbar optional`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const view=owner(html,'function palletHtml542(){');
    assert.match(view,/Sendungsreferenz optional<input id="rc542PalRef" placeholder="optional">/);
    assert.doesNotMatch(view,/id="rc542PalRef"[^>]*\brequired\b/);
    assert.doesNotMatch(view,/bei Ausgang Pflicht/);
  });

  for(const direction of ['Eingang','Ausgang']){
    test(`${file}: ${direction} kann ohne Referenz gebucht werden`,()=>{
      const html=fs.readFileSync(file,'utf8');
      const booking=owner(html,'window.rc542AddPalletBooking=function(){');
      assert.doesNotMatch(booking,/dir==='Ausgang'&&!ref/);
      assert.doesNotMatch(booking,/Sendungsreferenz Pflicht/);
      assert.match(booking,/shipmentRef:ref/);
      const {state,alerts}=runBlankReferenceBooking(html,direction);
      assert.equal(alerts.length,0,`Unerwartete Meldung: ${alerts.join(' | ')}`);
      assert.equal(state.palletAccount.length,1,'Buchung wurde nicht gespeichert');
      assert.equal(state.palletAccount[0].direction,direction);
      assert.equal(state.palletAccount[0].shipmentRef,'');
      assert.equal(state.palletAccount[0].count,3);
    });
  }
}
