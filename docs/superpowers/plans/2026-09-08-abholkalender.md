# RC1004 Abholkalender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB erhält eine Montag-bis-Freitag-Abholübersicht mit getrennten, wiederkehrenden FIX-Stammdaten und konkreten SENDUNG-Einträgen inklusive Heute-Ansicht, Teilabholungs-Restmengen und serverseitig abgesicherter Admin-Verwaltung.

**Architecture:** Fixe Abholungen werden in einem eigenen, umgebungs- und firmenbezogenen Blob-Store gespeichert; reale Sendungen bleiben ausschließlich Projektion des bestehenden ExportHUB-Sendungs-/Pickup-Zustands. Eine kleine eigenständige Frontend-Einheit baut aus beiden Quellen ein gemeinsames Ansichtsmodell, rendert Heute + Montag bis Freitag und behandelt Ladefehler beider Quellen unabhängig. Es gibt keine automatische Verknüpfung oder Umwandlung zwischen FIX und SENDUNG.

**Tech Stack:** Azure Static Web Apps, Node.js CommonJS Azure Functions, Azure Blob Storage über `api/shared/blob-rest.js`, bestehende ExportHUB-Sitzungs-/Rechteprüfung, browserseitiges Vanilla JavaScript/CSS, Node `node:test` + `assert`.

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
- Produktions- und Testservice-Daten werden getrennt gespeichert.
- Firmen-/Mandantenbezug wird bei jedem FIX-Lese- und Schreibzugriff serverseitig aufgelöst und geprüft.
- Keine realen Kunden oder Standorte werden im Code hart codiert; insbesondere werden keine zusätzlichen Kunden automatisch angelegt.
- Produktion wird in diesem Plan nicht direkt verändert oder deployed.

---

## File Structure

**Neu**
- `api/shared/company-context.js` — löst den aktuellen Firmen-/Mandantenkontext aus authentifiziertem Benutzer + Request auf und verhindert Cross-Company-Zugriffe.
- `api/shared/fixed-pickup-store.js` — validiert FIX-Datensätze und persistiert sie umgebungs-/mandantengetrennt mit ETag-Retry.
- `api/fixed-pickups/index.js` — GET/POST/PATCH-API, Authentifizierung, Rollenprüfung, Fehlerantworten.
- `api/fixed-pickups/function.json` — HTTP-Trigger für `fixed-pickups`.
- `assets/abholkalender.js` — reine Kalenderprojektion plus Browser-Controller/Renderer; keine Persistenzlogik.
- `assets/abholkalender.css` — ausschließlich Layout/Statusdarstellung der Heute-/Wochen-/Adminansicht.
- `test/rc1004-company-context.test.mjs` — Mandantenauflösung und Fremdzugriffsschutz.
- `test/rc1004-fixed-pickup-store.test.mjs` — Datenmodell, Validierung, Umgebungs-/Tenant-Isolation, Soft-Deaktivierung.
- `test/rc1004-fixed-pickups-api.test.mjs` — GET für Mitarbeiter, Admin-Schreibzugriffe, Fehlercodes.
- `test/rc1004-abholkalender-model.test.mjs` — Montag–Freitag-Projektion, Heute, SENDUNG-Restmengen, keine automatische Verknüpfung.
- `test/rc1004-abholkalender-ui.test.mjs` — HTML-/Asset-Vertrag, Navigation, FIX/SENDUNG-Trennung, Fehlerisolation.

**Ändern**
- `api/shared/user-policy.js` — Modulrecht `pickupcalendar`; normale Benutzer erhalten standardmäßig Leserecht, Admins Adminrecht.
- `index.html` — Abholkalender in Navigation/Page-Routing aufnehmen und `assets/abholkalender.css/js` laden.
- `TESTVERSION.html` — identische Laufzeitintegration wie Produktion-Kandidat, Testservice-Umgebung beibehalten.
- `RELEASE_MANIFEST.txt` — neue API-, Asset- und Testdateien in den Release-Vertrag aufnehmen.
- `.github/workflows/rc1002-main-contract.yml` — RC1004-Tests nur dann ergänzen, wenn der Workflow als zukünftiger Main-Vertrag genutzt wird; der Branch selbst wird nicht deployed.

---

### Task 1: Firmenkontext und Abholkalender-Leserecht

