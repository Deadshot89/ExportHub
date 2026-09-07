import fs from 'node:fs';

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s,'utf8')}

function patchHtml(path){
  let s=read(path);
  const before=s;
  s=s.replace(/\|\|\(directTokens\(x\)\.length>0&&!!q\(x\.pickupQrCreatedAt\)\)/g,'');
  s=s.replace(/\|\|\(directTokens\(sh\)\.length>0&&!!q\(sh\.pickupQrCreatedAt\)\)/g,'');
  if(s===before) throw new Error(`${path}: historicalQr-Anker nicht gefunden`);
  if(/function historicalQr\(sh\)[\s\S]{0,700}pickupQrCreatedAt/.test(s)) throw new Error(`${path}: pickupQrCreatedAt ist in historicalQr noch aktiv`);
  write(path,s);
}

function patchAccess(path){
  let s=read(path);
  const old="const token=crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind),createdAt=now()";
  const repl="const requestedToken=text(payload&&payload.token||meta&&meta.token||'').toLowerCase(),token=/^[a-f0-9]{48}$/.test(requestedToken)?requestedToken:crypto.randomBytes(24).toString('hex'),tokenHash=hashToken(token,env,kind),createdAt=now()";
  if(!s.includes(old)) throw new Error(`${path}: Token-Anker nicht gefunden`);
  s=s.replace(old,repl);
  write(path,s);
}

function patchRc995Apply(){
  const path='.github/rc995/apply.py';
  let s=read(path);
  const old='s=s.replace(old,"crypto.randomBytes(24).toString(\'hex\')",1)';
  const repl='s=s.replace(old,"((payload&&/^[a-f0-9]{48}$/i.test(text(payload.token))?text(payload.token).toLowerCase():crypto.randomBytes(24).toString(\'hex\')))",1)';
  if(!s.includes(old)) throw new Error(`${path}: RC995 Token-Patch-Anker nicht gefunden`);
  s=s.replace(old,repl);
  write(path,s);
}

patchHtml('index.html');
patchHtml('TESTVERSION.html');
patchAccess('api/shared/public-access-store.js');
patchRc995Apply();
console.log('RC1000 Pickup-Token-Race-Fix angewendet');
