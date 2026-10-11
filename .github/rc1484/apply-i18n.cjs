// RC1484 one-shot helper; real release i18n gate runs in the repository verification workflow.
const fs=require('node:fs');

function replaceOnce(source,from,to,label){
  const first=source.indexOf(from),second=first<0?-1:source.indexOf(from,first+from.length);
  if(first<0||second>=0)throw new Error(label+': expected exactly one match');
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const runtimePath='assets/rc1166-avis-reminder-overview.js';
let runtime=fs.readFileSync(runtimePath,'utf8');
runtime=replaceOnce(runtime,
` var wrap=d.createElement('div');wrap.className='index236-reminder-actions rc1484-generic-reminder-actions';
 var title=d.createElement('span');title.className='rc820-reminder-label';title.textContent='Abholerinnerung öffnen';wrap.appendChild(title);`,
` var wrap=d.createElement('div');wrap.className='index236-reminder-actions rc1484-generic-reminder-actions';
 var title=d.createElement('span'),legacyLabel=d.querySelector&&d.querySelector('.index236-reminder-actions .rc820-reminder-label');title.className='rc820-reminder-label';title.textContent=q(legacyLabel&&legacyLabel.textContent)||tr('avisReminder.button');wrap.appendChild(title);`,
'localized reminder heading');
runtime=replaceOnce(runtime,
`  if(!recipient.available){button.disabled=true;button.setAttribute('aria-disabled','true');button.title='Keine E-Mail-Adresse für diesen Empfänger hinterlegt'}
  else button.title=(target==='carrier'?'Erinnerungsmail an Spedition':'Erinnerungsmail an Kunde')+' ('+lang.toUpperCase()+')';`,
`  if(!recipient.available){button.disabled=true;button.setAttribute('aria-disabled','true');button.title=tr(target==='carrier'?'avisReminder.missingCarrier':'avisReminder.missingCustomer')}
  else button.title=label;`,
'localized reminder tooltip');
runtime=replaceOnce(runtime,
` add('customer','de','Kunde DE',customer);add('customer','en','Kunde EN',customer);add('carrier','de','Spedition DE',carrier);add('carrier','en','Spedition EN',carrier);`,
` add('customer','de',tr('avisReminder.customer')+' DE',customer);add('customer','en',tr('avisReminder.customer')+' EN',customer);add('carrier','de',tr('avisReminder.carrier')+' DE',carrier);add('carrier','en',tr('avisReminder.carrier')+' EN',carrier);`,
'localized reminder button labels');
fs.writeFileSync(runtimePath,runtime);
console.log('RC1484 i18n runtime patch applied');
