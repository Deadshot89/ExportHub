import { app } from '@azure/functions';
import { createPickupService } from '../shared/core.js';
import { repository, blobs } from '../shared/azure-store.js';
import { readJson, fromResult } from '../shared/http.js';
const service = createPickupService({ repository, blobs });
app.http('pickup-confirm', { methods: ['POST'], authLevel: 'anonymous', route: 'pickup-confirm', handler: async (request) => fromResult(await service.confirm(await readJson(request))) });
