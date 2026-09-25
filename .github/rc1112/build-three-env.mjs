import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1048');
const OUT=path.join(ROOT,'dist-rc1112');
const VERSION='RC1112';
const NUMBER='1112';
const DEFAULT_VISIBLE_VERSION='RC1112';
function resolveVisibleVersion(){
  const explicit=String(process.env.EXPORTHUB_VISIBLE_RELEASE_VERSION||'').trim().toUpperCase();
  if(/^RC\d+$/.test(explicit))return explicit;
  try{
    const subjects=execFileSync('git',['log','-20','--pretty=%s'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const matches=Array.from(String(subjects||'').matchAll(/\bRC(\d+)\b/gi)).map(m=>Number(m[1])).filter(Number.isFinite);
    if(matches.length)return 'RC'+Math.max(...matches);
  }catch(_){}
  return DEFAULT_VISIBLE_VERSION;
}
const VISIBLE_VERSION=resolveVisibleVersion();
const VISIBLE_NUMBER=VISIBLE_VERSION.slice(2);
const LEGACY_TESTSERVICE_HOST='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';
const CURRENT_TESTSERVICE_HOST='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const RC1267_I18N_TAG='<script id="exporthub-rc1267-i18n" defer src="/assets/rc1267-i18n.js?v=1267"></script>';
const RC1206_SHIPPING_ID='exporthub-rc1206-shipping-rules';
const RC1206_SHIPPING_TAG='<script id="'+RC1206_SHIPPING_ID+'" defer src="/assets/rc1206-shipping-rules.js?v=1266"></script>';

function injectDeferredRuntimeInHead(html,tag,id){
  if(id&&(html.includes('id="'+id+'"')||html.includes("id='"+id+"'")))return html;
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error((id||'Script')+': äußerer <head>-Anker fehlt');
  const start=headOpen.index+headOpen[0].length;
  const lower=html.toLowerCase(),idx=lower.indexOf('</head>',start);
  if(idx<0)throw new Error((id||'Script')+': äußerer </head>-Anker fehlt');
  return html.slice(0,idx)+tag+'\n'+html.slice(idx);
}

function patchRc1206ShippingRules(html,file){
  return injectDeferredRuntimeInHead(html,RC1206_SHIPPING_TAG,RC1206_SHIPPING_ID);
}

function patchMainCountryDetection(html,file){
  const linesAnchor=" var lines=raw.split(/[\\n,;|]+/).map(q).filter(Boolean);";
  const italyRule=" var italian=raw.match(/\\b([0-9]{5})\\b[\\s\\S]*\\b([A-Za-z]{2})\\s*$/),itProvinces='|AG|AL|AN|AO|AP|AQ|AR|AT|AV|BA|BG|BI|BL|BN|BO|BR|BS|BT|BZ|CA|CB|CE|CH|CI|CL|CN|CO|CR|CS|CT|CZ|EN|FC|FE|FG|FI|FM|FR|GE|GO|GR|IM|IS|KR|LC|LE|LI|LO|LT|LU|MB|MC|ME|MI|MN|MO|MS|MT|NA|NO|NU|OR|PA|PC|PD|PE|PG|PI|PN|PO|PR|PT|PU|PV|PZ|RA|RC|RE|RG|RI|RM|RN|RO|SA|SI|SO|SP|SR|SS|SU|SV|TA|TE|TN|TO|TP|TR|TS|TV|UD|VA|VB|VC|VE|VI|VR|VS|VT|VV|';if(italian&&itProvinces.indexOf('|'+String(italian[2]).toUpperCase()+'|')>=0)return countryName('IT');\n";
  const count=html.split(linesAnchor).length-1;
  if(count!==1)throw new Error(file+': RC1237 countryFromAddress-Anker '+count+'x gefunden');
  html=html.replace(linesAnchor,italyRule+linesAnchor);

  const customerFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)";
  const addressFirst="||firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const orderCount=html.split(customerFirst).length-1;
  if(orderCount!==1)throw new Error(file+': RC1237 Zielland-Priorität '+orderCount+'x gefunden');
  html=html.replace(customerFirst,addressFirst);

  if(!html.includes("itProvinces='|AG|AL|AN|"))throw new Error(file+': RC1237 Italien-Provinzerkennung fehlt');
  if(!html.includes(addressFirst))throw new Error(file+': RC1237 Lieferadresse hat nicht Vorrang vor Kundenland');
  return html;
}



function patchAuthSessionTimeout(html,file){
  const before="const d=await authCall('session',{});";
  const after="const d=await authCall('session',{},runtime.authToken,{timeoutMs:120000,maxAttempts:1});";
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1247 Session-Keepalive-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes(after))throw new Error(file+': RC1247 Session-Keepalive verwendet nicht 120s Einzelrequest');
  return html;
}

function patchDemoTestPortalIsolation(html,file){
  if(file!=='demo.html')return html;
  const originAnchor="namedTest=/-testservice\\./i.test(h);";
  const runtimeAnchor=" if(!window.__EXPORTHUB_TEST_PORTAL__)return;";
  const routeAnchor="function anchorTestRoute(){try{if(window.__EXPORTHUB_PICKUP_MODE__||!isTestPath())return;";
  for(const [needle,label] of [[originAnchor,'Testservice-Origin'],[runtimeAnchor,'Testportal-Runtime'],[routeAnchor,'Testportal-Routenanker']]){
    const count=html.split(needle).length-1;
    if(count!==1)throw new Error(file+': RC1131 '+label+' '+count+'x gefunden');
  }
  html=html.replace(originAnchor,"namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;");
  html=html.replace(runtimeAnchor," if(window.__EXPORTHUB_DEMO_MODE__===true)return;\n if(!window.__EXPORTHUB_TEST_PORTAL__)return;");
  html=html.replace(routeAnchor,"function anchorTestRoute(){try{if(window.__EXPORTHUB_DEMO_MODE__===true||window.__EXPORTHUB_PICKUP_MODE__||!isTestPath())return;");
  return html;
}

