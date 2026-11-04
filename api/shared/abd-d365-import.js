'use strict';

// RC1784: D365 shipment export import for ABD proforma. Never merge distinct packing slips.
const COUNTRY3_TO_2=Object.freeze({
 AUT:'AT',BEL:'BE',BGR:'BG',CHE:'CH',CHN:'CN',CZE:'CZ',DEU:'DE',DNK:'DK',ESP:'ES',
 EST:'EE',FIN:'FI',FRA:'FR',GBR:'GB',GRC:'GR',HRV:'HR',HUN:'HU',IDN:'ID',
 IND:'IN',IRL:'IE',ISR:'IL',ITA:'IT',JPN:'JP',KOR:'KR',LTU:'LT',LUX:'LU',
 LVA:'LV',MEX:'MX',NLD:'NL',NOR:'NO',POL:'PL',PRT:'PT',ROU:'RO',RUS:'RU',
 SVK:'SK',SVN:'SI',SWE:'SE',THA:'TH',TUR:'TR',TWN:'TW',UKR:'UA',USA:'US',
 VNM:'VN',ZAF:'ZA',CAN:'CA',AUS:'AU',BRA:'BR',ARE:'AE'
});
function str(value){return String(value==null?'':value).trim()}
function headerName(value){return str(value).replace(/[^A-Za-z0-9]/g,'').toUpperCase()}
function country(value){const code=str(value).toUpperCase();return COUNTRY3_TO_2[code]||code}
function decimal(value,analyzer){return analyzer.safeNumber(value)}
function delimitedRows(raw){
 const source=String(raw==null?'':raw).replace(/^\uFEFF/,'').replace(/\u0000/g,'');
 const header=source.split(/\r?\n/,1)[0]||'';
 const delimiter=['\t',';',','].sort((a,b)=>header.split(b).length-header.split(a).length)[0];
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<source.length;i++){
  const char=source[i];
  if(char==='"'){
   if(quoted&&source[i+1]==='"'){field+='"';i++}else quoted=!quoted;
  }else if(char===delimiter&&!quoted){row.push(field.trim());field=''}
  else if((char==='\r'||char==='\n')&&!quoted){
   if(char==='\r'&&source[i+1]==='\n')i++;
   row.push(field.trim());
   if(row.some(Boolean))rows.push(row);
   row=[];field='';
  }else field+=char
 }
 row.push(field.trim());if(row.some(Boolean))rows.push(row);
 return rows;
}
function d365Columns(row){
 const map={};(Array.isArray(row)?row:[]).forEach((v,i)=>{const key=headerName(v);if(key&&!Object.prototype.hasOwnProperty.call(map,key))map[key]=i});
 return map;
}
function isD365(matrix){
 const m=Array.isArray(matrix)&&matrix.length?d365Columns(matrix[0]):{};
 return ['PACKINGSLIPID','ITEMNUMBER','QTY','COMMODITYCODE','SHIPPEDAMOUNT'].every(k=>Object.prototype.hasOwnProperty.call(m,k));
}
function d365Invoice(matrix,name,analyzer,analysisModel){
 if(!isD365(matrix))return null;
 const columns=d365Columns(matrix[0]),shipments=new Map(),allPositions=[];
 for(let i=1;i<matrix.length&&allPositions.length<500;i++){
  const row=matrix[i];const get=key=>str(row[columns[key]]);
  const quantity=decimal(get('QTY'),analyzer);
  if(!(quantity>0))continue; // A backorder without shipped pieces is not an invoice line.
  const value=decimal(get('SHIPPEDAMOUNT'),analyzer);
  const fallback=decimal(get('LINEAMOUNT'),analyzer);
  // Never silently use the ordered line amount for a partially shipped backorder.
  const shippedValue=value!=null?value:((get('SALESORDERLINESTATUS').toLowerCase()==='backorder')?null:fallback);
  const address=get('FORMATTEDDELVERYADDRESS')||[
   get('DELIVERYADDRESSSTREET'),get('DELIVERYADDRESSZIPCODE')+' '+get('DELIVERYADDRESSCITY'),
   get('DELIVERYADDRESSCOUNTRYREGIONISOCODE')
  ].filter(Boolean).join('\n');
  const recipient=get('DELIVERYADDRESSNAME')||get('DELIVERYADDRESSDESCRIPTION');
  const deliveryCountry=get('DELIVERYADDRESSCOUNTRYREGIONISOCODE')||country(get('DELIVERYADDRESSCOUNTRYREGIONID'));
  const packingSlip=get('PACKINGSLIPID');
  const reference=packingSlip||get('SALESORDERNUMBER');
  const normalized=analyzer.normalizePosition({
   position:String(i),itemNumber:get('ITEMNUMBER'),
   description:get('PRODUCTDESCRIPTION')||get('NAME')||get('PRODUCTNAMEDE'),
   quantity,unit:get('SALESUNIT')||get('UNIT'),unitPrice:shippedValue!=null?shippedValue/quantity:null,
   value:shippedValue,commodityCode:get('COMMODITYCODE'),originCountry:country(get('ORIGCOUNTRYREGIONID')),
   netMassKg:get('SHIPPEDQTYNETWEIGHT'),grossMassKg:get('SHIPPEDQTYGROSSWEIGHT'),
   currency:get('CURRENCYCODE'),_source:name,_row:i+1
  },allPositions.length);
  normalized.packingSlipId=packingSlip;
  normalized.salesOrderNumber=get('SALESORDERNUMBER');
  normalized.lineStatus=get('SALESORDERLINESTATUS');
  if(!recipient||!reference||!deliveryCountry)normalized.warnings.push('d365-delivery-reference-review-required');
  if(shippedValue==null)normalized.warnings.push('d365-shipped-value-review-required');
  allPositions.push(normalized);
  // A document always belongs to one physical delivery and one recipient.
  const key=[reference,recipient,address,deliveryCountry].join('\u001f');
  if(!shipments.has(key))shipments.set(key,{reference,recipient,address,destinationCountry:deliveryCountry,positions:[]});
  shipments.get(key).positions.push(normalized);
 }
 const documents=[];
 for(const batch of shipments.values()){
  const currencies=Array.from(new Set(batch.positions.map(p=>p.currency).filter(Boolean)));
  const completeValues=batch.positions.every(p=>p.value!=null);
  const total=completeValues?Number(batch.positions.reduce((sum,p)=>sum+p.value,0).toFixed(2)):null;
  const header={
   invoiceNumber:'',recipient:batch.recipient,recipientAddress:batch.address,
   destinationCountry:batch.destinationCountry,shipmentReference:batch.reference,
   currency:currencies.length===1?currencies[0]:'',
   invoiceTotal:total
  };
  const analysis=analysisModel.enrichLegacyAnalysis({
   positions:batch.positions,fileName:name+' · '+batch.reference+' · '+batch.recipient,
   fileType:'d365',extraction:'d365-shipped-quantities',requiresReview:true
  },header);
  documents.push(analysis);
 }
 const overall=analysisModel.enrichLegacyAnalysis({
  positions:allPositions,fileName:name,fileType:'d365',extraction:'d365-shipped-quantities',
  requiresReview:true
 });
 overall.deliveryDocuments=documents;
 overall.deliveryCount=documents.length;
 return overall;
}
module.exports={delimitedRows,isD365,d365Invoice,country};
