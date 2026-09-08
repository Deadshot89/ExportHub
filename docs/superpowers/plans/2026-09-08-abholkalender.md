# RC1004 Abholkalender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB erhält eine Montag-bis-Freitag-Abholübersicht mit getrennten, wiederkehrenden FIX-Stammdaten und konkreten SENDUNG-Einträgen inklusive Heute-Ansicht, Teilabholungs-Restmengen und serverseitig abgesicherter Admin-Verwaltung.

**Architecture:** Fixe Abholungen werden in einem eigenen, umgebungs- und firmenbezogenen Blob-Dokument gespeichert; reale Sendungen bleiben ausschließlich eine Projektion des bestehenden ExportHUB-Sendungs-/Pickup-Zustands. Eine fokussierte Frontend-Einheit baut aus beiden Quellen ein gemeinsames Ansichtsmodell, rendert Heute + Montag bis Freitag und behandelt Ladefehler beider Quellen unabhängig. Es gibt keine automatische Verknüpfung oder Umwandlung zwischen FIX und SENDUNG.

**Tech Stack:** Azure Static Web Apps, Node.js CommonJS Azure Functions, bestehender Azure-Blob-REST-Client `api/shared/blob-rest.js`, bestehende ExportHUB-Sitzungs-/Rechteprüfung, browserseitiges Vanilla JavaScript/CSS, Node `node:test` + `assert`.

**Spec:** `docs/superpowers/specs/2026-09-08-abholkalender-design.md`

## Global Constraints

- Kalender ausschließlich Montag bis Freitag.
- Keine Uhrzeit- oder Zeitfensterfelder für fixe Abholungen.
- Heute-Übersicht oberhalb der Wochenansicht.
- FIX und SENDUNG bleiben fachlich und technisch getrennte Quellen.
- FIX erzeugt niemals automatisch eine Sendung; SENDUNG wird niemals automatisch FIX.
- Keine automatische Zuordnung von FIX zu SENDUNG über Kundennamen oder Standort.
- Teilabholungen bleiben offen, bis Restmenge `0` erreicht.
- Normale Mitarbeiter dürfen fixe Abholungen lesen, aber nicht verändern.
- Nur administrative Benutzer dürfen FIX-Einträge anlegen, ändern, deaktivieren oder reaktivieren.
- Schreibrechte werden serverseitig geprüft.
- Produktions- und Testservice-Daten werden getrennt gespeichert; Host/Origin und angeforderte Umgebung dürfen sich nicht widersprechen.
- Firmen-/Mandantenbezug wird bei jedem FIX-Lese- und Schreibzugriff serverseitig aufgelöst und geprüft.
- Ein nicht-administrativer Legacy-Benutzer ohne Firmenmetadaten darf niemals durch einen selbst gesetzten Header in einen beliebigen Firmenkontext wechseln.
- Keine realen Kunden oder Standorte werden im Runtime-Code hart codiert; insbesondere werden keine zusätzlichen Kunden automatisch angelegt.
- Produktion wird in diesem Plan nicht direkt verändert oder deployed.

---

## File Structure

**Neu**
- `api/shared/company-context.js` — löst den aktuellen Firmen-/Mandantenkontext aus authentifiziertem Benutzer + Request auf und verhindert Cross-Company-Zugriffe.
- `api/shared/fixed-pickup-store.js` — validiert FIX-Datensätze, löst die Datenumgebung sicher auf und persistiert umgebungs-/mandantengetrennt mit ETag-Retry.
- `api/fixed-pickups/index.js` — GET/POST/PATCH-API, Authentifizierung, Rollenprüfung und Fehlerantworten.
- `api/fixed-pickups/function.json` — HTTP-Trigger für `fixed-pickups`.
- `assets/abholkalender.js` — reine Kalenderprojektion plus Browser-Controller/Renderer; keine serverseitige Persistenzlogik.
- `assets/abholkalender.css` — ausschließlich Layout/Statusdarstellung der Heute-/Wochen-/Adminansicht.
- `test/rc1004-company-context.test.mjs` — Mandantenauflösung, Legacy-Fallback und Fremdzugriffsschutz.
- `test/rc1004-fixed-pickup-store.test.mjs` — Datenmodell, keine Uhrzeitfelder, Umgebungs-/Tenant-Isolation und Soft-Deaktivierung.
- `test/rc1004-fixed-pickups-api.test.mjs` — Mitarbeiter-GET, Admin-Schreibzugriffe, Firmen- und Umgebungsfehler.
- `test/rc1004-abholkalender-model.test.mjs` — Montag–Freitag-Projektion, Heute, SENDUNG-Restmengen und keine automatische Verknüpfung.
- `test/rc1004-abholkalender-ui.test.mjs` — Asset-/HTML-Vertrag, Navigation, FIX/SENDUNG-Trennung und Fehlerisolation.

**Ändern**
- `api/shared/user-policy.js` — Modulrecht `pickupcalendar`; normale Benutzer erhalten standardmäßig Leserecht, Admins Adminrecht.
- `index.html` — Abholkalender in Navigation/Page-Routing aufnehmen und `assets/abholkalender.css/js` laden.
- `TESTVERSION.html` — identische Laufzeitintegration wie Produktionskandidat, aber bestehende Testservice-Umgebung beibehalten.
- `RELEASE_MANIFEST.txt` — neue Runtime-Dateien in den Release-Vertrag aufnehmen.
- `.github/workflows/rc1002-main-contract.yml` — RC1004-Tests in den zukünftigen Main-Verifikationsvertrag aufnehmen; keine Deploy- oder Branch-Trigger für RC1004 hinzufügen.

