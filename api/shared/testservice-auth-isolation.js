'use strict';

// RC1634: staged, disabled-by-default TESTSERVICE credential boundary.
// The opt-in cannot point back to the production storage account.
const MODE='EXPORTHUB_TEST_AUTH_ISOLATION';
function text(value){return String(value==null?'':value).trim();}
function primaryConnection(env){
 return text(env.EXPORTHUB_STORAGE_CONNECTION_STRING||env.EXPORTHUB_STORAGE_CONNECTION||
  env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||env.AzureWebJobsStorage);
}
function accountName(value){
 const m=String(value||'').match(/(?:^|;)\s*AccountName\s*=\s*([^;\s]+)/i);
 return m?m[1].toLowerCase():'';
}
function fail(code){const e=new Error(code);e.code=code;e.status=503;throw e;}
function isolationConfig(env=process.env){
 const mode=text(env[MODE]);
 if(!mode)return{enabled:false};
 if(mode!=='enabled')fail('TEST_AUTH_ISOLATION_MODE_INVALID');
 const primary=primaryConnection(env),test=text(env.EXPORTHUB_TEST_STORAGE_CONNECTION_STRING);
 const pa=accountName(primary),ta=accountName(test);
 // Prevent accident-prone URI comparison: different keys to the SAME account
 // must not be misinterpreted as separate storage.
 if(!pa||!ta||pa===ta||primary===test||/(?:^|;)\s*(?:BlobEndpoint|QueueEndpoint|FileEndpoint|TableEndpoint)\s*=/i.test(test))
  fail('TEST_AUTH_ISOLATION_ACCOUNT_NOT_SEPARATE');
 const container=text(env.EXPORTHUB_TEST_STORAGE_CONTAINER||env.EXPORTHUB_STORAGE_CONTAINER||
  env.EXPORTHUB_CONTAINER||'exporthub-data');
 const authBlob=text(env.EXPORTHUB_TEST_AUTH_BLOB||'testservice/auth-sessions.json');
 if(!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(container)||
    !/^testservice\/[A-Za-z0-9._/-]+$/.test(authBlob)||authBlob.includes('..')||
    authBlob.includes('//'))fail('TEST_AUTH_ISOLATION_PATH_INVALID');
 return{enabled:true,connectionString:test,container,authBlob};
}
module.exports={isolationConfig,primaryConnection,accountName};
