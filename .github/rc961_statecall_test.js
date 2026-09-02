'use strict';
const fs=require('fs');
const vm=require('vm');

const html=fs.readFileSync('TESTVERSION.html','utf8');
const start=html.indexOf('async function stateCall(');
const end=html.indexOf('\nfunction shipmentRecoveryScalar',start);
if(start<0||end<0)throw new Error('Aktive stateCall-Funktion wurde nicht gefunden.');
const source=html.slice(start,end).trim();

const observed=[];
const context={
  console,
  Date,
  Math,
  JSON,
  Promise,
  Error,
  Number,
  Array,
  Object,
  String,
  isFinite,
  setTimeout,
  clearTimeout,
  native:{setTimeout},
  runtime:{authToken:'test-token'},
  DATA_ENVIRONMENT:'testservice',
  API:'/api/exporthub-state',
  STATE_API_CANDIDATES:['/api/state-fallback-1','/api/state-fallback-2','/api/state-fallback-3'],
  text:v=>String(v==null?'':v).trim(),
  lower:v=>String(v==null?'':v).toLowerCase(),
  progress:()=>{},
  apiEndpointLabel:v=>String(v),
  verifyStateEnvironment:v=>v,
  noteAzureNetworkSuccess:()=>{},
  jsonFetch:(url,opts)=>new Promise((resolve,reject)=>{
    const wait=Math.max(1,Number(opts&&opts.timeoutMs||1));
    observed.push({url,timeoutMs:wait});
    setTimeout(()=>{const e=new Error('simulierter Timeout');e.code='API_TIMEOUT';e.status=408;reject(e)},wait);
  })
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'active-stateCall.js'});

(async()=>{
  const requested=40;
  const started=Date.now();
  let error=null;
  try{await context.stateCall('read',{}, {timeoutMs:requested,maxAttempts:1})}catch(e){error=e}
  const elapsed=Date.now()-started;
  if(!error)throw new Error('Timeout-Simulation hätte fehlschlagen müssen.');
  if(elapsed>90){
    throw new Error(`Start-Timeout wird pro API-Route multipliziert: ${elapsed} ms bei ${observed.length} Requests (Soll: gesamter Read <= ca. ${requested} ms).`);
  }
  if(observed.length>1&&observed.slice(1).some(x=>x.timeoutMs>=requested)){
    throw new Error('Fallback-Routen erhalten erneut den vollen Start-Timeout statt nur die verbleibende Gesamtzeit.');
  }
  console.log(`RC961 stateCall total-timeout PASS: elapsed=${elapsed}ms requests=${observed.length} timeouts=${observed.map(x=>x.timeoutMs).join(',')}`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
