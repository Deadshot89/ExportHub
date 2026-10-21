#!/usr/bin/env node
// RC1612 P0: independently verify the exact Main Verification job and its
// TESTSERVICE live-gates immediately BEFORE the production upload.
// Fail closed. Never print GitHub tokens or job logs.
import { pathToFileURL } from 'node:url';

const WORKFLOW = 'azure-static-web-apps-wonderful-forest-0f315e310.yml';
const REQUIRED_STEPS = [
  'RC1381 TESTSERVICE stale-deploy guard',
  'Deploy ExportHUB TESTSERVICE',
  'RC1553 TESTSERVICE deployment identity prüfen',
  'RC1124 TESTSERVICE Browser Gate',
  'RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen',
  'RC1249 TESTSERVICE AVIS-Mail-Konfiguration prüfen',
  'RC1505 TESTSERVICE Readiness prüfen'
];

export function validateMainGate({ releaseSha, runs, jobs }) {
  if (!/^[a-f0-9]{40}$/i.test(String(releaseSha || '')))
    throw new Error('RC1612: ungültiger Release-SHA');
  if (!Array.isArray(runs) || !Array.isArray(jobs)) throw new Error('RC1612: GitHub-Nachweise fehlen');
  const matched = runs.filter(run => run?.head_sha === releaseSha &&
    run?.head_branch === 'main' && run?.event === 'push' &&
    String(run?.path || '').endsWith('/' + WORKFLOW) &&
    run?.status === 'completed' && run?.conclusion === 'success');
  if (matched.length !== 1) throw new Error('RC1612: keine eindeutige vollständig erfolgreiche Main Verification für den Release-SHA');
  const job = jobs.find(x => x?.name === 'verify_and_deploy_testservice' && x?.status === 'completed' && x?.conclusion === 'success');
  if (!job || !Array.isArray(job.steps)) throw new Error('RC1612: Main-Verification-Job nicht erfolgreich abgeschlossen');
  for (const name of REQUIRED_STEPS) {
    const matching = job.steps.filter(s => s?.name === name);
    if (matching.length !== 1 || matching[0].status !== 'completed' || matching[0].conclusion !== 'success')
      throw new Error('RC1612: erforderliches TESTSERVICE-Gate nicht erfolgreich: ' + name);
  }
  return { runId: matched[0].id, releaseSha, checkedSteps: REQUIRED_STEPS.length };
}

export async function verifyReleaseGate(env=process.env, fetchImpl=fetch) {
  const releaseSha = String(env.RELEASE_SHA || '').trim();
  const token = String(env.GITHUB_TOKEN || '').trim();
  const repository = String(env.GITHUB_REPOSITORY || '').trim();
  if (!/^[a-f0-9]{40}$/i.test(releaseSha) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token)
    throw new Error('RC1612: Release-SHA, Repository oder GitHub-Berechtigung fehlt');
  const headers = {
    Authorization:'Bearer '+token,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  };
  const base = 'https://api.github.com/repos/' + repository;
  const request = async url => {
    const response = await fetchImpl(url,{headers,signal:AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('RC1612: GitHub API-Anfrage nicht erfolgreich, HTTP '+response.status);
    return response.json();
  };
  const list = await request(base+'/actions/workflows/'+WORKFLOW+'/runs?branch=main&event=push&head_sha='+releaseSha+'&per_page=100');
  const runs = Array.isArray(list?.workflow_runs)?list.workflow_runs:[];
  // Explicitly require a completed success BEFORE fetching any jobs; a run in
  // progress cannot qualify by merely appearing in a workflow search result.
  const successful = runs.filter(x=>x?.head_sha===releaseSha&&x?.head_branch==='main'&&x?.event==='push'&&x?.status==='completed'&&x?.conclusion==='success'&&String(x?.path||'').endsWith('/'+WORKFLOW));
  if(successful.length !== 1 || !Number.isSafeInteger(successful[0]?.id))
    throw new Error('RC1612: keine eindeutige erfolgreich abgeschlossene Main Verification');
  const direct = await request(base+'/actions/runs/'+successful[0].id);
  if (direct?.id !== successful[0].id || direct?.head_sha !== releaseSha ||
      direct?.status !== 'completed' || direct?.conclusion !== 'success')
    throw new Error('RC1612: direkter Workflow-Status widerspricht dem Suchergebnis');
  const page = await request(base+'/actions/runs/'+direct.id+'/jobs?per_page=100');
  return validateMainGate({releaseSha,runs:[direct],jobs:Array.isArray(page?.jobs)?page.jobs:[]});
}

export async function runCli() {
  try {
    const result = await verifyReleaseGate();
    process.stdout.write('RC1612: exakt bestätigte Main Verification #'+result.runId+
      ' und '+result.checkedSteps+' TESTSERVICE-Gates grün für '+result.releaseSha+'.\n');
  } catch (error) {
    process.stderr.write(String(error?.message || 'RC1612: nicht freigegeben').slice(0,230)+'\n');
    process.exitCode=1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runCli();
