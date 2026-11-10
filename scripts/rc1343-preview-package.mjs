// RC1343: isolated, test-only Azure SWA preview. No main/production writes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha=String(process.env.RC1343_EXPECTED_SHA||'').trim();
assert.match(sha,/^[0-9a-f]{40}$/i);
assert.equal(process.env.GITHUB_REPOSITORY,'Deadshot89/ExportHub');
assert.equal(process.env.GITHUB_REF,'refs/heads/fix/rc1903-remove-legacy-fields-all-internal-20261110');
const host='ashy-grass-065b7b803-rc1343ts.westeurope.6.azurestaticapps.net';
const app='.rc1343_preview_app',api='.rc1343_preview_api';
fs.rmSync(app,{recursive:true,force:true});fs.rmSync(api,{recursive:true,force:true});
fs.mkdirSync(path.join(app,'assets','i18n'),{recursive:true});
fs.mkdirSync(path.join(api,'shipment-evidence'),{recursive:true});
fs.mkdirSync(path.join(api,'exporthub-health'),{recursive:true});
const copy=(src,dst)=>fs.copyFileSync(src,dst);
copy('assets/sendungsdokumentation.html',path.join(app,'index.html'));
copy('assets/sendungsdokumentation.html',path.join(app,'assets','sendungsdokumentation.html'));
copy('assets/shipment-evidence.css',path.join(app,'assets','shipment-evidence.css'));
copy('assets/shipment-evidence-guest.js',path.join(app,'assets','shipment-evidence-guest.js'));
copy('assets/i18n/shipment-evidence.js',path.join(app,'assets','i18n','shipment-evidence.js'));
fs.writeFileSync(path.join(app,'staticwebapp.config.json'),JSON.stringify({
 routes:[
  {route:'/',rewrite:'/index.html',allowedRoles:['anonymous'],headers:{'Cache-Control':'no-store'}},
  {route:'/sendungsdokumentation',rewrite:'/assets/sendungsdokumentation.html',allowedRoles:['anonymous'],headers:{'Cache-Control':'no-store'}},
  {route:'/api/*',allowedRoles:['anonymous'],headers:{'Cache-Control':'no-store'}}
 ],
 platform:{apiRuntime:'node:20'},
 globalHeaders:{'X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}
},null,2)+'\n');
copy('api/host.json',path.join(api,'host.json'));
fs.cpSync('api/shared',path.join(api,'shared'),{recursive:true});
copy('api/shipment-evidence/function.json',path.join(api,'shipment-evidence','function.json'));
copy('api/exporthub-health/function.json',path.join(api,'exporthub-health','function.json'));
copy('api/exporthub-health/index.js',path.join(api,'exporthub-health','index.js'));
fs.writeFileSync(path.join(api,'package.json'),JSON.stringify({
 name:'exporthub-rc1343-preview-api',version:'1.0.0',private:true,
 engines:{node:'20.x'},dependencies:{'@azure/storage-blob':'12.27.0'}
},null,2)+'\n');
fs.writeFileSync(path.join(api,'release-metadata.json'),JSON.stringify({
 buildId:sha,visibleRelease:'RC1343',technicalBuild:'isolated-preview',
 builtAt:new Date().toISOString(),environment:'testservice'
},null,2)+'\n');

const key=crypto.randomBytes(32).toString('base64url');
const keyPath=process.env.RC1343_PREVIEW_KEY_FILE;
assert.ok(keyPath&&path.isAbsolute(keyPath));
fs.writeFileSync(keyPath,key,{mode:0o600});
console.log('::add-mask::'+key);
fs.writeFileSync(path.join(api,'rc1343-preview.json'),JSON.stringify({
 marker:'RC1343-ISOLATED-PREVIEW',sha,host,
 tokenHash:crypto.createHash('sha256').update(key).digest('hex'),
 prefix:'testservice/rc1343/'+sha+'/shipment-evidence/v1/'
}));

let source=fs.readFileSync('api/shipment-evidence/index.js','utf8');
function once(before,after,label){
 if(source.split(before).length!==2)throw Error('RC1343 fail-closed source anchor changed: '+label);
 source=source.replace(before,after);
}
once("const MAX_FILE=15*1024*1024;",
 "const MAX_FILE=15*1024*1024;\n"+
 "const PREVIEW=JSON.parse(fs.readFileSync(path.join(__dirname,'..','rc1343-preview.json'),'utf8'));\n"+
 "if(PREVIEW.marker!=='RC1343-ISOLATED-PREVIEW'||PREVIEW.host!=='"+host+"'||!/^[0-9a-f]{40}$/i.test(PREVIEW.sha))throw Error('PREVIEW_METADATA_INVALID');",
 'preview identity');
once([
 "function storageContext(req,user){",
 " const env=verifiedDeploymentEnvironment()||auth.environmentFromRequest(req),",
 "       cfg=isolationConfig(),isolated=env==='testservice'&&cfg.enabled;",
 " const conn=isolated?cfg.connectionString:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';",
 " if(!conn)fail('STORAGE_UNAVAILABLE','Azure-Speicher nicht konfiguriert.',503);",
 " const container=isolated?cfg.container:auth.TEAM_CONTAINER;",
 " const prefix=env==='testservice'?'testservice/shipment-evidence/v1/':'shipment-evidence/v1/';",
 " return{container:BlobServiceClient.fromConnectionString(conn).getContainerClient(container),prefix,user};",
 "}"
].join('\n'),
[
 "function storageContext(req,user){",
 " // Mandatory separate Azure storage account; NO fallback to production credentials.",
 " const cfg=isolationConfig();",
 " if(!cfg.enabled||!cfg.connectionString||verifiedDeploymentEnvironment()!=='testservice')",
 "  fail('RC1343_ISOLATED_STORAGE_REQUIRED','Separate TESTSERVICE storage required.',503);",
 " if(!PREVIEW.prefix.startsWith('testservice/rc1343/'+PREVIEW.sha+'/'))",
 "  fail('RC1343_BAD_STORAGE_PREFIX','Unsafe preview namespace.',503);",
 " return{container:BlobServiceClient.fromConnectionString(cfg.connectionString).getContainerClient(cfg.container),",
 "  prefix:PREVIEW.prefix,user};",
 "}"
].join('\n'),'independent storage');
once("source==='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'&&",
 "(source==='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'||source===PREVIEW.host)&&",
 'preview origin');
once("async function processRequest(req){\n const method=req.method,query=req.query||{},payload=method==='POST'?body(req):query;",
[
 "async function processRequest(req){",
 " // The deployed preview contains no other business APIs or customer listing route.",
 " const token=txt((req.headers||{})['x-exporthub-rc1343-test-token']||(req.headers||{})['X-ExportHUB-RC1343-Test-Token'],128);",
 " const a=Buffer.from(crypto.createHash('sha256').update(token).digest('hex'),'hex');",
 " const b=Buffer.from(PREVIEW.tokenHash,'hex');",
 " if(!token||a.length!==b.length||!crypto.timingSafeEqual(a,b))",
 "  fail('RC1343_PREVIEW_DENIED','Isolated preview token required.',403);",
 " if(verifiedDeploymentEnvironment()!=='testservice')",
 "  fail('RC1343_ENVIRONMENT_DENIED','Preview is not running as TESTSERVICE.',503);",
 " const method=req.method,query=req.query||{},payload=method==='POST'?body(req):query;",
 " const previewAction=txt(payload.action,32);",
 " if(method==='GET'&&previewAction==='preview-diagnose'){",
 "  // Read-only diagnosis guarded by the same private preview key.",
 "  let stage='isolation-config';",
 "  try{",
 "   const cfg=isolationConfig();",
 "   if(!cfg.enabled)return json(503,{ok:false,code:'RC1343_STORAGE_ISOLATION_DISABLED',stage});",
 "   stage='client-create';",
 "   const client=BlobServiceClient.fromConnectionString(cfg.connectionString);",
 "   stage='container-exists';",
 "   const exists=await client.getContainerClient(cfg.container).exists();",
 "   return json(exists?200:503,{ok:exists,code:exists?'RC1343_STORAGE_READY':'RC1343_STORAGE_CONTAINER_MISSING',stage});",
 "  }catch(e){return json(503,{ok:false,code:'RC1343_STORAGE_PREFLIGHT_FAILED',stage,category:txt(e&&e.name,60)});}",
 " }",
 " if(!((method==='POST'&&['public-create','public-upload','public-submit'].includes(previewAction))||",
 "      (method==='GET'&&['public-get','public-file'].includes(action))))",
 "  fail('RC1343_TEST_ONLY','Only synthetic guest evidence tests are permitted.',403);",
 " if(previewAction==='public-create'&&(txt(payload.fields&&payload.fields.customerMode,32)||",
 "   txt(payload.fields&&payload.fields.customerNumber,50)||txt(payload.fields&&payload.fields.exporthubRef,50)))",
 "  fail('RC1343_NO_CUSTOMER_MASTER','No customer master lookup or REF linking in isolated preview.',403);"
].join('\n'), 'test-only APIs');
fs.writeFileSync(path.join(api,'shipment-evidence','index.js'),source);
assert.ok(source.includes('RC1343_ISOLATED_STORAGE_REQUIRED'));
assert.ok(source.includes('RC1343_PREVIEW_DENIED'));
assert.ok(!fs.existsSync(path.join(api,'customer-avis')));
console.log('RC1343: guest-only, private-key-protected preview staged; isolated account mandatory, no production writes.');
