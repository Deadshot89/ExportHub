'use strict';

// RC1630 "Selbst korrigieren" (IT area): a global admin fixes texts/translations on the website.
// Nothing is changed live. Each request becomes a job that the GitHub workflow self-correct.yml claims
// (GitHub OIDC), applies to assets/i18n/*.json on main, tests and opens as a pull request. After the merge
// main deploys to TESTSERVICE only; Production still needs the manual "ExportHUB Production Release".
// "Rückgängig machen" creates a revert pull request for a merged correction the same way.

const crypto = require('crypto');
const apiI18n = require('../shared/i18n');
const rules = require('../shared/self-correct');
const { helpers } = require('../diagnostic-autofix/index.js');

const { validateGlobalAdmin, githubOidcAuthorized, httpsJson, readJson, uploadJson, service, appendAudit, sanitize, environmentOf, TEAM_CONTAINER, REPO, MAX_RETRIES } = helpers;
const WORKFLOW = process.env.EXPORTHUB_SELF_CORRECT_WORKFLOW || 'self-correct.yml';
const OIDC_AUDIENCE = 'exporthub-self-correct';
const JOBS_PROD_BLOB = process.env.EXPORTHUB_SELF_CORRECT_BLOB || 'self-correct/jobs.json';
const JOBS_TEST_BLOB = process.env.EXPORTHUB_TEST_SELF_CORRECT_BLOB || 'testservice/self-correct/jobs.json';
const MAX_JOBS = 200;
const ACTIVE = ['queued', 'claimed', 'running'];
const STATUSES = ['running', 'pr-open', 'failed'];
const PR_URL_RE = /^https:\/\/github\.com\/Deadshot89\/ExportHub\/pull\/(\d+)$/;

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function now() { return new Date().toISOString(); }
function json(status, body) { return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: JSON.stringify(body) }; }
function error(code, message, status = 400) { const e = new Error(message); e.code = code; e.status = status; return e; }
function body(req) { if (req && req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; } }
function token() { return text(process.env.EXPORTHUB_GITHUB_AUTOFIX_TOKEN); }
function enabled() { return !/^(0|false|no|off)$/i.test(text(process.env.EXPORTHUB_SELF_CORRECT_ENABLED)); }
function jobsBlob(env) { return service().getContainerClient(TEAM_CONTAINER).getBlockBlobClient(env === 'testservice' ? JOBS_TEST_BLOB : JOBS_PROD_BLOB); }
function jobId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function actor(admin) { return text(admin && (admin.name || admin.user)) || 'Admin'; }
function publicJob(job) { const out = Object.assign({}, job); delete out.requestedByUserId; return sanitize(out); }

