import fs from 'node:fs';

function patchHtml(file){
  let s=fs.readFileSync(file,'utf8');
  s=s.replace(/\|\|\(directTokens\(x\)\.length>0&&!!q\(x\.pickupQrCreatedAt\)\)/g,'');
  s=s.replace(/\|\|\(directTokens\(sh\)\.length>0&&!!q\(sh\.pickupQrCreatedAt\)\)/g,'');
  const start=s.indexOf('function historicalQr(sh)');
  if(start<0)throw new Error(file+': historicalQr fehlt');
  if(/pickupQrCreatedAt/.test(s.slice(start,start+700)))throw new Error(file+': pickupQrCreatedAt ist in historicalQr noch aktiv');
  fs.writeFileSync(file,s,'utf8');
}

function patchAccess(file){
  let s=fs.readFileSync(file,'utf8');
  const old="const token=crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind),createdAt=now(),ttl=";
  const initial="const requestedToken=text(payload&&payload.token||meta&&meta.token||'').toLowerCase(),token=/^[a-f0-9]{48}$/.test(requestedToken)?requestedToken:crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind),createdAt=now(),ttl=";
  const robust="const requestedToken=text(payload&&payload.token||meta&&meta.token||'').toLowerCase();\n  let token=/^[a-f0-9]{48}$/.test(requestedToken)?requestedToken:crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind);\n  if(old.value&&old.value.tokenHash===tokenHash){token=crypto.randomBytes(24).toString('hex');tokenHash=hashToken(token,env,kind)}\n  const createdAt=now(),ttl=";
  if(s.includes(old))s=s.replace(old,robust);
  else if(s.includes(initial))s=s.replace(initial,robust);
  if(!s.includes('requestedToken')||!s.includes('old.value&&old.value.tokenHash===tokenHash'))throw new Error(file+': Token-Neuausgabe-Fix fehlt');
  fs.writeFileSync(file,s,'utf8');
}

patchHtml('index.html');
patchHtml('TESTVERSION.html');
patchAccess('api/shared/public-access-store.js');
console.log('RC1000 Produktions-QR Fix angewendet');