function patchNotificationTasks(html,file){
  const moduleStart='<script id="index236-notification-controller">';
  const moduleEnd='<!-- INDEX 236 NOTIFICATION CENTER END -->';
  const a=html.indexOf(moduleStart),b=a>=0?html.indexOf(moduleEnd,a+moduleStart.length):-1;
  if(a<0||b<0)throw new Error(file+': RC1123 Benachrichtigungsmodul fehlt');
  let block=html.slice(a,b);
  const oldTitle="function taskTitle(t){return q(t&&(t.title||t.name||t.subject||'Aufgabe'))||'Aufgabe'}";
  const newTitle="function taskTitle(t){var vals=t?[t.title,t.name,t.subject,t.taskTitle,t.taskName,t.label,t.description,t.text,t.action,t.note,t.comment,t.notes]:[];for(var i=0;i<vals.length;i++){var v=q(vals[i]);if(!v||/^(?:aufgabe|task)$/i.test(v))continue;return v.length>160?v.slice(0,157)+'…':v}return''}";
  const oldId="function taskId(t){return q(t&&(t.id||t.taskId||t.uuid||t.title))}";
  const newId="function taskId(t){return q(t&&(t.id||t.taskId||t.uuid))||taskTitle(t)}";
  const oldOpen="function openTasks(){return arr(main().tasks).filter(function(t){return t&&!isDone(t)&&!taskIsTemplate(t)&&taskForUser(t)})}";
  const newOpen="function notificationTaskKey(t){var id=q(t&&(t.id||t.taskId||t.uuid));if(id)return'id:'+low(id);return'sem:'+low([taskTitle(t),taskOwner(t),taskDate(t),taskRef(t),q(t&&(t.time||'')),q(t&&(t.area||t.category||t.type||''))].join('|'))}\nfunction openTasks(){var seen={};return arr(main().tasks).filter(function(t){if(!t||isDone(t)||taskIsTemplate(t)||!taskForUser(t)||!taskTitle(t))return false;var key=notificationTaskKey(t);if(!key||seen[key])return false;seen[key]=1;return true})}";
  for(const [before,after,label] of [[oldTitle,newTitle,'taskTitle'],[oldId,newId,'taskId'],[oldOpen,newOpen,'openTasks']]){
    const n=block.split(before).length-1;
    if(n!==1)throw new Error(file+': RC1123 '+label+' im Benachrichtigungsmodul '+n+'x gefunden');
    block=block.replace(before,after);
  }
  if(!block.includes('function notificationTaskKey(t)'))throw new Error(file+': RC1123 Aufgabenfilter fehlt');
  return html.slice(0,a)+block+html.slice(b);
}

function patchTaskMasterSaveScope(html,file){
  const before="function saveScopeForReason(reason){var r=lower(reason);if(/kundenstamm|kundenordner|kunden-mail|kundenmail|neuen kunden|kundendaten/.test(r))return new Set(['customers','customerNotes']);return null}";
  const after="function saveScopeForReason(reason){var r=lower(reason);if(/kundenstamm|kundenordner|kunden-mail|kundenmail|neuen kunden|kundendaten/.test(r))return new Set(['customers','customerNotes']);if(/aufgaben-master rc874/.test(r))return new Set(['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt']);return null}";
  const count=html.split(before).length-1;
  if(count!==1)throw new Error(file+': RC1153 saveScopeForReason '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes("if(/aufgaben-master rc874/.test(r))return new Set(['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt'])"))throw new Error(file+': RC1153 Task-Master-Save-Scope fehlt');
  return html
}

