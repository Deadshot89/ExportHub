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
 const words=safeText(value,500).split(/\s+/).filter(Boolean),lines=[];let current='';
 for(const word of words){
  const candidate=current?current+' '+word:word;
  if(font.widthOfTextAtSize(candidate,size)<=maxWidth)current=candidate;
  else{
   if(current)lines.push(current);
   current=word;
   if(lines.length>=maxLines-1)break
  }
 }
 if(current&&lines.length<maxLines)lines.push(current);
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
 const model=createExportModel(snapshot),{PDFDocument,StandardFonts,rgb}=require('pdf-lib'),pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logoData=invoiceLogo(snapshot&&snapshot.logoDataUri);
 const logoImage=logoData?(logoData.type==='png'?await pdf.embedPng(logoData.buffer):await pdf.embedJpg(logoData.buffer)):null;
 pdf.setTitle('Proforma Invoice '+fileLabel(model));pdf.setSubject('Essentra Components GmbH Proforma Invoice');pdf.setCreator('ExportHUB360');
 const width=595.28,height=841.89,margin=36,ink=rgb(0.08,0.12,0.18),muted=rgb(0.35,0.4,0.47),line=rgb(0.82,0.85,0.89),accent=rgb(0.09,0.48,0.43),soft=rgb(0.94,0.98,0.97);
 let page,y,pageNo=0;
 function draw(value,x,yy,size=8,font=normal,maxWidth=520,color=ink){page.drawText(safeText(value,300),{x,y:yy,size,font,color,maxWidth})}
 function rule(yy){page.drawLine({start:{x:margin,y:yy},end:{x:width-margin,y:yy},thickness:0.8,color:line})}
 function brand(){
  if(logoImage){
   const scale=Math.min(245/logoImage.width,55/logoImage.height,1);
   page.drawImage(logoImage,{x:margin,y:height-87,width:logoImage.width*scale,height:logoImage.height*scale})
  }else{
   page.drawRectangle({x:margin,y:height-67,width:8,height:30,color:accent});
   page.drawCircle({x:margin+18,y:height-52,size:5,color:accent});
   draw('essentra',margin+30,height-57,21,bold,190,ink);
   draw('Components',margin+31,height-70,7,normal,120,muted)
  }
  draw('PROFORMA INVOICE',356,height-54,15,bold,200,ink);
  draw('NO COMMERCIAL INVOICE',369,height-69,7,bold,180,muted)
 }
 function footer(){
  rule(28);draw('Essentra Components GmbH · Export document generated by ExportHUB360',margin,16,6.5,normal,430,muted);draw(String(pageNo),538,16,6.5,bold,20,muted)
 }
 function newPage(first){
  page=pdf.addPage([width,height]);pageNo++;brand();footer();y=height-98;
  if(first){
   draw('Proforma-Nr.',margin,y,7,normal,80,muted);draw(model.header.invoiceNumber||'—',margin,y-12,10,bold,180);draw('Datum',215,y,7,normal,60,muted);draw(model.header.invoiceDate||'—',215,y-12,9,bold,100);
   draw('Empfaengerland',390,y,7,normal,95,muted);draw(model.header.destinationCountry||'—',390,y-12,9,bold,150);y-=38;
   page.drawRectangle({x:margin,y:y-106,width:width-margin*2,height:112,color:soft,borderColor:line,borderWidth:0.5});
   draw('VERSENDER',margin+12,y-11,7,bold,90,muted);
   draw(model.header.senderName||model.header.customer||'Essentra Components GmbH',margin+12,y-26,9,bold,235);
   const senderLines=wrapText(normal,model.header.senderAddress,7.4,232,5);
   senderLines.forEach((row,i)=>draw(row,margin+12,y-40-(i*11),7.4,normal,232));
   draw('EMPFAENGER',306,y-11,7,bold,90,muted);
   draw(model.header.recipient||'—',306,y-26,9,bold,236);
   const recipientLines=wrapText(normal,model.header.recipientAddress,7.4,232,5);
   recipientLines.forEach((row,i)=>draw(row,306,y-40-(i*11),7.4,normal,232));
   y-=135
  }else y-=6
 }
 function positionHeader(){
  draw('Pos',margin,y,6.5,bold,22,muted);draw('Artikel / Beschreibung',65,y,6.5,bold,178,muted);draw('Menge',248,y,6.5,bold,42,muted);draw('Preis',293,y,6.5,bold,48,muted);draw('Wert',344,y,6.5,bold,48,muted);draw('HS / COO',397,y,6.5,bold,70,muted);draw('kg / m3',476,y,6.5,bold,72,muted);y-=8;rule(y);y-=13
 }
 newPage(true);draw('WARENPOSITIONEN',margin,y,9,bold,180);y-=18;positionHeader();
 for(const position of model.positions){
  const desc=wrapText(normal,[position.itemNumber,position.description].filter(Boolean).join(' · '),7.5,174,2),rowHeight=Math.max(31,desc.length*11+11);
  if(y-rowHeight<150){newPage(false);draw('WARENPOSITIONEN · FORTSETZUNG',margin,y,9,bold,220);y-=18;positionHeader()}
  draw(position.position||'',margin,y,7.5,bold,25);desc.forEach((row,i)=>draw(row,65,y-(i*10),7.5,i===0?bold:normal,174));
  draw(formatQuantity(position.quantity)+(position.unit?' '+position.unit:''),248,y,7.2,normal,42);
  draw(position.unitPrice==null?'—':formatMoney(position.unitPrice),293,y,7.2,normal,48);
  draw(formatMoney(position.value),344,y,7.2,bold,48);
  draw(position.commodityCode,397,y,7.2,bold,70);draw(position.originCountry,397,y-11,7,normal,70);
  draw((position.grossMassKg==null?'—':formatMetric(position.grossMassKg))+' kg',476,y,7,normal,72);draw((position.volumeM3==null?'—':formatMetric(position.volumeM3))+' m3',476,y-11,7,normal,72);
  y-=rowHeight;rule(y+6)
 }
 if(y<180)newPage(false);
 y-=4;page.drawRectangle({x:335,y:y-72,width:width-margin-335,height:78,color:soft,borderColor:line,borderWidth:0.5});
 const currency=model.totals.currency||model.header.currency;
 draw('WARENWERT GESAMT',347,y-13,7,bold,120,muted);draw(formatMoney(model.totals.invoiceTotal)+' '+currency,455,y-13,10,bold,95);
 draw('Nettogewicht',347,y-29,7,normal,90,muted);draw(formatMetric(model.totals.netMassKg)+' kg',455,y-29,8,bold,95);
 draw('Bruttogewicht',347,y-45,7,normal,90,muted);draw(formatMetric(model.totals.grossMassKg)+' kg',455,y-45,8,bold,95);
 draw('Volumen',347,y-61,7,normal,90,muted);draw(formatMetric(model.totals.volumeM3)+' m3',455,y-61,8,bold,95);y-=96;
 if(y<140)newPage(false);
 draw('ZOLLZUSAMMENFASSUNG · HS-CODE + HERKUNFTSLAND',margin,y,9,bold,320);y-=19;
 draw('HS-Code',margin,y,7,bold,90,muted);draw('COO',145,y,7,bold,55,muted);draw('Warenwert',205,y,7,bold,90,muted);draw('Netto kg',310,y,7,bold,70,muted);draw('Brutto kg',390,y,7,bold,70,muted);draw('Volumen m3',470,y,7,bold,75,muted);y-=8;rule(y);y-=13;
 for(const group of model.groups){
  if(y<58){newPage(false);draw('ZOLLZUSAMMENFASSUNG · FORTSETZUNG',margin,y,9,bold,280);y-=19}
  draw(group.commodityCode,margin,y,8,bold,95);draw(group.originCountry,145,y,8,normal,50);draw(formatMoney(group.value)+' '+group.currency,205,y,8,bold,95);draw(formatMetric(group.netMassKg),310,y,8,normal,70);draw(formatMetric(group.grossMassKg),390,y,8,normal,70);draw(formatMetric(group.volumeM3),470,y,8,normal,75);y-=18
 }
 return Buffer.from(await pdf.save())
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
