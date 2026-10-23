(function(root){
'use strict';
if(root.ExportHubSopFunctionRegistry)return;

function freezeEntry(entry){return Object.freeze(Object.assign({},entry));}

const processEntries=[
  ['system.access','auth','login-access','SOP-EH-001',false],
  ['system.navigation','dashboard','navigation-search','SOP-EH-002',false],
  ['admin.users','admin-users','manage-users','SOP-EH-010',false],
  ['admin.roles','admin-access','manage-roles','SOP-EH-012',false],
  ['customers.master-data','customers','manage-customer','SOP-EH-020',true],
  ['shipments.overview','shipment-overview','manage-shipment','SOP-EH-030',true],
  ['shipments.create','shipment','create-shipment','SOP-EH-031',true],
  ['shipments.stow-plan','stow-plan','manage-stow-plan','SOP-EH-034',true],
  ['shipping.handoff','shipping','calculate-and-handoff','SOP-EH-040',true],
  ['documents.manage','documents','manage-documents','SOP-EH-050',true],
  ['documents.output','print','create-shipping-documents','SOP-EH-052',true],
  ['customs.abd','abd','complete-abd','SOP-EH-060',true],
  ['customs.mail','mail','send-export-mail','SOP-EH-063',true],
  ['pickup.qr','pickup','manage-qr-pickup','SOP-EH-070',true],
  ['pickup.pod','pod','manage-pod','SOP-EH-075',true],
  ['pickup.avis','avis','manage-delivery-notice','SOP-EH-076',true],
  ['pallets.account','pallets','manage-pallet-account','SOP-EH-080',true],
  ['tasks.manage','tasks','manage-tasks','SOP-EH-090',false],
  ['pickup.calendar','pickup-calendar','manage-pickup-calendar','SOP-EH-095',false],
  ['sop.manage','sop','manage-sop','SOP-EH-100',false],
  ['academy.exam','academy','manage-exam','SOP-EH-105',false],
  ['audit.archive','archive','audit-history','SOP-EH-110',false],
  ['support.diagnostics','diagnostics','troubleshoot','SOP-EH-112',false],
  ['release.manage','release','manage-release','SOP-EH-114',false]
].map(([id,view,action,sopNumber,customerScoped])=>freezeEntry({
  id,view,action,sopNumber,stepId:'step-1',targetKey:'',
  requiredImage:true,requiredTour:true,requiredExam:true,required:true,customerScoped
}));

const pilotEntries=[
  freezeEntry({
    id:'shipment.abd-decision',
    view:'shipment',
    action:'abd-decision',
    sopNumber:'SOP-EH-060',
    stepId:'step-1',
    targetKey:'shipment-abd-decision',
    requiredImage:true,
    requiredTour:true,
    requiredExam:true,
    required:true,
    customerScoped:true
  })
];

const entries=Object.freeze([...processEntries,...pilotEntries]);
const byId=new Map(entries.map(entry=>[entry.id,entry]));

root.ExportHubSopFunctionRegistry=Object.freeze({
  version:'RC1505',
  entries,
  get(id){return byId.get(String(id==null?'':id).trim())||null;}
});
})(typeof globalThis!=='undefined'?globalThis:this);
