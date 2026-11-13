// RC1820: read-only TESTSERVICE gate for the actual published menu scripts.
// Never authenticates, mutates data, or targets PRODUCTION.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const TESTSERVICE_ORIGIN='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
export const MENU_ASSETS=Object.freeze([
  Object.freeze({path:'assets/rc1820-top-navigation.js',version:'20261112p0'}),
  Object.freeze({path:'assets/rc1579-menu-redesign.js',version:'20261112'})
]);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function assertMenuHtml(html){
  for(const asset of MENU_ASSETS){
    const expected=`/${asset.path}?v=${asset.version}`;
    if(!html.includes(expected))throw Error(`RC1820: TESTSERVICE lacks current menu asset ${asset.path}`);
  }
  if(!html.includes('exporthub-rc1820-topnav-script')||
     !html.includes('exporthub-rc1579-menu-script')){
    throw Error('RC1820: TESTSERVICE menu script tags missing');
  }
}

export function assertDeploymentIdentity(payload,expectedSha){
  const deployment=payload&&payload.deployment;
  if(!deployment||deployment.verified!==true||
     deployment.environment!=='testservice'||deployment.buildId!==expectedSha){
    throw Error('RC1820: TESTSERVICE deployed SHA is not verified or differs from main');
  }
}

export function assertAssetMatches(localBytes,publishedBytes,name){
  if(!Buffer.isBuffer(localBytes)||!Buffer.isBuffer(publishedBytes)||
     hash(localBytes)!==hash(publishedBytes)){
    throw Error(`RC1820: published asset differs from checked-out main: ${name}`);
  }
}

export async function verifyPublishedMenu({expectedSha,fetchImpl=fetch,root=ROOT}={}){
  if(!/^[a-f0-9]{40}$/i.test(String(expectedSha||'')))throw Error('RC1820: expected full 40-character main SHA required');
  const read=async (relativeUrl)=>{
    const target=new URL(relativeUrl,TESTSERVICE_ORIGIN);
    if(target.origin!==TESTSERVICE_ORIGIN)throw Error('RC1820: invalid TESTSERVICE target');
    const response=await fetchImpl(target.href,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'*/*'}});
    if(response.status!==200||response.redirected===true)throw Error(`RC1820: TESTSERVICE GET ${target.pathname} HTTP ${response.status} (expected 200 without redirect)`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.byteLength>6*1024*1024)throw Error(`RC1820: oversized TESTSERVICE response ${target.pathname}`);
    return bytes;
  };
  const healthBytes=await read(`/api/exporthub-health?rc1820=${expectedSha}`);
  let health;
  try{health=JSON.parse(healthBytes.toString('utf8'))}
  catch(error){throw Error('RC1820: TESTSERVICE health is not valid JSON',{cause:error})}
  assertDeploymentIdentity(health,expectedSha);
  // The public TESTSERVICE entrypoint '/' is explicitly rewritten to TESTVERSION.html.
  // Check its delivered HTML directly instead of the canonicalized file URL (301).
  const html=(await read(`/?rc1820=${expectedSha}`)).toString('utf8');
  assertMenuHtml(html);
  for(const asset of MENU_ASSETS){
    const source=fs.readFileSync(path.join(root,asset.path));
    const published=await read(`/${asset.path}?v=${asset.version}`);
    assertAssetMatches(source,published,asset.path);
  }
  return {verified:true,environment:'testservice',buildId:expectedSha,menuAssets:MENU_ASSETS.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyPublishedMenu({expectedSha:process.argv[2]})
    .then(result=>console.log(`RC1820 TESTSERVICE published navigation verified: buildId=${result.buildId} assets=${result.menuAssets} SHA256=ok`))
    .catch(error=>{console.error(error.message);process.exitCode=1});
}
