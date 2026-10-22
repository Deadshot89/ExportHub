import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only TESTSERVICE scope inventory. These prefixes were found in storage writers.
// Never scan a whole container or fall back to production credentials.
export const SCOPES = Object.freeze([
  { id:'team', container:'exporthub-teamdata', prefixes:['testservice/'],
    credential:'EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING', account:'exporthubtestde89' },
  { id:'documents', container:'exporthub-documents', prefixes:['rc1059/testservice/','testservice/'],
    credential:'EXPORTHUB_TEST_DOCUMENTS_INVENTORY_CONNECTION_STRING', accountEnv:'EXPORTHUB_TEST_DOCUMENTS_ACCOUNT' },
  { id:'pickup', container:'exporthub-pickup', prefixes:['rc995/testservice/'],
    credential:'EXPORTHUB_TEST_PICKUP_INVENTORY_CONNECTION_STRING', accountEnv:'EXPORTHUB_TEST_PICKUP_ACCOUNT' },
  { id:'pod', container:'exporthub-pod', prefixes:['rc995/testservice/'],
    credential:'EXPORTHUB_TEST_POD_INVENTORY_CONNECTION_STRING', accountEnv:'EXPORTHUB_TEST_POD_ACCOUNT' },
  { id:'abd-quarantine', container:'exporthub-abd-quarantine', prefixes:['rc1294/testservice/'],
    credential:'EXPORTHUB_TEST_ABD_INVENTORY_CONNECTION_STRING', accountEnv:'EXPORTHUB_TEST_ABD_ACCOUNT' },
  { id:'pod-backup', container:'exporthub-pod-backup', prefixes:['rc1220/testservice/'],
    credential:'EXPORTHUB_TEST_POD_BACKUP_INVENTORY_CONNECTION_STRING', accountEnv:'EXPORTHUB_TEST_POD_BACKUP_ACCOUNT' }
]);

function safeInt(value) { return Number.isSafeInteger(value) && value >= 0; }
function add(target,bytes) {
  if(!safeInt(target.logicalBytes+bytes)) throw new Error('INVENTORY_SIZE_OVERFLOW');
  target.records++; target.logicalBytes+=bytes;
}
export function validateConfiguration(env = process.env) {
  return SCOPES.map(scope => {
    if(!env[scope.credential] || !String(env[scope.credential]).trim())
      throw new Error('MISSING_DEDICATED_CREDENTIAL');
    const account=scope.account || String(env[scope.accountEnv] || '').toLowerCase().trim();
    if(!/^[a-z0-9]{3,24}$/.test(account)) throw new Error('MISSING_CONFIRMED_ACCOUNT');
    return {scope,account,connection:String(env[scope.credential])};
  });
}
export function assertAccount(service,account) {
  let url;
  try { url=new URL(service.url); } catch (_) { throw new Error('WRONG_ACCOUNT'); }
  if(url.protocol!=='https:' || url.hostname.toLowerCase()!==account+'.blob.core.windows.net')
    throw new Error('WRONG_ACCOUNT');
}

// No names, references, document contents, personal metadata, SAS or credentials in the output.
export async function collectScope(container,scope) {
  if(!SCOPES.includes(scope)) throw new Error('UNKNOWN_SCOPE');
  const result={scope:scope.id,container:scope.container,complete:false,records:0,logicalBytes:0,kinds:{},prefixes:{}};
  for(const prefix of scope.prefixes) {
    const part={records:0,logicalBytes:0};result.prefixes[prefix]=part;
    for await(const item of container.listBlobsFlat({prefix,includeSnapshots:true,includeVersions:true,includeDeleted:true})) {
      if(typeof item.name!=='string' || !item.name.startsWith(prefix)) throw new Error('OUT_OF_SCOPE');
      const bytes=item.properties && item.properties.contentLength;
      if(!safeInt(bytes)) throw new Error('INVALID_SIZE');
      const kind=item.deleted?'deleted':item.snapshot?'snapshot':item.versionId?'version':'live';
      result.kinds[kind] ||= {records:0,logicalBytes:0};
      add(part,bytes);add(result,bytes);add(result.kinds[kind],bytes);
    }
  }
  result.complete=true;
  return result;
}
export async function collectAll(openScope,scopes=SCOPES) {
  if(scopes.length!==SCOPES.length || scopes.some((scope,i)=>scope!==SCOPES[i]))
    throw new Error('INVENTORY_SCOPE_INCOMPLETE');
  const report={environment:'testservice',complete:false,records:0,logicalBytes:0,
    startedAt:new Date().toISOString(),scopes:[],billingVerified:false,
    archiveVerified:false,sharedProductionDependenciesResolved:false,
    caveats:[
      'This counts only identified TESTSERVICE prefixes, not shared production authentication or unknown resources.',
      'Logical bytes, including snapshot and version sizes, are not billed bytes.',
      'Multiple separate Azure accounts may be used, especially for POD backups.',
      'Read/list operations may be charged. No archive or restore test is performed.',
      'The scan is not atomic; historical files and concurrent writes need separate validation.'
    ]};
  for(const scope of scopes) {
    const container=await openScope(scope);
    const part=await collectScope(container,scope);
    if(!part.complete) throw new Error('INCOMPLETE_SCOPE');
    report.scopes.push(part);
    if(!safeInt(report.logicalBytes+part.logicalBytes)) throw new Error('INVENTORY_SIZE_OVERFLOW');
    report.records+=part.records;report.logicalBytes+=part.logicalBytes;
  }
  report.complete=true;
  report.completedAt=new Date().toISOString();
  return report;
}
async function main() {
  // Preflight all six independently scoped credentials before making a single Azure request.
  const configuration=validateConfiguration();
  const require=createRequire(new URL('../api/package.json',import.meta.url));
  const {BlobServiceClient}=require('@azure/storage-blob');
  const clients=configuration.map(({scope,connection,account})=>{
    const service=BlobServiceClient.fromConnectionString(connection);
    assertAccount(service,account);
    return {scope,container:service.getContainerClient(scope.container)};
  });
  const report=await collectAll(async scope=>clients.find(x=>x.scope===scope).container);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{
    // Azure SDK errors may contain signed URLs: never serialize caught exceptions.
    process.stderr.write('TESTSERVICE extended inventory failed; no complete report. Check dedicated read/list credentials, confirmed accounts and containers.\n');
    process.exitCode=1;
  });
}
