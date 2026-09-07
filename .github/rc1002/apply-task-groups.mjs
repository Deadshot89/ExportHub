import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];
const replacement=`function taskGroupNameRC874(t){\\
  const a=norm(t&&(t.area||t.category||t.section||t.type||'')),title=norm(t&&(t.title||t.name||'')),hay=norm([a,title,t&&t.note,t&&t.source,t&&t.recurringSource].join(' '));\\
  const shipmentStatus=norm(t&&(t.shipmentStatus||t.linkedShipmentStatus||t.deliveryStatus||''));\\
  const pickedUp=!!(t&&(t.pickedUp===true||t.pickupConfirmed===true||t.pickedUpAt||t.pickupAt||t.abgeholtAt))||/abgeholt|picked up|pickedup/.test(shipmentStatus);\\
  const hasPod=!!(t&&(t.pod===true||t.hasPod===true||t.podAvailable===true||t.podAt||t.podUrl||t.podFile||t.podDocument));\\
  if((/pod/.test(hay)||(t&&t.requiresPod===true))&&pickedUp&&!hasPod)return'Fehlende POD';\\
  if(/abd|mrn|ausfuhr/.test(hay))return'Offene ABDs';\\
  if(/^(picken|pick|heute picken)$/.test(a)||(a.includes('pick')&&!a.includes('pickup'))||/picken|pick/.test(title))return'Picks';\\
  if(/kunde.*angemeld|angemeld.*kunde|anmeld|avis|spedition|carrier/.test(hay))return'Kunde angemeldet';\\
  return'Offene Sendungen';\\
}\\
`;

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function taskGroupNameRC874(t){');
  const end=html.indexOf('function taskGroupOpenRC874',start);
  if(start<0||end<=start)throw new Error(`${file}: Gruppenfunktion nicht gefunden`);
  html=html.slice(0,start)+replacement+html.slice(end);
  const orderStart=html.indexOf('function areaOrderRC67(');
  if(orderStart>=0){
    const orderEnd=html.indexOf('function ',orderStart+12);
    const order=`function areaOrderRC67(a){const order=['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs'];const i=order.indexOf(String(a||''));return i<0?99:i}\\
`;
    if(orderEnd>orderStart)html=html.slice(0,orderStart)+order+html.slice(orderEnd);
  }
  fs.writeFileSync(file,html,'utf8');
}
console.log('RC1002 Aufgaben-Gruppen materialisiert');
