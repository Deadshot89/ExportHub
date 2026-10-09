import fs from 'node:fs';

const path='api/shared/pod-archive.js';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  if(first<0) throw new Error('Missing patch anchor: '+label);
  if(source.indexOf(from,first+from.length)>=0) throw new Error('Ambiguous patch anchor: '+label);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
  "const TEAM_POD_LINK_VERSION = 'RC1340';",
  "const TEAM_POD_LINK_VERSION = 'RC1340';\nconst POD_PDF_LAYOUT_VERSION = 'RC1361-STRUCTURED-V1';",
  'layout version constant'
);

replaceOnce(
  "function automaticPod(record) {\n  return (Array.isArray(record && record.podFiles) ? record.podFiles : []).find(file => String(file && file.kind || '').toLowerCase() === 'automatic-pod') || null;\n}",
  "function automaticPod(record) {\n  return (Array.isArray(record && record.podFiles) ? record.podFiles : []).find(file => String(file && file.kind || '').toLowerCase() === 'automatic-pod') || null;\n}\nfunction isCurrentAutomaticPod(file) {\n  return !!file && String(file.kind || '').toLowerCase() === 'automatic-pod' && text(file.layoutVersion) === POD_PDF_LAYOUT_VERSION;\n}",
  'current layout predicate'
);

replaceOnce(
  "page.drawRectangle({x,y:y-25,width,color:pale,borderColor:border,borderWidth:.7});",
  "page.drawRectangle({x,y:y-25,width,height:25,color:pale,borderColor:border,borderWidth:.7});",
  'table header geometry'
);

replaceOnce(
  "      kind: 'automatic-pod',\n      sha256: hash\n",
  "      kind: 'automatic-pod',\n      sha256: hash,\n      layoutversion: POD_PDF_LAYOUT_VERSION\n",
  'blob layout metadata'
);

replaceOnce(
  "    storage: 'azure',\n    hash,\n    source: 'pickup-confirm-v2'",
  "    storage: 'azure',\n    hash,\n    layoutVersion: POD_PDF_LAYOUT_VERSION,\n    source: 'pickup-confirm-v3'",
  'descriptor layout version'
);

replaceOnce(
  "  if (file) {\n    try {\n      const existing = await readAutomaticPodBuffer(accessKey, environment, record);",
  "  if (file && isCurrentAutomaticPod(file) && !options.force) {\n    try {\n      const existing = await readAutomaticPodBuffer(accessKey, environment, record);",
  'ensure current layout only'
);

const downloadHelpers=`\nasync function createShareLink(accessKey, environment) {\n  await ensureAutomaticPod(accessKey, environment, {});\n  const live = await store.getRecord(accessKey, environment);\n  const file = automaticPod(live.record);\n  if (!file || !isCurrentAutomaticPod(file)) throw new Error('Aktueller automatischer POD ist nicht gespeichert');\n  return {\n    file,\n    url: store.podDownloadUrl(accessKey, environment, file.id),\n    expiresAt: store.podLinkExpiry(live.record),\n    version: TEAM_POD_LINK_VERSION\n  };\n}\nasync function getPodDownload(accessKey, environment, fileId) {\n  const got = await store.getRecord(accessKey, environment);\n  const record = got.record;\n  let file = null;\n  if (fileId) file = (Array.isArray(record.podFiles) ? record.podFiles : []).find(item => text(item.id) === text(fileId));\n  if (!file) file = automaticPod(record);\n  if (!file) {\n    const created = await ensureAutomaticPod(accessKey, environment, {});\n    return { buffer: created.pdf || created.buffer, file: created.file, record: created.record };\n  }\n  if (file && !isCurrentAutomaticPod(file) && String(file.kind || '').toLowerCase() === 'automatic-pod') {\n    const regenerated = await ensureAutomaticPod(accessKey, environment, { force: true });\n    return { buffer: regenerated.pdf || regenerated.buffer, file: regenerated.file, record: regenerated.record };\n  }\n  const blobName = text(file.blobName || file.storageBlobName);\n  if (!blobName) throw new Error('POD-Datei ohne Speicherreferenz');\n  const blob = got.clients.pods.getBlobClient(blobName);\n  const read = await store.readBuffer(blob);\n  return { buffer: read.buffer, file, record };\n}\n`;

replaceOnce(
  "\nmodule.exports = {\n  automaticPod,",
  downloadHelpers+"\nmodule.exports = {\n  automaticPod,\n  isCurrentAutomaticPod,",
  'download helpers'
);

replaceOnce(
  "  ensureAutomaticPod,\n  retryArchiveBackup,",
  "  ensureAutomaticPod,\n  createShareLink,\n  getPodDownload,\n  readAutomaticPodBuffer,\n  retryArchiveBackup,",
  'download exports'
);

replaceOnce(
  "  saveSuppliedPod,\n  reconcilePendingBackups\n};",
  "  saveSuppliedPod,\n  reconcilePendingBackups,\n  POD_PDF_LAYOUT_VERSION,\n  TEAM_POD_LINK_VERSION\n};",
  'version exports'
);

fs.writeFileSync(path,source);
