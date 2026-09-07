import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function taskChunk(file){
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function tasks(){');
  assert.ok(start>=0,`${file}: tasks() fehlt`);
  const end=html.indexOf('function taskSortRC67',start);
  assert.ok(end>start,`${file}: Ende von tasks() fehlt`);
  return html.slice(start,end);
}

for(const file of ['index.html','TESTVERSION.html']){
  test(`${file}: durchgestrichene Aufgaben-Kacheln sind entfernt`,()=>{
    const src=taskChunk(file);
    for(const label of ['Alle anzeigen','Gruppen \\u00f6ffnen','Gruppen schlie\\u00dfen','Master-Aufgaben pr\\u00fcfen']){
      assert.ok(!src.includes(`>${label}</button>`),`${label} darf in der Aufgaben-Toolbar nicht mehr sichtbar sein`);
    }
    const days=(src.match(/let days=\[([^\]]+)\]/)||[])[1]||'';
    assert.ok(days,'Tagesfilter fehlen');
    for(const label of ['Alle Tage','\\u00dcberf\\u00e4llig','Ohne Tag']){
      assert.ok(!days.includes(label),`${label} darf nicht mehr als Tageskachel erscheinen`);
    }
  });

  test(`${file}: gewuenschte Aufgaben-Kacheln bleiben sichtbar`,()=>{
    const src=taskChunk(file);
    assert.ok(src.includes('>+ Manuelle Aufgabe</button>'),'+ Manuelle Aufgabe muss bleiben');
    const days=(src.match(/let days=\[([^\]]+)\]/)||[])[1]||'';
    for(const label of ['Heute','R\\u00fcckstand','Montag','Dienstag','Mittwoch','Donnerstag','Freitag']){
      assert.ok(days.includes(label),`${label} muss als Tageskachel erhalten bleiben`);
    }
  });
}