**Files:**
- Create: `api/shared/company-context.js`
- Modify: `api/shared/user-policy.js`
- Test: `test/rc1004-company-context.test.mjs`

**Interfaces:**
- Consumes: authentifizierter `user` aus `auth-store.validateSession(req)` und Azure-Function-`req`.
- Produces: `resolveCompanyContext(req, user) -> { companyKey, requestedCompanyKey, allowedCompanyKeys }`, `canWritePickupCalendar(user) -> boolean` über bestehende Adminlogik; Modulrecht `pickupcalendar` ist für normale aktive Benutzer mindestens `view` und für Admins `admin`.

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
    () => ctx.resolveCompanyContext({ headers: { 'x-exporthub-company-id': 'KONTUR' } }, { companyId: 'ESSENTRA' }),
    e => e && e.code === 'COMPANY_FORBIDDEN' && e.statusCode === 403
  );
});

test('Legacy-Benutzer ohne Firmenfeld bleiben im isolierten Legacy-Kontext', () => {
  const out = ctx.resolveCompanyContext({ headers: {} }, { id: 'USER-1' });
  assert.equal(out.companyKey, 'legacy-default');
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
  const e = new Error(message); e.code = code; e.status = statusCode; e.statusCode = statusCode; return e;
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
  return user && (user.globalAdmin === true || role === 'admin' || /global.?admin|administrator|vollzugriff/.test(role) || (Array.isArray(user.permissions) && user.permissions.includes('*')));
}
function resolveCompanyContext(req, user){
  const allowed = values(user), wanted = requested(req);
  if (wanted && allowed.length && !allowed.includes(wanted) && !isGlobalAdmin(user)) throw error('COMPANY_FORBIDDEN','Kein Zugriff auf diese Firma.',403);
  const companyKey = wanted || allowed[0] || 'legacy-default';
  return { companyKey, requestedCompanyKey: wanted, allowedCompanyKeys: allowed };
}
module.exports = { text, key, values, requested, resolveCompanyContext, isGlobalAdmin };
```

In `api/shared/user-policy.js` add `pickupcalendar` to `MODULES`, and make the non-admin fallback for `start`, `dashboard` **and** `pickupcalendar` equal to `view`. Keep all existing rights behavior unchanged for other modules.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/rc1004-company-context.test.mjs`

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 5: Run existing auth/user regression**

Run: `npm test -- --test-name-pattern="auth|user|rights|permission"`

Expected: no new failures. If the repository's `npm test` script does not forward the filter, run `npm test` and require exit code 0.

- [ ] **Step 6: Commit**

```bash
git add api/shared/company-context.js api/shared/user-policy.js test/rc1004-company-context.test.mjs
git commit -m "feat: Abholkalender Firmenkontext und Leserecht"
```

---

### Task 2: Eigenständiger FIX-Stammdaten-Store

**Files:**
- Create: `api/shared/fixed-pickup-store.js`
- Test: `test/rc1004-fixed-pickup-store.test.mjs`

**Interfaces:**
- Consumes: `environment` (`production` oder `testservice`), `companyKey`, und validierte FIX-Nutzdaten.
- Produces:
  - `normalizeEnvironment(value) -> 'production'|'testservice'`
  - `validateInput(payload, { partial }) -> sanitized payload`
  - `list(environment, companyKey, { includeInactive }) -> item[]`
  - `create(environment, companyKey, payload, actor) -> item`
  - `update(environment, companyKey, id, patch, actor) -> item`
  - `publicItem(item) -> { id, siteLabel, weekday, note, active, createdAt, updatedAt }`

- [ ] **Step 1: Write failing store tests**

The test must mock `../shared/blob-rest` with an in-memory container and verify these behaviors:

```js
test('FIX-Modell akzeptiert Montag bis Freitag und keine Uhrzeiten', () => {
  assert.equal(store.validateInput({ siteLabel: 'Teststandort', weekday: 1, note: '' }, { partial: false }).weekday, 1);
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 6 }, { partial: false }), /Montag bis Freitag/);
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 2, time: '10:00' }, { partial: false }), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
  assert.throws(() => store.validateInput({ siteLabel: 'Teststandort', weekday: 2, pickupStart: '10:00' }, { partial: false }), e => e.code === 'TIME_FIELDS_NOT_ALLOWED');
});

test('Produktions- und Testservice-FIX-Daten sind getrennt', async () => {
  await store.create('production', 'firma-a', { siteLabel: 'Produktion', weekday: 1 }, 'Admin');
  await store.create('testservice', 'firma-a', { siteLabel: 'Testservice', weekday: 1 }, 'Admin');
  assert.deepEqual((await store.list('production','firma-a',{})).map(x=>x.siteLabel), ['Produktion']);
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel), ['Testservice']);
});

test('Firmen erhalten getrennte FIX-Dokumente', async () => {
  await store.create('testservice', 'firma-a', { siteLabel: 'A', weekday: 2 }, 'Admin');
  await store.create('testservice', 'firma-b', { siteLabel: 'B', weekday: 2 }, 'Admin');
  assert.deepEqual((await store.list('testservice','firma-a',{})).map(x=>x.siteLabel), ['A']);
  assert.deepEqual((await store.list('testservice','firma-b',{})).map(x=>x.siteLabel), ['B']);
});

test('Deaktivieren ist soft und reaktivierbar', async () => {
  const created = await store.create('testservice','firma-a',{siteLabel:'A',weekday:3},'Admin');
  await store.update('testservice','firma-a',created.id,{active:false},'Admin');
  assert.equal((await store.list('testservice','firma-a',{})).length, 0);
  assert.equal((await store.list('testservice','firma-a',{includeInactive:true}))[0].active, false);
  const active = await store.update('testservice','firma-a',created.id,{active:true},'Admin');
  assert.equal(active.active, true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/rc1004-fixed-pickup-store.test.mjs`

Expected: FAIL because `fixed-pickup-store.js` does not exist.

- [ ] **Step 3: Implement the store with an isolated blob per environment/company**

Use `createBlobServiceClient` from `api/shared/blob-rest.js`, the same storage connection string family already used by ExportHUB, and these exact document rules:

```js
const crypto = require('crypto');
const { createBlobServiceClient } = require('./blob-rest');
const TIME_KEYS = ['time','startTime','endTime','pickupStart','pickupEnd','timeWindow','plannedPickupStart','plannedPickupEnd'];
const CONTAINERS = { production: 'state', testservice: 'exporthub-testservice' };

function blobName(companyKey){
  const digest = crypto.createHash('sha256').update(String(companyKey)).digest('hex').slice(0,24);
  return `fixed-pickups/${digest}.json`;
}
function emptyDocument(environment, companyKey){
  return { schemaVersion: 1, environment, companyKey, revision: 0, updatedAt: null, items: [] };
}
```

`validateInput` rules:
- reject any present `TIME_KEYS` value with code `TIME_FIELDS_NOT_ALLOWED`, status 400;
- `siteLabel`: trimmed, required on create, max 180 chars;
- `weekday`: integer `1..5`, required on create;
- `note`: optional, max 500 chars;
- `active`: boolean only when present;
- never accept `id`, `companyKey`, `environment`, `createdAt`, `updatedAt` from the caller as authoritative values.

`create` generates `FIX-<24 hex>` with `crypto.randomBytes(12).toString('hex')`, sets `active:true`, actor fields, timestamps and writes with ETag protection. `update` mutates only `siteLabel`, `weekday`, `note`, `active`, keeps `createdAt`, sets `updatedAt`/`updatedBy`, and returns `FIX_NOT_FOUND`/404 when the id is absent. Implement max 4 retries on HTTP 412.

- [ ] **Step 4: Run the store test and verify GREEN**

Run: `node --test test/rc1004-fixed-pickup-store.test.mjs`

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 5: Commit**

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
- Consumes: `auth-store.validateSession(req)`, `company-context.resolveCompanyContext(req,user)`, `fixed-pickup-store`.
- Produces HTTP API:
  - `GET /api/fixed-pickups` -> `{ ok:true, items:[...], canEdit:boolean, environment, companyKey }`
  - `GET /api/fixed-pickups?includeInactive=1` -> inactive items only when caller is admin.
  - `POST /api/fixed-pickups` -> 201 `{ ok:true, item }`.
  - `PATCH /api/fixed-pickups` with `{ id, ...patch }` -> 200 `{ ok:true, item }`.
  - `OPTIONS` -> 204.
  - `DELETE` and unsupported methods -> 405.

- [ ] **Step 1: Write failing API tests using `Module._load` mocks**

Use the existing `.github/rc995/rc995-flow.test.cjs` pattern to mock auth/context/store. Required assertions:

```js
test('Mitarbeiter kann aktive fixe Abholungen lesen', async () => {
  auth.validateSession = async () => ({ user:{ id:'U1', role:'Benutzer', companyId:'A' } });
  const ctx = context();
  await handler(ctx,{ method:'GET', headers:{'x-exporthub-environment':'testservice'}, query:{} });
  assert.equal(ctx.res.status,200);
  assert.equal(bodyOf(ctx.res).canEdit,false);
});

test('Mitarbeiter kann FIX-Daten nicht schreiben', async () => {
  auth.validateSession = async () => ({ user:{ id:'U1', role:'Benutzer', companyId:'A' } });
  const ctx = context();
  await handler(ctx,{ method:'POST', headers:{}, body:{siteLabel:'A',weekday:1} });
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'ADMIN_REQUIRED');
});

test('Admin kann anlegen und deaktivieren', async () => {
  auth.validateSession = async () => ({ user:{ id:'A1', name:'Admin', role:'admin', globalAdmin:true, companyId:'A' } });
  const created = context();
  await handler(created,{method:'POST',headers:{'x-exporthub-environment':'testservice'},body:{siteLabel:'A',weekday:1}});
  assert.equal(created.res.status,201);
  const changed = context();
  await handler(changed,{method:'PATCH',headers:{'x-exporthub-environment':'testservice'},body:{id:bodyOf(created.res).item.id,active:false}});
  assert.equal(changed.res.status,200);
  assert.equal(bodyOf(changed.res).item.active,false);
});

test('Fremdfirma wird vor Store-Zugriff abgewiesen', async () => {
  auth.validateSession = async () => ({ user:{ id:'U1', role:'Benutzer', companyId:'A' } });
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{'x-exporthub-company-id':'B'},query:{}});
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'COMPANY_FORBIDDEN');
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

function environment(req){
  const h=req&&req.headers||{}, q=req&&req.query||{}, b=req&&req.body||{};
  const raw=String(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||q.environment||b.environment||'production').toLowerCase();
  return store.normalizeEnvironment(raw);
}
module.exports = async function(context, req){
  if (req.method === 'OPTIONS') { context.res = auth.json(204,{}); return; }
  try {
    const method = String(req.method||'GET').toUpperCase();
    if (!['GET','POST','PATCH'].includes(method)) throw auth.error('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);
    const session = await auth.validateSession(req);
    const company = companies.resolveCompanyContext(req, session.user);
    const env = environment(req);
    const admin = auth.isAdmin(session.user);
    if (method === 'GET') {
      const includeInactive = admin && String(req.query&&req.query.includeInactive||'') === '1';
      const items = await store.list(env, company.companyKey, { includeInactive });
      context.res = auth.json(200,{ok:true,items,canEdit:admin,environment:env,companyKey:company.companyKey}); return;
    }
    if (!admin) throw auth.error('ADMIN_REQUIRED','Nur Administratoren dürfen fixe Abholungen ändern.',403);
    const b = auth.body(req);
    if (method === 'POST') {
      const item = await store.create(env,company.companyKey,b,session.user.name||session.user.user||'Admin');
      context.res = auth.json(201,{ok:true,item}); return;
    }
    const id = String(b.id||'').trim();
    if (!id) throw auth.error('FIX_ID_REQUIRED','FIX-ID fehlt.',400);
    const item = await store.update(env,company.companyKey,id,b,session.user.name||session.user.user||'Admin');
    context.res = auth.json(200,{ok:true,item});
  } catch(e) {
    context.res = auth.json(e.status||e.statusCode||500,{ok:false,code:e.code||'FIXED_PICKUPS_FAILED',message:e.message||'Fixe Abholungen konnten nicht verarbeitet werden.'});
  }
};
```

`api/fixed-pickups/function.json` must declare anonymous Azure Function auth (because ExportHUB enforces its own session) and only `get`, `post`, `patch`, `options` on route `fixed-pickups`.

- [ ] **Step 4: Run API + company/store tests and verify GREEN**

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
- Consumes: `fixedPickups[]`, `shipments[]`, `today: Date`.
- Produces browser-/testbare Funktionen unter `globalThis.ExportHubPickupCalendar` und CommonJS export when available:
  - `buildCalendarModel({today,fixedPickups,shipments})`
  - `shipmentPickupDate(shipment)`
  - `shipmentColliState(shipment)`
  - `weekdayLabel(1..5)`
  - `dateKeyLocal(date)`

- [ ] **Step 1: Write failing projection tests**

```js
const calendar = require('../assets/abholkalender.js');

test('Wochenmodell enthält genau Montag bis Freitag', () => {
  const model = calendar.buildCalendarModel({ today:new Date(2026,8,8,12), fixedPickups:[], shipments:[] });
  assert.deepEqual(model.days.map(d=>d.label), ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']);
  assert.equal(model.days.length,5);
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
  assert.notEqual(tue.fixed[0],tue.shipments[0]);
});

test('Teilabholung zeigt Gesamt, abgeholt und offen', () => {
  const state = calendar.shipmentColliState({ expectedColliCount:10, collectedPickupCollis:4, remainingPickupCollis:6, status:'partial' });
  assert.deepEqual(state,{expected:10,collected:4,remaining:6,partial:true,complete:false});
});

test('Sendung ohne geplanten Abholtag wird nicht künstlich eingeordnet', () => {
  const model = calendar.buildCalendarModel({today:new Date(2026,8,8,12),fixedPickups:[],shipments:[{reference:'NO-DATE'}]});
  assert.equal(model.days.flatMap(d=>d.shipments).length,0);
});
```

- [ ] **Step 2: Run model test and verify RED**

Run: `node --test test/rc1004-abholkalender-model.test.mjs`

Expected: FAIL because `assets/abholkalender.js` does not exist.

- [ ] **Step 3: Implement minimal pure model**

Use numeric weekdays `1..5`. `shipmentPickupDate` may read only planning fields `plannedPickupDate`, `pickupDate`, `pickdate`; it must not assign a shipment from `actualPickupDate` when no planned day exists. `shipmentColliState` uses, in order:

```js
const expected = positive(sh.expectedColliCount || sh.totalCollis || sh.totalColli || sh.colliCount);
const collected = nonNegative(sh.collectedPickupCollis ?? sh.pickupCollectedColliCount ?? 0);
const remaining = sh.remainingPickupCollis != null || sh.pickupRemainingColliCount != null
  ? nonNegative(sh.remainingPickupCollis ?? sh.pickupRemainingColliCount)
  : Math.max(0, expected - collected);
return { expected, collected, remaining, partial: collected > 0 && remaining > 0, complete: expected > 0 && remaining === 0 };
```

Week computation must use local calendar dates, find the Monday containing `today`, and create exactly five day objects. Active FIX records are placed solely by their numeric weekday. SENDUNG entries are placed solely by their planned pickup date. Never compare FIX `siteLabel` with shipment customer/recipient.

- [ ] **Step 4: Run model test and verify GREEN**

Run: `node --test test/rc1004-abholkalender-model.test.mjs`

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/abholkalender.js test/rc1004-abholkalender-model.test.mjs
git commit -m "feat: Abholkalender Wochenmodell erstellen"
```

---

### Task 5: Heute-/Wochenansicht und unabhängige Fehlerzustände

**Files:**
- Modify: `assets/abholkalender.js`
- Create: `assets/abholkalender.css`
- Test: `test/rc1004-abholkalender-ui.test.mjs`

**Interfaces:**
- Consumes: DOM root, vorhandene `shipments` aus ExportHUB state, FIX-API über `fetch`.
- Produces:
  - `mount(root, options)`
  - `render(root, viewState)`
  - `loadFixedPickups(options)`
  - `setShipments(shipments)`
  - Admin dialog handlers only when API response `canEdit:true`.

- [ ] **Step 1: Add failing UI contract tests**

The test reads `assets/abholkalender.js` and `assets/abholkalender.css` as text and, where possible, uses exported render helpers with a minimal fake root. Required contract assertions:

```js
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
  state.fixedError = 'FIX konnte nicht geladen werden';
  state.shipmentError = null;
  assert.equal(state.fixedError,'FIX konnte nicht geladen werden');
  assert.equal(state.shipmentError,null);
});
```

- [ ] **Step 2: Run UI test and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because renderer, view state, CSS, and required copy are not yet present.

- [ ] **Step 3: Implement renderer and fetch/controller layer**

`assets/abholkalender.js` must render this stable structure inside its supplied root:

```html
<section class="pickup-today" data-pickup-calendar-today>
  <h2>Heute</h2>
  <div data-today-fixed></div>
  <div data-today-shipments></div>
