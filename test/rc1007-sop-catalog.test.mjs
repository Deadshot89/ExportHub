import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-catalog.js');
const catalog=globalThis.ExportHubIsoSopCatalog;

const required=['purpose','scope','definitions','responsibilities','prerequisites','resources','steps','checks','deviations','records','metrics','relatedDocuments','references','changeHistory'];

test('Katalog enthält exakt die 36 freigegebenen SOPs',()=>{
  assert.equal(catalog.documents.length,36);
  assert.equal(new Set(catalog.documents.map(doc=>doc.number)).size,36);
  const countByArea=Object.fromEntries([...new Set(catalog.documents.map(doc=>doc.area))].map(area=>[area,catalog.documents.filter(doc=>doc.area===area).length]));
  assert.deepEqual(countByArea,{
    Qualitätsmanagement:5,
    'System / ExportHUB':4,
    'Versand und Export':17,
    Lager:7,
    Organisation:3
  });
});

test('jede SOP besitzt die vollständige gelenkte Pflichtstruktur',()=>{
  for(const doc of catalog.documents){
    for(const field of ['id','number','title','area','keywords','processFlow','version','status','createdBy','reviewedBy','approvedBy','processOwner','affectedAreas','changeReason','sections','visuals','references','history']){
      assert.ok(Object.hasOwn(doc,field),`${doc.number}: Feld ${field} fehlt`);
    }
    for(const key of required) assert.ok(Object.hasOwn(doc.sections,key),`${doc.number}: Abschnitt ${key} fehlt`);
    assert.equal(doc.version,'1.0',`${doc.number}: Startversion`);
    assert.equal(doc.status,'Entwurf',`${doc.number}: Ausgangsstatus`);
    assert.ok(Array.isArray(doc.sections.steps)&&doc.sections.steps.length>=3,`${doc.number}: Ablauf zu kurz`);
  }
});

test('Nummern und Titel entsprechen dem freigegebenen Verzeichnis',()=>{
  const expected=[
    ['SOP-QM-001','Dokumentenlenkung'],['SOP-QM-002','Rollen, Verantwortlichkeiten und Qualifikation'],['SOP-QM-003','Abweichungen und Korrekturmaßnahmen'],['SOP-QM-004','Reklamationen und Kundenfeedback'],['SOP-QM-005','Interne Prüfung und kontinuierliche Verbesserung'],
    ['SOP-SYS-001','Benutzer, Rollen und Zugriffsrechte'],['SOP-SYS-002','Fehler und Systemstörungen'],['SOP-SYS-003','Datensicherung und Wiederherstellung'],['SOP-SYS-004','Änderungen und Softwarefreigaben'],
    ['SOP-LOG-001','Versandauftrag übernehmen und prüfen'],['SOP-LOG-002','Kunden- und Empfängerdaten'],['SOP-LOG-003','Verpackung, Colli, Gewicht und LDM'],['SOP-LOG-004','Priorisierung und Urgent Orders'],['SOP-LOG-005','Versandart, Spedition und Versandkosten'],['SOP-LOG-006','Versanddokumente'],['SOP-LOG-007','ABD und Zollabwicklung'],['SOP-LOG-008','CMR'],['SOP-LOG-009','Ladeliste und Gesamtdruck'],['SOP-LOG-010','Bereitstellung zur Abholung'],['SOP-LOG-011','QR-Abholung und Verlade-PIN'],['SOP-LOG-012','POD und Abliefernachweis'],['SOP-LOG-013','Palettenkonto'],['SOP-LOG-014','Kundenavis'],['SOP-LOG-015','Selbstabholer'],['SOP-LOG-016','Despatch und Versandübergabe'],['SOP-LOG-017','Abschluss und Archivierung einer Sendung'],
    ['SOP-WH-001','Wareneingang'],['SOP-WH-002','Einlagerung / Putaway'],['SOP-WH-003','Kommissionierung'],['SOP-WH-004','PPD-Sortierung'],['SOP-WH-005','Reform / Rework'],['SOP-WH-006','DAF Area'],['SOP-WH-007','Lager-Arbeitsliste und Minibag-Analyse'],
    ['SOP-ORG-001','Aufgabenplanung, Urlaub und Vertretung'],['SOP-ORG-002','Schicht- und Personaleinsatzplanung'],['SOP-ORG-003','Leistungs- und KPI-Erfassung']
  ];
  assert.deepEqual(catalog.documents.map(doc=>[doc.number,doc.title]),expected);
});

test('externe Tätigkeiten bleiben eindeutig mit SOP XXXX gekennzeichnet',()=>{
  const text=JSON.stringify(catalog.documents);
  assert.match(text,/SOP XXXX/);
});