async function mutateJobs(env, fn) {
  const blob = jobsBlob(env);
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const d = await readJson(blob, { schemaVersion: 1, revision: 0, jobs: [] }, false);
    const doc = d.value && typeof d.value === 'object' ? d.value : { schemaVersion: 1, revision: 0, jobs: [] };
    const jobs = Array.isArray(doc.jobs) ? doc.jobs.slice() : [];
    const result = fn(jobs);
    const next = { schemaVersion: 1, revision: Number(doc.revision || 0) + 1, updatedAt: now(), jobs: jobs.slice(-MAX_JOBS) };
    try { await uploadJson(blob, next, d.etag); return result; } catch (e) { if (e && (e.statusCode === 409 || e.statusCode === 412) && attempt < MAX_RETRIES - 1) continue; throw e; }
  }
  throw error('SELF_CORRECT_CONCURRENT_UPDATE', 'Gleichzeitige Änderung, bitte erneut versuchen.', 409);
}
async function readJobs(env) {
  const d = await readJson(jobsBlob(env), { jobs: [] }, false);
  return Array.isArray(d.value && d.value.jobs) ? d.value.jobs : [];
}
function updateJob(env, id, fn) {
  return mutateJobs(env, (jobs) => {
    const pos = jobs.findIndex((j) => j && j.id === id);
    if (pos < 0) throw error('SELF_CORRECT_JOB_NOT_FOUND', 'Auftrag nicht gefunden.', 404);
    jobs[pos] = Object.assign({}, jobs[pos], fn(jobs[pos]) || {}, { updatedAt: now() });
    return jobs[pos];
  });
}
function requireReady() {
  if (!enabled()) throw error('SELF_CORRECT_DISABLED', '„Selbst korrigieren“ ist auf diesem Server ausgeschaltet (EXPORTHUB_SELF_CORRECT_ENABLED).', 409);
  if (!token()) throw error('SELF_CORRECT_GITHUB_NOT_CONFIGURED', 'Die GitHub-Verbindung (EXPORTHUB_GITHUB_AUTOFIX_TOKEN) ist nicht eingerichtet.', 503);
}
async function dispatch(id, env) {
  const url = 'https://api.github.com/repos/' + REPO + '/actions/workflows/' + encodeURIComponent(WORKFLOW) + '/dispatches';
  await httpsJson('POST', url, { Authorization: 'Bearer ' + token(), 'X-GitHub-Api-Version': '2022-11-28' }, { ref: 'main', inputs: { job_id: id, environment: env } });
}
async function queue(env, admin, job, auditType) {
  await mutateJobs(env, (jobs) => {
    if (jobs.filter((j) => j && ACTIVE.includes(j.status)).length >= 3) throw error('SELF_CORRECT_BUSY', 'Es laufen schon drei Vorgänge. Bitte warten, bis einer fertig ist.', 409);
    jobs.push(job);
  });
  try { await dispatch(job.id, env); } catch (e) {
    await updateJob(env, job.id, () => ({ status: 'failed', message: 'GitHub-Workflow konnte nicht gestartet werden.' }));
    throw e;
  }
  try { await appendAudit(env, auditType, actor(admin), { jobId: job.id, type: job.type, reason: job.reason, targetPr: job.targetPr || null, changes: (job.changes || []).map((c) => c.lang + ':' + c.key) }); } catch (_) {}
  return { ok: true, job: publicJob(job) };
}

async function submitTexts(req, payload, env) {
  const admin = await validateGlobalAdmin(req, payload, env);
  requireReady();
  const { changes, reason } = rules.normalizeTextChanges(payload.changes, payload.reason);
  const job = { id: jobId('SC'), type: 'texts', status: 'queued', environment: env, changes, reason, requestedBy: actor(admin), requestedByUserId: text(admin.id), requestedAt: now(), message: '' };
  return queue(env, admin, job, 'SELF_CORRECT_TEXTS_REQUESTED');
}
async function requestRevert(req, payload, env) {
  const admin = await validateGlobalAdmin(req, payload, env);
  requireReady();
  const targetId = text(payload.jobId);
  const target = (await readJobs(env)).find((j) => j && j.id === targetId);
  if (!target || target.type !== 'texts') throw error('SELF_CORRECT_JOB_NOT_FOUND', 'Korrektur nicht gefunden.', 404);
  if (target.status !== 'merged' || !PR_URL_RE.test(text(target.prUrl))) throw error('SELF_CORRECT_NOT_MERGED', 'Nur übernommene (gemergte) Korrekturen können rückgängig gemacht werden.', 409);
  if (target.revertJobId) throw error('SELF_CORRECT_ALREADY_REVERTED', 'Für diese Korrektur gibt es schon einen Rückgängig-Auftrag.', 409);
  const why = text(payload.reason).slice(0, 500) || 'Rückgängig: ' + text(target.reason).slice(0, 400);
  const job = { id: jobId('SCR'), type: 'revert', status: 'queued', environment: env, targetJobId: target.id, targetPr: Number(PR_URL_RE.exec(target.prUrl)[1]), reason: why, requestedBy: actor(admin), requestedByUserId: text(admin.id), requestedAt: now(), message: '' };
  const result = await queue(env, admin, job, 'SELF_CORRECT_REVERT_REQUESTED');
  await updateJob(env, target.id, () => ({ revertJobId: job.id }));
  return result;
}
// Refreshes open pull requests from GitHub so the list shows merged/closed without a separate webhook.
async function refreshPullRequests(env, jobs) {
  if (!token()) return jobs;
  const open = jobs.filter((j) => j && j.status === 'pr-open' && PR_URL_RE.test(text(j.prUrl))).slice(-10);
  for (const job of open) {
    try {
      const n = PR_URL_RE.exec(job.prUrl)[1];
      const res = await httpsJson('GET', 'https://api.github.com/repos/' + REPO + '/pulls/' + n, { Authorization: 'Bearer ' + token(), 'X-GitHub-Api-Version': '2022-11-28' });
      const pr = JSON.parse(res.body || '{}');
      if (pr.merged_at) await updateJob(env, job.id, () => ({ status: 'merged', mergedAt: text(pr.merged_at), mergeCommit: text(pr.merge_commit_sha).slice(0, 40) }));
      else if (pr.state === 'closed') await updateJob(env, job.id, () => ({ status: 'closed', closedAt: text(pr.closed_at) }));
    } catch (_) { /* GitHub not reachable: keep the stored status */ }
  }
  return open.length ? readJobs(env) : jobs;
}
async function list(req, payload, env) {
  await validateGlobalAdmin(req, payload, env);
  const jobs = await refreshPullRequests(env, await readJobs(env));
  return { ok: true, enabled: enabled(), configured: Boolean(token()), environment: env, jobs: jobs.slice(-30).reverse().map(publicJob) };
}

