'use strict';
// RC1603: print-safe A4 proforma layout. All coordinates are PDF points.
const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
const W=595.28,H=841.89,M=40,R=W-M,CONTENT=R-M,TOP=H-37,FOOT=38;
const ink=rgb(0.09,0.15,0.24),muted=rgb(0.34,0.40,0.48);
const accent=rgb(0.08,0.39,0.61),line=rgb(0.83,0.87,0.91);
const pale=rgb(0.96,0.98,0.99),white=rgb(1,1,1);
const LETTER_REPLACEMENTS={'ł':'l','Ł':'L','đ':'d','Đ':'D','ß':'ss','œ':'oe','Œ':'OE','æ':'ae','Æ':'AE','ø':'o','Ø':'O','ı':'i','€':'EUR','–':'-','—':'-','−':'-','’':"'",'‘':"'",'“':'"','”':'"','•':'-','✓':'OK','→':'->','⁰':'0','²':'2','³':'3'};
function printable(value){
 return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/[łŁđĐßœŒæÆøØı€–—−’‘“”•✓→⁰²³]/g,c=>LETTER_REPLACEMENTS[c]||'?')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g,'?').replace(/\s+/g,' ').trim();
}
function fail(code){const error=new Error(code);error.code=code;error.status=400;throw error}
function money(value){return value==null?'--':Number(value).toFixed(2)}
function metric(value){return value==null?'--':Number(value).toFixed(3)}
function number(value){return value==null?'--':String(Number(value))}
function linesFor(font,value,size,width,maxLines=25){
 const words=printable(value).split(/\s+/).filter(Boolean),lines=[];let current='';
 function push(){if(current){lines.push(current);current=''}}
 for(const word of words){
  let proposal=current?current+' '+word:word;
  if(font.widthOfTextAtSize(proposal,size)<=width){current=proposal;continue}
  push();
  if(font.widthOfTextAtSize(word,size)<=width){current=word;continue}
  let part='';
  for(const char of word){
   if(part&&font.widthOfTextAtSize(part+char,size)>width){lines.push(part);part=char}
   else part+=char
  }
  current=part
 }
 push();
 if(lines.length>maxLines)fail('ABD_PDF_TEXT_OVERFLOW');
 return lines.length?lines:['']
}
async function renderInvoice(model,logoData){
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const header=model.header||{},positions=model.positions||[],groups=model.groups||[],totals=model.totals||{};
 const currency=printable(totals.currency||header.currency||'EUR');
 const logo=logoData?(logoData.type==='png'?await pdf.embedPng(logoData.buffer):await pdf.embedJpg(logoData.buffer)):null;
 pdf.setTitle('Proforma Invoice '+printable(header.invoiceNumber||''));
 pdf.setAuthor('ExportHUB360');
 pdf.setSubject('Customs proforma - not a commercial tax invoice');
 pdf.setCreator('ExportHUB360');
 let page,y,numberOfPages=0;
 function put(value,x,yy,options={}){
  const font=options.bold?bold:normal,size=options.size||8,text=printable(value);
  if(!text)return;
  const max=options.width||CONTENT;
  if(font.widthOfTextAtSize(text,size)>max+0.1)fail('ABD_PDF_TEXT_OVERFLOW');
  page.drawText(text,{x,y:yy,size,font,color:options.color||ink})
 }
 function putRight(value,right,yy,options={}){
  const font=options.bold?bold:normal,size=options.size||8,text=printable(value);
  const width=font.widthOfTextAtSize(text,size);
  if(width>(options.width||CONTENT)+0.1)fail('ABD_PDF_TEXT_OVERFLOW');
  put(text,right-width,yy,options)
 }
 function rule(yy){page.drawLine({start:{x:M,y:yy},end:{x:R,y:yy},thickness:0.65,color:line})}
 function headerBand(){
  page.drawRectangle({x:M,y:H-93,width:CONTENT,height:2.8,color:accent});
  if(logo){
   const dims=logo.scale(Math.min(194/logo.width,42/logo.height,1));
   page.drawImage(logo,{x:M,y:H-75,width:dims.width,height:dims.height});
  }else{
   // Never fabricate an Essentra corporate mark. Until a verified artwork is supplied,
   // identify the sender with plain text, not a logo-like wordmark.
   const senderLabel=header.senderName||header.customer||'';
   const senderLines=linesFor(bold,senderLabel,11,194,3);
   senderLines.forEach((label,i)=>put(label,M,H-52-i*12,{size:11,bold:true,width:194}))
  }
  putRight('PROFORMA INVOICE',R,H-58,{size:16,bold:true,width:290});
  putRight('Customs document | not a tax invoice',R,H-75,{size:8,color:muted,width:290});
 }
 function newPage(){
  page=pdf.addPage([W,H]);numberOfPages++;
  headerBand();y=H-113
 }
 function section(label){
  page.drawRectangle({x:M,y:y-4,width:3.5,height:17,color:accent});
  put(label,M+12,y+1,{size:10,bold:true,width:CONTENT-12});
  y-=25
 }
 function lineBlock(text,x,start,size,maxWidth){
  const parts=linesFor(normal,text,size,maxWidth,30);
  for(let i=0;i<parts.length;i++)put(parts[i],x,start-i*12,{size,width:maxWidth});
  return parts.length
 }
 function addressCard(name,address,x,width){
  const interior=width-24;
  const nameLines=linesFor(bold,name||'--',8.7,interior,15);
  const addressLines=linesFor(normal,address||'--',8.0,interior,30);
  return {nameLines,addressLines,height:Math.max(94,23+nameLines.length*13+addressLines.length*12+12)}
 }
 function printAddress(){
  const gap=13,col=(CONTENT-gap)/2;
  const sender=addressCard(header.senderName||header.customer||'Essentra Components GmbH',header.senderAddress,M,col);
  const receiver=addressCard(header.recipient,header.recipientAddress,M+col+gap,col);
  const boxHeight=Math.max(sender.height,receiver.height);
  if(boxHeight>345)fail('ABD_PDF_TEXT_OVERFLOW');
  const leftY=y-boxHeight;
  for(const [entry,x,title] of [[sender,M,'ABSENDER / SHIPPER'],[receiver,M+col+gap,'EMPFAENGER / CONSIGNEE']]){
   page.drawRectangle({x,y:leftY,width:col,height:boxHeight,color:pale,borderColor:line,borderWidth:0.65});
   put(title,x+12,y-18,{size:7,bold:true,color:accent,width:col-24});
   let yy=y-34;
   for(const l of entry.nameLines){put(l,x+12,yy,{size:8.7,bold:true,width:col-24});yy-=13}
   yy-=3;
   for(const l of entry.addressLines){put(l,x+12,yy,{size:8,width:col-24});yy-=12}
  }
  y=leftY-25
 }
 function startPageContent(){
  newPage();
  const metaY=y;
  const fields=[
   {x:M,label:'PROFORMA-NR.',value:header.invoiceNumber||'--',w:178},
   {x:M+200,label:'DATUM',value:header.invoiceDate||'--',w:112},
   {x:M+341,label:'BESTIMMUNGSLAND',value:header.destinationCountry||'--',w:CONTENT-341}
  ];
  for(const f of fields){
   put(f.label,f.x,metaY,{size:7,bold:true,color:muted,width:f.w});
   const valueLines=linesFor(bold,f.value,9,f.w,4);
   valueLines.forEach((t,i)=>put(t,f.x,metaY-15-i*12,{size:9,bold:true,width:f.w}))
  }
  y=metaY-45;
  printAddress();
 }
 function itemHeader(){
  page.drawRectangle({x:M,y:y-22,width:CONTENT,height:27,color:pale});
  put('POS.',M+5,y-12,{size:7,bold:true,width:24});
  put('ARTIKEL / WARENBESCHREIBUNG',M+36,y-12,{size:7,bold:true,width:220});
  putRight('MENGE',M+318,y-12,{size:7,bold:true,width:55});
  putRight('PREIS',M+381,y-12,{size:7,bold:true,width:52});
  putRight('WERT',M+451,y-12,{size:7,bold:true,width:68});
  put('HS / COO',M+461,y-12,{size:7,bold:true,width:CONTENT-463});
  y-=33;
 }
 function itemsSection(continued){
  section(continued?'WARENPOSITIONEN - FORTSETZUNG':'WARENPOSITIONEN');
  itemHeader()
 }
 function detailRow(p){
  const name=printable([p.itemNumber,p.description].filter(Boolean).join(' - '));
  const desc=linesFor(normal,name,8.0,217,50);
  const kgText='Netto '+metric(p.netMassKg)+' kg | Brutto '+metric(p.grossMassKg)+' kg'+(p.volumeM3!=null?' | '+metric(p.volumeM3)+' m3':'');
  const hs=printable(p.commodityCode||'--'),coo=printable(p.originCountry||'--');
  const netLines=linesFor(normal,kgText,7.0,380,4);
  const minHeight=Math.max(51,10+desc.length*11+netLines.length*10+9);
  if(minHeight>H-200)fail('ABD_PDF_TEXT_OVERFLOW');
  if(y-minHeight<FOOT+22){newPage();itemsSection(true)}
  const yy=y;
  if(p.position)put(p.position,M+5,yy,{size:7.5,bold:true,width:25});
  desc.forEach((t,i)=>put(t,M+36,yy-i*11,{size:8,width:217}));
  putRight(number(p.quantity)+(p.unit?' '+printable(p.unit):''),M+318,yy,{size:7.2,width:55});
  putRight(money(p.unitPrice),M+381,yy,{size:7.2,width:52});
  putRight(money(p.value),M+451,yy,{size:8,bold:true,width:68});
  put(hs,M+461,yy,{size:7.5,bold:true,width:CONTENT-463});
  put(coo,M+461,yy-13,{size:7.2,width:CONTENT-463});
  const kgY=yy-desc.length*11-4;
  netLines.forEach((t,i)=>put(t,M+36,kgY-i*10,{size:7,color:muted,width:380}));
  y-=minHeight;rule(y+3);y-=8
 }
 function summary(){
  if(y<198)newPage();
  section('RECHNUNGSZUSAMMENFASSUNG');
  const top=y;
  page.drawRectangle({x:M,y:top-94,width:CONTENT,height:101,color:pale,borderColor:line,borderWidth:0.7});
  put('WARENWERT GESAMT',M+15,top-21,{size:9,bold:true,width:230});
  putRight(money(totals.invoiceTotal)+' '+currency,R-16,top-22,{size:14,bold:true,width:210});
  page.drawLine({start:{x:M+15,y:top-36},end:{x:R-15,y:top-36},thickness:0.7,color:line});
  put('Nettogewicht',M+15,top-57,{size:8,color:muted,width:120});
  put(metric(totals.netMassKg)+' kg',M+142,top-57,{size:9,bold:true,width:105});
  put('Bruttogewicht',M+272,top-57,{size:8,color:muted,width:120});
  putRight(metric(totals.grossMassKg)+' kg',R-16,top-57,{size:9,bold:true,width:105});
  put('Gesamtvolumen',M+15,top-77,{size:8,color:muted,width:120});
  put(metric(totals.volumeM3)+' m3',M+142,top-77,{size:9,bold:true,width:105});
  y=top-116
 }
 function groupedHeader(){
  page.drawRectangle({x:M,y:y-22,width:CONTENT,height:27,color:pale});
  const cols=[[M+6,'HS-CODE',93],[M+114,'HERKUNFT',70],[M+215,'WARENWERT',116],[M+351,'NETTO KG',65],[M+433,'BRUTTO KG',71]];
  for(const [x,t,w] of cols)put(t,x,y-12,{size:7,bold:true,width:w});
  y-=34
 }
 function groupSection(continued){
  section(continued?'ZOLLZUSAMMENFASSUNG - FORTSETZUNG':'ZOLLZUSAMMENFASSUNG');
  groupedHeader()
 }
 function grouped(){
  if(y<133)newPage();
  groupSection(false);
  for(const g of groups){
   if(y<FOOT+35){newPage();groupSection(true)}
   put(g.commodityCode,M+6,y,{size:8,bold:true,width:93});
   put(g.originCountry,M+114,y,{size:8,width:70});
   put(money(g.value)+' '+printable(g.currency||currency),M+215,y,{size:8,bold:true,width:116});
   put(metric(g.netMassKg),M+351,y,{size:8,width:65});
   put(metric(g.grossMassKg),M+433,y,{size:8,width:71});
   y-=20;rule(y+5)
  }
 }
 startPageContent();itemsSection(false);
 for(const position of positions)detailRow(position);
 summary();grouped();
 const pages=pdf.getPages();
 for(let i=0;i<pages.length;i++){
  const p=pages[i];
  p.drawLine({start:{x:M,y:FOOT},end:{x:R,y:FOOT},thickness:0.6,color:line});
  p.drawText('ExportHUB360 | Proforma fuer Zollzwecke',{x:M,y:FOOT-14,size:7,font:normal,color:muted});
  const pageLabel='Seite '+(i+1)+' / '+pages.length;
  const width=normal.widthOfTextAtSize(pageLabel,7);
  p.drawText(pageLabel,{x:R-width,y:FOOT-14,size:7,font:normal,color:muted})
 }
 return Buffer.from(await pdf.save())
}
module.exports={renderInvoice,printable,linesFor};
