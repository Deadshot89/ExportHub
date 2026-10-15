const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function timing(response,name){
  try{return String(response&&response.headers&&response.headers.get(name)||'').trim()}catch(_){return ''}
}

export default async function testserviceReadiness(){
  if(process.env.EXPORTHUB_E2E_LIVE!=='1')return;
  if(String(process.env.EXPORTHUB_E2E_PUBLIC_ENV||'').trim().toLowerCase()!=='testservice')return;

  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'').trim();
  const token=String(process.env.EXPORTHUB_E2E_SESSION_TOKEN||'').trim();
  let target;
  try{target=new URL(base)}catch(_){throw new Error('RC1506 TESTSERVICE-Basis-URL ist ungültig.');}
  if(target.protocol!=='https:')throw new Error('RC1506 TESTSERVICE-Readiness darf nur HTTPS prüfen.');
  if(!token)throw new Error('RC1541 TESTSERVICE State-Readiness benötigt die E2E-Sitzung.');

  const deadline=Date.now()+60_000;
  let healthy=0;
  let lastStatus=0;
  let lastError='';
  let attempt=0;

  while(Date.now()<deadline){
    attempt+=1;
    const endpoint=new URL('/api/exporthub-state?mode=health',target);
    endpoint.searchParams.set('_rc1541',`${Date.now()}-${attempt}`);
    try{
      const response=await fetch(endpoint,{headers:{'Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':'testservice'},cache:'no-store',signal:AbortSignal.timeout(8_000)});
      lastStatus=response.status;
      let payload={};
      try{payload=await response.json()}catch(_){payload={};}
      if(response.ok&&payload&&payload.ok===true){
        healthy+=1;
      }else{
        healthy=0;
        lastError=String(payload&&(payload.message||payload.code)||'');
      }
    }catch(error){
      healthy=0;
      lastError=String(error&&error.message||error);
    }

    if(healthy>=2){
      const readEndpoint=new URL('/api/exporthub-state?mode=read&full=1',target);
      readEndpoint.searchParams.set('_rc1541',`${Date.now()}-${attempt}`);
      try{
        const response=await fetch(readEndpoint,{
          headers:{
            'Accept':'application/json',
            'Cache-Control':'no-cache',
            'X-ExportHUB-Token':token,
            'X-ExportHUB-Session':token,
            'Authorization':'Bearer '+token,
            'X-ExportHUB-Environment':'testservice'
          },
          cache:'no-store',
          signal:AbortSignal.timeout(20_000)
        });
        lastStatus=response.status;
        let payload={};
        try{payload=await response.json()}catch(_){payload={};}
        if(response.ok&&payload&&payload.ok===true){
          console.log('RC1541 TESTSERVICE State-Readiness',JSON.stringify({
            status:response.status,
            serverMs:timing(response,'x-exporthub-server-ms'),
            authMs:timing(response,'x-exporthub-auth-ms'),
            authCache:timing(response,'x-exporthub-auth-cache'),
            teamMs:timing(response,'x-exporthub-team-ms'),
            teamCache:timing(response,'x-exporthub-team-cache')
          }));
          return;
        }
        lastError=String(payload&&(payload.message||payload.code)||'State-Read nicht bereit');
      }catch(error){
        lastError='State-Read: '+String(error&&error.message||error);
      }
    }

    await pause(750);
  }

  throw new Error(`RC1541 TESTSERVICE State-Readiness fehlgeschlagen: HTTP ${lastStatus||'—'}${lastError?' · '+lastError:''}`);
}