---

### Task 1: Firmenkontext und Abholkalender-Leserecht

**Files:**
- Create: `api/shared/company-context.js`
- Modify: `api/shared/user-policy.js`
- Test: `test/rc1004-company-context.test.mjs`

**Interfaces:**
- Consumes: authentifizierter `user` aus `auth-store.validateSession(req)` und Azure-Function-`req`.
- Produces: `resolveCompanyContext(req, user) -> { companyKey, requestedCompanyKey, allowedCompanyKeys }`; Modulrecht `pickupcalendar` ist für normale aktive Benutzer mindestens `view` und für Admins `admin`.

- [ ] **Step 1: Write the failing company-context and rights tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ctx = require('../api/shared/company-context.js');
const policy = require('../api/shared/user-policy.js');

test('Firmenkontext nutzt die am Benutzer gebundene Firma', () => {
  const out = ctx.resolveCompanyContext({ headers: {} }, { companyId: 'ESSENTRA' });
  assert.equal(out.companyKey, 'essentra');
});

test('Benutzer darf keine andere Firma per Header auswählen', () => {
  assert.throws(
    () => ctx.resolveCompanyContext(
      { headers: { 'x-exporthub-company-id': 'KONTUR' } },
      { companyId: 'ESSENTRA', role: 'Benutzer' }
    ),
    e => e && e.code === 'COMPANY_FORBIDDEN' && e.statusCode === 403
  );
});

test('Legacy-Benutzer ohne Firmenfeld bleiben im Legacy-Kontext', () => {
  const out = ctx.resolveCompanyContext({ headers: {} }, { id: 'USER-1', role: 'Benutzer' });
  assert.equal(out.companyKey, 'legacy-default');
});

test('Legacy-Benutzer ohne Firmenfeld kann keine Firma per Header erfinden', () => {
  assert.throws(
    () => ctx.resolveCompanyContext(
      { headers: { 'x-exporthub-company-id': 'ESSENTRA' } },
      { id: 'USER-1', role: 'Benutzer' }
    ),
    e => e && e.code === 'COMPANY_FORBIDDEN' && e.statusCode === 403
  );
});