</section>
<section class="pickup-week" data-pickup-calendar-week></section>
```

Each of the five generated day cards contains two subsections with badges `FIX` and `SENDUNG`. FIX cards show `siteLabel` and optional `note`; SENDUNG cards show reference, customer/recipient, carrier if available, status, expected collis and for partial pickups `Bereits abgeholt: N` plus `Noch offen: N`.

`createViewState()` must return separate fields:

```js
{
  fixedPickups: [], shipments: [], canEdit: false,
  fixedLoading: false, shipmentLoading: false,
  fixedError: null, shipmentError: null
}
```

A failure of `/api/fixed-pickups` sets only `fixedError`; it must not clear `shipments`. A shipment-source error sets only `shipmentError`; it must not clear `fixedPickups`.

When `canEdit:true`, show `Fixe Abholungen verwalten`. The admin form contains only `siteLabel`, `weekday` select (Montag–Freitag), `note`, `active`; no time input. POST creates, PATCH edits/deactivates/reactivates. On failed save, keep the dialog/form values and show the server message; never render an optimistic success state before a successful response.

- [ ] **Step 4: Add CSS focused only on this feature**

`assets/abholkalender.css` must define responsive five-column desktop layout and stacked mobile cards using feature-prefixed classes only, for example:

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

- [ ] **Step 5: Run model + UI tests and verify GREEN**

Run: `node --test test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 6: Commit**

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
- Consumes: bestehendes ExportHUB Routing/Navigation und den bereits geladenen Sendungs-/Team-State.
- Produces: Seite/Route `pickupcalendar`; beim Öffnen wird `ExportHubPickupCalendar.mount(...)` einmal initialisiert und bei State-Änderungen mit aktuellen Sendungen aktualisiert.

