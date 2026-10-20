import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HIGH_CONFIDENCE=[
  ['OpenAI API key',/\bsk-[A-Za-z0-9_-]{32,}\b/g],
  ['GitHub classic token',/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ['GitHub fine-grained token',/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/g],
  ['Google API key',/\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Slack token',/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['Azure Storage account key',/\bAccountKey=[A-Za-z0-9+/=]{40,}/g],
  ['Private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
];

const SENSITIVE_SETTING=/\b(?:EXPORTHUB_INITIAL_ADMIN_PASSWORD|EXPORTHUB_AUTH_SIGNING_SECRET|EXPORTHUB_SESSION_SECRET|EXPORTHUB_STORAGE_CONNECTION_STRING|EXPORTHUB_CUSTOMER_PORTAL_KEY|EXPORTHUB_GRAPH_CLIENT_SECRET|EXPORTHUB_MAIL_GRAPH_CLIENT_SECRET|EXPORTHUB_CUSTOMS_AI_API_KEY|OPENAI_API_KEY|AZURE_STATIC_WEB_APPS_API_TOKEN)\b/i;
const ASSIGNMENT=/^[\s"']*([A-Z0-9_]+)["']?\s*[:=]\s*["']([^"']{8,})["']\s*,?\s*$/i;
const SAFE_VALUE=/^(?:<[^>]+>|\$\{\{\s*secrets\.|process\.env\.|example|placeholder|dummy|test|changeme|UseFakeStorage=true$)/i;

export function scanText(file,text){
  const findings=[];
  const value=String(text||'');
  for(const [rule,re] of HIGH_CONFIDENCE){
    re.lastIndex=0;
    let match;
    while((match=re.exec(value))){
      findings.push({file,rule,index:match.index});
      if(match[0].length===0)re.lastIndex++;
    }
  }
  value.split(/\r?\n/).forEach((line,index)=>{
    const m=line.match(ASSIGNMENT);
    if(!m||!SENSITIVE_SETTING.test(m[1])||SAFE_VALUE.test(m[2]))return;
    findings.push({file,rule:'Hardcoded sensitive setting',line:index+1});
  });
  return findings;
}

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXCLUDED=new Set(['.git','node_modules','test-results','playwright-report','blob-report','.playwright']);
const TEXT_EXT=new Set(['.js','.mjs','.cjs','.json','.yml','.yaml','.html','.css','.md','.txt','.env','.config','.toml','.ini']);

function files(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(EXCLUDED.has(entry.name))continue;
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory()){files(abs,out);continue;}
    const ext=path.extname(entry.name).toLowerCase();
    if(TEXT_EXT.has(ext)||entry.name==='.env'||entry.name==='.gitignore')out.push(abs);
  }
  return out;
}

export function scanRepository(root=ROOT){
  const findings=[];
  for(const abs of files(root)){
    const rel=path.relative(root,abs).split(path.sep).join('/');
    let text;
    try{text=fs.readFileSync(abs,'utf8')}catch{continue;}
    findings.push(...scanText(rel,text));
  }
  return findings;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const findings=scanRepository();
  if(findings.length){
    console.error(`Secret-Scan fehlgeschlagen: ${findings.length} verdächtige Fundstelle(n).`);
    for(const item of findings)console.error(`- ${item.file}${item.line?`:${item.line}`:''} · ${item.rule}`);
    process.exitCode=1;
  }else{
    console.log('Secret-Scan: keine hochkonfidenten hartcodierten Secrets gefunden.');
  }
}
