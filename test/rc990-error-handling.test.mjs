import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function fn(name){
  const re=new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m=re.exec(html);
  if(!m)return '';
  let i=m.index+m[0].length-1,depth=0,quote='',esc=false;
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

test('RC990: sichtbarer Fehlerabschluss verwendet das bestehende Statussystem',()=>{
  const src=fn('rc990FailOperation');
  assert.ok(src,'rc990FailOperation fehlt');
  assert.match(src,/operationFail|ExportHUBOperationStatus|loadingBarFail/,'Fehlerabschluss ist nicht an das vorhandene Statussystem angebunden');
  assert.match(src,/rc990RestoreUiState\s*\(/,'lokaler UI-State wird nach Fehler nicht wiederhergestellt');
  assert.match(src,/return\s+false/);
});

test('RC990: Renderfehler werden sichtbar abgeschlossen und stellen den lokalen UI-State wieder her',()=>{
  const src=fn('rc990ScheduleRender');
  assert.ok(src,'rc990ScheduleRender fehlt');
  assert.match(src,/catch\s*\([^)]*\)[\s\S]*?rc990FailOperation\s*\(/,'Renderqueue verschluckt Fehler oder meldet sie nicht über RC990');
  assert.match(src,/rc990CaptureUiState|snapshot/,'Renderqueue sichert vor dem Update keinen lokalen UI-State');
  assert.doesNotMatch(src,/catch\s*\([^)]*\)\s*\{\s*\}/,'primärer Renderfehler darf nicht still geschluckt werden');
});

test('RC990: Release-Center-Änderungen behalten bei Fehlern Position und sichtbaren Zustand',()=>{
  for(const name of ['toggleReleaseChange','setReleaseChangeStatus']){
    const src=fn(name);
    assert.ok(src,`${name} fehlt`);
    assert.match(src,/rc990CaptureReleasePosition\s*\(/,`${name} sichert die Release-Position nicht`);
    assert.match(src,/rc990FailOperation\s*\(/,`${name} schließt Fehler nicht sichtbar ab`);
    assert.match(src,/rc990RestoreReleasePosition|rc990ArmReleasePosition/,`${name} stellt die Release-Position nach Fehler nicht wieder her`);
    assert.doesNotMatch(src,/catch\s*\([^)]*\)\s*\{\s*\}/,`${name} enthält einen stillen primären Fehlerpfad`);
  }
});

test('RC990: Fehlerbrücke erzeugt kein zweites Persistenz- oder Meldungssystem',()=>{
  const src=fn('rc990FailOperation');
  assert.doesNotMatch(src,/fetch\s*\(|localStorage\.setItem|sessionStorage\.setItem|azure|saveShipment|saveAction/i);
});
