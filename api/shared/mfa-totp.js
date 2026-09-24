'use strict';
const crypto=require('crypto');

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function text(v){return String(v==null?'':v).trim()}
function encodeBase32(buffer){
 let bits=0,value=0,out='';
 for(const byte of Buffer.from(buffer)){
  value=(value<<8)|byte;bits+=8;
  while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5}
 }
 if(bits>0)out+=ALPHABET[(value<<(5-bits))&31];
 return out
}
function decodeBase32(value){
 const raw=text(value).replace(/=+$/,'').replace(/\s+/g,'').toUpperCase();
 let bits=0,acc=0,out=[];
 for(const ch of raw){
  const n=ALPHABET.indexOf(ch);if(n<0)throw new Error('MFA_SECRET_INVALID');
  acc=(acc<<5)|n;bits+=5;
  if(bits>=8){out.push((acc>>>(bits-8))&255);bits-=8}
 }
 return Buffer.from(out)
}
function generateSecret(){return encodeBase32(crypto.randomBytes(20))}
function counterBuffer(counter){
 const b=Buffer.alloc(8);let n=BigInt(counter);
 for(let i=7;i>=0;i--){b[i]=Number(n&255n);n>>=8n}
 return b
}
function codeForCounter(secret,counter){
 const h=crypto.createHmac('sha1',decodeBase32(secret)).update(counterBuffer(counter)).digest();
 const o=h[h.length-1]&15;
 const n=((h[o]&127)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255);
 return String(n%1000000).padStart(6,'0')
}
function verifyCode(secret,code,nowMs=Date.now(),lastCounter=-1){
 const candidate=text(code).replace(/\s+/g,'');
 if(!/^\d{6}$/.test(candidate))return null;
 const current=Math.floor(Number(nowMs)/30000);
 for(let delta=-1;delta<=1;delta++){
  const counter=current+delta;if(counter<=Number(lastCounter||-1))continue;
  const expected=codeForCounter(secret,counter);
  const a=Buffer.from(expected),b=Buffer.from(candidate);
  if(a.length===b.length&&crypto.timingSafeEqual(a,b))return counter
 }
 return null
}
function key(rootSecret){
 const root=text(rootSecret);if(!root)throw new Error('MFA_KEY_MISSING');
 return crypto.createHash('sha256').update('ExportHUB/mfa/v1|'+root).digest()
}
function sealSecret(secret,rootSecret){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(rootSecret),iv);
 const data=Buffer.concat([cipher.update(text(secret),'utf8'),cipher.final()]);
 return{v:1,alg:'aes-256-gcm',iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:data.toString('base64url')}
}
function openSecret(record,rootSecret){
 if(!record||Number(record.v)!==1||record.alg!=='aes-256-gcm')throw new Error('MFA_SECRET_INVALID');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key(rootSecret),Buffer.from(record.iv,'base64url'));
 decipher.setAuthTag(Buffer.from(record.tag,'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(record.data,'base64url')),decipher.final()]).toString('utf8')
}
function enrollmentUri(username,secret){
 const label='ExportHUB:'+text(username);
 return 'otpauth://totp/'+encodeURIComponent(label)+'?secret='+encodeURIComponent(text(secret))+'&issuer=ExportHUB&algorithm=SHA1&digits=6&period=30'
}
module.exports={encodeBase32,decodeBase32,generateSecret,codeForCounter,verifyCode,sealSecret,openSecret,enrollmentUri};
