# Tech stack
- Root `package.json`: `"type": "module"`, Node >=20, Tests `.mjs` (`test/`) und `.cjs` (`tests/`) mit `node --test`.
- `api/package.json`: Node 20.x, Azure Functions (CommonJS, `require`), Blob ueber REST (`api/shared/blob-rest.js`), Mail/Dateien ueber Microsoft Graph (`graph-mail.js`, `graph-drive.js`).
- Hosting: Azure Static Web Apps, Routing in `staticwebapp.config.json` (Testservice: `staticwebapp.testservice.config.json`).
- E2E: Playwright (`playwright.config.mjs`, `e2e/specs`). Android: Gradle in `android-app/`.
- Serena-Sprache: typescript (deckt JS ab).
