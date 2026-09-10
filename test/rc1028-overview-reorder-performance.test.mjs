import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function functionBlock(name,nextName,max=7000){
  const start=html.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} fehlt`);
  const end=nextName?html.indexOf(`function ${nextName}(`,start+1):-1;
  return html.slice(start,end>start?end:start+max);
}

test('RC1028: korrekt sortierte Overview-Gruppen verursachen keine DOM-Kartenbewegungen',()=>{
  const src=functionBlock('overviewReorderExistingCards','overviewRemoveEmptyGroups');
  assert.match(src,/var\s+current\s*=\s*Array\.from\(body\.querySelectorAll\(/,'aktuelle DOM-Reihenfolge muss einmal erfasst werden');
  assert.match(src,/var\s+sorted\s*=\s*current\.slice\(\)\.sort\(/,'Sortierung muss auf einer Kopie berechnet werden');
  assert.match(src,/if\s*\(\s*current\.length===sorted\.length&&current\.every\(/,'bei bereits korrekter Reihenfolge muss vor DOM-Schreibzugriffen abgebrochen werden');
  const guard=src.indexOf('current.length===sorted.length&&current.every(');
  const write=src.indexOf('body.appendChild(card)');
  assert.ok(guard>=0&&write>guard,'appendChild darf erst nach dem Reihenfolge-Guard erfolgen');
});
