#!/usr/bin/env node
// RC1613 (#836): protected OFFLINE, read-only Team-State size profile.
// Never connects to Azure, never prints JSON content or customer-supplied keys.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const GROUPS=['shipments','savedShipments','customers','tasks','abdRequests'];
const LARGE_STRING_THRESHOLD=100_000;
const HUGE_STRING_THRESHOLD=1_000_000;

function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function bytes(value){return Buffer.byteLength(JSON.stringify(value),'utf8')}
function validState(document){
  if(!object(document))throw new Error('RC1613 INVALID_TEAM_STATE: JSON object required');
  const state=Object.prototype.hasOwnProperty.call(document,'state')?document.state:document;
  if(!object(state))throw new Error('RC1613 INVALID_TEAM_STATE: state object required');
  if(!Array.isArray(state.shipments)&&!Array.isArray(state.savedShipments))
    throw new Error('RC1613 INVALID_TEAM_STATE: shipment collection required');
  for(const key of GROUPS)if(Object.prototype.hasOwnProperty.call(state,key)&&
     !Array.isArray(state[key]))throw new Error('RC1613 INVALID_TEAM_STATE: malformed collection');
  return state;
}
function groupFor(key){return GROUPS.includes(key)?key:'other'}
function analyzeStrings(value){
  const stack=[value],report={
    largeStringCount:0,largeStringBytes:0,hugeStringCount:0,hugeStringBytes:0,
    inlineDataUrlCount:0,inlineDataUrlBytes:0,visitedNodes:0
  };
  while(stack.length){
    const v=stack.pop();
    if(++report.visitedNodes>2_000_000)throw new Error('RC1613 LIMIT_EXCEEDED: too many JSON nodes');
    if(typeof v==='string'){
      if(v.length>=LARGE_STRING_THRESHOLD){
        const n=Buffer.byteLength(v,'utf8');
        report.largeStringCount++;report.largeStringBytes+=n;
        if(v.length>=HUGE_STRING_THRESHOLD){report.hugeStringCount++;report.hugeStringBytes+=n;}
      }
      if(v.slice(0,160).toLowerCase().match(/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+)*;base64,/)){
        report.inlineDataUrlCount++;report.inlineDataUrlBytes+=Buffer.byteLength(v,'utf8');
      }
    }else if(Array.isArray(v)){for(const x of v)stack.push(x)}
    else if(object(v)){for(const x of Object.values(v))stack.push(x)}
  }
  return report;
}
export function profileTeamState(document){
  const state=validState(document);
  const rows=Object.fromEntries([...GROUPS,'other'].map(k=>[k,{entries:0,serializedBytes:0,
    largeStringCount:0,largeStringBytes:0,hugeStringCount:0,hugeStringBytes:0,
    inlineDataUrlCount:0,inlineDataUrlBytes:0}]));
  for(const [key,value] of Object.entries(state)){
    const bucket=groupFor(key),row=rows[bucket];
    row.entries+=Array.isArray(value)?value.length:1;
    row.serializedBytes+=bytes(value);
    const meta=analyzeStrings(value);
    for(const field of ['largeStringCount','largeStringBytes','hugeStringCount','hugeStringBytes','inlineDataUrlCount','inlineDataUrlBytes'])row[field]+=meta[field];
  }
  return {
    version:'RC1613',readOnly:true,
    note:'Serialized collection sizes are attribution estimates. No raw records, keys, URLs, or documents are shown.',
    stateSerializedBytes:bytes(state),sections:rows
  };
}
export function runCli(args){
  const flag=args.indexOf('--input');
  if(args.includes('--help')||flag<0||!args[flag+1]){
    process.stderr.write('Usage: node scripts/rc1613-state-startup-size-audit.mjs --input /secure/team-state-backup.json\n');
    return args.includes('--help')?0:2;
  }
  try{
    const input=fs.readFileSync(args[flag+1]);
    if(input.length>300_000_000)throw new Error('RC1613 LIMIT_EXCEEDED: snapshot too large');
    const document=JSON.parse(input.toString('utf8'));
    const report=profileTeamState(document);
    report.sourceSha256=crypto.createHash('sha256').update(input).digest('hex');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    return 0;
  }catch(error){
    // Fail closed with a code only, never echo input, raw error, or file name.
    const m=String(error?.message||'');
    const code=m.includes('LIMIT_EXCEEDED')?'LIMIT_EXCEEDED':
      m.includes('INVALID_TEAM_STATE')?'INVALID_TEAM_STATE':'INVALID_SNAPSHOT';
    process.stderr.write('RC1613 audit rejected: '+code+'\n');
    return 1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  process.exitCode=runCli(process.argv.slice(2));
