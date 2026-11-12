'use strict';
// Urgent Order capability tokens are bearer credentials. Never log, persist,
// derive from an email address or expose an unscoped public order listing.
const crypto=require('node:crypto');
const TOKEN_PATTERN=/^uro_[A-Za-z0-9_-]{43}$/;
function hashToken(value){
 return crypto.createHash('sha256').update('ExportHUB360|urgent-reporter|v1|'+String(value)).digest('hex');
}
function issue(){
 const token='uro_'+crypto.randomBytes(32).toString('base64url');
 return{token,tokenHash:hashToken(token),id:crypto.randomUUID()};
}
function groupByToken(doc,value){
 const token=String(value==null?'':value).trim();
 if(!TOKEN_PATTERN.test(token))return null;
 const hashed=hashToken(token);
 return(doc.reporterGroups||[]).find(group=>group&&typeof group.tokenHash==='string'&&group.tokenHash===hashed)||null;
}
function extractToken(value){
 const raw=String(value==null?'':value).trim();
 if(TOKEN_PATTERN.test(raw))return raw;
 try{
  const link=new URL(raw);
  if(link.protocol!=='https:'||link.username||link.password||link.search||link.pathname!=='/urgent-order')return '';
  const fragment=/^#access=(uro_[A-Za-z0-9_-]{43})$/.exec(link.hash);
  return fragment?fragment[1]:'';
 }catch(_){return'';}
}
module.exports={hashToken,issue,groupByToken,extractToken};
