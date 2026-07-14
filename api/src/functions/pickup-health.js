import { app } from '@azure/functions';
import { repository } from '../shared/azure-store.js';
import { json } from '../shared/http.js';

app.http('pickup-health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'pickup-health',
  handler: async () => {
    try {
      await repository.get('0'.repeat(48));
      return json({ ok: true, api: true, storage: true, service: 'ExportHUB Pickup API', time: new Date().toISOString() });
    } catch (error) {
      return json({ ok: false, api: true, storage: false, error: 'Azure-Speicher ist nicht erreichbar oder AzureWebJobsStorage fehlt.' }, 503);
    }
  }
});