- [ ] **Step 1: Extend the UI test with failing production/test parity contracts**

Add assertions that both HTML files:

```js
for (const file of ['index.html','TESTVERSION.html']) {
  const html = fs.readFileSync(file,'utf8');
  assert.match(html,/abholkalender\.css/);
  assert.match(html,/abholkalender\.js/);
  assert.match(html,/pickupcalendar/);
  assert.match(html,/Abholkalender/);
}
```

Also compile/extract the relevant runtime scripts using the same approach as `test/rc1003-task-render-syntax.test.mjs` so syntax regressions in the large HTML runtime fail before deployment.

- [ ] **Step 2: Run UI contract and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because the new assets/page are not yet referenced by both HTML files.

- [ ] **Step 3: Integrate assets and route without restructuring the monolith**

In both `index.html` and `TESTVERSION.html`:

1. Load `/assets/abholkalender.css` in `<head>`.
2. Load `/assets/abholkalender.js` once with the other runtime assets.
3. Add a navigation/module entry with stable id `pickupcalendar` and visible label `Abholkalender`.
4. Add a page root exactly once:

```html
<div id="pickupCalendarRoot" class="pickup-calendar" data-page="pickupcalendar"></div>
```

5. In the existing page/routing switch, when `pickupcalendar` becomes active, pass the already-loaded application shipment collection to the calendar controller. Do not fetch or duplicate the whole team state only for this page. The adapter must select the existing in-memory collection that currently feeds Sendungsübersicht/Aufgaben and call:

