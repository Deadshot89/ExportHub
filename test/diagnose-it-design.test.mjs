import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Fehlerdiagnose: gleiche Meldungen zusammenfassen und Zeilen nicht mehr über die
// globalen Theme-Klassen .error/.warning vollflächig einfärben lassen.

function module(file){
  const html=fs.readFileSync(file,'utf8');
  const a=html.indexOf('<script id="exporthub-rc871-diagnostics-ui">');
  assert.ok(a>=0,'Diagnose-Modul fehlt in '+file);
  return html.slice(a,html.indexOf('</script>',a));
}
function helpers(js){
  const pick=name=>{const i=js.indexOf('function '+name+'(');assert.ok(i>=0,name+' fehlt');return js.slice(i,js.indexOf('\n',i))};
  const ctx={};
  vm.runInNewContext([
    "function q(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}",
    "function low(v){return q(v).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}",
    'var byGroup={};',
    pick('occ'),pick('signature'),pick('kinds'),pick('groups'),pick('names')
  ].join('\n'),ctx);
  return ctx;
}

for(const file of ['index.html','TESTVERSION.html']){
  const js=module(file);

  test(`Fehlerdiagnose (${file}): gleiche Meldungen werden mit Anzahl, Benutzern und Bereichen zusammengefasst`,()=>{
    const h=helpers(js);
    const rows=[
      {level:'error',category:'network',message:'Netzwerkfehler bei GET /api/pickup-status',count:244,user:'Amer',area:'dashboard',at:'2026-10-19T10:00:00Z',lastAt:'2026-10-19T10:05:00Z'},
      {level:'error',category:'network',message:'Netzwerkfehler bei GET /api/pickup-status',count:10,user:'Sikandar',area:'pallet',at:'2026-10-19T11:00:00Z',lastAt:'2026-10-19T11:01:00Z'},
      {level:'warning',category:'performance',message:'Browser-Hänger / Long Task',count:1,user:'Tobias',area:'abd',at:'2026-10-19T12:00:00Z'},
      {level:'warning',category:'performance',message:'Browser-Hänger / Long Task',count:2,user:'Tobias',area:'abd',at:'2026-10-19T12:10:00Z'}
    ];
    const g=h.groups(rows);
    assert.equal(g.length,2);
    assert.equal(g[0].total,254,'Häufigste Meldung steht oben und summiert die Vorkommen');
    assert.equal(g[0].events,2);
    assert.equal(h.names(g[0].users,5),'Amer, Sikandar');
    assert.equal(h.names(g[0].areas,5),'dashboard, pallet');
    assert.equal(g[0].first,'2026-10-19T10:00:00Z');
    assert.equal(g[0].last,'2026-10-19T11:01:00Z');
    assert.equal(g[1].total,3);
    assert.equal(h.occ(rows),257);
    assert.equal(h.kinds(rows),2);
    assert.equal(h.signature({level:'warning',category:'performance',message:'Langsam: 4105 ms'}),h.signature({level:'warning',category:'performance',message:'Langsam: 812 ms'}),'Zahlen trennen keine Meldungsarten');
  });

  test(`Fehlerdiagnose (${file}): Zeilen nutzen eigene Statusklassen statt der Theme-Klassen error/warning`,()=>{
    assert.doesNotMatch(js,/class="rc871-diag-event '\+esc\(x\.level/,'Einzelzeilen dürfen den Level nicht als nackte Klasse setzen');
    assert.match(js,/function levelClass\(x\)\{return x==='error'\?'rc871-lvl-error'/);
    assert.match(js,/<select id="rc871DiagMode"><option value="groups">Zusammengefasst<\/option><option value="events">Einzelne Einträge<\/option><\/select>/);
    assert.match(js,/mode=q\(e\.target\.value\)==='events'\?'events':'groups'/);
  });
}
