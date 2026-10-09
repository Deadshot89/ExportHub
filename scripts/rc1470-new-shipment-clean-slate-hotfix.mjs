import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let source=fs.readFileSync(builderPath,'utf8');

const functionName='function patchRc1470NewShipmentCleanSlate(html,file){';
const call='html=patchRc1470NewShipmentCleanSlate(html,file);';

if(!source.includes(functionName)){
  const insertBefore='function patchTaskDetailTab(html,file){';
  const at=source.indexOf(insertBefore);
  if(at<0)throw new Error('RC1470 builder insertion anchor fehlt');
  const patch=`function patchRc1470NewShipmentCleanSlate(html,file){
  const startMarker='function startFreshShipment(){';
  const endMarker='function enforceFreshDraft(){';
  const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
  if(start<0||end<=start)throw new Error(file+': RC1470 Fresh-Draft-Block fehlt');
  let block=html.slice(start,end);
  if(block.includes('var rc1470FreshDefaults={'))return html;
  const finalizeAnchor=" function finalize(){var sh=shipment();";
  if(block.split(finalizeAnchor).length-1!==1)throw new Error(file+': RC1470 Finalize-Anker fehlt');
  const helper=" function rc1470ResetFreshShipment(sh){if(!sh||typeof sh!=='object')return;var rc1470FreshDefaults={customerId:'',customerNo:'',customerName:'',customerSearch:'',carrier:'',carrierName:'',comments:'',notes:'',goodsDescription:'',incoterm:'',licensePlate:'',loader:'',documents:[],files:[],docs:[],deliveryFiles:[],deliveryNotesFiles:[],lieferscheine:[],podFiles:[],abdFiles:[],cmrFiles:[],invoiceFiles:[],mailAttachments:[],attachments:[],totalWeight:0,totalColli:0,totalLdm:0,goodsValue:0,status:'Entwurf',draft:true};Object.assign(sh,rc1470FreshDefaults)}\\n";
  block=block.replace(finalizeAnchor,helper+" function finalize(){var sh=shipment();rc1470ResetFreshShipment(sh);");
  if(!block.includes('cmrFiles:[]')||!block.includes("status:'Entwurf'")||!block.includes('rc1470ResetFreshShipment(sh)'))throw new Error(file+': RC1470 Clean-Slate-Patch unvollständig');
  return html.slice(0,start)+block+html.slice(end);
}

`;
  source=source.slice(0,at)+patch+source.slice(at);
}

if(!source.includes(call)){
  const anchor='html=patchRc1414ShipmentCreateNoRerender(html,file);';
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error('RC1470 build-call anchor '+count+'x gefunden');
  source=source.replace(anchor,anchor+'\n  '+call);
}

if(!source.includes(functionName)||!source.includes(call))throw new Error('RC1470 builder integration unvollständig');
fs.writeFileSync(builderPath,source,'utf8');
console.log('RC1470 fresh-shipment clean-slate hotfix applied');
