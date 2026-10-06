'use strict';

const TARGET_REFS=Object.freeze(['7YJUPL','4UXU92']);
const COLLECTIONS=Object.freeze([
  'shipments','savedShipments','salesSharedShipments','sharedShipments',
  'shipmentArchive','archivedShipments','archive'
]);
const DESCRIPTION_FIELDS=Object.freeze(['goodsDescription','description','warenbeschreibung']);

function text(value){return String(value==null?'':value).trim()}
function upper(value){return text(value).toUpperCase()}
function rootState(team){
  if(team&&team.state&&typeof team.state==='object'&&!Array.isArray(team.state))return team.state;
  return team&&typeof team==='object'&&!Array.isArray(team)?team:{};
}
function shipmentReference(item){
  if(!item||typeof item!=='object')return'';
  return upper(item.ref||item.reference||item.shipmentRef||item.referenceNumber||item.referenceNo||item.refNo||item.refNr||item.sendungsnummer||item.exporthubRef||item.exportHubReference);
}
function mailLikeGoodsDescription(value){
  const valueText=text(value);if(!valueText)return false;
  let score=0;
  if(/(?:^|\n)\s*(?:LIEFERAVIS|COLLECTION NOTICE)\b/i.test(valueText))score+=2;
  if(/Sehr geehrte Damen und Herren|Dear Sir or Madam|Mit freundlichen Gr[uü][sß]en|Kind regards/i.test(valueText))score++;
  if(/https?:\/\/|\/avis\/|customer-avis/i.test(valueText))score++;
  if(/Abholdatum|Zeitfenster|Kennzeichen des Abholfahrzeugs|pickup date|time window|license plate/i.test(valueText))score++;
  return score>=2;
}
function blankTargetReport(){
  return Object.fromEntries(TARGET_REFS.map(ref=>[ref,{found:false,occurrences:0,contaminatedFields:0,collections:{}}]));
}
function forEachTargetShipment(team,visitor){
  const state=rootState(team);
  for(const collection of COLLECTIONS){
    const list=Array.isArray(state[collection])?state[collection]:[];
    for(let index=0;index<list.length;index++){
      const item=list[index];
      const ref=shipmentReference(item);
      if(!TARGET_REFS.includes(ref))continue;
      visitor(item,{collection,index,ref});
    }
  }
}
function inspectHistoricMailDescriptions(team){
  const targets=blankTargetReport();
  let contaminatedFields=0,occurrences=0;
  forEachTargetShipment(team,(item,meta)=>{
    const report=targets[meta.ref];
    report.found=true;
    report.occurrences++;
    report.collections[meta.collection]=(report.collections[meta.collection]||0)+1;
    occurrences++;
    for(const key of DESCRIPTION_FIELDS){
      if(!mailLikeGoodsDescription(item&&item[key]))continue;
      report.contaminatedFields++;
      contaminatedFields++;
    }
  });
  const verified=TARGET_REFS.every(ref=>targets[ref].found&&targets[ref].contaminatedFields===0);
  return{verified,targets,occurrences,contaminatedFields};
}
function cleanHistoricMailDescriptions(team,options={}){
  const at=text(options.at)||new Date().toISOString();
  const actor=text(options.actor)||'RC1453 GitHub Workflow';
  const before=inspectHistoricMailDescriptions(team);
  let clearedFields=0,changedShipments=0;
  forEachTargetShipment(team,(item)=>{
    let changed=false;
    for(const key of DESCRIPTION_FIELDS){
      if(!mailLikeGoodsDescription(item&&item[key]))continue;
      item[key]='';
      clearedFields++;
      changed=true;
      if(item._syncFields&&typeof item._syncFields==='object'&&!Array.isArray(item._syncFields))item._syncFields[key]=at;
    }
    if(!changed)return;
    item.updatedAt=at;
    item._syncUpdatedAt=at;
    item.updatedBy=actor;
    changedShipments++;
  });
  const after=inspectHistoricMailDescriptions(team);
  return{
    changed:clearedFields>0,
    clearedFields,
    changedShipments,
    before,
    after,
    verified:after.verified
  };
}

module.exports={
  TARGET_REFS,
  COLLECTIONS,
  DESCRIPTION_FIELDS,
  mailLikeGoodsDescription,
  shipmentReference,
  inspectHistoricMailDescriptions,
  cleanHistoricMailDescriptions
};
