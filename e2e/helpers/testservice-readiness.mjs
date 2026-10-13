const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export default async function testserviceReadiness(){
  if(process.env.EXPORTHUB_E2E_LIVE!=='1')return;
  if(String(process.env.EXPORTHUB_E2E_PUBLIC_ENV||'').trim().toLowerCase()!=='testservice')return;

  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'').trim();
  let target;
  try{target=new URL(base)}catch(_){throw new Error('RC1506 TESTSERVICE-Basis-URL ist ungültig.');}
  if(target.protocol!=='https:')throw new Error('RC1506 TESTSERVICE-Readiness darf nur HTTPS prüfen.');

  const deadline=Date.now()+60_000;
  let healthy=0;
  let lastStatus=0;
  let lastError='';
  let attempt=0;

  while(Date.now()<deadline){
    attempt+=1;
    const endpoint=new URL('/api/exporthub-state?mode=health',target);
    endpoint.searchParams.set('_rc1506',`${Date.now()}-${attempt}`);
    try{
      const response=await fetch(endpoint,{headers:{'Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':'testservice'},cache:'no-store',signal:AbortSignal.timeout(8_000)});
      lastStatus=response.status;
      let payload={};
      try{payload=await response.json()}catch(_){payload={};}
      if(response.ok&&payload&&payload.ok===true){
        healthy+=1;
        if(healthy>=2)return;
      }else{
        healthy=0;
        lastError=String(payload&&(payload.message||payload.code)||'');
      }
    }catch(error){
      healthy=0;
      lastError=String(error&&error.message||error);
    }
    await pause(750);
  }

  throw new Error(`RC1506 TESTSERVICE State-Readiness fehlgeschlagen: HTTP ${lastStatus||'—'}${lastError?' · '+lastError:''}`);
}
