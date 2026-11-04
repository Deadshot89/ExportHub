'use strict';
// RC1790: independent delivery note (DNC) PDF; no invoice prices or D365 writes.
const fs = require('node:fs');
const path = require('node:path');
const {PDFDocument,StandardFonts,rgb} = require('pdf-lib');
const WIDTH=595.28,HEIGHT=841.89,LEFT=40,RIGHT=WIDTH-40,CONTENT=RIGHT-LEFT,BOTTOM=62;
const ink=rgb(0.10,0.17,0.25),muted=rgb(0.33,0.40,0.46),accent=rgb(0.05,0.39,0.62);
const border=rgb(0.81,0.86,0.90),pale=rgb(0.95,0.98,0.99);
function fail(code){const err=new Error(code);err.code=code;err.status=400;throw err}
function safe(value,max=500){
 const s=String(value==null?'':value).trim();
 if(s.length>max)fail('DELIVERY_NOTE_TEXT_TOO_LONG');
 return s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ');
}
function printable(value){
 return safe(value,800).replace(/\s+/g,' ').replace(/[ß]/g,'ss').replace(/[łŁ]/g,'l').replace(/[øØ]/g,'o')
  .replace(/[€]/g,'EUR').replace(/[–—−]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\x20-\x7e\u00a0-\u00ff]/g,'?').replace(/\s+/g,' ').trim();
}
function date(value){
 const s=safe(value,10),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 const parsed=m?new Date(s+'T12:00:00Z'):null;
 if(!parsed||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==s)fail('DELIVERY_NOTE_DATE_INVALID');
 return m[3]+'.'+m[2]+'.'+m[1];
}
function optionalNumber(value){
 if(value===''||value==null)return null;
 const n=Number(String(value).replace(',','.'));
 if(!Number.isFinite(n)||n<0||n>1000000000)fail('DELIVERY_NOTE_NUMBER_INVALID');
 return n;
}
function modelFrom(snapshot){
 const src=snapshot&&typeof snapshot==='object'?snapshot:{};
 const h=src.header&&typeof src.header==='object'?src.header:{};
 const documentNumber=safe(h.documentNumber,42);
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,39}$/.test(documentNumber))fail('DELIVERY_NOTE_NUMBER_REQUIRED');
 const result={header:{
  documentNumber,issuedAt:date(h.issuedAt),
  senderName:safe(h.senderName,160),senderAddress:safe(h.senderAddress,500),
  recipient:safe(h.recipient,160),recipientAddress:safe(h.recipientAddress,500),
  customerNumber:safe(h.customerNumber,60),customerOrder:safe(h.customerOrder,80),
  shipmentReference:safe(h.shipmentReference,80),
  deliveryDate:h.deliveryDate?date(h.deliveryDate):'',
  packageCount:optionalNumber(h.packageCount),
  packageType:safe(h.packageType,100),
  netWeight:optionalNumber(h.netWeight),
  grossWeight:optionalNumber(h.grossWeight),
  notes:safe(h.notes,800)
 },items:[]};
 if(!result.header.senderName||!result.header.senderAddress||!result.header.recipient||!result.header.recipientAddress)fail('DELIVERY_NOTE_ADDRESS_REQUIRED');
 if(result.header.packageCount!=null&&!Number.isInteger(result.header.packageCount))fail('DELIVERY_NOTE_PACKAGE_COUNT_INVALID');
 if(result.header.grossWeight!=null&&result.header.netWeight!=null&&result.header.grossWeight<result.header.netWeight)fail('DELIVERY_NOTE_WEIGHT_INVALID');
 const items=Array.isArray(src.items)?src.items:[];
 if(!items.length||items.length>250)fail('DELIVERY_NOTE_ITEMS_REQUIRED');
 result.items=items.map((item,i)=>{
  const p=item&&typeof item==='object'?item:{};
  const quantity=Number(String(p.quantity==null?'':p.quantity).replace(',','.'));
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000000||!safe(p.description,500))fail('DELIVERY_NOTE_ITEM_INVALID');
  return {position:i+1,itemNumber:safe(p.itemNumber,100),description:safe(p.description,500),
   quantity,unit:safe(p.unit,24)||'Stk',orderPosition:safe(p.orderPosition,50)};
 });
 return result;
}
function wrap(font,value,size,width,max=80){
 const words=printable(value).split(' ').filter(Boolean),lines=[];let current='';
 function add(){if(current){lines.push(current);current=''}}
 for(const word of words){
  const test=current?current+' '+word:word;
  if(font.widthOfTextAtSize(test,size)<=width){current=test;continue}
  add();
  if(font.widthOfTextAtSize(word,size)<=width){current=word;continue}
  let partial='';
  for(const char of word){
   if(partial&&font.widthOfTextAtSize(partial+char,size)>width){lines.push(partial);partial=char}
   else partial+=char;
  }
  current=partial;
  if(lines.length>max)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
 }
 add();
 if(lines.length>max)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
 return lines.length?lines:[''];
}
function addressLines(font,value,size,width,max=25){
 const lines=[];
 for(const sourceLine of safe(value,800).split(/\r?\n/)){
  if(!sourceLine.trim())continue;
  lines.push(...wrap(font,sourceLine,size,width,max));
  if(lines.length>max)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
 }
 return lines.length?lines:[''];
}
async function createDeliveryNotePdf(snapshot){
 const data=modelFrom(snapshot),h=data.header,pdf=await PDFDocument.create();
 const normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logoData=fs.readFileSync(path.join(__dirname,'essentra-company-logo.png'));
 const logo=await pdf.embedPng(logoData);
 pdf.setTitle('Lieferschein '+h.documentNumber);pdf.setAuthor('Essentra Components GmbH');
 pdf.setSubject('Essentra Lieferschein / Delivery Note');
 let page,y;
 function put(value,x,yy,size=8,isBold=false,width=CONTENT,color=ink){
  const s=printable(value),font=isBold?bold:normal;
  if(font.widthOfTextAtSize(s,size)>width+.3)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
  if(s)page.drawText(s,{x,y:yy,size,font,color});
 }
 function rule(at){page.drawLine({start:{x:LEFT,y:at},end:{x:RIGHT,y:at},color:border,thickness:0.75})}
 function addPage(){
  page=pdf.addPage([WIDTH,HEIGHT]);const dim=logo.scale(Math.min(180/logo.width,40/logo.height,1));
  page.drawImage(logo,{x:LEFT,y:HEIGHT-76,width:dim.width,height:dim.height});
  put('LIEFERSCHEIN',RIGHT-202,HEIGHT-52,17,true,202);
  put('DELIVERY NOTE',RIGHT-152,HEIGHT-68,9,false,152,muted);
  page.drawRectangle({x:LEFT,y:HEIGHT-98,width:CONTENT,height:3,color:accent});
  const numberLines=wrap(bold,'Lieferschein-Nr.: '+h.documentNumber,9,347,3);
  if(numberLines.length>2)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
  numberLines.forEach((line,i)=>put(line,LEFT,HEIGHT-117-i*11,9,true,347));
  put('Datum: '+h.issuedAt,RIGHT-166,HEIGHT-117,9,true,166);
  y=HEIGHT-143;
 }
 function section(label){put(label,LEFT,y,9,true,CONTENT,accent);y-=15;rule(y);y-=15}
 function addressBlock(label,name,address,x,width){
  const nameLines=wrap(bold,name,9,width-24,10),lines=addressLines(normal,address,8,width-24,25);
  return {label,nameLines,lines,height:Math.max(100,40+nameLines.length*12+lines.length*11)};
 }
 function addresses(){
  section('ABSENDER UND EMPFAENGER / SENDER AND RECIPIENT');
  const gap=14,w=(CONTENT-gap)/2;
  const entries=[
   addressBlock('ABSENDER / SENDER',h.senderName,h.senderAddress,LEFT,w),
   addressBlock('LIEFERANSCHRIFT / SHIP TO',h.recipient,h.recipientAddress,LEFT+w+gap,w)
  ];
  const height=Math.max(entries[0].height,entries[1].height);
  if(height>330)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
  entries.forEach((entry,i)=>{
   const x=LEFT+i*(w+gap);
   page.drawRectangle({x,y:y-height,width:w,height,color:pale,borderColor:border,borderWidth:0.8});
   put(entry.label,x+12,y-18,7,true,w-24,accent);
   let cursor=y-35;
   entry.nameLines.forEach(s=>{put(s,x+12,cursor,9,true,w-24);cursor-=12});
   cursor-=4;
   entry.lines.forEach(s=>{put(s,x+12,cursor,8,false,w-24);cursor-=11});
  });
  y-=height+23;
 }
 function details(){
  const fields=[
   ['Kundennummer',h.customerNumber],['Kundenbestellung',h.customerOrder],
   ['Sendungsreferenz',h.shipmentReference],['Lieferdatum',h.deliveryDate],
   ['Packstuecke',h.packageCount!=null?String(h.packageCount)+' '+h.packageType:h.packageType],
   ['Nettogewicht',h.netWeight!=null?h.netWeight.toFixed(3)+' kg':''],
   ['Bruttogewicht',h.grossWeight!=null?h.grossWeight.toFixed(3)+' kg':'']
  ].filter(pair=>pair[1]);
  if(!fields.length)return;
  section('SENDUNGSANGABEN / DELIVERY DETAILS');
  const col=CONTENT/2;
  for(let i=0;i<fields.length;i+=2){
   const pair=fields.slice(i,i+2).map(([label,value])=>({label,lines:wrap(normal,value,8,col-12,10)}));
   const height=17+pair.reduce((n,f)=>Math.max(n,f.lines.length*11),0);
   if(y-height<BOTTOM+110)addPage();
   pair.forEach((entry,j)=>{
    const x=LEFT+j*col;
    put(entry.label.toUpperCase(),x,y,7,true,col-10,muted);
    entry.lines.forEach((s,k)=>put(s,x,y-14-k*11,8,false,col-12));
   });
   y-=height+7;
  }
  y-=9;
 }
 function tableHead(continued){
  section(continued?'WARENPOSITIONEN / ITEMS - FORTSETZUNG':'WARENPOSITIONEN / ITEMS');
  page.drawRectangle({x:LEFT,y:y-25,width:CONTENT,height:29,color:pale});
  put('POS.',LEFT+5,y-13,7,true,28);
  put('ARTIKEL',LEFT+40,y-13,7,true,88);
  put('BESCHREIBUNG',LEFT+142,y-13,7,true,240);
  put('MENGE',RIGHT-101,y-13,7,true,57);
  put('EINHEIT',RIGHT-50,y-13,7,true,50);
  y-=38;
 }
 function itemLayout(item){
  const sku=wrap(normal,item.itemNumber||'-',8,90,16),desc=wrap(normal,item.description,8,231,40),unitLines=wrap(normal,item.unit,8,46,8);
  const order=item.orderPosition?wrap(normal,'Bestellpos.: '+item.orderPosition,7,231,7):[];
  const height=Math.max(32,13+Math.max(sku.length*11,desc.length*11+order.length*10,unitLines.length*11)+8);
  if(height>HEIGHT-220)fail('DELIVERY_NOTE_TEXT_OVERFLOW');
  return{sku,desc,unitLines,order,height}
 }
 function itemRow(item){
  const {sku,desc,unitLines,order,height}=itemLayout(item);
  if(y-height<BOTTOM+20){addPage();tableHead(true)}
  const yy=y;
  put(String(item.position),LEFT+5,yy,8,true,28);
  sku.forEach((s,i)=>put(s,LEFT+40,yy-i*11,8,false,90));
  desc.forEach((s,i)=>put(s,LEFT+142,yy-i*11,8,false,231));
  order.forEach((s,i)=>put(s,LEFT+142,yy-desc.length*11-2-i*10,7,false,231,muted));
  put(String(item.quantity),RIGHT-101,yy,8,true,57);
  unitLines.forEach((line,i)=>put(line,RIGHT-50,yy-i*11,8,false,50));
  y-=height;rule(y+5);y-=6;
 }
 function conclusion(){
  if(y<150)addPage();
  y-=7;
  section('ZUSAMMENFASSUNG / SUMMARY');
  put('Positionen: '+data.items.length,LEFT,y,9,true,230);y-=24;
  if(h.notes){
   const lines=wrap(normal,h.notes,8,CONTENT-20,80);
   if(y<75)addPage();
   put('BEMERKUNGEN / REMARKS',LEFT,y,8,true,CONTENT,accent);y-=18;
   for(const line of lines){if(y<BOTTOM+12)addPage();put(line,LEFT,y,8,false,CONTENT-20);y-=12}
  }
 }
 addPage();addresses();details();
 // Reserve the column heading AND the first item; never print an empty table header.
 if(y-68-itemLayout(data.items[0]).height<BOTTOM+20)addPage();
 tableHead(false);
 for(const p of data.items)itemRow(p);
 conclusion();
 const pages=pdf.getPages();
 pages.forEach((p,index)=>{
  p.drawLine({start:{x:LEFT,y:47},end:{x:RIGHT,y:47},color:border,thickness:0.7});
  const footer='Essentra Components GmbH | Lieferschein / Delivery Note';
  p.drawText(footer,{x:LEFT,y:31,font:normal,size:7,color:muted});
  const number='Seite '+(index+1)+' / '+pages.length;
  p.drawText(number,{x:RIGHT-bold.widthOfTextAtSize(number,8),y:31,font:bold,size:8,color:ink});
 });
 return Buffer.from(await pdf.save());
}
module.exports={modelFrom,createDeliveryNotePdf};
