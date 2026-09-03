import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function fn(name){
  const re=new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m=re.exec(html);
  if(!m)return '';
  let i=m.index+m[0].length-1, depth=0, quote='', esc=false;
  for(;i<html.length;i++){
    const ch=html[i];
    if(quote){
      if(esc)esc=false;
      else if(ch==='\\\\')esc=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return html.slice(m.index,i+1);
  }
  return '';
}

test('RC990: Build ist auf RC990 angehoben',()=>{
  const m=html.match(/var\s+BUILD\s*=\s*Object\.freeze\(\{version:'RC(\d+)'/);
  assert.ok(m,'BUILD marker fehlt');
  assert.ok(Number(m[1])>=990,`erwartet RC990+, gefunden RC${m[1]}`);
});

test('RC990: Release-Center besitzt stabilen Positions-Snapshot mit Änderungsanker',()=>{
  const capture=fn('rc990CaptureReleasePosition');
  const restore=fn('rc990RestoreReleasePosition');
  const baseCapture=fn('captureReleaseScroll');
  assert.ok(capture,'rc990CaptureReleasePosition fehlt');
  assert.ok(restore,'rc990RestoreReleasePosition fehlt');
  assert.match(capture,/captureReleaseScroll\s*\(/,'RC990 muss die bestehende Scroll-Snapshot-Schnittstelle verwenden');
  for(const token of ['pageY','rootTop'])assert.match(baseCapture,new RegExp(token),`Basis-Snapshot enthält ${token} nicht`);
  for(const token of ['key','anchorTop'])assert.match(capture,new RegExp(token),`RC990-Anker enthält ${token} nicht`);
  assert.match(html,/data-rc990-change-key/);
  assert.match(restore,/anchorTop|pageY/);
});

test('RC990: offene Änderungen haben genau eine kanonische Quelle für Liste und Zähler',()=>{
  assert.ok(fn('rc990OpenChangeItems'),'rc990OpenChangeItems fehlt');
  for(const name of ['changeChecklistProgress','unreleasedGroups','changeItemByKey']){
    const src=fn(name);
    assert.ok(src,`${name} fehlt`);
    assert.match(src,/rc990OpenChangeItems\s*\(/,`${name} nutzt nicht die kanonische RC990-Quelle`);
  }
});

test('RC990: Einzelbestätigung erhält den Anker auch über spätere Render hinweg',()=>{
  for(const name of ['toggleReleaseChange','setReleaseChangeStatus']){
    const src=fn(name);
    assert.match(src,/rc990CaptureReleasePosition\s*\(/,`${name} erfasst die Position nicht`);
    assert.match(src,/rc990RestoreReleasePosition|rc990ArmReleasePosition/,`${name} stellt die Position nicht wieder her`);
    assert.doesNotMatch(src,/scrollTo\s*\(\s*0\s*,\s*0\s*\)/,`${name} enthält Top-Reset`);
  }
  assert.match(html,/exporthub:rendered/,'kein Hook für nachgelagerte Render vorhanden');
  assert.match(html,/rc990PendingReleasePosition/,'kein langlebiger RC990-Positionsanker vorhanden');
});

test('RC990: vollständiger Release-Center-Neuaufbau kann eine übergebene Position wiederherstellen',()=>{
  const src=fn('rerender');
  assert.match(src,/rc990CaptureReleasePosition|rc990RestoreReleasePosition|rc990PendingReleasePosition/);
  const tested=fn('markTested');
  const reset=fn('resetTest');
  assert.match(tested,/rc990CaptureReleasePosition|rerender\s*\([^)]/);
  assert.match(reset,/rc990CaptureReleasePosition|rerender\s*\([^)]/);
});

test('RC990: veröffentlichte Historie bleibt einklappbar und offene Änderungen bleiben getrennt',()=>{
  const history=fn('renderReleaseHistory');
  const open=fn('renderUnreleasedChangesCard');
  assert.match(history,/<details|details class/);
  assert.match(open,/rc747UnreleasedChanges/);
  assert.doesNotMatch(open,/renderReleaseHistory\s*\(/);
});
