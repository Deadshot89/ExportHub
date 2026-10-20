import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('location.html','utf8');
const match=html.match(/<script>\s*(\(function\(\)\{[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(match,'Location booking inline runtime must exist');

test('Location status puts a real space between localized fragments and the untrusted location name',async()=>{
  class Element{
    constructor(tag='div'){
      this.tag=tag;this.attributes={};this.children=[];this._text='';this.listeners={};
      this.value='';this.disabled=false;this.className='';
    }
    set textContent(value){this._text=String(value);this.children=[]}
    get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._text}
    set innerHTML(value){assert.equal(value,'','Only clearing location buttons is supported');this.children=[];this._text=''}
    appendChild(child){this.children.push(child);return child}
    setAttribute(k,v){this.attributes[k]=v}
    addEventListener(event,handler){this.listeners[event]=handler}
  }
  const nodes=Object.fromEntries(['status','ref','customer','pallets','loader','current','locations','pin','submit'].map(id=>[id,new Element()]));
  const document={
    getElementById(id){assert.ok(nodes[id],'Unexpected requested field '+id);return nodes[id]},
    createElement(tag){return new Element(tag)},
    createTextNode(value){return{textContent:String(value),nodeType:3}}
  };
  const records={
    get:{reference:'ABC123',customer:'Demo',palletCount:2,ready:true,collected:false,prepared:true,locationCode:3,currentLocation:'Lane 3'},
    move:{reference:'ABC123',customer:'Demo',palletCount:2,ready:true,collected:false,prepared:true,locationCode:3,currentLocation:'Lane 3'}
  };
  let calls=[];
  const sandbox={
    document,location:{href:'https://example.org/location?token=ABC123'},
    URL,Date,JSON,Number,String,Object,RegExp,
    fetch:async(url,options)=>{
      const action=new URL(url,'https://example.org').searchParams.get('action');
      calls.push({action,method:options.method});
      return{ok:true,status:200,text:async()=>JSON.stringify(records[action])};
    }
  };
  vm.runInNewContext(match[1],sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.status.textContent,'Die Sendung ist auf Lane 3 bereitgestellt. Sie kann bei Bedarf umgebucht werden.');
  assert.deepEqual(nodes.status.children.filter(c=>c.nodeType===3).map(c=>c.textContent),[' ',' ']);
  assert.equal(nodes.status.children[0].attributes['data-i18n'],'location.status.preparedBefore');
  assert.equal(nodes.status.children[2].attributes['data-i18n-ignore'],'');
  assert.equal(nodes.status.children[4].attributes['data-i18n'],'location.status.preparedAfter');

  nodes.pin.value='1234';
  await nodes.submit.listeners.click();
  assert.equal(nodes.status.textContent,'Sendung erfolgreich auf Lane 3 gebucht.');
  assert.deepEqual(nodes.status.children.filter(c=>c.nodeType===3).map(c=>c.textContent),[' ',' ']);
  assert.equal(nodes.status.children[0].attributes['data-i18n'],'location.status.bookedBefore');
  assert.equal(nodes.status.children[4].attributes['data-i18n'],'location.status.bookedAfter');
  assert.deepEqual(calls.map(c=>c.action),['get','move']);
  assert.equal(calls[1].method,'POST');
});

test('Location status remains safe from markup embedded in location names',()=>{
  assert.match(match[1],/name\.textContent=q\(place\)\|\|'—'/);
  assert.match(match[1],/name\.setAttribute\('data-i18n-ignore',''\)/);
  assert.doesNotMatch(match[1],/name\.innerHTML\s*=/);
});
