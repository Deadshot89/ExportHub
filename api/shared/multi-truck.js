'use strict';

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function round3(v){return Math.round((num(v)+Number.EPSILON)*1000)/1000}
function stableId(shipmentId,splitVersion,index){return `${shipmentId||'shipment'}:load:${splitVersion}:${index+1}`}

function normalizePhysicalUnits(rows){
  const out=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const count=Math.max(0,Math.trunc(num(row.count||row.qty||row.anzahl||row.quantity)));
    if(!count)continue;
    const totalWeight=num(row.weight||row.gewicht),totalLdm=num(row.ldm);
    for(let i=0;i<count;i++)out.push({
      sourceRowId:String(row.id||row._syncId||`row-${out.length+1}`),
      sourceUnitIndex:i,
      type:String(row.type||row.packaging||row.verpackung||row.name||''),
      count:1,
      weightKg:i===count-1?round3(totalWeight-round3((totalWeight/count)*(count-1))):round3(totalWeight/count),
      ldm:i===count-1?round3(totalLdm-round3((totalLdm/count)*(count-1))):round3(totalLdm/count)
    });
  }
  return out;
}

function splitIntoLoadUnits(rows,profile,options={}){
  if(!profile||profile.active===false||num(profile.maxLdm)<=0||num(profile.maxWeightKg)<=0)throw new Error('Kein aktives LKW-Profil verfügbar');
  const units=normalizePhysicalUnits(rows),loads=[];
  for(const unit of units){
    if(unit.ldm>num(profile.maxLdm)||unit.weightKg>num(profile.maxWeightKg))throw new Error(`Manuelle Ladeplanung erforderlich: ${unit.sourceRowId}`);
    let load=loads[loads.length-1];
    if(!load||round3(load.totalLdm+unit.ldm)>num(profile.maxLdm)||round3(load.totalWeightKg+unit.weightKg)>num(profile.maxWeightKg)){
      load={id:stableId(options.shipmentId,options.splitVersion||1,loads.length),sequence:loads.length+1,total:0,displayLabel:'',sourceAssignments:[],rows:[],totalCount:0,totalWeightKg:0,totalLdm:0,status:'Erstellt',pickup:{},pod:{},generatedDocuments:[],stowPlan:null};
      loads.push(load);
    }
    load.sourceAssignments.push({sourceRowId:unit.sourceRowId,sourceUnitIndex:unit.sourceUnitIndex});
    load.rows.push(unit);
    load.totalCount+=1;
    load.totalWeightKg=round3(load.totalWeightKg+unit.weightKg);
    load.totalLdm=round3(load.totalLdm+unit.ldm);
  }
  for(const load of loads){
    load.total=loads.length;
    load.displayLabel=`${options.ref||''} · LKW ${load.sequence} von ${loads.length}`.trim();
  }
  return loads;
}

function summarizeLoadUnits(loadUnits){
  return (loadUnits||[]).reduce((a,l)=>({count:a.count+num(l.totalCount),weightKg:round3(a.weightKg+num(l.totalWeightKg)),ldm:round3(a.ldm+num(l.totalLdm))}),{count:0,weightKg:0,ldm:0});
}

function deriveMultiTruckProgress(loadUnits){
  const rows=(loadUnits||[]).filter(x=>x&&x.status!=='Storniert');
  const total=rows.length;
  const pickedUp=rows.filter(x=>/Abgeholt|POD vorhanden|Abgeschlossen|Archiviert/i.test(String(x.status))).length;
  const pod=rows.filter(x=>/POD vorhanden|Abgeschlossen|Archiviert/i.test(String(x.status))).length;
  return{total,pickedUp,pod,label:total?`${pickedUp}/${total} abgeholt`:'0/0 abgeholt'};
}

module.exports={normalizePhysicalUnits,splitIntoLoadUnits,summarizeLoadUnits,deriveMultiTruckProgress};
