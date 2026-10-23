import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Hand-maintained ?v= numbers were not bumped when an asset changed (e.g. the RC1558 dashboard and RC1579 menu
// redesigns), so browsers could pair a fresh index.html with a cached, outdated stylesheet or script.
// After the build, every local /assets reference in the shipped HTML gets an additional h=<content hash> parameter:
// it changes exactly when the deployed file changes. Existing ?v= values stay untouched for current release checks.
export const HTML_FILES=Object.freeze([
  'index.html','TESTVERSION.html','demo.html',
  'pickup.html','customer-avis.html','location.html','pod-notfall.html','migration-recovery.html','pack.html'
]);
const PARAM='h';
const REF=/(\b(?:src|href)=)(["'])((?:\/)?assets\/[^"'?#\s]+)(\?[^"'#\s]*)?(#[^"'\s]*)?\2/gi;

export function hashFile(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,10);
}

// Deploy order is: repository assets first, dist assets copied over them. dist therefore wins.
export function resolveAsset(assetPath,{root,out}){
  const rel=assetPath.replace(/^\/+/,'');
  for(const base of [out,root]){
    const file=path.join(base,rel);
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return file;
  }
  return null;
}

export function withHash(query,hash){
  const params=String(query||'').replace(/^\?/,'').split('&').filter(Boolean).filter(part=>part.split('=')[0]!==PARAM);
  params.push(`${PARAM}=${hash}`);
  return '?'+params.join('&');
}

export function fingerprintHtml(html,{root,out,cache=new Map()}){
  const missing=[];
  let count=0;
  const result=String(html||'').replace(REF,(match,attr,quote,assetPath,query,fragment)=>{
    let hash=cache.get(assetPath);
    if(hash===undefined){
      const file=resolveAsset(assetPath,{root,out});
      hash=file?hashFile(file):null;
      cache.set(assetPath,hash);
    }
    if(!hash){missing.push(assetPath);return match;}
    count++;
    return `${attr}${quote}${assetPath}${withHash(query,hash)}${fragment||''}${quote}`;
  });
  return {html:result,count,missing};
}

export function fingerprintAssets({root=process.cwd(),out=path.join(root,'dist-rc1112'),files=HTML_FILES}={}){
  const cache=new Map(),report={};
  for(const name of files){
    const target=path.join(out,name);
    if(!fs.existsSync(target))continue;
    const before=fs.readFileSync(target,'utf8');
    const {html,count,missing}=fingerprintHtml(before,{root,out,cache});
    if(html!==before)fs.writeFileSync(target,html);
    report[name]={count,missing:[...new Set(missing)]};
  }
  return report;
}

const current=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(current)){
  const report=fingerprintAssets();
  for(const [name,{count,missing}] of Object.entries(report)){
    console.log(`Asset-Fingerprint ${name}: ${count} Verweise${missing.length?`, ohne Datei: ${missing.join(', ')}`:''}`);
  }
}
