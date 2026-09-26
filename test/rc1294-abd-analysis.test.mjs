import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
const parser=require('../api/shared/abd-analysis.js');
const runtime=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const apiSource=fs.readFileSync('api/abd-analysis/index.js','utf8');
const apiPackage=JSON.parse(fs.readFileSync('api/package.json','utf8'));

test('RC1294: strukturierte CSV-Zeilen werden auf ABD-Positionsfelder gemappt',()=>{
 const matrix=parser.parseDelimited('Pos;Artikelnummer;Warenbeschreibung;HS Code;Ursprungsland;Menge;Eigenmasse;Rohmasse;Warenwert;Währung;Y Nummern\n1;A-10;Kunststoffteil;39269097;DE;100;12,5;13,1;245,90;EUR;Y901 Y922\n2;B-20;Metallhalter;83024900;PL;25;8,2;8,8;125,00;EUR;Y901');
 const objects=parser.matrixToObjects(matrix,'test.csv'),analysis=parser.analyzeObjects(objects);
 assert.equal(analysis.positions.length,2);
 assert.equal(analysis.positions[0].commodityCode,'39269097');
 assert.equal(analysis.positions[0].originCountry,'DE');
 assert.equal(analysis.positions[0].netMassKg,12.5);
 assert.equal(analysis.positions[0].grossMassKg,13.1);
 assert.equal(analysis.positions[0].value,245.9);
 assert.deepEqual(analysis.positions[0].supplementaryCodes,['Y901','Y922']);
 assert.equal(analysis.positions[0].readyForReview,true);
 assert.equal(analysis.totals.value,370.9);
});

test('RC1294: fehlende Kerndaten werden nicht als vollständig ausgegeben',()=>{
 const out=parser.analyzeObjects([{description:'Teil ohne Zollstamm',commodityCode:'1234',_source:'x.xlsx'}]).positions[0];
 assert.ok(out.missing.includes('commodityCode'));
 assert.ok(out.missing.includes('originCountry'));
 assert.ok(out.missing.includes('weight'));
 assert.ok(out.missing.includes('value'));
 assert.equal(out.readyForReview,false);
});

test('RC1294: PDF-Auswertung erzeugt nur prüfpflichtige Kandidaten und extrahiert Y-Codes',()=>{
 const out=parser.extractPdfCandidates('Commercial Invoice\nPosition 1 Kunststoffteil HS Code 39269097 Ursprung DE Netto 12,5 kg 245,90 EUR Y901\nY922','invoice.pdf');
 assert.equal(out.positions.length>=1,true);
 assert.equal(out.positions[0].commodityCode,'39269097');
 assert.equal(out.requiresReview,true);
 assert.deepEqual(out.documentCodes,['Y901','Y922']);
});

function loadEndpoint({allowed=true}={}){
 const absolute=path.resolve('api/abd-analysis/index.js'),original=Module._load,records=new Map();
 const container={
  async createIfNotExists(){return{created:false}},
  getBlockBlobClient(name){
   return{
    name,
    async uploadData(buffer,options={}){
     if(records.has(name)){const e=new Error('exists');e.statusCode=409;throw e}
     records.set(name,{buffer:Buffer.from(buffer),metadata:Object.assign({},options.metadata||{}),tags:{},createdOn:new Date(),deleted:false});
    },
    async getProperties(){const r=records.get(name);if(!r||r.deleted){const e=new Error('not found');e.statusCode=404;throw e}return{metadata:r.metadata,createdOn:r.createdOn}},
    async getTags(){const r=records.get(name);if(!r||r.deleted){const e=new Error('not found');e.statusCode=404;throw e}return{tags:r.tags}},
    async download(){const r=records.get(name);if(!r||r.deleted){const e=new Error('not found');e.statusCode=404;throw e}return{readableStreamBody:Readable.from([r.buffer])}},
    async deleteIfExists(){const r=records.get(name);if(r)r.deleted=true;return{succeeded:!!r}}
   }
  }
 };
 const auth={
  async validateSession(){return{user:{id:'U1',rights:{abd:{edit:allowed}}}}},
  isAdmin(){return false},
  environmentFromRequest(){return'testservice'},
  body(req){return req.body||{}}
 };
 const i18n={t(_req,key,vars){return key+(vars&&vars.max?' '+vars.max:'')},tLang(_lang,key){return key}};
 Module._load=function(request,parent,isMain){
  if(request==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}};
  if(request==='../shared/fast-auth-store')return auth;
  if(request==='../shared/i18n')return i18n;
  return original.call(this,request,parent,isMain);
 };
 const old=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
 delete require.cache[require.resolve(absolute)];
 let handler;try{handler=require(absolute)}finally{Module._load=original}
 async function call(body){
  const context={log:{error(){}},res:null};await handler(context,{method:'POST',headers:{},body});return{status:context.res.status,body:JSON.parse(context.res.body)}
 }
 return{records,call,restore(){if(old===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=old}};
}

