import { app } from '@azure/functions';
import { createPickupService } from '../shared/core.js';
import { repository, blobs } from '../shared/azure-store.js';
import { fromResult } from '../shared/http.js';
const service = createPickupService({ repository, blobs });
app.http('pickup-status', { methods: ['GET'], authLevel: 'anonymous', route: 'pickup-status', handler: async (request) => fromResult(await service.status(request.query.get('token'))) });
