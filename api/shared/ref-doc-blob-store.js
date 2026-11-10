'use strict';
// Unabhängige, private Azure-Kopie für Dokumente aus der Sendungsansicht (Lieferschein, Rechnung, Packliste, Excel, sonstige).
// Vorbild: av-blob-store.js. Fällt SharePoint/Graph aus, bleibt die hochgeladene Datei erhalten und lesbar.
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const { isolationConfig } = require('./testservice-auth-isolation');
const avBlob = require('./av-blob-store');

const CONTAINER = process.env.EXPORTHUB_DOCUMENT_CONTAINER || 'exporthub-documents';
const MAX_FILES = 500;
const MAX_BYTES = 15 * 1024 * 1024;

function text(value) { return String(value == null ? '' : value).trim(); }
function err(code, message, status = 503) { const e = new Error(message); e.code = code; e.status = status; return e; }
function environment(value) { return text(value).toLowerCase() === 'testservice' ? 'testservice' : 'production'; }
function client(env = 'production') {
  const isolated = environment(env) === 'testservice' ? isolationConfig() : { enabled: false };
  const cs = isolated.enabled ? isolated.connectionString : avBlob.connectionString();
  if (!cs) throw err('STORAGE_NOT_CONFIGURED', 'Der ExportHUB-Dokumentenspeicher ist nicht konfiguriert.');
  return BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER);
}
function prefix(ref, env) { return 'refdoc-v1/' + environment(env) + '/' + avBlob.refValue(ref) + '/'; }
function filename(name) {
  const value = text(name);
  if (!value || value.length > 180 || /[\\/\r\n\x00-\x1f]/.test(value)) throw err('REFDOC_NAME_INVALID', 'Ungültiger Dateiname.', 400);
  return value;
}
function fileId(uuid) { return 'refdoc:' + uuid; }
function fileFromBlob(blob, p) {
  const rest = blob.name.slice(p.length), m = rest.match(/^([0-9a-f]{32})\//);
  if (!m) return null;
  let name;
  try { name = decodeURIComponent(blob.name.slice(p.length + 33)); } catch (_) { return null; }
  const props = blob.properties || {};
  return {
    id: fileId(m[1]), name,
    size: Number(props.contentLength || 0),
    mimeType: text(props.contentType) || 'application/octet-stream',
    createdDateTime: props.createdOn ? new Date(props.createdOn).toISOString() : null,
    lastModifiedDateTime: props.lastModified ? new Date(props.lastModified).toISOString() : null,
    blobName: blob.name
  };
}
async function list(ref, env) {
  const c = client(env), p = prefix(ref, env), files = [];
  try {
    for await (const entry of c.listBlobsFlat({ prefix: p })) {
      const file = fileFromBlob(entry, p);
      if (!file) continue;
      if (files.length >= MAX_FILES) throw err('REFDOC_ARCHIVE_LIMIT', 'Zu viele Dokumente für eine vollständige Liste.');
      files.push(file);
    }
  } catch (e) {
    // Vor dem ersten Upload kann der private Container noch fehlen.
    if (Number(e && e.statusCode) === 404 && /^(ContainerNotFound|ResourceNotFound)$/i.test(text(e && e.code))) return [];
    throw e;
  }
  const deleted = new Set((await deletedRecords(ref, env)).map(r => r.id));
  return files.filter(f => !deleted.has(f.id));
}
async function save(ref, env, name, bytes, mimeType) {
  const r = avBlob.refValue(ref), n = filename(name), buffer = Buffer.from(bytes || []);
  if (!buffer.length || buffer.length > MAX_BYTES) throw err('REFDOC_FILE_INVALID', 'Die Datei ist leer oder zu groß.', 400);
  const c = client(env);
  await c.createIfNotExists();
  const id = crypto.randomBytes(16).toString('hex'), blobName = prefix(r, env) + id + '/' + encodeURIComponent(n);
  const blob = c.getBlockBlobClient(blobName), hash = crypto.createHash('sha256').update(buffer).digest('hex');
  await blob.uploadData(buffer, {
    conditions: { ifNoneMatch: '*' },
    blobHTTPHeaders: { blobContentType: text(mimeType) || 'application/octet-stream', blobCacheControl: 'private, no-store' },
    metadata: { reference: r, environment: environment(env), sha256: hash }
  });
  // Ein Schreibvorgang gilt erst als gespeichert, wenn die Bytes unabhängig zurückgelesen wurden.
  const readback = Buffer.from(await blob.downloadToBuffer());
  if (readback.length !== buffer.length || crypto.createHash('sha256').update(readback).digest('hex') !== hash)
    throw err('REFDOC_READBACK_FAILED', 'Der Upload konnte im sicheren Dokumentenspeicher nicht bestätigt werden.', 502);
  return { id: fileId(id), name: n, size: buffer.length, storage: 'azure-refdoc', blobName };
}
async function read(ref, env, id) {
  if (!/^refdoc:[0-9a-f]{32}$/.test(text(id))) throw err('REFDOC_ID_INVALID', 'Ungültige Dateikennung.', 400);
  const file = (await list(ref, env)).find(f => f.id === id);
  if (!file) throw err('REFDOC_NOT_FOUND', 'Dokument in dieser Sendung nicht gefunden.', 404);
  const bytes = Buffer.from(await client(env).getBlockBlobClient(file.blobName).downloadToBuffer());
  if (bytes.length !== file.size) throw err('REFDOC_READBACK_FAILED', 'Das gespeicherte Dokument ist unvollständig.', 502);
  return { file, buffer: bytes };
}


const REMOVED_ROOT = 'refdoc-removed-v1/';
function removedPrefix(ref, env) { return REMOVED_ROOT + environment(env) + '/' + avBlob.refValue(ref) + '/'; }
async function deletedRecords(ref, env) {
  const c = client(env), p = removedPrefix(ref, env), records = [];
  try {
    for await (const entry of c.listBlobsFlat({ prefix: p })) {
      if (!/^([0-9a-f]{32})\.json$/.test(entry.name.slice(p.length))) continue;
      if (records.length >= MAX_FILES) throw err('REFDOC_REMOVED_LIMIT', 'Zu viele Löschvermerke.', 503);
      const value = JSON.parse((await c.getBlockBlobClient(entry.name).downloadToBuffer()).toString('utf8'));
      if (value && /^refdoc:[0-9a-f]{32}$/.test(text(value.id)) && text(value.name)) records.push(value);
    }
  } catch (e) {
    if (Number(e && e.statusCode) === 404 && /^(ContainerNotFound|ResourceNotFound)$/i.test(text(e && e.code))) return [];
    throw e;
  }
  return records;
}
async function hiddenNames(ref, env) {
  return new Set((await deletedRecords(ref, env)).map(r => text(r.name).toLowerCase()));
}
async function softDelete(ref, env, id, actor) {
  const itemId = text(id);
  if (!/^refdoc:[0-9a-f]{32}$/.test(itemId))
    throw err('REFDOC_DELETE_FORBIDDEN', 'Nur hochgeladene Sendungsdokumente dürfen entfernt werden.', 403);
  const file = (await list(ref, env)).find(f => f.id === itemId);
  if (!file) throw err('REFDOC_NOT_FOUND', 'Dokument in dieser Sendung nicht gefunden.', 404);
  const uploadName = new RegExp('^(?:Lieferschein|Rechnung|Packliste|Excel|Dokument)_' + avBlob.refValue(ref) + '_[0-9]{8}-[0-9]{6}_', 'i');
  if (!uploadName.test(file.name))
    throw err('REFDOC_DELETE_FORBIDDEN', 'Originale und andere Belege sind vor dem Entfernen geschützt.', 403);
  const siblings = (await list(ref, env)).filter(f => f.name.toLowerCase() === file.name.toLowerCase());
  if (siblings.length !== 1) throw err('REFDOC_DELETE_AMBIGUOUS', 'Mehrere gleichnamige Uploads: bitte einzeln klären.', 409);
  const record = { id: itemId, name: file.name, reference: avBlob.refValue(ref), environment: environment(env), deletedAt: new Date().toISOString(), actor: text(actor) || 'authenticated-user', archived: true };
  const data = Buffer.from(JSON.stringify(record), 'utf8'), blob = client(env).getBlockBlobClient(removedPrefix(ref, env) + itemId.slice(7) + '.json');
  await blob.uploadData(data, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json', blobCacheControl: 'private, no-store' } });
  const verified = Buffer.from(await blob.downloadToBuffer());
  if (!verified.equals(data)) throw err('REFDOC_REMOVE_NOT_VERIFIED', 'Der Löschvermerk konnte nicht bestätigt werden.', 502);
  // Reversible removal: original Azure and SharePoint bytes remain archived; signed POD/AV are never changed.
  return { id: file.id, name: file.name, deleted: true, archiveRetained: true };
}

module.exports = { save, list, read, prefix, softDelete, hiddenNames };