```js
ExportHubPickupCalendar.mount(document.getElementById('pickupCalendarRoot'), {
  environment: currentEnvironment,
  companyId: currentCompanyId,
  shipments: currentShipments
});
```

On later state refreshes call `ExportHubPickupCalendar.setShipments(currentShipments)` rather than remounting.

6. The FIX request must send the existing ExportHUB session automatically (`credentials:'same-origin'`) and the environment/company headers used by the current runtime:

```js
headers: {
  'Accept':'application/json',
  'Content-Type':'application/json',
  'X-ExportHUB-Environment': environment,
  'X-ExportHUB-Company-Id': companyId || ''
}
```

If the existing runtime exposes the company under a differently named variable, adapt only the bridge assignment; the HTTP header and server contract above remain stable.

- [ ] **Step 4: Verify navigation/runtime tests**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs test/rc1002-release-sync.test.mjs test/rc1003-task-render-syntax.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add index.html TESTVERSION.html test/rc1004-abholkalender-ui.test.mjs
git commit -m "feat: Abholkalender in ExportHUB einbinden"
```

---

### Task 7: Release-Vertrag und keine hart codierten Kundendaten

**Files:**
- Modify: `RELEASE_MANIFEST.txt`
- Modify: `test/rc1004-abholkalender-ui.test.mjs`
- Modify: `.github/workflows/rc1002-main-contract.yml` only to add RC1004 test commands to the future main verification contract; do not add a deployment trigger.

**Interfaces:**
- Consumes: all RC1004 files from Tasks 1–6.
- Produces: release/build knows the files; CI verifies the feature and forbids real seed data/time fields.

- [ ] **Step 1: Add failing release assertions**

Add a test that checks `RELEASE_MANIFEST.txt` contains these paths:

```text
api/fixed-pickups/function.json
api/fixed-pickups/index.js
api/shared/company-context.js
api/shared/fixed-pickup-store.js
assets/abholkalender.css
assets/abholkalender.js
```

Add a source scan over `api/shared/fixed-pickup-store.js`, `api/fixed-pickups/index.js`, `assets/abholkalender.js` asserting it does not contain real seed-list declarations and does not contain the explicitly excluded names `BSH`, `TOYOTA`, `REHAU`, `Siemens`. Do not assert absence of `O Hare`/`BMP` from documentation; only runtime/source code must be seed-free.

- [ ] **Step 2: Run release/UI test and verify RED**

Run: `node --test test/rc1004-abholkalender-ui.test.mjs`

Expected: FAIL because release manifest/workflow are not yet updated.

- [ ] **Step 3: Update release manifest and verification workflow**

Append the six runtime paths above to `RELEASE_MANIFEST.txt` using the repository's existing alphabetical/grouping convention.

In `.github/workflows/rc1002-main-contract.yml`, add a verification step before `Gesamte Node-Regression`:

```yaml
      - name: RC1004 Abholkalender-Vertrag
        run: node --test test/rc1004-company-context.test.mjs test/rc1004-fixed-pickup-store.test.mjs test/rc1004-fixed-pickups-api.test.mjs test/rc1004-abholkalender-model.test.mjs test/rc1004-abholkalender-ui.test.mjs