function patchDeckblattHighVisibility(html,file){
  let covers=0,refs=0;
  html=html.replace(/\.rc352-cover\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('border:8mm solid #08245d!important;')<0)return full;
    covers++;
    var next=body
      .replace('border:8mm solid #08245d!important;','border:10mm solid #08245d!important;border-top-width:18mm!important;outline:2mm solid #2563eb!important;outline-offset:-3mm!important;')
      .replace('background:linear-gradient(180deg,#60a5fa 0,#93c5fd 58mm,#bfdbfe 58mm,#dbeafe 100%)','background:linear-gradient(180deg,#1d4ed8 0,#60a5fa 66mm,#dbeafe 66mm,#eff6ff 100%)')
      .replace('box-shadow:inset 0 0 0 2mm #1d4ed8','box-shadow:inset 0 0 0 3mm #60a5fa')
      .replace('padding:8mm','padding:6mm');
    return '.rc352-cover{'+next+'}'
  });
  html=html.replace(/\.rc352-cover-ref\{([^}]*)\}/g,function(full,body){
    if(body.indexOf('background:#08245d')<0)return full;
    refs++;
    var next=body
      .replace('background:#08245d','background:#facc15')
      .replace('border:3px solid #60a5fa','border:3mm solid #111827')
      .replace('color:#fff!important','color:#111827!important');
    return '.rc352-cover-ref{'+next+'}'
  });
  html=html.replace(/(\.rc352-cover-ref span\{[^}]*?)color:#fff/g,'$1color:#111827');
  html=html.replace(/(\.rc352-cover-ref strong\{)color:#fff!important/g,'$1color:#111827!important');
  html=html.replace(/}\\n\.rc352-qr-slot\.empty/g,'}\n.rc352-qr-slot.empty');
  if(!covers)throw new Error(file+': RC1133 Deckblatt-Grundfläche nicht gefunden');
  if(!refs)throw new Error(file+': RC1133 Deckblatt-Referenzfeld nicht gefunden');
  return html
}

function patchRc1203ActualDeckblatt(html,file){
  if(html.includes('data-rc1281-customer-theme=')&&html.includes('id="exporthub-rc1203-deckblatt-style"'))return html;
  const start=html.indexOf('function coverHtml(sh){');
  const end=start<0?-1:html.indexOf('function rc1095LoadPalletCount',start);
  if(start<0||end<0)throw new Error(file+': RC1281 echter rc390-coverHtml-Renderer fehlt');
  let block=html.slice(start,end);

  const coverFnOld="function coverHtml(sh){var c=cname(sh),addr=caddress(sh),t=totals(sh),d=documents(sh),ref=esc(sref(sh)||sid(sh));return";
  const coverFnNew="function coverHtml(sh){var c=cname(sh),addr=caddress(sh),t=totals(sh),d=documents(sh),ref=esc(sref(sh)||sid(sh)),isEssentra=/\\bessentra\\b/i.test(c),created=dateDe(sh&&(sh.createdAt||sh.createdDateTime||sh.createdOn||sh.createdDate||sh.created));return";
  if(block.split(coverFnOld).length-1!==1)throw new Error(file+': RC1281 coverHtml-Kopf nicht eindeutig');
  block=block.replace(coverFnOld,coverFnNew);

  const coverOld=`<section id="rc565Cover" class="rc390-page rc390-cover rc576-cover rc601-cover" data-shipment-ref="'+ref+'">`;
  const coverNew=`<section id="rc565Cover" class="rc390-page rc390-cover rc576-cover rc601-cover rc1203-cover" data-rc1203-cover-enhanced="1" data-rc1281-customer-theme="'+(isEssentra?'essentra':'customer')+'" data-shipment-ref="'+ref+'" style="box-sizing:border-box!important;border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#fff!important;background-image:none!important;color:#1f2937!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;--rc1281-ref-bg:'+(isEssentra?'#facc15':'#2563eb')+';--rc1281-ref-border:'+(isEssentra?'#ca8a04':'#1d4ed8')+';--rc1281-ref-text:'+(isEssentra?'#111827':'#ffffff')+';--rc1281-recipient-bg:'+(isEssentra?'#fef9c3':'#dbeafe')+';--rc1281-recipient-border:'+(isEssentra?'#eab308':'#60a5fa')+';--rc1281-recipient-text:'+(isEssentra?'#713f12':'#1e3a8a')+';-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important">`;
  if(block.split(coverOld).length-1!==1)throw new Error(file+': RC1281 rc390-Cover-Anker nicht eindeutig');
  block=block.replace(coverOld,coverNew);

  const recipientOld='<div class="rc390-card"><div class="rc390-label">Empfänger</div><strong>';
  const recipientNew='<div class="rc390-card rc1203-cover-recipient" data-rc1203-recipient-highlight="1" style="font-size:16pt!important;line-height:1.24!important;font-weight:750!important;padding:4mm!important;border:1mm solid var(--rc1281-recipient-border)!important;background:var(--rc1281-recipient-bg)!important;color:var(--rc1281-recipient-text)!important"><div class="rc390-label">Empfänger</div><strong style="font-size:19pt!important;line-height:1.18!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important">';
  if(block.split(recipientOld).length-1<1)throw new Error(file+': RC1281 Empfänger-Anker fehlt');
  block=block.replace(recipientOld,recipientNew);

  const refOld='<div class="rc390-cover-ref"><span>Sendungsreferenz</span><b>';
  const refNew='<div class="rc390-cover-ref rc1203-cover-reference" data-rc1203-reference-highlight="1" style="background:var(--rc1281-ref-bg)!important;border:1.2mm solid var(--rc1281-ref-border)!important;color:var(--rc1281-ref-text)!important;padding:4mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important"><span style="color:var(--rc1281-ref-text)!important">Sendungsreferenz</span><b style="color:var(--rc1281-ref-text)!important">';
  if(block.split(refOld).length-1!==1)throw new Error(file+': RC1281 Referenz-Anker nicht eindeutig');
  block=block.replace(refOld,refNew);

  const dataOld=`<div class="rc390-card"><div class="rc390-label">Sendungsdaten</div><div class="rc390-txt">Zielland: '+esc(country(sh))+'\\nAnzahl: `;
  const dataNew=`<div class="rc390-card" data-rc1281-created-date="1"><div class="rc390-label">Sendungsdaten</div><div class="rc390-txt"><b>Erstellt am: '+esc(created||'–')+'</b>\\nZielland: '+esc(country(sh))+'\\nAnzahl: `;
  if(block.split(dataOld).length-1!==1)throw new Error(file+': RC1281 Sendungsdaten-Anker nicht eindeutig');
  block=block.replace(dataOld,dataNew);

  const dncOld=`<div class="rc390-card" style="grid-column:1/-1"><div class="rc390-label">Lieferscheine / DNCs</div><div class="rc390-txt">'+esc(d.join('\\n')||'–')+'</div></div></div><div class="rc390-cover-qr`;
  const dncNew=`<div class="rc390-card" style="grid-column:1/-1"><div class="rc390-label">Lieferscheine / DNCs</div><div class="rc390-txt">'+esc(d.join('\\n')||'–')+'</div></div><div class="rc390-card rc1203-cover-remark" data-rc1203-cover-remark="1" style="grid-column:1/-1;border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;padding:3.5mm 4mm!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important"><div class="rc390-label" style="font-size:11pt!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.25mm!important;color:#1f2937!important">Bemerkung</div><div class="rc390-txt" style="font-size:12pt!important;line-height:1.25!important;font-weight:700!important;white-space:pre-wrap!important;color:#1f2937!important">'+esc(sh.remark||sh.remarks||sh.bemerkung||sh.comments||sh.comment||sh.note||sh.notes||'–')+'</div></div></div><div class="rc390-cover-qr`;
  if(block.split(dncOld).length-1!==1)throw new Error(file+': RC1281 Bemerkungs-Anker nicht eindeutig');
  block=block.replace(dncOld,dncNew);

  html=html.slice(0,start)+block+html.slice(end);

  const css='<style id="exporthub-rc1203-deckblatt-style">'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover,.rc390-cover.rc1203-cover{box-sizing:border-box!important;border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#fff!important;background-image:none!important;color:#1f2937!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc390-cover-ref,.rc390-cover.rc1203-cover .rc390-cover-ref{background:var(--rc1281-ref-bg)!important;border:1.2mm solid var(--rc1281-ref-border)!important;color:var(--rc1281-ref-text)!important;padding:4mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '.rc390-cover.rc1203-cover .rc390-cover-ref span,.rc390-cover.rc1203-cover .rc390-cover-ref b{color:var(--rc1281-ref-text)!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc1203-cover-recipient,.rc390-cover.rc1203-cover .rc1203-cover-recipient{font-size:16pt!important;line-height:1.24!important;font-weight:750!important;padding:4mm!important;border:1mm solid var(--rc1281-recipient-border)!important;background:var(--rc1281-recipient-bg)!important;color:var(--rc1281-recipient-text)!important}'+
  '.rc390-cover.rc1203-cover .rc1203-cover-recipient strong{font-size:19pt!important;line-height:1.18!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important}.rc390-cover.rc1203-cover .rc1203-cover-recipient .rc390-txt{font-size:18pt!important;line-height:1.25!important;font-weight:800!important;color:var(--rc1281-recipient-text)!important}'+
  '.rc390-cover.rc1203-cover [data-rc1281-created-date]{background:#fff!important;color:#334155!important}'+
  '#rc576DocumentStage .rc390-cover.rc1203-cover .rc1203-cover-remark,.rc390-cover.rc1203-cover .rc1203-cover-remark{border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;padding:3.5mm 4mm!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
  '.rc390-cover.rc1203-cover .rc1203-cover-remark .rc390-label{font-size:11pt!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.25mm!important;color:#1f2937!important}.rc390-cover.rc1203-cover .rc1203-cover-remark .rc390-txt{font-size:12pt!important;line-height:1.25!important;font-weight:700!important;white-space:pre-wrap!important;color:#1f2937!important}'+
  '</style>';
  html=injectDeferredRuntimeInHead(html,css,'exporthub-rc1203-deckblatt-style');

  if(!html.includes('data-rc1203-cover-enhanced="1"'))throw new Error(file+': RC1281 rc390-Cover-Marker fehlt');
  if(!html.includes('data-rc1281-customer-theme='))throw new Error(file+': RC1281 kundenspezifisches Deckblatt-Theme fehlt');
  if(!html.includes('data-rc1281-created-date="1"'))throw new Error(file+': RC1281 Erstellungsdatum fehlt');
  if(!html.includes('background:#fff!important'))throw new Error(file+': RC1281 weißer Deckblatt-Hintergrund fehlt');
  return html
}

function patchShipmentSuspendSave(html,file){
  const anchor="function flushEditSave(reason,keepalive){";
  const replacement="function flushEditSave(reason,keepalive){if(!editSaveReason&&!editSaveTimer&&/vor (?:App-Wechsel|Verlassen)/.test(q(reason)))return true;";
  const count=html.split(anchor).length-1;
  if(count!==1)throw new Error(file+': RC1155 flushEditSave-Anker '+count+'x gefunden');
  html=html.replace(anchor,replacement);
  if(!html.includes("Sendungseingabe vor Verlassen gespeichert"))throw new Error(file+': RC1155 Shipment-pagehide-Anker fehlt');
  if(!html.includes("!editSaveReason&&!editSaveTimer"))throw new Error(file+': RC1155 No-op Suspend-Save Guard fehlt');
  return html
}

function patchTaskDetailTab(html,file){
  const open='<script id="index321-single-navigation-controller">';
  const start=html.indexOf(open),end=start<0?-1:html.indexOf('</script>',start+open.length);
  if(start<0||end<=start)throw new Error(file+': RC1179 Navigationscontroller fehlt');
  let block=html.slice(start,end+'</script>'.length);
  if(!/view:['"]taskdetail['"]/.test(block)){
    const stateAt=block.indexOf('function state(){');
    const itemsAt=stateAt>=0?block.lastIndexOf('var ITEMS=',stateAt):block.indexOf('var ITEMS=');
    if(itemsAt<0)throw new Error(file+': RC1179 ITEMS-Navigation fehlt');
    const arrayStart=block.indexOf('[',itemsAt),arrayEnd=block.indexOf('];',arrayStart);
    if(arrayStart<0||arrayEnd<0)throw new Error(file+': RC1179 ITEMS-Navigation unvollständig');
    let list=block.slice(arrayStart,arrayEnd);
    const taskAt=list.indexOf("view:'tasks'");
    if(taskAt<0)throw new Error(file+': RC1179 Aufgaben-Reiter fehlt');
    const taskEnd=list.indexOf('}',taskAt);
    if(taskEnd<0)throw new Error(file+': RC1179 Aufgaben-Menüeintrag unvollständig');
    const item="{view:'taskdetail',label:'Aufgabenansicht',right:'tasks'}";
    list=list.slice(0,taskEnd+1)+','+item+list.slice(taskEnd+1);
    block=block.slice(0,arrayStart)+list+block.slice(arrayEnd);
  }
  block=block.replace("tasks:'#f59e0b'","tasks:'#f59e0b',taskdetail:'#2563eb'");
  block=block.replace("item.view==='history'?'↺':","item.view==='taskdetail'?'▣':item.view==='history'?'↺':");
  const route=" if(view==='taskdetail'&&window.ExportHUBRC1014TaskRuntime&&typeof window.ExportHUBRC1014TaskRuntime.renderTaskDetailView==='function'){setViewState(view);prepareDirectView(view);var taskDetailRoot=document.getElementById('content');if(taskDetailRoot)taskDetailRoot.innerHTML='';var taskDetailOut=window.ExportHUBRC1014TaskRuntime.renderTaskDetailView();finishDirectView(view);return taskDetailOut}";
  if(!block.includes(route)){
    const historyPos=block.indexOf(" if(view==='history'&&window.ExportHUBRC1081AuditHistory");
    const diagnosticsPos=block.indexOf(" if(view==='diagnostics')");
    const pos=historyPos>=0?historyPos:diagnosticsPos;
    if(pos<0)throw new Error(file+': RC1179 Direktroute konnte nicht eingefügt werden');
    block=block.slice(0,pos)+route+'\n'+block.slice(pos);
  }
  const out=html.slice(0,start)+block+html.slice(end+'</script>'.length);
  if(!/view:['"]taskdetail['"],label:['"]Aufgabenansicht['"],right:['"]tasks['"]/.test(out))throw new Error(file+': RC1179 Aufgabenansicht-Reiter fehlt');
  if(!out.includes("view==='taskdetail'&&window.ExportHUBRC1014TaskRuntime"))throw new Error(file+': RC1179 Aufgabenansicht-Direktroute fehlt');
  return out;
}

function patchRc1259ContainerSearch(html,file){
  const overviewNeedle="attachmentFiles(x).join(' ')].join(' '))}";
  const overviewReplacement="attachmentFiles(x).join(' '),x&&x.sealNumber,x&&x.containerSealNumber,x&&x.siegelnummer].join(' '))}";
  const overviewCount=html.split(overviewNeedle).length-1;
  if(overviewCount<1)throw new Error(file+': RC1259 Sendungsübersicht-Suchanker fehlt');
  html=html.split(overviewNeedle).join(overviewReplacement);

  const viewNeedle="location&&location.name,location&&location.address,docs.map(function(d){return d.name+' '+d.group}).join(' ')].join(' '))}";
  const viewReplacement="location&&location.name,location&&location.address,sh&&sh.sealNumber,sh&&sh.containerSealNumber,sh&&sh.siegelnummer,docs.map(function(d){return d.name+' '+d.group}).join(' ')].join(' '))}";
  const viewCount=html.split(viewNeedle).length-1;
  if(viewCount<1)throw new Error(file+': RC1259 Sendungsansicht-Suchanker fehlt');
  html=html.split(viewNeedle).join(viewReplacement);

  html=html.replace(/Referenz, Kunde, DNC, POD oder ABD suchen/g,'Referenz, Kunde, Siegel, DNC, POD oder ABD suchen');
  html=html.replace(/Kunde, Referenz, Kundennummer oder Anhang suchen …/g,'Kunde, Referenz, Siegelnummer, Kundennummer oder Anhang suchen …');

  const subPayloadNeedle="plannedPickupDate:q(main.plannedPickupDate||main.pickupDate),subShipmentId:key";
  const subPayloadReplacement="plannedPickupDate:q(main.plannedPickupDate||main.pickupDate),transportMode:q(main.transportMode||main.transportType||main.shippingMode),containerDocumentationRequired:main.containerDocumentationRequired===true,subShipmentId:key";
  if(html.includes(subPayloadNeedle))html=html.split(subPayloadNeedle).join(subPayloadReplacement);
  return html;
}

function patchCompletePrintBundle(html,file){
  const loadStart=html.indexOf('function loadHtml(sh,withQr){');
  const loadEnd=loadStart<0?-1:html.indexOf('function documentCacheKey',loadStart);
  if(loadStart<0||loadEnd<0)throw new Error(file+': RC1274 Ladelisten-/CMR-Druckmodul fehlt');
  let block=html.slice(loadStart,loadEnd);

  const copyOld="withQr?'1 / 1 · mit QR-Code':'ohne QR-Code'";
  const copyNew="withQr?'1 / 2 · mit QR-Code':'2 / 2 · ohne QR-Code'";
  if(!block.includes(copyOld)&&!block.includes(copyNew))throw new Error(file+': RC1274 Ladelisten-Seitenkennzeichnung fehlt');
  block=block.replace(copyOld,copyNew);

  const cmrOld="for(var i=1;i<=3;i++){";
  const cmrNew="for(var i=1;i<=4;i++){";
  if(!block.includes(cmrOld)&&!block.includes(cmrNew))throw new Error(file+': RC1274 CMR-Ausfertigungszähler fehlt');
  block=block.replace(cmrOld,cmrNew);
  block=block.replace("CMR '+i+' / 3</div></div>'","CMR '+i+' / 4</div></div>'");

  html=html.slice(0,loadStart)+block+html.slice(loadEnd);

  const bundleOld="+coverHtml(sh)+loadHtml(sh,true)+cmrHtml(sh)+";
  const bundleNew="+coverHtml(sh)+loadHtml(sh,true)+loadHtml(sh,false)+cmrHtml(sh)+";
  if(!html.includes(bundleOld)&&!html.includes(bundleNew))throw new Error(file+': RC1274 Gesamtdruck-Bundle-Anker fehlt');
  html=html.replace(bundleOld,bundleNew);

  const pagesOld="return[d.cover,d.load1].concat(d.cmrs.slice(0,3)).filter(Boolean)";
  const pagesNew="return[d.cover,d.load1,d.load2].concat(d.cmrs.slice(0,4)).filter(Boolean)";
  if(!html.includes(pagesOld)&&!html.includes(pagesNew))throw new Error(file+': RC1274 Gesamtdruck-Seitenauswahl fehlt');
  html=html.replace(pagesOld,pagesNew);

  if(!html.includes("loadHtml(sh,true)+loadHtml(sh,false)+cmrHtml(sh)"))throw new Error(file+': RC1274 L2 fehlt im Gesamtdruck');
  if(!html.includes("return[d.cover,d.load1,d.load2].concat(d.cmrs.slice(0,4)).filter(Boolean)"))throw new Error(file+': RC1274 Druckreihenfolge ist unvollständig');
  if(!html.includes("withQr?'1 / 2 · mit QR-Code':'2 / 2 · ohne QR-Code'"))throw new Error(file+': RC1274 L1/L2-Kennzeichnung fehlt');
  if(!html.includes("for(var i=1;i<=4;i++){")||!html.includes("CMR '+i+' / 4</div></div>'"))throw new Error(file+': RC1274 vier CMR-Ausfertigungen fehlen');
  return html;
}

function patchRc1283LoadingListSearch(html,file){
  const anchor="async function downloadDocument(mode,button){";
  const bridge=`window.__EXPORTHUB_RC1283_OPEN_LOAD1__=function(sh,printNow){try{if(!sh)throw new Error('Keine Ladeliste ausgewählt.');var child=window.open('about:blank','_blank','width=1180,height=860');if(!child){alert('Das Ladelistenfenster wurde vom Browser blockiert.');return false}var styles=Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(function(n){return n.outerHTML}).join(''),body=loadHtml(sh,true),title='Ladeliste '+esc(sref(sh)||sid(sh));child.opener=null;child.document.open();child.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>'+title+'</title>'+styles+'<style>@page{size:A4 portrait;margin:8mm}html,body{background:#fff!important}body{margin:0;padding:0}.rc390-page,.rc352-page{margin:0 auto!important;box-shadow:none!important}</style></head><body>'+body+'</body></html>');child.document.close();if(printNow){var run=function(){try{child.focus();child.print()}catch(e){console.error('RC1283 Ladeliste drucken',e)}};if(child.document.readyState==='complete')setTimeout(run,250);else child.addEventListener('load',function(){setTimeout(run,200)},{once:true})}return true}catch(e){console.error('RC1283 Ladeliste öffnen/drucken',e);alert('Ladeliste konnte nicht geöffnet werden: '+String(e&&e.message||e));return false}}\nwindow.__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__=async function(sh){try{if(!sh)throw new Error('Keine Ladeliste ausgewählt.');var out=await createPdf('load1',sh),name=('Ladeliste_'+(sref(sh)||sid(sh)||'Sendung')+'.pdf').replace(/[^A-Za-z0-9._-]+/g,'_');downloadBlob(out.blob,name);return true}catch(e){console.error('RC1283 Ladeliste herunterladen',e);alert('Ladeliste konnte nicht heruntergeladen werden: '+String(e&&e.message||e));return false}}`;
  const count=html.split(anchor).length-1;
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__')){
    if(count!==1)throw new Error(file+': RC1283 Ladelisten-Druckanker '+count+'x gefunden');
    html=html.replace(anchor,bridge+'\n'+anchor);
  }
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1283-loading-list-search" defer src="/assets/rc1283-loading-list-search.js?v=1285"></script>','exporthub-rc1283-loading-list-search');
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Öffnen/Drucken-Bridge fehlt');
  if(!html.includes('__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Download-Bridge fehlt');
  if(!html.includes('assets/rc1283-loading-list-search.js?v=1285'))throw new Error(file+': RC1283 Ladelisten-Suche fehlt');
  return html;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchDemoTestPortalIsolation(html,file);
  html=patchAuthSessionTimeout(html,file);
  html=patchMainCountryDetection(html,file);
  html=patchRc1206ShippingRules(html,file);
  html=patchNotificationTasks(html,file);
  html=patchTaskMasterSaveScope(html,file);
  html=patchTaskDetailTab(html,file);
  html=patchRc1259ContainerSearch(html,file);
  html=patchCompletePrintBundle(html,file);
  html=patchRc1283LoadingListSearch(html,file);
  html=patchDeckblattHighVisibility(html,file);
  html=patchRc1203ActualDeckblatt(html,file);
  html=patchShipmentSuspendSave(html,file);
  html=html.replace(/ExportHUB RC1048 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1048',cache:'1048',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1048/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1048(['"])/g,`$1${VERSION}$2`);
  html=html.replaceAll(LEGACY_TESTSERVICE_HOST,CURRENT_TESTSERVICE_HOST);
  html=html.replace(/assets\/rc1074-login-clean\.js\?v=1074/g,'assets/rc1074-login-clean.js?v=1112');
  html=html.replace(/assets\/rc1014-task-runtime\.js\?v=1016/g,'assets/rc1014-task-runtime.js?v=1266');
  html=html.replace(/assets\/rc1014-task-ui\.css\?v=1016/g,'assets/rc1014-task-ui.css?v=1179');
  html=html.replace(/assets\/rc1013-diagnostics\.js\?v=1085/g,'assets/rc1013-diagnostics.js?v=1125');
  html=html.replace(/assets\/exporthub-environment-hub\.js\?v=\d+/g,'assets/exporthub-environment-hub.js?v=1174');
  html=html.replace(/assets\/rc1081-audit-history\.js\?v=(?:1087|1126|1160|1163)/g,'assets/rc1081-audit-history.js?v=1177');
  html=html.replace(/assets\/rc1071-shipment-history\.js\?v=(?:1095|1151)/g,'assets/rc1071-shipment-history.js?v=1178');
  html=html.replace(/assets\/rc1063-abd-blob-viewer-compat\.js\?v=(?:1063|1151|1248)/g,'assets/rc1063-abd-blob-viewer-compat.js?v=1248');
  html=injectDeferredRuntimeInHead(html,'<!-- id="exporthub-rc1148-history-compat-marker" assets/rc1071-shipment-history.js?v=1095 -->','exporthub-rc1148-history-compat-marker');
  html=injectDeferredRuntimeInHead(html,RC1267_I18N_TAG,'exporthub-rc1267-i18n');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1126-customer-delete" defer src="/assets/rc1126-customer-delete.js?v=1126"></script>','exporthub-rc1126-customer-delete');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1113-stowplan-persist" defer src="/assets/rc1113-stowplan-persist.js?v=1113"></script>','exporthub-rc1113-stowplan-persist');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1114-shipping-neutral" defer src="/assets/rc1114-shipping-neutral.js?v=1114"></script>','exporthub-rc1114-shipping-neutral');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1133-avis-upload-notifications" defer src="/assets/rc1133-avis-upload-notifications.js?v=1133"></script>','exporthub-rc1133-avis-upload-notifications');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1160-customer-portal" defer src="/assets/rc1160-customer-portal-credentials.js?v=1162"></script>','exporthub-rc1160-customer-portal');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1165-pod-backup-status" defer src="/assets/rc1165-pod-backup-status.js?v=1165"></script>','exporthub-rc1165-pod-backup-status');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1166-avis-reminder" defer src="/assets/rc1166-avis-reminder-overview.js?v=1207"></script>','exporthub-rc1166-avis-reminder');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1176-shipment-location" defer src="/assets/rc1176-shipment-location.js?v=1202"></script>','exporthub-rc1176-shipment-location');
  html=injectDeferredRuntimeInHead(html,'<link id="exporthub-rc1259-container-ui" rel="stylesheet" href="/assets/rc1014-shipment-overview.css?v=1284">','exporthub-rc1259-container-ui');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1259-container-runtime" defer src="/assets/rc1014-shipment-overview.js?v=1284"></script>','exporthub-rc1259-container-runtime');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1203-deckblatt-print" defer src="/assets/rc1203-deckblatt-print.js?v=1281"></script>','exporthub-rc1203-deckblatt-print');
  html=injectDeferredRuntimeInHead(html,'<script id="exporthub-rc1207-pallet-account-fix" defer src="/assets/rc1207-pallet-account-fix.js?v=1246"></script>','exporthub-rc1207-pallet-account-fix');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1193-visible-release" defer src="/assets/rc1193-visible-release.js?v=${VISIBLE_NUMBER}"></script>`,'exporthub-rc1193-visible-release');
  html=injectDeferredRuntimeInHead(html,`<script id="exporthub-rc1177-release-notes" defer src="/assets/rc1177-release-notes.js?v=${VISIBLE_NUMBER}"></script>`,'exporthub-rc1177-release-notes');
  if(!html.includes('assets/rc1014-shipment-overview.css?v=1284'))throw new Error(file+': RC1259 Container-CSS fehlt');
  if(!html.includes('assets/rc1014-shipment-overview.js?v=1284'))throw new Error(file+': RC1259 Container-Runtime fehlt');
  if(!html.includes('x&&x.sealNumber')||!html.includes('sh&&sh.sealNumber'))throw new Error(file+': RC1259 Siegelnummer ist nicht in beiden Sendungssuchen');
  if(html.includes(LEGACY_TESTSERVICE_HOST))throw new Error(file+': alter TESTSERVICE-Endpunkt ist noch aktiv');
  if(!html.includes(CURRENT_TESTSERVICE_HOST))throw new Error(file+': aktueller TESTSERVICE-Endpunkt fehlt');
  if(!html.includes(`version:'${VERSION}'`))throw new Error(file+': BUILD '+VERSION+' fehlt');
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(file+': Environment '+VERSION+' fehlt');
  if(!html.includes('assets/rc1074-login-clean.js?v=1112'))throw new Error(file+': RC1112 ABD/Login Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-runtime.js?v=1266'))throw new Error(file+': RC1266 Aufgaben-Runtime Cache-Key fehlt');
  if(!html.includes('assets/rc1014-task-ui.css?v=1179'))throw new Error(file+': RC1152 Aufgaben-CSS Cache-Key fehlt');
  if(!html.includes('assets/rc1013-diagnostics.js?v=1125'))throw new Error(file+': RC1125 Diagnose Cache-Key fehlt');
  if(!html.includes('assets/exporthub-environment-hub.js?v=1174'))throw new Error(file+': RC1174 Android-Diagnose-Hub Cache-Key fehlt');
  if(!html.includes('assets/rc1081-audit-history.js?v=1177'))throw new Error(file+': RC1177 Historie Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1178'))throw new Error(file+': RC1178 Druck-History Cache-Key fehlt');
  if(file!=='demo.html'&&!html.includes('assets/rc1063-abd-blob-viewer-compat.js?v=1248'))throw new Error(file+': RC1248 Dokumentaktionen Cache-Key fehlt');
  if(!html.includes('assets/rc1071-shipment-history.js?v=1095'))throw new Error(file+': RC1148 History-Kompatibilitätsmarker fehlt');
  if(!html.includes('assets/rc1126-customer-delete.js?v=1126'))throw new Error(file+': RC1126 Kundenlöschung fehlt');
  if(!html.includes('assets/rc1113-stowplan-persist.js?v=1113'))throw new Error(file+': RC1113 Stauplan-Erweiterung fehlt');
  if(!html.includes('assets/rc1114-shipping-neutral.js?v=1114'))throw new Error(file+': RC1114 neutrale Versandkostenoberfläche fehlt');
  if(!html.includes('assets/rc1133-avis-upload-notifications.js?v=1133'))throw new Error(file+': RC1133 AVIS-Upload-Benachrichtigungen fehlen');
  if(!html.includes('assets/rc1160-customer-portal-credentials.js?v=1162'))throw new Error(file+': RC1160 Kundenportal-Runtime fehlt');
  if(!html.includes('assets/rc1165-pod-backup-status.js?v=1165'))throw new Error(file+': RC1165 POD-Sicherungsstatus-Runtime fehlt');
  if(!html.includes('assets/rc1166-avis-reminder-overview.js?v=1207'))throw new Error(file+': RC1207 Avis-Erinnerung-Runtime fehlt');
  if(!html.includes('assets/rc1176-shipment-location.js?v=1202'))throw new Error(file+': RC1191 Standort-Capture-Runtime fehlt');
  if(!html.includes('assets/rc1203-deckblatt-print.js?v=1281'))throw new Error(file+': RC1205 Deckblatt-Runtime fehlt');
  if(!html.includes('assets/rc1283-loading-list-search.js?v=1285'))throw new Error(file+': RC1283 Ladelisten-Suchruntime fehlt');
  if(!html.includes('__EXPORTHUB_RC1283_OPEN_LOAD1__'))throw new Error(file+': RC1283 Ladelisten-Öffnen/Drucken-Bridge fehlt');
  if(!html.includes('assets/rc1207-pallet-account-fix.js?v=1246'))throw new Error(file+': RC1207 Palettenkonto-Runtime fehlt');
  if(!html.includes('assets/rc1193-visible-release.js?v='+VISIBLE_NUMBER))throw new Error(file+': '+VISIBLE_VERSION+' sichtbare Release-Version fehlt');
  if(!html.includes('assets/rc1177-release-notes.js?v='+VISIBLE_NUMBER))throw new Error(file+': '+VISIBLE_VERSION+' Änderungshinweise Cache-Key fehlt');
  if(!/\.rc352-cover\{[^}]*border:10mm solid #08245d!important;[^}]*border-top-width:18mm!important;/.test(html))throw new Error(file+': RC1133 Deckblatt-Rahmen fehlt');
  if(!/\.rc352-cover-ref\{(?=[^}]*background:#facc15)(?=[^}]*border:3mm solid #111827)[^}]*\}/.test(html))throw new Error(file+': RC1159 Deckblatt-Referenzfeld ist nicht ausreichend hervorgehoben');
  if(/\\\\n\.rc352-qr-slot\.empty/.test(html))throw new Error(file+': RC1133 Deckblatt-CSS enthält literalen \\n-Text');
  if(file==='demo.html'){
    if(!html.includes("namedTest=/-testservice\\./i.test(h)&&window.__EXPORTHUB_DEMO_MODE__!==true;"))throw new Error(file+': RC1131 Demo/Testservice-Origin nicht getrennt');
    if(!html.includes('if(window.__EXPORTHUB_DEMO_MODE__===true)return;'))throw new Error(file+': RC1131 Testportal-Runtime ist in Demo noch aktiv');
    if(!html.includes('window.__EXPORTHUB_DEMO_MODE__===true||window.__EXPORTHUB_PICKUP_MODE__'))throw new Error(file+': RC1131 Demo-Routenanker fehlt');
  }
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
const currentApi=path.join(ROOT,'api'),builtApi=path.join(OUT,'api');
if(!fs.existsSync(currentApi))throw new Error('Aktuelles API-Verzeichnis fehlt');
fs.mkdirSync(builtApi,{recursive:true});
fs.cpSync(currentApi,builtApi,{recursive:true,force:true});
fs.mkdirSync(path.join(OUT,'assets'),{recursive:true});
fs.copyFileSync(path.join(ROOT,'assets/rc1267-i18n.js'),path.join(OUT,'assets/rc1267-i18n.js'));
fs.cpSync(path.join(ROOT,'assets/i18n'),path.join(OUT,'assets/i18n'),{recursive:true,force:true});
for(const rel of [
  'assets/rc1014-shipment-overview.js',
  'assets/rc1014-shipment-overview.css',
  'assets/rc1027-lieferavis-immediate.js',
  'assets/rc1037-lieferavis-timing-diagnostics.js',
  'assets/exporthub-environment-hub.js',
  'assets/rc1049-abd-avis-policy.js',
  'assets/rc1014-task-runtime.js',
  'assets/rc1014-task-ui.css',
  'assets/rc1126-customer-delete.js',
  'assets/rc1133-avis-upload-notifications.js',
  'assets/rc1081-audit-history.js',
  'assets/rc1160-customer-portal-credentials.js',
  'assets/rc1165-pod-backup-status.js',
  'assets/rc1166-avis-reminder-overview.js',
  'assets/rc1176-shipment-location.js',
  'assets/rc1203-deckblatt-print.js',
  'assets/rc1283-loading-list-search.js',
  'assets/rc1177-release-notes.js',
  'assets/rc1193-visible-release.js'
]){
  const src=path.join(ROOT,rel),dst=path.join(OUT,rel);
  if(!fs.existsSync(src))throw new Error('RC1124 Pflicht-Runtime fehlt: '+rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
  if(!fs.existsSync(dst)||fs.statSync(dst).size===0)throw new Error('RC1124 Pflicht-Runtime wurde nicht gebaut: '+rel);
}
const environmentHubBuilt=fs.readFileSync(path.join(OUT,'assets','exporthub-environment-hub.js'),'utf8');
if(!environmentHubBuilt.includes("android.time")||!environmentHubBuilt.includes("android.diagnosticTitle"))throw new Error('RC1287 lokalisierter Android-Diagnose-Hub fehlt im finalen Build');
const visibleRuntimeFile=path.join(OUT,'assets','rc1193-visible-release.js');
let visibleRuntime=fs.readFileSync(visibleRuntimeFile,'utf8');
if(!/var VERSION='RC\d+';/.test(visibleRuntime))throw new Error('RC1265 sichtbare Release-Runtime enthält keinen ersetzbaren Versionsanker');
visibleRuntime=visibleRuntime.replace(/var VERSION='RC\d+';/,`var VERSION='${VISIBLE_VERSION}';`);
fs.writeFileSync(visibleRuntimeFile,visibleRuntime);

const releaseNotesFile=path.join(OUT,'assets','rc1177-release-notes.js');
let releaseNotes=fs.readFileSync(releaseNotesFile,'utf8');
releaseNotes=releaseNotes.replace(/return'RC\d+'/,`return'${VISIBLE_VERSION}'`);
fs.writeFileSync(releaseNotesFile,releaseNotes);

for(const requiredApi of ['shared/pod-archive.js','shared/graph-drive.js','shared/container-document-store.js','shared/reference-folder-upload.js','shared/customer-portal-store.js','customer-portal-credentials/index.js','customer-portal-credentials/function.json','customer-portal-readiness/index.js','customer-portal-readiness/function.json','avis-upload-mail-readiness/index.js','avis-upload-mail-readiness/function.json','pickup-confirm-v2/index.js','pickup-container-document/index.js','pickup-container-document/function.json','container-document/index.js','container-document/function.json','pod-backup/index.js','avis-reminder-mail/index.js','avis-reminder-mail/function.json','shared/graph-mail.js','package.json']){
  if(!fs.existsSync(path.join(builtApi,requiredApi)))throw new Error('RC1114 API-Datei fehlt im Build: '+requiredApi);
}
const rc1114PickupSource=path.join(ROOT,'pickup.html');
if(!fs.existsSync(rc1114PickupSource))throw new Error('RC1114 pickup.html fehlt');
fs.copyFileSync(rc1114PickupSource,path.join(OUT,'pickup.html'));
const rc1113StowSrc=path.join(ROOT,'assets','rc1113-stowplan-persist.js');
const rc1113StowOut=path.join(OUT,'assets','rc1113-stowplan-persist.js');
if(!fs.existsSync(rc1113StowSrc))throw new Error('RC1113 Stauplan-Runtime fehlt');
fs.mkdirSync(path.dirname(rc1113StowOut),{recursive:true});
fs.copyFileSync(rc1113StowSrc,rc1113StowOut);
const rc1114ShippingSrc=path.join(ROOT,'assets','rc1114-shipping-neutral.js');
const rc1114ShippingOut=path.join(OUT,'assets','rc1114-shipping-neutral.js');
if(!fs.existsSync(rc1114ShippingSrc))throw new Error('RC1114 Versandkosten-Runtime fehlt');
fs.copyFileSync(rc1114ShippingSrc,rc1114ShippingOut);
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);
// RC1267 public pages: central language runtime must load before the legacy compatibility runtime.
for(const file of ['customer-avis.html','pickup.html','location.html','pod-notfall.html']){
  const target=path.join(OUT,file);if(!fs.existsSync(target))continue;
  let publicHtml=fs.readFileSync(target,'utf8');
  if(!publicHtml.includes('exporthub-rc1267-i18n')){
    const marker='id="exporthub-rc1018-public-language"',at=publicHtml.indexOf(marker);
    if(at>=0){const start=publicHtml.lastIndexOf('<script',at);publicHtml=publicHtml.slice(0,start)+RC1267_I18N_TAG+'\n'+publicHtml.slice(start)}
    else publicHtml=publicHtml.replace('</head>',RC1267_I18N_TAG+'\n</head>');
    fs.writeFileSync(target,publicHtml);
  }
}

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1048'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1112 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1048-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1112-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1112-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1048',
  sourceManifest:previousManifest,
  releaseFixes:{
    visibleVersion:VISIBLE_VERSION,
    taskDetailAndManagedRoster:'RC1179 dedicated Aufgabenansicht tab + RC1152 recurring roster + targeted legacy cleanup',
    abdDashboardCustomer:true,
    androidBuildSetup:'runner-sdkmanager',
    loginAbdAssetCache:'1112',
    stowPlanInstructionsAndPersistence:'RC1113',
    shippingProviderNeutralUi:'RC1114',
    podReliability:'RC1220 Azure primary + immutable Azure archive; M365 optional',
    podGraphReadiness:'RC1220 Graph optional; Azure archive is release-critical secondary backup',
    podTargetFailClosed:'RC1195 explicit drive user + folder required, no personal OneDrive fallback',
    podBackupStatusUi:'RC1220 shipment overview Azure/archive backup status',
    podTargetedProof:'RC1220 targeted archive proof: found/already-saved/saved-now/not-found/pending',
    podArchiveIntegrity:'RC1226 archive read-back + scheduled integrity verification',
    containerDocumentation:'RC1259 sea freight container seal + 3 QR photos + reference-folder storage + shipment overview download',
    avisReminderOverview:'RC1207 DE/EN customer/carrier reminder via stored contacts + secure avis link',
    avisUploadNotifications:'RC1133 secure customer PDF notice + open/print action',
    documentActionHistory:'RC1178 print/open/download + user + filename, including resumed print flow',
    deckblattHighVisibility:'RC1281 white cover + Essentra yellow / customer blue reference + lighter recipient + shipment created date',
    loadingListSearch:'RC1283 search by reference/customer/attachment/remark + open/print/download',
    coverOnlyPrint:'RC1205 single Nur Deckblatt drucken action inside Speichern & Ausgabe',
    palletAccountDirectionAndAdminDelete:'RC1207 visible direction is saved, admin tombstone delete, one-time production cleanup 2026-09-21',
    coverRemark:'RC1281 compact remark block above QR without overlap',
    customerPortalCredentials:'RC1160 AES-256-GCM + re-auth + use/manage rights',
    customerPortalReadiness:'RC1162 safe key-status + UI readiness guard',
    avisAppointmentRevisionHistory:'RC1163 old/new pickup appointment history before actual pickup',
    diagnosticsNonAdminProof:'RC1169 live non-admin rights view + diagnostics-read 403',
    customerPortalReleaseReadiness:'RC1170 OIDC live configured=true gate in TESTSERVICE and PRODUCTION',
    customerPortalKeyStrength:'RC1187 minimum 32 characters, fail-closed before portal use and production release',
    customerPortalKeyDiagnostics:'RC1194 safe missing-vs-too-short readiness without secret or exact length disclosure',
    shipmentCreateUiE2E:'RC1171 UI customer + location + reference + colli + save + reload + overview',
    testserviceGateOrder:'RC1172 browser/mutation gate before external readiness blocker, production still protected',
    shipmentLocationPersistence:'RC1202 current draft priority + synthetic empty rerender guard',
    historyConsolidationAndReleaseNotes:'RC1177 duplicate shipment history cleanup + current Update changelog',
    visibleProductVersion:VISIBLE_VERSION+' current visible release label while RC1112 remains the stable build/deploy pipeline'
  },
  compatibility:{
    qr:'stable-existing-links',
    historicalBuildPath:'RC1048 preserved'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');


const rc1206Source=path.join(ROOT,'assets/rc1206-shipping-rules.js'),rc1206Target=path.join(OUT,'assets/rc1206-shipping-rules.js');
if(!fs.existsSync(rc1206Source))throw new Error('RC1206 Versandkosten-Runtime fehlt');
fs.mkdirSync(path.dirname(rc1206Target),{recursive:true});fs.copyFileSync(rc1206Source,rc1206Target);

const rc1207Source=path.join(ROOT,'assets/rc1207-pallet-account-fix.js'),rc1207Target=path.join(OUT,'assets/rc1207-pallet-account-fix.js');
if(!fs.existsSync(rc1207Source))throw new Error('RC1207 Palettenkonto-Runtime fehlt');
fs.copyFileSync(rc1207Source,rc1207Target);

console.log('RC1112 build pipeline ready: sichtbare Produktversion '+VISIBLE_VERSION+' auf geprüfter RC1048-Basis, RC1194 sichere Kundenportal-Key-Diagnose aktiv.');
