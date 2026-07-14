import { TableClient } from '@azure/data-tables';
import { BlobServiceClient } from '@azure/storage-blob';

const connection = process.env.AzureWebJobsStorage;
if (!connection) throw new Error('AzureWebJobsStorage ist nicht konfiguriert.');

const table = TableClient.fromConnectionString(connection, 'ExportHubPickup');
const blobService = BlobServiceClient.fromConnectionString(connection);
const container = blobService.getContainerClient('exporthub-pod');
let initialized;

async function ensure() {
  if (!initialized) initialized = Promise.all([table.createTable().catch((e) => { if (e.statusCode !== 409) throw e; }), container.createIfNotExists()]);
  await initialized;
}

export const repository = {
  async get(token) {
    await ensure();
    try { return await table.getEntity('pickup', token); }
    catch (e) { if (e.statusCode === 404) return null; throw e; }
  },
  async insert(entity) { await ensure(); await table.createEntity(entity); },
  async update(entity) {
    await ensure();
    const options = entity.etag ? { etag: entity.etag } : undefined;
    await table.updateEntity(entity, 'Replace', options);
  }
};

export const blobs = {
  async put(name, data, type) {
    await ensure();
    const client = container.getBlockBlobClient(name);
    await client.uploadData(data, { blobHTTPHeaders: { blobContentType: type } });
  },
  async get(name) {
    await ensure();
    const client = container.getBlobClient(name);
    const response = await client.download();
    const chunks = [];
    for await (const chunk of response.readableStreamBody) chunks.push(chunk);
    return { data: Buffer.concat(chunks), type: response.contentType };
  }
};
