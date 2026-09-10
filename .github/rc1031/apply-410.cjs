'use strict';
const fs=require('fs');
const path='TESTVERSION.html';
let source=fs.readFileSync(path,'utf8');
function replaceOnce(before,after,label){const first=source.indexOf(before);if(first<0)throw new Error('RC1031 410 Patchanker fehlt: '+label);if(source.indexOf(before,first+before.length)>=0)throw new Error('RC1031 410 Patchanker nicht eindeutig: '+label);source=source.slice(0,first)+after+source.slice(first+before.length)}
replaceOnce(
"catch(e){if(e&&e.status===404){serverMissUntil[token]=Date.now()+10*60*1000;misses++;continue}lastError=q(e&&e.message||e)}",
"catch(e){if(e&&e.status===410){serverMissUntil[token]=Number.MAX_SAFE_INTEGER;misses++;continue}if(e&&e.status===404){serverMissUntil[token]=Date.now()+10*60*1000;misses++;continue}lastError=q(e&&e.message||e)}",
'pickup-status 410 backoff'
);
replaceOnce(
"patchCopies(sh,{pickupQrRegistered:true,pickupQrActivating:false,pickupQrRegisteredAt:new Date().toISOString(),pickupQrServerStatus:'open',pickupQrError:'',pickupQrDisabled:false,pickupQrUsed:false,qrPickupConfirmed:false,pickupConfirmed:false,pickupCompleted:false,remotePickupStatusLocked:false});save('Falschen QR-Scan serverseitig zurückgesetzt');return true",
"patchCopies(sh,{pickupQrRegistered:true,pickupQrActivating:false,pickupQrRegisteredAt:new Date().toISOString(),pickupQrServerStatus:'open',pickupQrError:'',pickupQrDisabled:false,pickupQrUsed:false,qrPickupConfirmed:false,pickupConfirmed:false,pickupCompleted:false,remotePickupStatusLocked:false});delete serverMissUntil[token];delete lastSync[token];save('Falschen QR-Scan serverseitig zurückgesetzt');return true",
'pickup reset clears 410 backoff'
);
fs.writeFileSync(path,source);
console.log('RC1031 pickup-status 410 Backoff angewendet.');
