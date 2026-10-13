import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const isGithubActions=process.env.GITHUB_ACTIONS==='true'&&process.env.CI==='true';

function run(command,args,options={}){
  return execFileSync(command,args,{cwd:ROOT,encoding:'utf8',stdio:options.capture?'pipe':'inherit',...options});
}

if(!isGithubActions){
  console.log('RC1520 release checkout isolation skipped outside GitHub Actions.');
  process.exit(0);
}

const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
const headBefore=String(run('git',['rev-parse','HEAD'],{capture:true})).trim();

run('git',['reset','--hard','HEAD']);
run('git',['clean','-fd']);

const headAfter=String(run('git',['rev-parse','HEAD'],{capture:true})).trim();
if(!headBefore||headAfter!==headBefore){
  throw new Error(`RC1520 Release-Checkout-SHA verändert: ${headBefore||'leer'} -> ${headAfter||'leer'}`);
}

run(process.execPath,['.github/rc1018/apply-public-language.mjs']);
run(process.execPath,['.github/rc1018/fix-mail-wording.mjs']);
run(npmCommand,['run','pretest','--silent']);

const smokePath=path.join(ROOT,'e2e/specs/public-smoke.spec.mjs');
const committedSmoke=String(run('git',['show','HEAD:e2e/specs/public-smoke.spec.mjs'],{capture:true}));
const preparedSmoke=fs.readFileSync(smokePath,'utf8');
if(preparedSmoke!==committedSmoke){
  throw new Error('RC1520 public-smoke.spec.mjs wurde nach sauberer Release-Vorbereitung erneut mutiert. Browser-Gate wird fail-closed blockiert.');
}

console.log(`RC1520 release checkout isolation verified on ${headAfter}: mutation-heavy Testreste entfernt, Release-Transforms sauber neu vorbereitet.`);