```

Do not change its branch trigger to the RC1004 branch and do not add Azure deployment steps.

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
- No feature files added in this task unless verification exposes a defect; any defect fix must start with a reproducing failing test in the owning RC1004 test file.

**Interfaces:**
- Consumes: complete RC1004 branch state.
- Produces: evidence that RC1004 does not regress tasks, QR/partial pickup, diagnostics, rights or three-environment build.

- [ ] **Step 1: Run the complete RC1004 focused suite**

Run:

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

Run:

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

Run:

```bash
node .github/rc1002/build-three-env.mjs
git diff --check
test -f dist-rc1002/index.html
test -f dist-rc1002/TESTVERSION.html
test -f dist-rc1002/demo.html
```

Expected: exit 0. The demo build must not fail because FIX persistence is unavailable; its calendar may render read-only/empty but must not write production or testservice FIX data.

- [ ] **Step 4: Inspect branch diff against its RC1003 base**

Run:

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

Expected: only RC1004-related changes plus the already-approved design/plan documentation; no production-version bump and no deployment-only workflow.

- [ ] **Step 5: Request code review before merge/release**

Use `superpowers:requesting-code-review`. Review specifically:
- tenant isolation and admin authorization;
- no time fields;
- no hard-coded customer seeds;
- FIX/SENDUNG separation;
- partial pickup/rest quantity handling;
- independent source error states;
- index/TESTVERSION runtime parity.

- [ ] **Step 6: Commit verification-only adjustments if necessary**

If verification required a code change, first add/confirm its failing regression test, then commit only after the focused + full verification is green:

```bash
git add <exact files changed by the verified fix>
git commit -m "fix: RC1004 Verifikationsfund beheben"
```

If no defect was found, make no empty commit.

- [ ] **Step 7: Stop before production**

Do not merge to `main`, do not change `production-version.js`, and do not trigger production deployment in this task. Hand the verified branch and review result back for the explicit release decision.
