import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const API_VERSION='2022-11-28';
const DEFAULT_ATTEMPTS=8;
const DEFAULT_DELAY_MS=1500;

function text(value){return String(value==null?'':value).trim()}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function readPushEvent(env,eventPayload,readFileImpl){
  if(eventPayload&&typeof eventPayload==='object')return eventPayload;
  const eventPath=text(env.GITHUB_EVENT_PATH);
  if(!eventPath)throw new Error('DIRECT_MAIN_PUSH_BLOCKED: GitHub Push-Event für die Herkunftsprüfung fehlt.');
  try{
    const raw=readFileImpl(eventPath,'utf8');
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object')throw new Error('ungültiges JSON');
    return parsed;
  }catch(error){
    throw new Error(`DIRECT_MAIN_PUSH_BLOCKED: GitHub Push-Event kann nicht gelesen werden (${text(error&&error.message||error)}).`);
  }
}

function requestHeaders(env){
  const headers={
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':API_VERSION,
    'User-Agent':'ExportHUB-RC1473-Release-Provenance'
  };
  const token=text(env.GITHUB_TOKEN);
  if(token)headers.Authorization=`Bearer ${token}`;
  return headers;
}

export async function verifyMainPrProvenance({
  env=process.env,
  fetchImpl=globalThis.fetch,
  sleepImpl=sleep,
  readFileImpl=fs.readFileSync,
  eventPayload=null,
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

  const pushEvent=readPushEvent(env,eventPayload,readFileImpl);
  const before=text(pushEvent.before);
  const after=text(pushEvent.after);
  if(!before||!after||after!==sha){
    throw new Error('DIRECT_MAIN_PUSH_BLOCKED: GitHub Push-Event passt nicht zum aktuellen Main-Commit.');
  }

  const maxAttempts=Math.max(1,Number(attempts)||1);
  const encodedSha=encodeURIComponent(sha);
  const pullsUrl=`https://api.github.com/repos/${repository}/commits/${encodedSha}/pulls`;
  const commitUrl=`https://api.github.com/repos/${repository}/commits/${encodedSha}`;
  const headers=requestHeaders(env);
  let lastReason='kein zugeordneter gemergter PR nach main für den aktuellen Merge-Commit gefunden';

  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const response=await fetchImpl(pullsUrl,{method:'GET',headers});
      if(response&&response.ok){
        const items=await response.json();
        const prs=Array.isArray(items)?items:[];
        const merged=prs.find(pr=>pr&&pr.merged_at&&pr.base&&text(pr.base.ref)==='main'&&text(pr.merge_commit_sha)===sha);
        if(merged){
          const commitResponse=await fetchImpl(commitUrl,{method:'GET',headers});
          if(commitResponse&&commitResponse.ok){
            const commit=await commitResponse.json();
            const parents=Array.isArray(commit&&commit.parents)?commit.parents:[];
            const firstParent=text(parents[0]&&parents[0].sha);
            if(firstParent!==before){
              lastReason=`tatsächlicher Merge-Commit hat nicht die Push-Basis ${before} als ersten Parent`;
            }else{
              const headSha=text(merged.head&&merged.head.sha);
              if(parents.length>1&&headSha&&!parents.slice(1).some(parent=>text(parent&&parent.sha)===headSha)){
                lastReason='tatsächlicher Merge-Commit enthält nicht den Head des zugeordneten Pull Requests';
              }else{
                return{checked:true,pullRequest:Number(merged.number)||null,sha,before};
              }
            }
          }else{
            lastReason=`GitHub Commit-API antwortet mit HTTP ${commitResponse&&commitResponse.status||'unbekannt'}`;
          }
        }else{
          lastReason='kein zugeordneter gemergter PR nach main für den aktuellen Merge-Commit gefunden';
        }
      }else{
        lastReason=`GitHub PR-API antwortet mit HTTP ${response&&response.status||'unbekannt'}`;
      }
    }catch(error){
      lastReason=`GitHub API nicht erreichbar: ${text(error&&error.message||error)}`;
    }
    if(attempt<maxAttempts)await sleepImpl(Math.max(0,Number(delayMs)||0));
  }

  throw new Error(`DIRECT_MAIN_PUSH_BLOCKED: Release von main verweigert – ${lastReason}. Änderungen müssen über den aktuell gemergten Pull Request nach main gelangen.`);
}

const invokedPath=process.argv[1]?pathToFileURL(process.argv[1]).href:'';
if(invokedPath&&import.meta.url===invokedPath){
  try{
    const result=await verifyMainPrProvenance();
    if(result.checked)console.log(`RC1473 Main-Herkunft bestätigt: PR #${result.pullRequest||'?'} · ${result.before} -> ${result.sha}`);
    else console.log(`RC1473 Herkunftsprüfung übersprungen: ${result.reason}`);
  }catch(error){
    console.error(error&&error.message||error);
    process.exitCode=1;
  }
}
