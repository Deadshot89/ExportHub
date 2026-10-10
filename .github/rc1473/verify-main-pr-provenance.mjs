import { pathToFileURL } from 'node:url';

const API_VERSION='2022-11-28';
const DEFAULT_ATTEMPTS=8;
const DEFAULT_DELAY_MS=1500;

function text(value){return String(value==null?'':value).trim()}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

export async function verifyMainPrProvenance({
  env=process.env,
  fetchImpl=globalThis.fetch,
  sleepImpl=sleep,
  attempts=DEFAULT_ATTEMPTS,
  delayMs=DEFAULT_DELAY_MS
}={}){
  const eventName=text(env.GITHUB_EVENT_NAME);
  const ref=text(env.GITHUB_REF);
  if(eventName!=='push'||ref!=='refs/heads/main')return{checked:false,reason:'not-main-push'};

  const repository=text(env.GITHUB_REPOSITORY);
  const sha=text(env.GITHUB_SHA);
  if(!repository||!sha)throw new Error('DIRECT_MAIN_PUSH_BLOCKED: GitHub Repository/SHA für die PR-Herkunftsprüfung fehlt.');
  if(typeof fetchImpl!=='function')throw new Error('DIRECT_MAIN_PUSH_BLOCKED: GitHub API ist für die PR-Herkunftsprüfung nicht verfügbar.');

  const maxAttempts=Math.max(1,Number(attempts)||1);
  const url=`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(sha)}/pulls`;
  let lastReason='kein zugeordneter gemergter PR nach main gefunden';

  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const response=await fetchImpl(url,{
        method:'GET',
        headers:{
          'Accept':'application/vnd.github+json',
          'X-GitHub-Api-Version':API_VERSION,
          'User-Agent':'ExportHUB-RC1473-Release-Provenance'
        }
      });
      if(response&&response.ok){
        const items=await response.json();
        const prs=Array.isArray(items)?items:[];
        const merged=prs.find(pr=>pr&&pr.merged_at&&pr.base&&text(pr.base.ref)==='main');
        if(merged){
          return{checked:true,pullRequest:Number(merged.number)||null,sha};
        }
        lastReason='kein zugeordneter gemergter PR nach main gefunden';
      }else{
        lastReason=`GitHub API antwortet mit HTTP ${response&&response.status||'unbekannt'}`;
      }
    }catch(error){
      lastReason=`GitHub API nicht erreichbar: ${text(error&&error.message||error)}`;
    }
    if(attempt<maxAttempts)await sleepImpl(Math.max(0,Number(delayMs)||0));
  }

  throw new Error(`DIRECT_MAIN_PUSH_BLOCKED: Release von main verweigert – ${lastReason}. Änderungen müssen über einen gemergten Pull Request nach main gelangen.`);
}

const invokedPath=process.argv[1]?pathToFileURL(process.argv[1]).href:'';
if(invokedPath&&import.meta.url===invokedPath){
  try{
    const result=await verifyMainPrProvenance();
    if(result.checked)console.log(`RC1473 Main-Herkunft bestätigt: PR #${result.pullRequest||'?'} · ${result.sha}`);
    else console.log(`RC1473 Herkunftsprüfung übersprungen: ${result.reason}`);
  }catch(error){
    console.error(error&&error.message||error);
    process.exitCode=1;
  }
}
