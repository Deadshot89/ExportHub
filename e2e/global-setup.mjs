const MAX_ATTEMPTS=24;
const SLEEP_MS=5000;
const REQUIRED_CONSECUTIVE=2;

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

export default async function globalSetup(){
  if(process.env.EXPORTHUB_E2E_LIVE!=='1') return;

  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'').trim().replace(/\/+$/,'');
  if(!base){
    throw new Error('RC1514: EXPORTHUB_E2E_BASE_URL fehlt fuer Live-Readiness.');
  }

  let consecutiveHealthy=0;
  let lastProblem='unbekannt';

  for(let attempt=0;attempt<MAX_ATTEMPTS;attempt+=1){
    try{
      const response=await fetch(`${base}/api/exporthub-state?mode=health&rc1514=${Date.now()}-${attempt}`,{
        headers:{'cache-control':'no-cache'}
      });

      if(!response.ok){
        consecutiveHealthy=0;
        lastProblem=`HTTP ${response.status}`;
      }else{
        const v=await response.json();
        if(v.ok===true&&v.storageReachable===true&&v.teamStateReadable===true){
          consecutiveHealthy+=1;
          if(consecutiveHealthy>=REQUIRED_CONSECUTIVE){
            console.log(`RC1514: State-Backend stabil bereit (${consecutiveHealthy}/${REQUIRED_CONSECUTIVE}).`);
            return;
          }
          lastProblem='erster gesunder Health-Check; Stabilitaet wird bestaetigt';
        }else{
          consecutiveHealthy=0;
          lastProblem=`Health noch nicht bereit: ok=${v?.ok===true} storage=${v?.storageReachable===true} teamState=${v?.teamStateReadable===true}`;
        }
      }
    }catch(error){
      consecutiveHealthy=0;
      lastProblem=error instanceof Error?error.message:String(error);
    }

    if(attempt<MAX_ATTEMPTS-1){
      console.log(`RC1514: State-Backend noch nicht stabil (${attempt+1}/${MAX_ATTEMPTS}: ${lastProblem}).`);
      await sleep(SLEEP_MS);
    }
  }

  throw new Error(`RC1514: State-Backend vor Live-Playwright nicht stabil bereit (${lastProblem}).`);
}
