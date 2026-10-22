'use strict';

function text(value){return String(value==null?'':value).trim()}
function numberOrNull(value){
 if(value==null||value==='')return null;
 const number=Number(value);return Number.isFinite(number)?number:null
}
function integer(value){const number=numberOrNull(value);return number==null?0:Math.max(0,Math.trunc(number))}
function money(value){const number=numberOrNull(value);return number==null?null:Math.round(number*100)/100}
function metric(value){const number=numberOrNull(value);return number==null?null:Math.round(number*1000)/1000}
function fail(code){const error=new Error(code);error.code=code;error.status=400;throw error}
function safeText(value,max=240){return text(value).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').slice(0,max)}
function cleanHeader(header){
 const source=header&&typeof header==='object'?header:{};
 return{
  invoiceNumber:safeText(source.invoiceNumber,80),
  invoiceDate:safeText(source.invoiceDate,40),
  customer:safeText(source.customer,160),
  senderName:safeText(source.senderName||source.customer,160),
  senderAddress:safeText(source.senderAddress,500),
  recipient:safeText(source.recipient,240),
  recipientAddress:safeText(source.recipientAddress,500),
  destinationCountry:safeText(source.destinationCountry,80),
  invoiceTotal:money(source.invoiceTotal),
  currency:safeText(source.currency,3).toUpperCase()
 }
}
function cleanGroup(group){
 const source=group&&typeof group==='object'?group:{},out={
  commodityCode:safeText(source.commodityCode,16),
  originCountry:safeText(source.originCountry,80).toUpperCase(),
  value:money(source.value),
  currency:safeText(source.currency,3).toUpperCase(),
  positionCount:integer(source.positionCount)
 };
 const net=metric(source.netMassKg),gross=metric(source.grossMassKg),volume=metric(source.volumeM3);
 if(net!=null)out.netMassKg=net;if(gross!=null)out.grossMassKg=gross;if(volume!=null)out.volumeM3=volume;
 return out
}
function cleanPosition(position){
 const source=position&&typeof position==='object'?position:{},out={
  position:safeText(source.position,60),
  itemNumber:safeText(source.itemNumber,120),
  description:safeText(source.description,400),
  commodityCode:safeText(source.commodityCode,16),
  originCountry:safeText(source.originCountry,80).toUpperCase(),
  quantity:numberOrNull(source.quantity),
  netMassKg:numberOrNull(source.netMassKg),
  grossMassKg:numberOrNull(source.grossMassKg),
  value:money(source.value),
  currency:safeText(source.currency,3).toUpperCase(),
  source:safeText(source.source||source.sourceFile,180)
 };
 const unit=safeText(source.unit,24),unitPrice=numberOrNull(source.unitPrice),volume=metric(source.volumeM3);
 if(unit)out.unit=unit;if(unitPrice!=null)out.unitPrice=unitPrice;if(volume!=null)out.volumeM3=volume;
 return out
}
function validateSnapshot(snapshot){
 const source=snapshot&&typeof snapshot==='object'?snapshot:{},review=source.review&&typeof source.review==='object'?source.review:{},totals=source.totals&&typeof source.totals==='object'?source.totals:{},groups=Array.isArray(source.groups)?source.groups:[],positions=Array.isArray(source.positions)?source.positions:[],unassigned=Array.isArray(source.unassigned)?source.unassigned:[];
 if(review.complete!==true||numberOrNull(totals.difference)!==0||unassigned.length!==0||groups.length===0)fail('ABD_EXPORT_NOT_READY');
 if(groups.length>500||positions.length>500)fail('ABD_EXPORT_TOO_LARGE');
 const cleaned=groups.map(cleanGroup);
 for(const group of cleaned){
  if(!group.commodityCode||!group.originCountry||group.value==null||!group.currency||group.positionCount<1)fail('ABD_EXPORT_NOT_READY')
 }
 return{groups:cleaned,positions:positions.map(cleanPosition)}
}
function createExportModel(snapshot){
 const source=snapshot&&typeof snapshot==='object'?snapshot:{},validated=validateSnapshot(source),totals=source.totals&&typeof source.totals==='object'?source.totals:{},cleanedTotals={
  invoiceTotal:money(totals.invoiceTotal),
  groupedTotal:money(totals.groupedTotal),
  accountedTotal:money(totals.accountedTotal),
  difference:money(totals.difference),
  currency:safeText(totals.currency,3).toUpperCase()
 };
 const net=metric(totals.netMassKg),gross=metric(totals.grossMassKg),volume=metric(totals.volumeM3);
 if(net!=null)cleanedTotals.netMassKg=net;if(gross!=null)cleanedTotals.grossMassKg=gross;if(volume!=null)cleanedTotals.volumeM3=volume;
 return{
  header:cleanHeader(source.header),
  groups:validated.groups,
  positions:validated.positions,
  totals:cleanedTotals,
  review:{complete:true,groupCount:validated.groups.length,unassignedCount:0}
 }
}
function formatMoney(value){return value==null?'':Number(value).toFixed(2)}
function formatMetric(value){return value==null?'':Number(value).toFixed(3)}
function formatQuantity(value){return value==null?'':String(Number(value))}
function fileLabel(model){return model.header.invoiceNumber||'ABD-Auswertung'}
async function createPdf(snapshot){
 const model=createExportModel(snapshot),{PDFDocument,StandardFonts,rgb}=require('pdf-lib'),pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle('ABD-Auswertung '+fileLabel(model));pdf.setSubject('ExportHUB360 ABD-Auswertung');pdf.setCreator('ExportHUB360');
 const width=595.28,height=841.89,margin=42,rowHeight=20;
 let page,y;
 function draw(value,x,yy,size=9,font=normal){page.drawText(safeText(value,120),{x,y:yy,size,font,color:rgb(0.08,0.12,0.18),maxWidth:510})}
 function addPage(){
  page=pdf.addPage([width,height]);y=height-margin;
  draw('ExportHUB360 - ABD-Auswertung',margin,y,16,bold);y-=26;
  draw('Rechnung: '+model.header.invoiceNumber,margin,y,10,bold);draw('Datum: '+model.header.invoiceDate,310,y,9);y-=16;
  draw('Kunde: '+model.header.customer,margin,y,9);y-=15;draw('Empfaenger: '+model.header.recipient,margin,y,9);y-=15;
  draw('Rechnungswert: '+formatMoney(model.totals.invoiceTotal)+' '+(model.totals.currency||model.header.currency),margin,y,9,bold);y-=28;
  draw('HS-Code',margin,y,9,bold);draw('Ursprung',155,y,9,bold);draw('Warenwert',255,y,9,bold);draw('Waehrung',360,y,9,bold);draw('Positionen',445,y,9,bold);y-=10;
  page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:1,color:rgb(0.72,0.78,0.86)});y-=17
 }
 addPage();
 for(const group of model.groups){
  if(y<70)addPage();
  draw(group.commodityCode,margin,y,9,bold);draw(group.originCountry,155,y);draw(formatMoney(group.value),255,y);draw(group.currency,360,y);draw(String(group.positionCount),445,y);y-=rowHeight
 }
 if(y<90)addPage();
 y-=8;page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:1,color:rgb(0.72,0.78,0.86)});y-=20;
 draw('Kontrollierter Wert: '+formatMoney(model.totals.accountedTotal)+' '+model.totals.currency,margin,y,9,bold);y-=15;
 draw('Differenz: '+formatMoney(model.totals.difference)+' '+model.totals.currency,margin,y,9,bold);
 return Buffer.from(await pdf.save())
}
function wrapText(font,value,size,maxWidth,maxLines=3){
 const words=safeText(value,600).split(/\s+/).filter(Boolean),lines=[];let current='';
 function pushLine(){if(current){lines.push(current);current=''}}
 for(const word of words){
  const combined=current?current+' '+word:word;
  if(font.widthOfTextAtSize(combined,size)<=maxWidth){current=combined;continue}
  pushLine();
  if(font.widthOfTextAtSize(word,size)<=maxWidth){current=word;continue}
  let piece='';
  for(const char of word){
   if(piece&&font.widthOfTextAtSize(piece+char,size)>maxWidth){lines.push(piece);piece=char}
   else piece+=char
  }
  current=piece
 }
 pushLine();
 if(lines.length>maxLines)fail('ABD_PDF_TEXT_OVERFLOW');
 return lines.length?lines:['']
}
function invoiceLogo(data){
 const raw=typeof data==='string'?data:'';
 if(!raw)return null;
 if(raw.length>420000)fail('ABD_LOGO_TOO_LARGE');
 const matched=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
 if(!matched)fail('ABD_LOGO_INVALID');
 const buffer=Buffer.from(matched[2],'base64');
 if(buffer.length<40||buffer.length>300000)fail('ABD_LOGO_INVALID');
 if(matched[1]==='png'&&!(buffer[0]===0x89&&buffer[1]===0x50&&buffer[2]===0x4e&&buffer[3]===0x47))fail('ABD_LOGO_INVALID');
 if(matched[1]==='jpeg'&&!(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff))fail('ABD_LOGO_INVALID');
 return{type:matched[1],buffer}
}
async function createProformaPdf(snapshot){
 const model=createExportModel(snapshot),supplied=invoiceLogo(snapshot&&snapshot.logoDataUri);
 // The default logo comes from the user's Essentra SOP document, never from a drawn imitation.
 // Keep it inside the Azure Functions API bundle so every PDF uses the same verified artwork.
 const logoData=supplied||{
  type:'png',
  buffer:require('node:fs').readFileSync(require('node:path').join(__dirname,'essentra-company-logo.png'))
 };
 return require('./abd-proforma-layout').renderInvoice(model,logoData)
}
function styleHeader(row){
 row.font={bold:true};row.alignment={vertical:'middle'};
 row.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2E8F0'}};cell.border={bottom:{style:'thin',color:{argb:'FF94A3B8'}}}})
}
async function createXlsx(snapshot){
 const model=createExportModel(snapshot),ExcelJS=require('exceljs'),workbook=new ExcelJS.Workbook();
 workbook.creator='ExportHUB360';workbook.subject='ABD-Auswertung';workbook.created=new Date();
 const summary=workbook.addWorksheet('ABD-Auswertung',{views:[{state:'frozen',ySplit:1}]});
 summary.columns=[
  {header:'HS-Code',key:'commodityCode',width:18},
  {header:'Ursprungsland',key:'originCountry',width:18},
  {header:'Warenwert',key:'value',width:16},
  {header:'Waehrung',key:'currency',width:12},
  {header:'Positionen',key:'positionCount',width:12}
 ];
 model.groups.forEach(group=>summary.addRow(group));styleHeader(summary.getRow(1));summary.autoFilter='A1:E1';summary.getColumn('value').numFmt='#,##0.00';
 const details=workbook.addWorksheet('Rechnungsdetails',{views:[{state:'frozen',ySplit:1}]});
 details.columns=[
  {header:'Position',key:'position',width:12},{header:'Artikel',key:'itemNumber',width:20},{header:'Beschreibung',key:'description',width:42},
  {header:'HS-Code',key:'commodityCode',width:18},{header:'Ursprungsland',key:'originCountry',width:18},{header:'Menge',key:'quantity',width:12},
  {header:'Nettogewicht kg',key:'netMassKg',width:18},{header:'Bruttogewicht kg',key:'grossMassKg',width:18},{header:'Warenwert',key:'value',width:16},
  {header:'Waehrung',key:'currency',width:12},{header:'Quelle',key:'source',width:28}
 ];
 model.positions.forEach(position=>details.addRow(position));styleHeader(details.getRow(1));details.autoFilter='A1:K1';details.getColumn('value').numFmt='#,##0.00';details.getColumn('netMassKg').numFmt='#,##0.000';details.getColumn('grossMassKg').numFmt='#,##0.000';
 return Buffer.from(await workbook.xlsx.writeBuffer())
}

module.exports={createExportModel,createPdf,createProformaPdf,createXlsx,validateSnapshot};