test('pickupcalendar ist für Mitarbeiter lesbar und für Admins administrierbar', () => {
  const employee = policy.normalizeUser({ user: 'Mitarbeiter', role: 'Benutzer' }, 0);
  const admin = policy.normalizeUser({ user: 'Admin', role: 'admin' }, 0);
  assert.equal(employee.rights.pickupcalendar.level, 'view');
  assert.equal(employee.rights.pickupcalendar.edit, false);
  assert.equal(admin.rights.pickupcalendar.level, 'admin');
  assert.equal(admin.rights.pickupcalendar.edit, true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/rc1004-company-context.test.mjs`

Expected: FAIL because `api/shared/company-context.js` does not exist and `pickupcalendar` is not yet part of `MODULES`.

- [ ] **Step 3: Implement the minimal company resolver and policy change**

`api/shared/company-context.js` must use this exact policy:

```js
'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function key(v){
  return text(v).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function error(code, message, statusCode){
  const e = new Error(message);
  e.code = code; e.status = statusCode; e.statusCode = statusCode;
  return e;
}
function values(user){
  const raw = [user && user.companyId, user && user.companyKey, user && user.tenantId, user && user.tenant];
  for (const listName of ['companyIds','allowedCompanyIds']) {
    const list = user && user[listName];
    if (Array.isArray(list)) raw.push(...list);
  }
  if (Array.isArray(user && user.companies)) {
    for (const c of user.companies) raw.push(typeof c === 'string' ? c : c && (c.id || c.key || c.companyId));
  }
  return [...new Set(raw.map(key).filter(Boolean))];
}
function requested(req){
  const h = req && req.headers || {}, q = req && req.query || {}, b = req && req.body || {};
  return key(h['x-exporthub-company-id'] || h['X-ExportHUB-Company-Id'] || q.companyId || b.companyId);
}
function isGlobalAdmin(user){
  const role = text(user && (user.role || user.rolle)).toLowerCase();
  return Boolean(user && (
    user.globalAdmin === true ||
    role === 'admin' ||
    /global.?admin|administrator|vollzugriff/.test(role) ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'))
  ));
}
function resolveCompanyContext(req, user){
  const allowed = values(user), wanted = requested(req), admin = isGlobalAdmin(user);
  if (!admin && wanted && allowed.length && !allowed.includes(wanted)) {
    throw error('COMPANY_FORBIDDEN','Kein Zugriff auf diese Firma.',403);
  }
  if (!admin && wanted && !allowed.length && wanted !== 'legacy-default') {
    throw error('COMPANY_FORBIDDEN','Für dieses Benutzerkonto ist keine andere Firma freigegeben.',403);
  }
  const companyKey = admin
    ? (wanted || allowed[0] || 'legacy-default')
    : (wanted || allowed[0] || 'legacy-default');
  return { companyKey, requestedCompanyKey: wanted, allowedCompanyKeys: allowed };
}
module.exports = { text, key, values, requested, resolveCompanyContext, isGlobalAdmin };
```

In `api/shared/user-policy.js` add `pickupcalendar` to `MODULES`. In **beiden** Fallback-Stellen (`defaultRights` und `normalizeRights`) gilt für Nicht-Admins: `start`, `dashboard` und `pickupcalendar` => `view`; alle anderen bisherigen Standardrechte bleiben unverändert.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/rc1004-company-context.test.mjs`

Expected: PASS, 5 tests, 0 failures.

- [ ] **Step 5: Run existing user/right regressions**

Run: `npm test`

Expected: exit code 0 and no new auth/right failures.

- [ ] **Step 6: Commit**

```bash
git add api/shared/company-context.js api/shared/user-policy.js test/rc1004-company-context.test.mjs
git commit -m "feat: Abholkalender Firmenkontext und Leserecht"
```

---

### Task 2: Eigenständiger FIX-Stammdaten-Store und sichere Umgebungsauflösung

**Files:**
- Create: `api/shared/fixed-pickup-store.js`
- Test: `test/rc1004-fixed-pickup-store.test.mjs`

**Interfaces:**
- Consumes: Azure-Function-Request für Umgebungsauflösung, `companyKey`, validierte FIX-Nutzdaten.
- Produces:
  - `resolveEnvironment(req, payload) -> 'production'|'testservice'`
  - `validateInput(payload, { partial }) -> sanitized payload`
  - `list(environment, companyKey, { includeInactive }) -> item[]`
  - `create(environment, companyKey, payload, actor) -> item`
  - `update(environment, companyKey, id, patch, actor) -> item`
  - `publicItem(item) -> { id, siteLabel, weekday, note, active, createdAt, updatedAt }`

- [ ] **Step 1: Write failing store tests**

Use an in-memory mock for `./blob-rest`. Required tests:

```js
test('FIX-Modell akzeptiert Montag bis Freitag und keine Uhrzeiten', () => {
  assert.equal(store.validateInput({ siteLabel:'Teststandort', weekday:1, note:'' }, {partial:false}).weekday,1);
  assert.throws(() => store.validateInput({siteLabel:'Teststandort',weekday:6},{partial:false}), /Montag bis Freitag/);
  assert.throws(() => store.validateInput({siteLabel:'Teststandort',weekday:2,time:'10:00'},{partial:false}), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
  assert.throws(() => store.validateInput({siteLabel:'Teststandort',weekday:2,pickupStart:'10:00'},{partial:false}), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
});

test('Produktionshost darf keine Testservice-Umgebung anfordern', () => {
  assert.throws(
    () => store.resolveEnvironment({headers:{origin:'https://example.azurestaticapps.net','x-exporthub-environment':'testservice'}},{}),
    e => e.code === 'ENVIRONMENT_MISMATCH' && e.statusCode === 409
  );
});

test('Testservice- und Produktionsdaten benutzen getrennte Blob-Pfade', async () => {
  await store.create('production','firma-a',{siteLabel:'Produktion',weekday:1},'Admin');
  await store.create('testservice','firma-a',{siteLabel:'Testservice',weekday:1},'Admin');
  assert.deepEqual((await store.list('production','firma-a',{})).map(x=>x.siteLabel),['Produktion']);
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel),['Testservice']);
});

test('Firmen erhalten getrennte FIX-Dokumente', async () => {
  await store.create('testservice','firma-a',{siteLabel:'A',weekday:2},'Admin');
  await store.create('testservice','firma-b',{siteLabel:'B',weekday:2},'Admin');
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel),['A']);
  assert.deepEqual((await store.list('testservice','firma-b',{})).map(x=>x.siteLabel),['B']);
});

test('Deaktivieren ist soft und reaktivierbar', async () => {
  const created = await store.create('testservice','firma-a',{siteLabel:'A',weekday:3},'Admin');
  await store.update('testservice','firma-a',created.id,{active:false},'Admin');
  assert.equal((await store.list('testservice','firma-a',{})).length,0);
  assert.equal((await store.list('testservice','firma-a',{includeInactive:true}))[0].active,false);
  const active = await store.update('testservice','firma-a',created.id,{active:true},'Admin');
  assert.equal(active.active,true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/rc1004-fixed-pickup-store.test.mjs`

Expected: FAIL because `fixed-pickup-store.js` does not exist.

- [ ] **Step 3: Implement environment resolution matching the current ExportHUB state rules**

Use the current storage configuration family from `api/exporthub-state/index.js`:

```js
const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const FIX_PREFIX = String(process.env.EXPORTHUB_FIXED_PICKUPS_PREFIX || 'fixed-pickups').replace(/^\/+|\/+$/g,'');
function connectionString(){
  return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING ||
    process.env.EXPORTHUB_STORAGE_CONNECTION ||
    process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING || '';
}
```

`resolveEnvironment(req,payload)` mirrors the safe behavior from `api/exporthub-state/index.js`:
- accepted explicit values: only `production`, `testservice`;
- testservice origin/host + explicit `production` => `ENVIRONMENT_MISMATCH`/409;
- production Azure Static Web Apps origin/host + explicit `testservice` => `ENVIRONMENT_MISMATCH`/409;
- invalid explicit value => `ENVIRONMENT_INVALID`/400;
- otherwise infer testservice from `-testservice.` evidence, else production.

- [ ] **Step 4: Implement isolated blob naming, validation, ETag mutation and soft state**

The same Azure container is used, but environment and tenant are encoded in the **blob path**, avoiding a duplicate application-state store:

```js
function tenantDigest(companyKey){
  return crypto.createHash('sha256').update(String(companyKey)).digest('hex').slice(0,24);
}
function blobName(environment, companyKey){
  const prefix = environment === 'testservice' ? `testservice/${FIX_PREFIX}` : FIX_PREFIX;
  return `${prefix}/${tenantDigest(companyKey)}.json`;
}
function emptyDocument(environment, companyKey){
  return {schemaVersion:1,environment,companyKey,revision:0,updatedAt:null,items:[]};
}
```

`validateInput` exact rules:
- reject any present value for `time`, `startTime`, `endTime`, `pickupStart`, `pickupEnd`, `timeWindow`, `plannedPickupStart`, `plannedPickupEnd` with `TIME_FIELDS_NOT_ALLOWED`/400;
- `siteLabel`: trimmed, create-required, 1–180 chars;
- `weekday`: integer 1–5, create-required;
- `note`: optional, max 500 chars;
- `active`: boolean when present;
- caller cannot overwrite `id`, `companyKey`, `environment`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

`create` generates `FIX-${crypto.randomBytes(12).toString('hex')}`, sets `active:true`, timestamps and actor fields. `update` changes only `siteLabel`, `weekday`, `note`, `active`; there is no hard delete. Mutation retries up to 4 times on HTTP 412 and otherwise preserves the Azure error. Missing id => `FIX_NOT_FOUND`/404.

- [ ] **Step 5: Run store tests and verify GREEN**

Run: `node --test test/rc1004-fixed-pickup-store.test.mjs`

Expected: PASS, 5 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add api/shared/fixed-pickup-store.js test/rc1004-fixed-pickup-store.test.mjs
git commit -m "feat: fixe Abholungen isoliert speichern"
```

---

### Task 3: Authentifizierte FIX-API mit Admin-Schreibschutz

**Files:**
- Create: `api/fixed-pickups/index.js`
- Create: `api/fixed-pickups/function.json`
- Test: `test/rc1004-fixed-pickups-api.test.mjs`

**Interfaces:**
- Consumes: `auth-store.validateSession(req)`, `company-context.resolveCompanyContext(req,user)`, `fixed-pickup-store.resolveEnvironment/list/create/update`.
- Produces:
  - `GET /api/fixed-pickups` -> 200 `{ok:true,items,canEdit,environment,companyKey}`
  - `GET /api/fixed-pickups?includeInactive=1` -> inactive records only for admins
  - `POST /api/fixed-pickups` -> 201 `{ok:true,item}`
  - `PATCH /api/fixed-pickups` -> 200 `{ok:true,item}`
  - `OPTIONS` -> 204
  - unsupported method -> 405.

- [ ] **Step 1: Write failing API tests with the repository's `Module._load` mocking pattern**

Use the helper pattern from `.github/rc995/rc995-flow.test.cjs` and test these exact behaviors:

```js
test('Mitarbeiter kann aktive fixe Abholungen lesen', async () => {
  auth.validateSession = async () => ({user:{id:'U1',role:'Benutzer',companyId:'A'}});
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{'x-exporthub-environment':'testservice'},query:{}});
  assert.equal(ctx.res.status,200);
  assert.equal(bodyOf(ctx.res).canEdit,false);
});

test('Mitarbeiter kann FIX-Daten nicht schreiben', async () => {
  auth.validateSession = async () => ({user:{id:'U1',role:'Benutzer',companyId:'A'}});
  const ctx = context();
  await handler(ctx,{method:'POST',headers:{},body:{siteLabel:'A',weekday:1}});
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'ADMIN_REQUIRED');
});

