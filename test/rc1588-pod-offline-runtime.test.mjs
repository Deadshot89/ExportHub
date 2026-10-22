import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('pod-notfall.html','utf8');
const jsonMatch=html.match(/<script id="exporthub-offline-pod-dictionary" type="application\/json">([\s\S]*?)<\/script>/);
const jsMatch=html.match(/<script id="pod-offline-i18n-runtime">([\s\S]*?)<\/script>/);

test('RC1588: standalone POD translation source is not corrupted by string replacement tokens',()=>{
  assert.ok(jsonMatch&&jsMatch,'embedded offline dictionary and translator must exist');
  assert.equal((html.match(/<\/body>/g)||[]).length,1,'a body closing tag must not leak into JavaScript');
  assert.equal((html.match(/<\/html>/g)||[]).length,1,'an html closing tag must not leak into JavaScript');
  assert.doesNotMatch(jsMatch[1],/<\/(?:body|html)>/i,'HTML closure must not appear inside offline JS');
  assert.doesNotThrow(()=>new vm.Script(jsMatch[1]),'offline JavaScript must parse');
  assert.match(jsMatch[1],/escape\(parts\[1\]\)/,'dynamic status suffix is preserved');
});

test('RC1588: file-mode offline language switch translates static text and live POD counts, without network',()=>{
  assert.ok(jsonMatch&&jsMatch);
  const dictionary=JSON.parse(jsonMatch[1]);
  const staticNode={nodeType:3,nodeName:'#text',nodeValue:'Noch keine POD-PDFs geladen.',parentNode:{nodeName:'DIV'}};
  const countNode={nodeType:3,nodeName:'#text',nodeValue:'3 vollständige POD-Ladeliste(n) aus dem Browser-Vault geladen.',parentNode:{nodeName:'DIV'}};
  const body={nodeType:1,nodeName:'BODY'};
  const textNodes=[staticNode,countNode];
  let selector,observer,networkRequests=0;
  const document={
    body,documentElement:{lang:'de'},title:'',getElementById(id){
      if(id==='exporthub-offline-pod-dictionary')return{textContent:jsonMatch[1]};
      return null;
    },
    querySelector(id){if(id!=='.head')return null;return{querySelector(){return null},insertBefore(){}}},
    createElement(tag){
      const node={nodeType:1,nodeName:tag.toUpperCase(),children:[],style:{},setAttribute(){},
        appendChild(child){this.children.push(child)},
        addEventListener(event,fn){if(event==='change')this.change=fn}};
      if(tag==='select')selector=node;
      return node;
    },
    createTreeWalker(){let position=0;return{nextNode(){return textNodes[position++]||null}}}
  };
  class FakeObserver{
    constructor(callback){observer=callback}
    observe(){}
  }
  const memory=new Map([['exporthub-emergency-pod-language','en']]);
  const sandbox={
    document,location:{protocol:'file:'},navigator:{language:'de-DE'},NodeFilter:{SHOW_TEXT:4},
    MutationObserver:FakeObserver,localStorage:{getItem(key){return memory.get(key)||null},setItem(key,value){memory.set(key,value)}},
    fetch(){networkRequests++;throw Error('Unexpected fetch')}
  };
  new vm.Script(jsMatch[1]).runInNewContext(sandbox,{timeout:1000});
  assert.equal(document.documentElement.lang,'en');
  assert.equal(document.title,dictionary.en['emergency.pod.documentTitle']);
  assert.equal(staticNode.nodeValue,dictionary.en['emergency.pod.noneInitially']);
  assert.equal(countNode.nodeValue,dictionary.en['legacyPattern.emergencyPodVaultLoaded'].replace('{{count}}','3'));
  assert.equal(networkRequests,0);

  selector.value='pl';selector.change();
  assert.equal(document.documentElement.lang,'pl');
  assert.equal(staticNode.nodeValue,dictionary.pl['emergency.pod.noneInitially'],'language switching must use original German source');
  assert.equal(countNode.nodeValue,dictionary.pl['legacyPattern.emergencyPodVaultLoaded'].replace('{{count}}','3'));
  assert.equal(networkRequests,0);
  assert.equal(memory.get('exporthub-emergency-pod-language'),'pl');
  assert.equal(typeof observer,'function');

  const added={nodeType:3,nodeName:'#text',nodeValue:'4 POD-Ladeliste(n) als ZIP erstellt.',parentNode:{nodeName:'DIV'}};
  observer([{addedNodes:[added]}]);
  assert.equal(added.nodeValue,dictionary.pl['legacyPattern.emergencyPodZipCreated'].replace('{{count}}','4'));
});
