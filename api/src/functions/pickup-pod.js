import { app } from '@azure/functions';
import { createPickupService } from '../shared/core.js';
import { repository, blobs } from '../shared/azure-store.js';
import { readJson, fromResult, json } from '../shared/http.js';
const service = createPickupService({ repository, blobs });
app.http('pickup-pod', { methods: ['POST'], authLevel: 'anonymous', route: 'pickup-pod', handler: async (request) => {
  try { return fromResult(await service.upload(await readJson(request))); }
  catch (e) { return json({ error: e.message || 'Upload fehlgeschlagen.' }, e.status || 500); }
} });