async function callbackAuthorized(req) { return githubOidcAuthorized(req, WORKFLOW, ['workflow_dispatch'], OIDC_AUDIENCE); }
async function claim(payload, env) {
  const id = text(payload.jobId);
  const job = await updateJob(env, id, (j) => {
    if (j.status !== 'queued') throw error('SELF_CORRECT_JOB_NOT_QUEUED', 'Auftrag ist nicht mehr offen.', 409);
    return { status: 'claimed', claimedAt: now() };
  });
  let target = null;
  if (job.type === 'revert') target = (await readJobs(env)).find((j) => j && j.id === job.targetJobId) || null;
  return { ok: true, job: { id: job.id, type: job.type, environment: env, changes: job.changes || [], reason: job.reason, requestedBy: job.requestedBy, targetPr: job.targetPr || null, targetMergeCommit: target ? text(target.mergeCommit) : '' } };
}
async function workflowStatus(payload, env) {
  const id = text(payload.jobId), status = lower(payload.status);
  if (!STATUSES.includes(status)) throw error('SELF_CORRECT_STATUS_INVALID', 'Ungültiger Status.', 400);
  const prUrl = text(payload.prUrl), runUrl = text(payload.runUrl).slice(0, 500);
  if (prUrl && !PR_URL_RE.test(prUrl)) throw error('SELF_CORRECT_PR_INVALID', 'Ungültige PR-Adresse.', 400);
  const job = await updateJob(env, id, () => Object.assign({ status, message: text(payload.message).slice(0, 3000), runUrl }, prUrl ? { prUrl } : {}));
  if (status !== 'running') { try { await appendAudit(env, status === 'failed' ? 'SELF_CORRECT_FAILED' : 'SELF_CORRECT_PR_OPENED', 'ExportHUB Selbstkorrektur', { jobId: id, type: job.type, prUrl, runUrl }); } catch (_) {} }
  return { ok: true, jobId: id, status };
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204, headers: { 'Cache-Control': 'no-store', Allow: 'POST, OPTIONS' }, body: '' }; return; }
  if (req.method !== 'POST') { context.res = json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: apiI18n.t(req, 'api.common.postOnly') }); return; }
  try {
    const payload = body(req), env = environmentOf(req, payload), action = lower(payload.action || 'list');
    let result;
    if (action === 'list') result = await list(req, payload, env);
    else if (action === 'submit-texts') result = await submitTexts(req, payload, env);
    else if (action === 'revert') result = await requestRevert(req, payload, env);
    else if (action === 'claim' || action === 'workflow-status') {
      if (!(await callbackAuthorized(req))) throw error('SELF_CORRECT_CALLBACK_UNAUTHORIZED', 'Nicht autorisierter Workflow-Aufruf.', 401);
      result = action === 'claim' ? await claim(payload, env) : await workflowStatus(payload, env);
    } else throw error('SELF_CORRECT_ACTION_INVALID', 'Unbekannte Aktion.', 400);
    context.res = json(200, result);
  } catch (e) {
    context.log && context.log.error && context.log.error('self-correct', e && e.code, e && e.message);
    const raw = text(e && e.message), message = /^api\./.test(raw) ? apiI18n.t(req, raw, e && e.vars) : raw;
    context.res = json(Number(e.status || e.statusCode || 500), { ok: false, code: e.code || 'SERVER_ERROR', message: message || 'Selbstkorrektur fehlgeschlagen.' });
  }
};
