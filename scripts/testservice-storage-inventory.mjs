import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Metadata only. No blob download, upload, delete or resource change.
export async function collectInventory(container) {
  const startedAt=new Date().toISOString();
  const report={environment:'testservice',prefix:'testservice/',complete:false,
    startedAt,completedAt:null,records:0,logicalBytes:0,kinds:{},areas:{},
    billingVerified:false,archiveVerified:false,
    caveats:[
      'Logical bytes are not billed bytes; snapshots and versions may share blocks.',
      'Only the selected container and testservice/ prefix are covered; shared and other containers require separate review.',
      'Listing is not an atomic snapshot. Quiesce writers for a migration manifest.',
      'Metadata inventory is not a backup or a restore verification.',
      'This read-only listing can incur Azure transaction charges.'
    ]};
  function add(target,bytes) {
    if(!Number.isSafeInteger(target.logicalBytes+bytes)) throw new Error('SIZE_OVERFLOW');
    target.records++; target.logicalBytes+=bytes;
  }
  for await(const item of container.listBlobsFlat({prefix:'testservice/',includeSnapshots:true,includeVersions:true,includeDeleted:true})) {
    if(typeof item.name!=='string'||!item.name.startsWith('testservice/')) throw new Error('OUT_OF_SCOPE');
    const bytes=item.properties?.contentLength;
    if(!Number.isSafeInteger(bytes)||bytes<0) throw new Error('INVALID_SIZE');
    const kind=item.deleted?'deleted':item.snapshot?'snapshot':item.versionId?'version':'live';
    const relative=item.name.slice('testservice/'.length);
    // Fixed categories avoid exposing shipment names and arbitrary path keys.
    const area=['state-backups/','recovery-backups/','documents/'].find(p=>relative.startsWith(p))?.slice(0,-1)||'other-testservice';
    report.kinds[kind] ||= {records:0,logicalBytes:0};
    report.areas[area] ||= {records:0,logicalBytes:0};
    add(report,bytes); add(report.kinds[kind],bytes); add(report.areas[area],bytes);
  }
  report.complete=true;
  report.completedAt=new Date().toISOString();
  return report;
}

async function main() {
  // Deliberately no fallback to shared production credentials.
  const connection=process.env.EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING;
  if(!connection) throw new Error('INVENTORY_CREDENTIAL_REQUIRED');
  const require=createRequire(new URL('../api/package.json',import.meta.url));
  const {BlobServiceClient}=require('@azure/storage-blob');
  const service=BlobServiceClient.fromConnectionString(connection);
  const container=service.getContainerClient(process.env.EXPORTHUB_TEST_INVENTORY_CONTAINER||'exporthub-data');
  const report=await collectInventory(container);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{
    // SDK errors may contain signed request URLs. Never print them.
    process.stderr.write('TESTSERVICE inventory failed; no complete report produced. Check read/list permissions, API dependency installation and dedicated inventory configuration.\n');
    process.exitCode=1;
  });
}