test('Admin kann anlegen und deaktivieren', async () => {
  auth.validateSession = async () => ({user:{id:'A1',name:'Admin',role:'admin',globalAdmin:true,companyId:'A'}});
  const created = context();
  await handler(created,{method:'POST',headers:{'x-exporthub-environment':'testservice'},body:{siteLabel:'A',weekday:1}});
  assert.equal(created.res.status,201);
  const changed = context();
  await handler(changed,{method:'PATCH',headers:{'x-exporthub-environment':'testservice'},body:{id:bodyOf(created.res).item.id,active:false}});
  assert.equal(changed.res.status,200);
  assert.equal(bodyOf(changed.res).item.active,false);
});

test('Fremdfirma wird vor Store-Zugriff abgewiesen', async () => {
  auth.validateSession = async () => ({user:{id:'U1',role:'Benutzer',companyId:'A'}});
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{'x-exporthub-company-id':'B'},query:{}});
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'COMPANY_FORBIDDEN');
});

test('Umgebungs-Mismatch wird als 409 zurückgegeben', async () => {
  auth.validateSession = async () => ({user:{id:'U1',role:'Benutzer',companyId:'A'}});
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{origin:'https://example.azurestaticapps.net','x-exporthub-environment':'testservice'},query:{}});
  assert.equal(ctx.res.status,409);
  assert.equal(bodyOf(ctx.res).code,'ENVIRONMENT_MISMATCH');
});
```

- [ ] **Step 2: Run the API test and verify RED**

Run: `node --test test/rc1004-fixed-pickups-api.test.mjs`

Expected: FAIL because endpoint/function definition does not exist.

- [ ] **Step 3: Implement endpoint**

Use this control flow in `api/fixed-pickups/index.js`:

```js
'use strict';
const auth = require('../shared/auth-store');
const companies = require('../shared/company-context');
const store = require('../shared/fixed-pickup-store');

