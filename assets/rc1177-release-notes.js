(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1177_RELEASE_NOTES__)return;
w.__EXPORTHUB_RC1177_RELEASE_NOTES__=true;
var NOTES=[
 'RC1177 bereinigt die zentrale Historie: doppelte Sendung-erfasst/erstellt-Einträge und mehrfach protokollierte Lieferavis-Aktivierungen werden in der Anzeige zu einer fachlich eindeutigen Aktion zusammengeführt; echte Benutzeraktionen werden gegenüber technischen System-Dubletten bevorzugt.',
 'RC1176 stabilisiert die Standortauswahl in „Sendung erstellen“. Gewählter Standort, Standort-Aliase und Empfängeradresse bleiben auch nach dem nächsten Render konsistent erhalten.',
 'RC1174 stellt die Fehlerdiagnose-Benachrichtigungen für die Android-/Handy-Nutzung wieder sicher und hält den Diagnosekanal im Releasevertrag abgesichert.',
 'RC1169 schützt die Fehlerdiagnose vollständig vor Nicht-Administratoren: keine sichtbare Diagnose-Navigation und serverseitig weiterhin 403 ohne Global-Admin-Recht.',
 'RC1166 ergänzt in der Sendungsübersicht die Avis-Erinnerung auf Deutsch oder Englisch an Kunde oder Spedition mit hinterlegten Kontakten und sicherem Lieferavis-Link.',
 'RC1220 stellt die verpflichtende POD-Zweitsicherung auf Azure-Primärspeicher plus separates Azure-Archiv um; Microsoft 365 ist nur noch optional. Die Sendungsübersicht zeigt den aktuellen Sicherungsstatus nachvollziehbar an.',
 'RC1163 protokolliert Änderungen eines bereits gemeldeten Abholtermins im Lieferavis revisionssicher mit altem und neuem Termin.',
 'RC1160 sichert Kundenportal-Zugangsdaten verschlüsselt und trennt Rechte für Verwenden, Anzeigen und Verwalten.',
 'RC1159 hebt das Deckblatt für Paletten deutlich stärker und drucksicher hervor, inklusive markanter Referenzfläche.',
 'RC1152 verbessert Aufgabenansicht, wiederkehrende Aufgaben und die Bereinigung veralteter Aufgabenbestände.',
 'RC1148 erweitert die Historie um Dokument öffnen/drucken mit Benutzer und Dateiname.',
 'RC1133 informiert ExportHUB über neue Kunden-PDFs aus dem Lieferavis und stellt direkte Öffnen-/Drucken-Aktionen bereit.'
];
function q(v){return String(v==null?'':v).trim()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function version(){
 var v=q(w.__EXPORTHUB_VISIBLE_RELEASE_VERSION__);if(/^RC\d+$/i.test(v))return v.toUpperCase();
 var el=d.querySelector('[data-exporthub-version-label]');
 v=q(el&&el.textContent);if(/^RC\d+$/i.test(v))return v.toUpperCase();
 return'RC1231'
}
function patch(){
 var title=d.getElementById('rc524ReleaseTitle');if(!title)return false;
 var card=title.closest&&title.closest('.rc524-release-card');if(!card)return false;
 title.textContent=version()+' · Aktueller ExportHUB-Stand';
 var date=card.querySelector('.rc524-release-date');if(date)date.textContent='23.09.2026';
 var list=card.querySelector('.rc524-release-list');
 if(!list){
  list=d.createElement('ul');list.className='rc524-release-list';
  var muted=card.querySelector('.muted');if(muted)muted.replaceWith(list);else card.appendChild(list)
 }
 list.innerHTML=NOTES.map(function(x){return'<li>'+esc(x)+'</li>'}).join('');
 card.setAttribute('data-rc1177-release-notes','1');
 return true
}
function schedule(){(w.setTimeout||setTimeout)(function(){try{patch()}catch(e){try{console.warn('RC1177 Release Notes',e)}catch(_){}}},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBReleaseNotes1177=Object.freeze({version:'RC1177',notes:NOTES.slice(),patch:patch});
})(window,document);
