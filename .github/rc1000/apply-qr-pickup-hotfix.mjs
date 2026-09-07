import fs from 'node:fs';

const targets = ['index.html', 'TESTVERSION.html'];

const oldPrintRegistration = "try{if(qr.eligible(sh)&&sh.pickupQrRegistered!==true&&typeof qr.register==='function')Promise.resolve(qr.register(sh,false)).catch(function(){})}catch(_){}}";
const newPrintRegistration = "try{if(qr.eligible(sh)&&sh.pickupQrRegistered!==true&&typeof qr.register==='function'){var pickupReady=await timed(Promise.resolve(qr.register(sh,false)),28000,'QR-Abholung konnte nicht rechtzeitig serverseitig registriert werden.');var pickupToken=q(sh.pickupToken||sh.pickupQrToken||sh.qrToken);if(pickupReady!==true||sh.pickupQrRegistered!==true||!/^[a-f0-9]{48}$/i.test(pickupToken))throw new Error('QR-Abholung konnte nicht serverseitig registriert werden. Bitte Verbindung prüfen und erneut drucken.')}}catch(e){throw e}}";

for (const file of targets) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(oldPrintRegistration)) {
    if (text.includes(newPrintRegistration)) continue;
    throw new Error(`${file}: erwarteter asynchroner QR-Druckpfad nicht gefunden`);
  }
  text = text.replace(oldPrintRegistration, newPrintRegistration);
  fs.writeFileSync(file, text);
}

const pickupFile = 'pickup.html';
let pickup = fs.readFileSync(pickupFile, 'utf8');
const oldRouter = "function tokenFromUrl(u){var hash='';try{hash=decodeURIComponent(String(u.hash||'').replace(/^#/,''))}catch(_){hash=String(u.hash||'').replace(/^#/,'')}var hm=hash.match(/(?:^|[\\/?&])pickup(?:=|\\/)([A-Za-z0-9_-]{6,128})(?:$|[&\\/?])/i)||hash.match(/^pickup=([A-Za-z0-9_-]{6,128})$/i),pm=String(u.pathname||'').match(/\\/pickup(?:\\.html)?\\/([A-Za-z0-9_-]{6,128})\\/?$/i),legacy=/^pickup$/i.test(q(u.searchParams.get('ehcmd'))),list=[u.searchParams.get('pickup'),u.searchParams.get('token'),legacy&&u.searchParams.get('ref'),pm&&pm[1],hm&&hm[1]];for(var i=0;i<list.length;i++)if(/^[A-Za-z0-9_-]{6,128}$/.test(q(list[i])))return q(list[i]);return''}";
const newRouter = "function tokenFromUrl(u){var hash='';try{hash=decodeURIComponent(String(u.hash||'').replace(/^#/,''))}catch(_){hash=String(u.hash||'').replace(/^#/,'')}var hm=hash.match(/(?:^|[\\/?&])pickup(?:=|\\/)([a-f0-9]{48})(?:$|[&\\/?])/i)||hash.match(/^pickup=([a-f0-9]{48})$/i),pm=String(u.pathname||'').match(/\\/pickup(?:\\.html)?\\/([a-f0-9]{48})\\/?$/i),list=[u.searchParams.get('pickup'),u.searchParams.get('token'),pm&&pm[1],hm&&hm[1]];for(var i=0;i<list.length;i++)if(/^[a-f0-9]{48}$/i.test(q(list[i])))return q(list[i]);return''}";
if (pickup.includes(oldRouter)) {
  pickup = pickup.replace(oldRouter, newRouter);
} else if (!pickup.includes(newRouter)) {
  throw new Error('pickup.html: erwarteter Token-Router nicht gefunden');
}
fs.writeFileSync(pickupFile, pickup);

console.log('RC1000 QR-Abholung Hotfix materialisiert.');
