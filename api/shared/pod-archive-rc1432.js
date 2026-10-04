'use strict';

const base=require('./pod-archive');
const store=require('./pickup-store');

function text(value){return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
function pdfText(value){return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\xFF]/g,'?')}
function wrap(value,max){const words=pdfText(value).split(' ').filter(Boolean),lines=[];let current='';for(const word of words){const next=current?current+' '+word:word;if(next.length>max&&current){lines.push(current);current=word}else current=next}if(current)lines.push(current);return lines.length?lines:['-']}
function formatDate(value){const date=new Date(value||'');if(Number.isNaN(date.getTime()))return text(value)||'-';try{return date.toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'medium'})}catch(_){return date.toISOString()}}
async function imageFor(pdf,buffer,type){try{return /png/i.test(type||'')?await pdf.embedPng(buffer):await pdf.embedJpg(buffer)}catch(_){return null}}

async function createPodPdf(record,signatureBuffer,signatureType,customsSignatureBuffer,customsSignatureType){
 const {PDFDocument,StandardFonts}=require('pdf-lib');
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let page=pdf.addPage([595.28,841.89]),y=800;const left=48,width=499;
 function newPage(){page=pdf.addPage([595.28,841.89]);y=800}
 function ensure(space){if(y-space<54)newPage()}
 function line(label,value){const lines=wrap(value,72);ensure(18+Math.max(0,lines.length-1)*13);page.drawText(label,{x:left,y,size:10,font:bold});page.drawText(lines[0],{x:left+135,y,size:10,font:normal});for(let i=1;i<lines.length;i++){y-=13;page.drawText(lines[i],{x:left+135,y,size:10,font:normal})}y-=18}
 function heading(value){ensure(28);y-=4;page.drawText(value,{x:left,y,size:12,font:bold});y-=20}
 page.drawText('ExportHUB - Abliefernachweis (POD)',{x:left,y,size:19,font:bold});y-=28;
 page.drawText('Automatisch nach digital bestaetigter Abholung erzeugt',{x:left,y,size:9,font:normal});y-=28;
 line('Referenz',record.reference||'-');
 if(record.subShipmentLabel)line('Teilsendung',record.subShipmentLabel);
 line('Kunde',record.customer||'-');line('Empfaenger',record.recipient||'-');line('Lieferadresse',record.address||'-');line('Spedition',record.carrierName||record.speditionName||record.carrier||record.spedition||'-');
 heading('Abholung');
 const history=typeof store.pickupHistory==='function'?store.pickupHistory(record):(Array.isArray(record.pickupHistory)?record.pickupHistory:[]),last=history.length?history[history.length-1]:{};
 line('Zeitpunkt',formatDate(record.confirmedAt||last.confirmedAt));line('Fahrer',last.driverName||record.driverName||'-');line('Kennzeichen',last.licensePlate||record.licensePlate||'-');line('Verlader',last.loaderName||record.loaderName||record.loadedBy||'-');line('Colli gesamt',String(typeof store.expectedCollis==='function'?store.expectedCollis(record):(record.expectedColliCount||record.colliCount||'-')));line('Colli abgeholt',String(typeof store.pickupCollectedColliCount==='function'?store.pickupCollectedColliCount(record):(record.pickupCollectedColliCount||record.collectedPickupCollis||'-')));
 const rows=Array.isArray(record.rows)?record.rows:[];
 if(rows.length){heading('Packstuecke');for(let i=0;i<Math.min(rows.length,40);i++){const row=rows[i]||{},packaging=text(row.type||row.packaging||row.verpackung||row.packageType||row.packagingType)||'Colli',count=row.count!=null?row.count:(row.quantity!=null?row.quantity:(row.qty!=null?row.qty:'')),weight=row.weight!=null?row.weight:(row.kg!=null?row.kg:'');line((i+1)+'.',packaging+(count!==''?' - Anzahl '+count:'')+(weight!==''?' - '+weight+' kg':''))}if(rows.length>40)line('Hinweis','Weitere '+(rows.length-40)+' Positionen sind im ExportHUB-Datensatz dokumentiert.')}
 const customsRequired=typeof store.abdPresent==='function'?store.abdPresent(record):record&&record.abdPresent===true;
 const primaryImage=await imageFor(pdf,signatureBuffer,signatureType),customsImage=customsRequired?await imageFor(pdf,customsSignatureBuffer,customsSignatureType):null;
 heading(customsRequired?'Fahrerunterschriften':'Fahrerunterschrift');
 ensure(customsRequired?132:180);
 if(customsRequired){
  const gap=12,boxW=(width-gap)/2,boxH=92,labelY=y;
  page.drawText('Abholung bestaetigt',{x:left,y:labelY,size:8,font:bold});
  page.drawText('Zolldokumente erhalten',{x:left+boxW+gap,y:labelY,size:8,font:bold});
  const boxY=labelY-boxH-12;
  page.drawRectangle({x:left,y:boxY,width:boxW,height:boxH,borderWidth:1});
  page.drawRectangle({x:left+boxW+gap,y:boxY,width:boxW,height:boxH,borderWidth:1});
  function draw(image,x){if(!image)return;const dims=image.scale(1),scale=Math.min((boxW-14)/dims.width,(boxH-14)/dims.height,1);page.drawImage(image,{x:x+7,y:boxY+7,width:dims.width*scale,height:dims.height*scale})}
  draw(primaryImage,left);draw(customsImage,left+boxW+gap);
  if(!primaryImage)page.drawText('Digital gespeichert',{x:left+8,y:boxY+boxH/2,size:9,font:normal});
  if(!customsImage)page.drawText('Nicht erfasst',{x:left+boxW+gap+8,y:boxY+boxH/2,size:9,font:normal});
  y=boxY-12;
 }else if(primaryImage){
  const dims=primaryImage.scale(1),maxW=width,maxH=150,scale=Math.min(maxW/dims.width,maxH/dims.height,1);page.drawRectangle({x:left,y:y-maxH+8,width:maxW,height:maxH,borderWidth:1});page.drawImage(primaryImage,{x:left+8,y:y-Math.min(maxH-16,dims.height*scale),width:dims.width*scale,height:dims.height*scale});y-=maxH+10;
 }else{page.drawText('Unterschrift ist im geschuetzten ExportHUB-POD-Speicher hinterlegt.',{x:left,y,size:10,font:normal});y-=22}
 ensure(55);page.drawText('Nachweis-ID: '+text(record.accessKey||'').slice(0,20),{x:left,y,size:8,font:normal});y-=12;page.drawText('Erzeugt: '+formatDate(new Date().toISOString()),{x:left,y,size:8,font:normal});y-=12;page.drawText('Quelle: ExportHUB QR-Abholung',{x:left,y,size:8,font:normal});
 return Buffer.from(await pdf.save())
}

