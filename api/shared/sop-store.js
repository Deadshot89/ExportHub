'use strict';

// SOP2 Phase 1: private, per-document Azure Blob storage with optimistic ETag writes.
// Does not expose an HTTP endpoint or modify the legacy SOP collection.
const {isDeepStrictEqual} = require('node:util');
const {verifyChain} = require('./hash-chain');

const SOP_ID = /^SOP-EH-\d{3}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DOCS = 1000;
const MAX_ATTEMPTS = 7;
const PREFIX = 'sop2/docs/';
const VALID_ENVIRONMENTS = new Set(['production', 'testservice']);

function failure(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}
function validEnvironment(environment) {
  if (!VALID_ENVIRONMENTS.has(environment)) throw failure('INVALID_ENVIRONMENT', 400);
  return environment;
}
function validId(id) {
  if (typeof id !== 'string' || !SOP_ID.test(id)) throw failure('INVALID_SOP_ID', 400);
  return id;
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isMissingBlob(error) {
  return error && error.statusCode === 404 &&
    (error.code === 'BlobNotFound' || (error.details && error.details.errorCode === 'BlobNotFound'));
}
function isEtagConflict(error) { return error && (error.statusCode === 409 || error.statusCode === 412); }

function validateDoc(doc, expectedId) {
  if (!isObject(doc) || doc.schemaVersion !== 1 || doc.id !== expectedId ||
      !Number.isSafeInteger(doc.revision) || doc.revision < 1 ||
      typeof doc.title !== 'string' || typeof doc.area !== 'string' ||
      typeof doc.functionId !== 'string' || !Array.isArray(doc.versions) ||
      !Array.isArray(doc.events)) throw failure('STORAGE_DATA_INVALID', 503);
  const chain = verifyChain(doc.events);
  // Each document revision has one immutable event, preventing silent truncation.
  if (!chain.ok || doc.events.length !== doc.revision) throw failure('HISTORY_BROKEN', 409);
  for (const version of doc.versions) {
    if (!isObject(version) || typeof version.version !== 'string' ||
        typeof version.status !== 'string' || !Object.hasOwn(version, 'content')) {
      throw failure('STORAGE_DATA_INVALID', 503);
    }
  }
  return doc;
}
function safePrefix(value) {
  if (typeof value !== 'string' || value.startsWith('/') || value.includes('..') ||
      value.includes('\\') || value.includes('//') || !/^[A-Za-z0-9/_-]*$/.test(value)) {
    throw failure('INVALID_STORAGE_PREFIX', 503);
  }
  return value && !value.endsWith('/') ? value + '/' : value;
}
function connectionFor(containerFor, environment) {
  validEnvironment(environment);
  const result = containerFor(environment);
  if (!result || !result.container || typeof result.container.getBlockBlobClient !== 'function') {
    throw failure('STORAGE_NOT_CONFIGURED', 503);
  }
  const base = safePrefix(result.prefix === undefined ? '' : result.prefix);
  // The TESTSERVICE directory boundary is required, even if the injection omits it.
  // A separate Azure account may additionally isolate the test environment.
  const prefix = environment === 'testservice' && !base.startsWith('testservice/')
    ? 'testservice/' + base : base;
  return {container:result.container, path:prefix + PREFIX};
}
async function readBlob(blob, id) {
  let response;
  try { response = await blob.download(0); }
  catch (error) {
    if (isMissingBlob(error)) return {doc:null,etag:null};
    throw error;
  }
  if (!response || !response.etag || !response.readableStreamBody) throw failure('STORAGE_DATA_INVALID', 503);
  const parts = [];
  let bytes = 0;
  for await (const chunk of response.readableStreamBody) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BYTES) throw failure('STORAGE_TOO_LARGE', 413);
    parts.push(buffer);
  }
  let doc;
  try { doc = JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch (_) { throw failure('STORAGE_DATA_INVALID', 503); }
  // Never convert a stored JSON null, empty object or corrupted file to a new draft.
  return {doc:validateDoc(doc, id),etag:response.etag};
}

