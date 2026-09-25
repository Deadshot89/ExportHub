import fs from 'node:fs';

const pages=['index.html','TESTVERSION.html','demo.html'];
const oldPairs=[
  [
    "function autoExpiresOn(sh){var picked=dateKey(pickupStamp(sh));return picked?addBusinessDays(picked,3):''}",
    "function addCalendarDays(key,count){var d=keyDate(key),days=Math.max(0,Number(count)||0);if(!d)return'';d.setUTCDate(d.getUTCDate()+days);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}\nfunction autoExpiresOn(sh){var picked=dateKey(pickupStamp(sh));return picked?addCalendarDays(picked,14):''}"
  ],
  [
    "function expired(sh){var until=autoExpiresOn(sh);return !!(configured(sh)&&until&&berlinDateKey(new Date())>=until)}",
    "function expired(sh){var until=autoExpiresOn(sh);return !!(configured(sh)&&until&&berlinDateKey(new Date())>until)}"
  ],
  [
    "customerAvisAutoDisabledReason:'3 Arbeitstage nach tatsächlicher Abholung',avisAutoDisabledReason:'3 business days after actual collection'",
    "customerAvisAutoDisabledReason:'14 Tage nach tatsächlicher Abholung',avisAutoDisabledReason:'14 calendar days after actual collection'"
  ],
  [
    "persist('Kunden-Avis automatisch nach 3 Arbeitstagen deaktiviert')",
    "persist('Kunden-Avis automatisch nach 14 Tagen deaktiviert')"
  ],
  [
    "IMPORTANT: This link is automatically deactivated three business days after the actual collection. Saturday and Sunday are not counted. Essentra can disable it earlier.",
    "IMPORTANT: This link remains available through 14 calendar days after the actual collection and is then automatically deactivated. Essentra can disable it earlier."
  ],
  [
    "WICHTIG: Der Link wird drei Arbeitstage nach der tatsächlichen Abholung automatisch deaktiviert. Samstag und Sonntag zählen nicht mit. Essentra kann ihn vorher deaktivieren.",
    "WICHTIG: Der Lieferavis-Link bleibt bis einschließlich 14 Kalendertage nach der tatsächlichen Abholung verfügbar und wird anschließend automatisch deaktiviert. Essentra kann ihn vorher deaktivieren."
  ],
  [
    "Note: The delivery notice link remains valid until three business days after the actual collection and is then automatically deactivated. Saturdays and Sundays are not counted as business days. Essentra can deactivate the link earlier at any time.",
    "Note: The delivery notice link remains available through 14 calendar days after the actual collection and is then automatically deactivated. Essentra can deactivate the link earlier at any time."
  ],
  [
    "Hinweis: Der Lieferavis-Link bleibt bis drei Arbeitstage nach der tatsächlichen Abholung gültig und wird anschließend automatisch deaktiviert. Samstage und Sonntage gelten dabei nicht als Arbeitstage. Essentra kann den Link jederzeit vorzeitig deaktivieren.",
    "Hinweis: Der Lieferavis-Link bleibt bis einschließlich 14 Kalendertage nach der tatsächlichen Abholung verfügbar und wird anschließend automatisch deaktiviert. Essentra kann den Link jederzeit vorzeitig deaktivieren."
  ]
];

for(const file of pages){
  if(!fs.existsSync(file)){
    if(file==='demo.html')continue;
    throw new Error(file+': verpflichtende Quelldatei fehlt');
  }
  let html=fs.readFileSync(file,'utf8');
  let changed=false;
  for(const [before,after] of oldPairs){
    if(html.includes(before)){ html=html.replaceAll(before,after); changed=true; }
  }
  if(/three business days|drei Arbeitstage|three calendar days|drei Kalendertage nach der tatsächlichen Abholung/i.test(
    html.slice(
      html.indexOf('function injectMailBody(sh,target,body,langOverride)'),
      html.indexOf('function click(e)',html.indexOf('function injectMailBody(sh,target,body,langOverride)'))
    )
  )){
    throw new Error(file+': veraltete 3-Tage-Regel im injectMailBody-Block bleibt bestehen');
  }
  if(!html.includes('14 calendar days after the actual collection')&&!html.includes('14 Kalendertage nach der tatsächlichen Abholung')){
    throw new Error(file+': 14-Tage-Hinweis fehlt');
  }
  if(changed)fs.writeFileSync(file,html,'utf8');
}

const apiFile='api/customer-avis/index.js';
let api=fs.readFileSync(apiFile,'utf8');
api=api.replaceAll('postPickupDays:3','postPickupDays:14');
if(!api.includes('addCalendarDays(picked,14)'))throw new Error('API: 14-Tage-Ablauf fehlt');
if(api.includes('postPickupDays:3'))throw new Error('API: postPickupDays=3 bleibt bestehen');
fs.writeFileSync(apiFile,api,'utf8');

console.log('RC1277: AVIS-Quellverträge auf 14 Kalendertage normalisiert.');