async function ensureAutomaticPod(accessKey,environment,options){
 options=Object.assign({copyToDrive:true},options||{});
 const got=await store.getRecord(accessKey,environment),record=got.record||{},abd=typeof store.abdPresent==='function'?store.abdPresent(record):record.abdPresent===true;
 if(!abd)return base.ensureAutomaticPod(accessKey,environment,options);
 const customsBlobName=text(record.customsDocumentsSignatureBlobName);
 if(!customsBlobName)throw store.err('CUSTOMS_SIGNATURE_REQUIRED','Für eine ABD-Sendung fehlt die zweite Fahrerunterschrift „Zolldokumente erhalten“.',409);
 const existing=base.automaticPod(record);
 if(existing&&record.podCustomsSignatureVersion==='RC1432')return base.ensureAutomaticPod(accessKey,environment,options);
 if(!text(record.signatureBlobName))throw store.err('SIGNATURE_NOT_FOUND','Die Fahrerunterschrift für den POD fehlt.',409);
 const driverRead=await store.readBuffer(got.clients.pods.getBlobClient(record.signatureBlobName));
 const customsRead=await store.readBuffer(got.clients.pods.getBlobClient(customsBlobName));
 const pdf=await createPodPdf(record,driverRead.buffer,record.signatureType||driverRead.contentType,customsRead.buffer,record.customsDocumentsSignatureType||customsRead.contentType);
 const saved=await base.saveSuppliedPod(accessKey,environment,record,pdf,base.fileNameFor(record));
 let marked=await store.mutateRecord(accessKey,environment,function(next){next.podCustomsSignatureVersion='RC1432';next.podCustomsSignatureIncludedAt=store.now();next.updatedAt=store.now();return next});
 if(options.copyToDrive!==false){const copied=await base.retryDriveBackup(accessKey,environment);if(copied&&copied.record)marked=copied.record}
 return{ok:true,record:marked,file:base.automaticPod(marked)||saved.file,pdf,backup:marked.podBackup||{},archiveSaved:!!(marked.podBackup&&marked.podBackup.archiveSaved),driveSaved:!!(marked.podBackup&&marked.podBackup.driveSaved)}
}

module.exports=Object.assign({},base,{createPodPdf,ensureAutomaticPod});
