import { app } from '@azure/functions';
import { createPickupService } from '../shared/core.js';
import { repository, blobs } from '../shared/azure-store.js';
import { fromResult } from '../shared/http.js';
const service = createPickupService({ repository, blobs });
app.http('pickup-pod-file', { methods: ['GET'], authLevel: 'anonymous', route: 'pickup-pod-file', handler: async (request) => fromResult(await service.podFile(request.query.get('token'), request.query.get('file'))) });
