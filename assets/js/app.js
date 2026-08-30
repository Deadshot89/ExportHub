import {inventoryBackup,buildMigrationPackage,summarizePackage} from '../../shared/migration-core.js';

const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
let sourceText='', sourcePayload=null, migrationPackage=null;

function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  $('#pageTitle').textContent=({overview:'Übersicht',migration:'Migration',tenants:'Mandanten',users:'Benutzer & Rollen',customers:'Kunden',shipments:'Sendungen',audit:'Audit'}[name]||'ExportHUB Professional');
}
$$('.nav button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.nav)));

function download(name,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function fmt(n){return new Intl.NumberFormat('de-DE').format(Number(n||0))}
function renderInventory(inv){
  const c=inv.counts;
  $('#invCustomers').textContent=fmt(c.customers);
  $('#invShipments').textContent=fmt(c.canonicalShipmentGroups);
  $('#invShipmentSources').textContent=fmt(c.shipmentSourceRecords)+' Quelldatensätze';
  $('#invPods').textContent=fmt(c.pods);
  $('#invDocs').textContent=fmt(c.documents)+' Dokumente gesamt';
  $('#invUsers').textContent=fmt(c.users);
  $('#sourceMeta').innerHTML=`<b>${inv.source.version||'Version unbekannt'}</b> · Export ${inv.source.exportedAt||'ohne Zeitpunkt'} · ${inv.source.exportedBy||'ExportHUB'}`;
  const rows=[
    ['Kunden',c.customers],['Sendungs-Quelldatensätze',c.shipmentSourceRecords],['Eindeutige Sendungsgruppen',c.canonicalShipmentGroups],['POD-Dokumente',c.pods],['Lieferscheine',c.deliveryNotes],['ABD-Dokumente',c.abdDocuments],['Aufgaben',c.tasks],['ABD-Anfragen',c.abdRequests],['Archiv-Einträge',c.archiveEntries],['Benutzer',c.users]
  ];
  $('#inventoryRows').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${fmt(r[1])}</td></tr>`).join('');
  $('#dupInfo').textContent=`${inv.duplicateShipmentGroups.length} Sendungsgruppen mit mehreren Quellen · ${inv.duplicateCustomerGroups.length} Kunden-Dubletten-Gruppen`;
  $('#inventorySection').classList.remove('hidden');
  $('#buildPackageBtn').disabled=false;
}

$('#backupFile').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0]; if(!file)return;
  $('#uploadStatus').textContent='Backup wird ausschließlich lokal im Browser gelesen …';
  $('#buildPackageBtn').disabled=true; migrationPackage=null;
  try{
    sourceText=await file.text(); sourcePayload=JSON.parse(sourceText);
    const result=inventoryBackup(sourcePayload);
    if(!result.validation.ok) throw new Error('Das ist kein vollständiges ExportHUB_BACKUP: '+result.validation.errors.join(', '));
    renderInventory(result.inventory);
    $('#uploadStatus').textContent='Backup erkannt. Es wurden noch keine Daten geschrieben oder hochgeladen.';
  }catch(err){
    sourceText='';sourcePayload=null;$('#inventorySection').classList.add('hidden');
    $('#uploadStatus').textContent='Abgelehnt: '+(err&&err.message||err);
  }
});

$('#buildPackageBtn').addEventListener('click',async()=>{
  if(!sourcePayload)return;
  const btn=$('#buildPackageBtn');btn.disabled=true;$('#packageStatus').textContent='Migrationspaket wird geprüft. Dokument-Prüfsummen können bei großen Backups etwas dauern …';$('#packageProgress').style.width='35%';
  await new Promise(r=>setTimeout(r,30));
  try{
    migrationPackage=await buildMigrationPackage(sourcePayload,sourceText);$('#packageProgress').style.width='100%';
    const s=summarizePackage(migrationPackage),g=migrationPackage.manifest.gates,d=migrationPackage.manifest.documents;
    $('#readOnlyGate').className='gate '+(g.readOnlyReady?'good':'bad');$('#readOnlyGate').textContent=g.readOnlyReady?'✓ READ_ONLY_READY – Bestandskopie vollständig zugeordnet':'✕ READ_ONLY blockiert – '+g.readOnlyErrors.join(', ');
    $('#cutoverGate').className='gate '+(g.cutoverReady?'good':'warn');$('#cutoverGate').textContent=g.cutoverReady?'✓ CUTOVER_READY':'⚠ CUTOVER weiterhin blockiert – '+(g.cutoverBlockers.join(', ')||'weitere Prüfung erforderlich');
    $('#hashValue').textContent=migrationPackage.manifest.sourceSha256;
    $('#docVerify').textContent=`${fmt(d.inlineHashed)} eingebettete Dateien gehasht · ${fmt(d.remoteCaptureRequired)} Remote-Dateien müssen später separat erfasst werden · ${fmt(d.contentMissing)} ohne Inhalt`;
    $('#packageStatus').textContent=`Migrationsprüfung abgeschlossen: ${fmt(s.customers)} Kunden · ${fmt(s.canonicalShipments)} Sendungen · ${fmt(s.documents)} Dokumente.`;
    $('#downloadPackageBtn').disabled=!g.readOnlyReady;$('#packageResult').classList.remove('hidden');
  }catch(err){$('#packageStatus').textContent='Fehler: '+(err&&err.message||err);$('#packageProgress').style.width='0'}finally{btn.disabled=false}
});

$('#downloadPackageBtn').addEventListener('click',()=>{
  if(!migrationPackage)return;
  const ts=new Date().toISOString().replace(/[:.]/g,'-');download(`ExportHUB_Professional_Migration_${ts}.json`,JSON.stringify(migrationPackage,null,2));
});

setView('overview');
