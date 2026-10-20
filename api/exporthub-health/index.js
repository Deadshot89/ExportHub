'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const SHA40_PATTERN = /^[0-9a-f]{40}$/i;

function clean(value, maxLength = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

function completeMetadata(metadata) {
  return Boolean(
    metadata &&
    metadata.buildId &&
    SHA40_PATTERN.test(metadata.buildId) &&
    metadata.visibleRelease &&
    metadata.technicalBuild &&
    metadata.builtAt &&
    metadata.environment
  );
}

function incomingCorrelationId(req) {
  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const value = clean(headers['x-correlation-id'] || headers['X-Correlation-ID'], 128);
  return value && CORRELATION_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

function json(status, body, correlationId) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (correlationId) headers['X-Correlation-ID'] = correlationId;
  return {
    status,
    headers,
    body: JSON.stringify(body)
  };
}

function runtimeMetadata() {
  const metadata = {
    buildId: clean(process.env.EXPORTHUB_DEPLOY_BUILD_ID, 64),
    visibleRelease: clean(process.env.EXPORTHUB_DEPLOY_VISIBLE_RELEASE, 80),
    technicalBuild: clean(process.env.EXPORTHUB_DEPLOY_TECHNICAL_BUILD, 80),
    builtAt: clean(process.env.EXPORTHUB_DEPLOY_BUILT_AT, 80),
    environment: clean(process.env.EXPORTHUB_DEPLOY_ENVIRONMENT, 40)
  };
  return completeMetadata(metadata) ? metadata : null;
}

function fileMetadata() {
  const metadataPath = process.env.EXPORTHUB_RELEASE_METADATA_PATH
    ? path.resolve(process.env.EXPORTHUB_RELEASE_METADATA_PATH)
    : path.join(__dirname, '..', 'release-metadata.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return {
      buildId: clean(parsed.buildId, 64),
      visibleRelease: clean(parsed.visibleRelease, 80),
      technicalBuild: clean(parsed.technicalBuild, 80),
      builtAt: clean(parsed.builtAt, 80),
      environment: clean(parsed.environment, 40)
    };
  } catch (_) {
    return null;
  }
}

function deploymentIdentity() {
  const fromFile = fileMetadata();
  const fromRuntime = runtimeMetadata();
  const fileIsComplete = completeMetadata(fromFile);
  const metadata = (fileIsComplete ? fromFile : fromRuntime) || fromFile || {
    buildId: null,
    visibleRelease: null,
    technicalBuild: null,
    builtAt: null,
    environment: null
  };
  const complete = completeMetadata(metadata);
  const source = fileIsComplete
    ? 'release-metadata'
    : (fromRuntime
      ? 'runtime-env'
      : (metadata.buildId || metadata.visibleRelease || metadata.technicalBuild || metadata.builtAt || metadata.environment ? 'release-metadata' : 'none'));
  return {
    status: complete ? 'verified' : 'unknown',
    verified: complete,
    buildId: metadata.buildId,
    visibleRelease: metadata.visibleRelease,
    technicalBuild: metadata.technicalBuild,
    builtAt: metadata.builtAt,
    environment: metadata.environment,
    source
  };
}

module.exports = async function(context, req) {
  const correlationId = incomingCorrelationId(req || {});
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Cache-Control':'no-store',
        'Allow':'GET, OPTIONS',
        'X-Correlation-ID': correlationId
      },
      body: ''
    };
    return;
  }
  if (req.method !== 'GET') {
    context.res = json(405, {ok:false, code:'METHOD_NOT_ALLOWED', correlationId}, correlationId);
    return;
  }
  context.res = json(200, {
    ok: true,
    service: 'exporthub-health',
    version: 'RC1060',
    release: 'legacy-document-migration',
    deployment: deploymentIdentity(),
    correlationId,
    runtime: process.version,
    time: new Date().toISOString()
  }, correlationId);
};