function createStore(containerFor) {
  if (typeof containerFor !== 'function') throw new TypeError('SOP_STORE_CONTAINER_REQUIRED');
  async function getDoc(environment, id) {
    validId(id);
    const {container,path} = connectionFor(containerFor,environment);
    return (await readBlob(container.getBlockBlobClient(path + id + '.json'),id)).doc;
  }
  async function listDocs(environment) {
    const {container,path} = connectionFor(containerFor,environment);
    if (typeof container.listBlobsFlat !== 'function') throw failure('STORAGE_LIST_UNAVAILABLE',503);
    const docs = [];
    let count = 0;
    for await (const item of container.listBlobsFlat({prefix:path})) {
      if (!item || typeof item.name !== 'string') throw failure('STORAGE_DATA_INVALID',503);
      const relative = item.name.slice(path.length);
      if (!/^SOP-EH-\d{3}\.json$/.test(relative) || !item.name.startsWith(path)) continue;
      if (++count > MAX_DOCS) throw failure('STORAGE_LIST_LIMIT',413);
      const id = relative.slice(0,-5);
      const {doc} = await readBlob(container.getBlockBlobClient(item.name),id);
      if (!doc) throw failure('STORAGE_DATA_INVALID',503);
      docs.push(doc);
    }
    return docs.sort((a,b)=>a.id.localeCompare(b.id));
  }
  async function mutateDoc(environment, id, updater, options={}) {
    validId(id);
    if (typeof updater !== 'function') throw new TypeError('SOP_STORE_UPDATER_REQUIRED');
    const {container,path} = connectionFor(containerFor,environment);
    const blob = container.getBlockBlobClient(path + id + '.json');
    for (let attempt=0; attempt<MAX_ATTEMPTS; attempt++) {
      const {doc,etag} = await readBlob(blob,id);
      if (options.create === true && doc) throw failure('SOP_EXISTS',409);
      if (options.create !== true && !doc) throw failure('SOP_NOT_FOUND',404);
      const candidate = await updater(doc ? clone(doc) : null);
      validateDoc(candidate,id);
      if (doc) {
        if (candidate.revision !== doc.revision + 1 ||
            candidate.events.length !== doc.events.length + 1 ||
            !isDeepStrictEqual(candidate.events.slice(0,-1),doc.events)) {
          throw failure('HISTORY_NOT_APPEND_ONLY',409);
        }
      } else if (candidate.revision !== 1 || candidate.events.length !== 1) {
        throw failure('HISTORY_NOT_APPEND_ONLY',409);
      }
      const raw = JSON.stringify(candidate);
      if (Buffer.byteLength(raw) > MAX_BYTES) throw failure('STORAGE_TOO_LARGE',413);
      try {
        await blob.upload(raw,Buffer.byteLength(raw),{
          blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},
          conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}
        });
        return clone(candidate);
      } catch (error) {
        if (isEtagConflict(error)) continue;
        throw error;
      }
    }
    throw failure('CONCURRENT_UPDATE',409);
  }
  return Object.freeze({getDoc,listDocs,mutateDoc});
}
function defaultStore() {
  const {BlobServiceClient} = require('@azure/storage-blob');
  const {isolationConfig,primaryConnection} = require('./testservice-auth-isolation');
  const containerFor = environment => {
    validEnvironment(environment);
    const isolated = environment === 'testservice' ? isolationConfig() : {enabled:false};
    const connection = isolated.enabled ? isolated.connectionString : primaryConnection(process.env);
    if (!connection) throw failure('STORAGE_NOT_CONFIGURED',503);
    const name = isolated.enabled ? isolated.container :
      (process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data');
    return {container:BlobServiceClient.fromConnectionString(connection).getContainerClient(name),
      prefix:environment === 'testservice' ? 'testservice/' : ''};
  };
  return createStore(containerFor);
}
module.exports = {createStore,defaultStore};