test('RC1294 API: CSV bleibt bis Defender-Clean in Quarantäne und wird erst danach analysiert',async()=>{
 const fx=loadEndpoint();
 try{
  const csv='Pos;Warenbeschreibung;HS Code;Ursprungsland;Eigenmasse;Warenwert;Währung\n1;Teil A;39269097;DE;12,5;245,90;EUR';
  let res=await fx.call({action:'upload',file:{name:'abd-positionen.csv',type:'text/csv',base64:Buffer.from(csv).toString('base64')}});
  assert.equal(res.status,202);assert.equal(res.body.status,'scanning');assert.equal(fx.records.size,1);
  const rec=[...fx.records.values()][0];assert.equal(rec.deleted,false);rec.tags['Malware scanning scan result']='No threats found';rec.tags['Malware scanning scan time']='2026-09-26T11:00:00Z';
  res=await fx.call({action:'status',uploadId:res.body.upload.id});
  assert.equal(res.status,200);assert.equal(res.body.status,'ready');assert.equal(res.body.analysis.positions.length,1);
  assert.equal(res.body.analysis.positions[0].commodityCode,'39269097');assert.equal(rec.deleted,true,'temporäre Analysedatei muss nach der Auswertung gelöscht werden');
 }finally{fx.restore()}
});

test('RC1294 API: Defender-Malware wird fail-closed blockiert und gelöscht',async()=>{
 const fx=loadEndpoint();
 try{
  const csv='Pos;HS Code\n1;39269097';
  let res=await fx.call({action:'upload',file:{name:'abd.csv',type:'text/csv',base64:Buffer.from(csv).toString('base64')}});
  const rec=[...fx.records.values()][0];rec.tags['Malware scanning scan result']='Malicious';
  res=await fx.call({action:'status',uploadId:res.body.upload.id});
  assert.equal(res.status,200);assert.equal(res.body.ok,false);assert.equal(res.body.code,'ABD_MALWARE_DETECTED');assert.equal(rec.deleted,true);
 }finally{fx.restore()}
});

test('RC1294 API: ABD-Auswertung verlangt Bearbeitungsrecht',async()=>{
 const fx=loadEndpoint({allowed:false});
 try{
  const res=await fx.call({action:'upload',file:{name:'abd.csv',type:'text/csv',base64:Buffer.from('Pos;HS Code\n1;39269097').toString('base64')}});
  assert.equal(res.status,403);assert.equal(res.body.code,'ABD_ANALYSIS_FORBIDDEN');
 }finally{fx.restore()}
});

test('RC1294: XLSX-Runtime und Release-Build sind vollständig verdrahtet',()=>{
 assert.equal(apiPackage.dependencies.exceljs,'4.4.0');
 assert.match(apiSource,/require\('exceljs'\)/);
 assert.match(apiSource,/workbook\.xlsx\.load\(buffer\)/);
 assert.match(apiSource,/Microsoft Defender for Storage/);
 assert.match(runtime,/\/api\/abd-analysis/);
 assert.match(runtime,/accept="\.pdf,\.xlsx,\.csv/);
 assert.match(runtime,/data-rc1294-results/);
 assert.match(build,/assets\/rc1294-abd-self-service\.js\?v=1294/);
 assert.match(build,/abd-analysis\/index\.js/);
 assert.match(build,/shared\/abd-analysis\.js/);
});

test('RC1294: geänderte JavaScript-Dateien sind syntaktisch gültig',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const file of ['api/shared/abd-analysis.js','api/abd-analysis/index.js','assets/rc1294-abd-self-service.js','.github/rc1112/build-three-env.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