module.exports = async function(context,req){
  const method = String(req && req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') { context.res = auth.json(204,{}); return; }
  try {
    if (!['GET','POST','PATCH'].includes(method)) throw auth.error('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);
    const session = await auth.validateSession(req);
    const company = companies.resolveCompanyContext(req,session.user);
    const payload = auth.body(req);
    const environment = store.resolveEnvironment(req,payload);
    const admin = auth.isAdmin(session.user);

    if (method === 'GET') {
      const includeInactive = admin && String(req.query && req.query.includeInactive || '') === '1';
      const items = await store.list(environment,company.companyKey,{includeInactive});
      context.res = auth.json(200,{ok:true,items,canEdit:admin,environment,companyKey:company.companyKey});
      return;
    }

    if (!admin) throw auth.error('ADMIN_REQUIRED','Nur Administratoren dürfen fixe Abholungen ändern.',403);
    const actor = session.user.name || session.user.user || 'Admin';
    if (method === 'POST') {
      const item = await store.create(environment,company.companyKey,payload,actor);
      context.res = auth.json(201,{ok:true,item});
      return;
    }
    const id = String(payload.id || '').trim();
    if (!id) throw auth.error('FIX_ID_REQUIRED','FIX-ID fehlt.',400);
    const item = await store.update(environment,company.companyKey,id,payload,actor);
    context.res = auth.json(200,{ok:true,item});
  } catch(e) {
    context.res = auth.json(e.status || e.statusCode || 500,{
      ok:false,
      code:e.code || 'FIXED_PICKUPS_FAILED',
      message:e.message || 'Fixe Abholungen konnten nicht verarbeitet werden.'
    });
  }
};
```

`api/fixed-pickups/function.json`:

```json
{
  "bindings": [
    {"authLevel":"anonymous","type":"httpTrigger","direction":"in","name":"req","methods":["get","post","patch","options"],"route":"fixed-pickups"},
    {"type":"http","direction":"out","name":"res"}
  ]
}
```

- [ ] **Step 4: Run API + context/store tests and verify GREEN**

Run: `node --test test/rc1004-company-context.test.mjs test/rc1004-fixed-pickup-store.test.mjs test/rc1004-fixed-pickups-api.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add api/fixed-pickups test/rc1004-fixed-pickups-api.test.mjs
git commit -m "feat: fixe Abholungen per API verwalten"
```

---

### Task 4: Reine Kalenderprojektion für Heute und Montag–Freitag

**Files:**
- Create: `assets/abholkalender.js`
- Test: `test/rc1004-abholkalender-model.test.mjs`

**Interfaces:**
- Consumes: `{today:Date,fixedPickups:Array,shipments:Array}`.
- Produces browser- und testbare Funktionen via CommonJS **und** `globalThis.ExportHubPickupCalendar`:
  - `buildCalendarModel({today,fixedPickups,shipments})`
  - `shipmentPickupDate(shipment)`
  - `shipmentColliState(shipment)`
  - `weekdayLabel(weekday)`
  - `dateKeyLocal(date)`.

- [ ] **Step 1: Write failing projection tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const calendar = require('../assets/abholkalender.js');

test('Wochenmodell enthält genau Montag bis Freitag', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[],shipments:[]});
  assert.deepEqual(model.days.map(d=>d.label),['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']);
  assert.equal(model.days.length,5);
});

test('Heute enthält nur den aktuellen regulären Kalendertag', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[{id:'F1',siteLabel:'A',weekday:2,active:true}],shipments:[]});
  assert.equal(model.today.regular,true);
  assert.equal(model.today.weekday,2);
  assert.equal(model.today.fixed.length,1);
});

test('FIX wiederholt sich per Wochentag und bleibt von SENDUNG getrennt', () => {
  const model = calendar.buildCalendarModel({
    today:new Date(2026,8,8,12),
    fixedPickups:[{id:'F1',siteLabel:'Standort A',weekday:2,active:true}],
    shipments:[{id:'S1',reference:'ABC123',customer:'Standort A',plannedPickupDate:'2026-09-08'}]
  });
  const tue = model.days.find(d=>d.weekday===2);
  assert.equal(tue.fixed.length,1);
  assert.equal(tue.shipments.length,1);
  assert.equal(tue.fixed[0].id,'F1');
  assert.equal(tue.shipments[0].reference,'ABC123');
});

test('Teilabholung zeigt Gesamt, abgeholt und offen', () => {
  const state = calendar.shipmentColliState({expectedColliCount:10,collectedPickupCollis:4,remainingPickupCollis:6,status:'partial'});
  assert.deepEqual(state,{expected:10,collected:4,remaining:6,partial:true,complete:false});
});

test('Sendung ohne geplanten Abholtag wird nicht künstlich eingeordnet', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[],shipments:[{reference:'NO-DATE',actualPickupDate:'2026-09-08'}]});
  assert.equal(model.days.flatMap(d=>d.shipments).length,0);
});
```

- [ ] **Step 2: Run model test and verify RED**

Run: `node --test test/rc1004-abholkalender-model.test.mjs`

Expected: FAIL because `assets/abholkalender.js` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Use numeric weekdays `1..5`. `shipmentPickupDate` reads only planning fields in this order: `plannedPickupDate`, `pickupDate`, `pickdate`. It must **not** use `actualPickupDate` as Ersatzplanung.

`shipmentColliState`:

```js
const expected = positive(sh.expectedColliCount || sh.totalCollis || sh.totalColli || sh.colliCount);
const collected = nonNegative(sh.collectedPickupCollis ?? sh.pickupCollectedColliCount ?? 0);
const explicitRemaining = sh.remainingPickupCollis ?? sh.pickupRemainingColliCount;
const remaining = explicitRemaining != null ? nonNegative(explicitRemaining) : Math.max(0,expected-collected);
return {
  expected,
  collected,
  remaining,
  partial: collected > 0 && remaining > 0,
  complete: expected > 0 && remaining === 0
};
```

Week computation uses local calendar dates, finds the Monday containing `today`, and creates exactly five day objects. Active FIX records are placed solely by numeric weekday. SENDUNG entries are placed solely by planned pickup date. Do not compare `siteLabel`, customer, recipient or address for matching.

For Saturday/Sunday, `model.today` is `{regular:false,weekday:null,fixed:[],shipments:[]}` while `model.days` still describes the Monday–Friday week.

- [ ] **Step 4: Run model test and verify GREEN**

Run: `node --test test/rc1004-abholkalender-model.test.mjs`

Expected: PASS, 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/abholkalender.js test/rc1004-abholkalender-model.test.mjs
git commit -m "feat: Abholkalender Wochenmodell erstellen"
```

---

### Task 5: Heute-/Wochenansicht, Admin-Verwaltung und unabhängige Fehlerzustände

**Files:**
- Modify: `assets/abholkalender.js`
- Create: `assets/abholkalender.css`
- Test: `test/rc1004-abholkalender-ui.test.mjs`

**Interfaces:**
- Consumes: DOM root, vorhandene `shipments`, environment/company context und FIX-API.
- Produces:
  - `createViewState()`
  - `mount(root,options)`
  - `render(root,viewState)`
  - `setShipments(shipments)`
  - `loadFixedPickups()`
  - Admin form only when API `canEdit:true`.

- [ ] **Step 1: Add failing UI contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const calendar = require('../assets/abholkalender.js');

test('UI enthält Heute, FIX, SENDUNG und Montag bis Freitag', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/Heute/);
  assert.match(js,/FIX/);
  assert.match(js,/SENDUNG/);
  for (const day of ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']) assert.match(js,new RegExp(day));
  assert.doesNotMatch(js,/Samstag|Sonntag/);
});

test('UI führt keine Uhrzeitfelder für fixe Abholungen ein', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.doesNotMatch(js,/type=["']time["']/);
  assert.doesNotMatch(js,/pickupStart|pickupEnd|timeWindow/);
});

test('FIX- und SENDUNG-Ladefehler werden getrennt gehalten', () => {
  const state = calendar.createViewState();
  state.fixedPickups = [{id:'F1'}];
  state.shipments = [{reference:'S1'}];
  state.fixedError = 'FIX konnte nicht geladen werden';
  assert.equal(state.shipments.length,1);
  assert.equal(state.fixedError,'FIX konnte nicht geladen werden');
  assert.equal(state.shipmentError,null);
});
```

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because renderer/view state/CSS/admin UI are not present.

- [ ] **Step 3: Implement controller state and independent source loading**

`createViewState()` returns:

```js
{
  fixedPickups: [],
  shipments: [],
  canEdit: false,
  fixedLoading: false,
  shipmentLoading: false,
  fixedError: null,
  shipmentError: null,
  editingFix: null,
  saveError: null
}
```

For `environment==='demo'`, do not call the FIX write API; use `fixedPickups:[]`, `canEdit:false`. For production/testservice, `loadFixedPickups()` calls `/api/fixed-pickups` with `credentials:'same-origin'` and stable headers:

```js
{
  'Accept':'application/json',
  'Content-Type':'application/json',
  'X-ExportHUB-Environment': environment,
  'X-ExportHUB-Company-Id': companyId || ''
}
```

A FIX request failure sets only `fixedError`; it never clears `shipments`. `setShipments()` updates only shipment state and `shipmentError`; it never clears `fixedPickups`.

- [ ] **Step 4: Implement renderer**

Stable root structure:

```html
<section class="pickup-today" data-pickup-calendar-today>
  <h2>Heute</h2>
  <div data-today-fixed></div>
  <div data-today-shipments></div>
</section>
<section class="pickup-week" data-pickup-calendar-week></section>
```

Each of five day cards contains two source sections:
- Badge `FIX`, `siteLabel`, optional `note`.
- Badge `SENDUNG`, reference, customer/recipient, optional carrier, status, Gesamt-Colli; for partial pickup additionally `Bereits abgeholt: N` and `Noch offen: N`.

If today is Saturday/Sunday, the Heute section says `Heute ist kein regulärer Abholkalendertag.` without adding weekend day cards.

- [ ] **Step 5: Implement admin dialog without time controls**

When `canEdit:true`, show `Fixe Abholungen verwalten`. Form fields are exactly:

```html
<input name="siteLabel" required maxlength="180">
<select name="weekday" required>
  <option value="1">Montag</option>
  <option value="2">Dienstag</option>
  <option value="3">Mittwoch</option>
  <option value="4">Donnerstag</option>
  <option value="5">Freitag</option>
</select>
<textarea name="note" maxlength="500"></textarea>
<label><input name="active" type="checkbox"> Aktiv</label>
```

Create uses POST. Edit/deactivate/reactivate uses PATCH. Do not optimistically change list state before a 2xx response. On failure, keep all entered form values, set `saveError`, and keep dialog open. Non-admin users never receive edit/deactivate controls in rendered HTML.

- [ ] **Step 6: Add feature-scoped responsive CSS**

```css
.pickup-calendar{display:grid;gap:16px}
.pickup-week{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.pickup-day{min-width:0;border:1px solid var(--border,#dbe4ee);border-radius:16px;padding:12px}
.pickup-badge{font-size:.72rem;font-weight:800;letter-spacing:.04em}
.pickup-source-error{padding:10px;border-radius:10px}
@media(max-width:1000px){.pickup-week{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.pickup-week{grid-template-columns:1fr}}
```

Do not restyle global buttons, cards, body, navigation or unrelated ExportHUB components.

- [ ] **Step 7: Run model + UI tests and verify GREEN**

Run: `node --test test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add assets/abholkalender.js assets/abholkalender.css test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs
git commit -m "feat: Abholkalender Heute und Woche darstellen"
```

---

### Task 6: ExportHUB-Navigation und bestehende Sendungsquelle anbinden

**Files:**
- Modify: `index.html`
- Modify: `TESTVERSION.html`
- Modify: `test/rc1004-abholkalender-ui.test.mjs`

**Interfaces:**
- Consumes: bestehendes ExportHUB Routing/Navigation, aktuelle Umgebung/Firma und die bereits geladene Sendungscollection.
- Produces: Seite/Route `pickupcalendar`; beim Öffnen wird `ExportHubPickupCalendar.mount(...)` einmal initialisiert, danach werden State-Aktualisierungen über `setShipments(...)` weitergereicht.

- [ ] **Step 1: Extend UI test with failing production/test parity contracts**

```js
for (const file of ['index.html','TESTVERSION.html']) {
  const html = fs.readFileSync(file,'utf8');
  assert.match(html,/abholkalender\.css/);
  assert.match(html,/abholkalender\.js/);
  assert.match(html,/pickupcalendar/);
  assert.match(html,/Abholkalender/);
  assert.equal((html.match(/id=["']pickupCalendarRoot["']/g)||[]).length,1);
}
```

Also reuse the script extraction/`new Function(...)` compile approach from `test/rc1003-task-render-syntax.test.mjs` so a broken runtime script in either large HTML file fails before deployment.

- [ ] **Step 2: Run UI contract and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because the new assets/page are not yet referenced by both HTML files.

- [ ] **Step 3: Integrate assets and route without restructuring the monolith**

In **both** `index.html` and `TESTVERSION.html`:

1. Load `/assets/abholkalender.css` in `<head>`.
2. Load `/assets/abholkalender.js` once with other runtime assets.
3. Add navigation/module id `pickupcalendar` with visible label `Abholkalender` using the same navigation markup/pattern as neighboring module entries.
4. Add root exactly once:

```html
<div id="pickupCalendarRoot" class="pickup-calendar" data-page="pickupcalendar"></div>
```

5. In the existing page/routing switch, when `pickupcalendar` becomes active, use the same in-memory shipment collection that currently feeds Sendungsübersicht/Aufgaben. Do **not** perform a second full team-state request only for the calendar.
6. Initial bridge call:

```js
ExportHubPickupCalendar.mount(document.getElementById('pickupCalendarRoot'),{
  environment: currentEnvironment,
  companyId: currentCompanyId,
  shipments: currentShipments
});
```

7. On later state refreshes:

```js
ExportHubPickupCalendar.setShipments(currentShipments);
```

If the current runtime variable names differ, map the **existing** environment/company/shipment values at this bridge only. Do not create a duplicate shipment store or calendar copy of the team state.

- [ ] **Step 4: Verify navigation/runtime tests**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs test/rc1002-release-sync.test.mjs test/rc1003-task-render-syntax.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add index.html TESTVERSION.html test/rc1004-abholkalender-ui.test.mjs
git commit -m "feat: Abholkalender in ExportHUB einbinden"
```

---

### Task 7: Release-Vertrag und Schutz vor hart codierten Stammdaten

**Files:**
- Modify: `RELEASE_MANIFEST.txt`
- Modify: `test/rc1004-abholkalender-ui.test.mjs`
- Modify: `.github/workflows/rc1002-main-contract.yml`

**Interfaces:**
- Consumes: complete RC1004 runtime from Tasks 1–6.
- Produces: Release-Manifest + zukünftiger Main-Vertrag kennen RC1004; keine Deployment-Änderung.

- [ ] **Step 1: Add failing release assertions**

`test/rc1004-abholkalender-ui.test.mjs` checks `RELEASE_MANIFEST.txt` for:

```text
api/fixed-pickups/function.json
api/fixed-pickups/index.js
api/shared/company-context.js
api/shared/fixed-pickup-store.js
assets/abholkalender.css
assets/abholkalender.js
```

Add a runtime source scan over `api/shared/fixed-pickup-store.js`, `api/fixed-pickups/index.js`, `assets/abholkalender.js` asserting that the explicitly excluded customer names `BSH`, `TOYOTA`, `REHAU`, `Siemens` are absent. Also assert that no array/object named `seed`, `initialCustomers`, `fixedCustomers` or `defaultPickups` is introduced in those runtime files.

- [ ] **Step 2: Run release/UI test and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because release manifest/main verification contract are not yet updated.

- [ ] **Step 3: Update release manifest and future main verification contract**

Add the six runtime paths above to `RELEASE_MANIFEST.txt` using the repository's current grouping/order.

In `.github/workflows/rc1002-main-contract.yml`, add before `Gesamte Node-Regression`:

```yaml
      - name: RC1004 Abholkalender-Vertrag
        run: node --test test/rc1004-company-context.test.mjs test/rc1004-fixed-pickup-store.test.mjs test/rc1004-fixed-pickups-api.test.mjs test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs
```

Do not change its current `main` trigger, do not add the RC1004 branch as trigger, and do not add Azure deployment steps.

- [ ] **Step 4: Run focused RC1004 suite and verify GREEN**

Run: `node --test test/rc1004-company-context.test.mjs test/rc1004-fixed-pickup-store.test.mjs test/rc1004-fixed-pickups-api.test.mjs test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add RELEASE_MANIFEST.txt .github/workflows/rc1002-main-contract.yml test/rc1004-abholkalender-ui.test.mjs
git commit -m "test: RC1004 Abholkalender Releasevertrag"
```

---

### Task 8: Vollständige Regression, Build und Review-Gate

**Files:**
- No planned feature-file additions in this task. If verification exposes a defect, change only the owning RC1004 test + smallest production file after reproducing RED.

**Interfaces:**
- Consumes: complete RC1004 branch.
- Produces: fresh verification evidence for RC1004, tasks, QR/partial pickup, diagnostics, rights and three-environment build.

- [ ] **Step 1: Run complete focused RC1004 suite**

```bash
node --test \
  test/rc1004-company-context.test.mjs \
  test/rc1004-fixed-pickup-store.test.mjs \
  test/rc1004-fixed-pickups-api.test.mjs \
  test/rc1004-abholkalender-model.test.mjs \
  test/rc1004-abholkalender-ui.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 2: Run protected existing regressions**

```bash
node --test test/rc1003-task-render-syntax.test.mjs
node --test test/rc1002-release-sync.test.mjs test/rc1002-task-groups.test.mjs test/rc1001-task-tiles-cleanup.test.mjs
node --test .github/rc1000/rc1000-production-pickup.test.mjs
node --test .github/rc998/partial-pickup-avis-contract.test.mjs
node --test .github/rc997/diagnostic-notifications-contract.test.mjs
npm test
```

Expected: every command exits 0 with no test failures.

- [ ] **Step 3: Run three-environment build and diff checks**

```bash
node .github/rc1002/build-three-env.mjs
git diff --check
test -f dist-rc1002/index.html
test -f dist-rc1002/TESTVERSION.html
test -f dist-rc1002/demo.html
```

Expected: exit 0. Demo must not write production/testservice FIX data; its calendar is read-only/empty unless the existing demo bootstrap deliberately supplies synthetic local display data.

- [ ] **Step 4: Inspect branch diff against approved RC1003 base**

```bash
git diff --stat 42f96e9d84801b6e47aaa192195aff3710d26f59...HEAD
git diff --check 42f96e9d84801b6e47aaa192195aff3710d26f59...HEAD
git diff 42f96e9d84801b6e47aaa192195aff3710d26f59...HEAD -- \
  api/shared/company-context.js \
  api/shared/fixed-pickup-store.js \
  api/fixed-pickups \
  api/shared/user-policy.js \
  assets/abholkalender.js \
  assets/abholkalender.css \
  index.html TESTVERSION.html \
  RELEASE_MANIFEST.txt \
  test/rc1004-*.test.mjs
```

Expected: only RC1004-related runtime/tests/docs plus no `production-version.js` bump and no production deployment workflow change.

- [ ] **Step 5: Request code review before merge/release**

Use `superpowers:requesting-code-review`. Review specifically:
- tenant isolation and Legacy fallback;
- host/environment mismatch protection;
- admin-only writes;
- no time fields;
- no hard-coded customer seeds;
- FIX/SENDUNG separation;
- partial pickup/rest quantity handling;
- independent source error states;
- `index.html`/`TESTVERSION.html` runtime parity.

- [ ] **Step 6: Fix a verification finding only through a fresh RED/GREEN cycle**

For any finding:
1. add the smallest reproducing test to the owning RC1004 test file;
2. run it and observe expected RED;
3. make the smallest production change;
4. rerun focused test and complete verification;
5. commit exact files.

Example commit command after a verified fix:

```bash
git add test/rc1004-abholkalender-ui.test.mjs assets/abholkalender.js
git commit -m "fix: RC1004 Verifikationsfund beheben"
```

If no defect is found, make no empty commit.

- [ ] **Step 7: Stop before production**

Do not merge to `main`, do not change `production-version.js`, and do not trigger production deployment in this task. Hand the verified branch and review result back for the explicit release decision.
