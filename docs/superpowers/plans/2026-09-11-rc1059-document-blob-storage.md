# RC1059 Document Blob Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue Dokumentpayloads vor dem Team-State-Save sicher in Azure Blob Storage auslagern und Legacy-Inline-Dokumente weiterhin vollständig unterstützen.

**Architecture:** Ein fokussiertes Shared-Modul übernimmt Erkennung, Decodierung, Hashing, Blob-Upload und Metadatenersetzung. Der zentrale State-Save normalisiert eingehende Dokumentlisten vor dem Merge. Ein geschützter Dokument-Endpunkt liest Blob-Dokumente; Legacy-Inline-Dokumente bleiben unangetastet. RC1060 migriert Bestandsdaten später separat.

**Tech Stack:** Node.js 20/24, Azure Functions, `@azure/storage-blob`, Node `crypto`, bestehende ExportHUB State-/Auth-Module, Node Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-11-rc1059-document-blob-storage-design.md`

## Global Constraints

- Bestehende QR-Codes und öffentliche Tokens dürfen nie ungültig werden.
- Bestehende Inline-Dokumente bleiben lesbar; RC1059 löscht keine Bestands-Payloads.
- Produktion und TESTSERVICE müssen getrennt gespeichert werden.
- Kein direkter Azure-Blob-URL-Leak an Browser/öffentliche Seiten.
- Ein fehlgeschlagener Dokumentupload darf niemals eine tote Blob-Referenz im Team-State erzeugen.
- Dokumentarrays und fachliche IDs bleiben unverändert/additiv-protektiv.
- TDD: für jede Produktionsänderung zuerst RED, danach minimaler GREEN-Fix.

---

### Task 1: Dokument-Blob-Store als isoliertes Shared-Modul

**Files:**
- Create: `api/shared/document-blob-store.js`
- Create: `test/rc1059-document-blob-store.test.mjs`

**Interfaces:**
- Produces: `normalizeEnvironment(value) -> 'production'|'testservice'`
- Produces: `extractInlinePayload(file) -> {buffer:Buffer,mimeType:string}|null`
- Produces: `storeInlineDocument(file, options) -> Promise<object>`
- Produces: `externalizeDocumentCollections(state, options) -> Promise<{state,stats}>`

- [ ] **Step 1: Write the failing unit tests**

Create tests that prove:

```js
assert.equal(extractInlinePayload({data:'data:application/pdf;base64,QUJD'}).buffer.toString(),'ABC');
assert.equal(extractInlinePayload({url:'https://example.invalid/a.pdf'}),null);
```

and with a mocked document container:

```js
const out=await storeInlineDocument(
  {id:'D1',name:'LS.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,QUJD'},
  {environment:'testservice',container}
);
assert.equal(out.storage,'blob');
assert.match(out.blobName,/^rc1059\/testservice\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
assert.equal(out.data,undefined);
assert.equal(out.sha256,crypto.createHash('sha256').update(Buffer.from('ABC')).digest('hex'));
```

Add a failure-path test where `uploadData` throws and assert that `storeInlineDocument` rejects instead of returning blob metadata.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `node --test test/rc1059-document-blob-store.test.mjs`
Expected: FAIL because `api/shared/document-blob-store.js` does not exist.

- [ ] **Step 3: Implement minimal blob store**

Implement:

```js
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const DOCUMENT_CONTAINER=process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents';
```

`extractInlinePayload` must accept `data`, `payload`, `content`, `base64` only when they contain valid base64/data-URL data; ordinary URLs remain untouched. `storeInlineDocument` calculates SHA-256, uses `rc1059/<environment>/<first2>/<hash>`, uploads idempotently, and returns a clone without inline fields plus `storage`, `blobName`, `sha256`, `size`, `mimeType`.

`externalizeDocumentCollections` recursively handles known document arrays in `shipments`, `savedShipments`, and `abdRequests`: `deliveryFiles`, `deliveryNotesFiles`, `podFiles`, `abdFiles`, `documents`, `generatedDocuments`, `files`, `attachments`, `invoiceFiles`, `mailAttachments`, `lieferscheine`.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run: `node --test test/rc1059-document-blob-store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/shared/document-blob-store.js test/rc1059-document-blob-store.test.mjs
git commit -m "RC1059: Dokument-Blob-Store hinzufügen"
```

---

### Task 2: State-Save externalisiert neue Dokumentpayloads vor dem Merge

**Files:**
- Modify: `api/exporthub-state/index.js`
- Modify: `test/rc1059-document-blob-store.test.mjs`

**Interfaces:**
- Consumes: `externalizeDocumentCollections(state,{environment,container})`
- Produces: save pipeline with externalized incoming state before `saveMerged`

- [ ] **Step 1: Write failing State-Save regression**

Mock Azure containers and send a save payload containing a new shipment with one `deliveryFiles[].data` payload. Assert after the save:

```js
assert.equal(saved.state.shipments[0].deliveryFiles[0].storage,'blob');
assert.equal(saved.state.shipments[0].deliveryFiles[0].data,undefined);
assert.equal(documentUploads,1);
```

Also assert that a legacy server-side shipment not touched by the incoming save retains its existing inline payload.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/rc1059-document-blob-store.test.mjs`
Expected: FAIL because the state endpoint still persists incoming inline payloads.

- [ ] **Step 3: Integrate minimal pre-save externalization**

In the POST save branch, before `saveMerged`, create/get the document container and call:

```js
const normalized=normalizeIncoming(payload);
const externalized=await externalizeDocumentCollections(normalized.state,{environment:c.environment,container:documentContainer});
normalized.state=externalized.state;
const saved=await saveMerged(blob,normalized,current.user,current.team,current.teamEtag,current.session);
```

Do not externalize the already loaded current team document in RC1059.

- [ ] **Step 4: Run targeted and merge regressions**

Run:
`node --test test/rc1059-document-blob-store.test.mjs test/rc992-state-save-performance.test.mjs .github/rc996/state-merge-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/exporthub-state/index.js test/rc1059-document-blob-store.test.mjs
git commit -m "RC1059: neue Dokumentpayloads vor State-Save auslagern"
```

---

### Task 3: Geschützter Blob-Dokumentabruf

**Files:**
- Create: `api/exporthub-document/index.js`
- Create: `api/exporthub-document/function.json`
- Create: `test/rc1059-document-download.test.mjs`

**Interfaces:**
- Consumes: bestehende Bearer-Session/Auth-Validierung
- Consumes: `blobName` metadata from RC1059 state objects
- Produces: authenticated `GET /api/exporthub-document?blob=<encoded>` binary response

- [ ] **Step 1: Write failing endpoint tests**

Assert:

```js
await requestWithoutToken(); // => 401
await requestWithInvalidBlob('../secret'); // => 400
const res=await requestWithValidSession('rc1059/testservice/ab/<64hex>');
assert.equal(res.status,200);
assert.equal(res.headers['Content-Type'],'application/pdf');
```

Also assert production sessions cannot request a `rc1059/testservice/` blob and vice versa.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/rc1059-document-download.test.mjs`
Expected: FAIL because endpoint does not exist.

- [ ] **Step 3: Implement authenticated download endpoint**

Validate the Bearer session with existing auth-store helpers. Accept only exact RC1059 blob names matching the caller environment. Download from `exporthub-documents`; stream/buffer response with `Content-Type`, `Content-Length`, `Cache-Control: private, no-store`, `Content-Disposition: inline; filename="document"`. Never return connection strings or direct Azure URLs.

- [ ] **Step 4: Run targeted tests**

Run: `node --test test/rc1059-document-download.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/exporthub-document test/rc1059-document-download.test.mjs
git commit -m "RC1059: geschützten Dokumentabruf ergänzen"
```

---

### Task 4: Browser-Dual-Read für Legacy und Blob-Referenzen

**Files:**
- Search and modify the existing shared document/open/download helper used by shipment print/download flows.
- Test: `test/rc1059-document-dual-read.test.mjs`

**Interfaces:**
- Produces: `documentSource(file)` behavior: legacy inline source unchanged; blob metadata maps to `/api/exporthub-document?blob=...`.

- [ ] **Step 1: Locate the canonical browser document resolver**

Run repository search for `deliveryFiles`, `generatedDocuments`, `data:application/pdf;base64`, `downloadUrl`, and object URL creation. Select the smallest existing shared path used by print/download flows; do not introduce parallel per-page implementations.

- [ ] **Step 2: Write failing dual-read tests**

Test exact behavior:

```js
assert.equal(documentSource({data:'data:application/pdf;base64,QUJD'}),'data:application/pdf;base64,QUJD');
assert.equal(documentSource({storage:'blob',blobName:'rc1059/production/ab/'+hash}),'/api/exporthub-document?blob='+encodeURIComponent(...));
```

- [ ] **Step 3: Run and verify RED**

Run: `node --test test/rc1059-document-dual-read.test.mjs`
Expected: FAIL for blob-backed document.

- [ ] **Step 4: Implement minimal dual-read**

Preserve all existing inline/data URL behavior. Add only the `storage==='blob' && blobName` branch and route it to the authenticated API endpoint.

- [ ] **Step 5: Run QR/Avis/print regressions**

Run: `node --test test/rc1059-document-dual-read.test.mjs .github/rc995/rc995-flow.test.cjs test/rc1017-subshipment-pickup.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add <resolved-browser-file> test/rc1059-document-dual-read.test.mjs
git commit -m "RC1059: Legacy- und Blob-Dokumente gemeinsam lesen"
```

---

### Task 5: Diagnose, Releasevertrag und Live-Verifikation

**Files:**
- Modify: `api/exporthub-state/index.js`
- Modify: `api/exporthub-health/index.js`
- Modify: `.github/workflows/rc1050-storage-probe.yml`
- Test: `test/rc1059-document-blob-store.test.mjs`

**Interfaces:**
- Produces: aggregate health fields `blobDocumentEntries`, `inlinePayloadCount`, `documentPayloadBytes`
- Produces: RC1059 live marker

- [ ] **Step 1: Extend regression expectations**

Assert health diagnostics expose counts only and do not expose `blobName`, file names, hashes, shipment refs, or customer values.

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1059-document-blob-store.test.mjs`
Expected: FAIL until blob-document aggregate count is present.

- [ ] **Step 3: Add aggregate diagnostics and release marker**

Extend the existing RC1058 aggregate walker to count `storage:'blob'` document entries. Keep current `inlinePayloadCount` and `documentPayloadBytes`. Update `api/exporthub-health/index.js` to RC1059 / `document-blob-storage`.

- [ ] **Step 4: Harden post-deploy probe**

Add RC1059 targeted regression before live API checks. The live health predicate must require `v.ok===true` and state health must still require storage/team readability. Do not make the probe depend on actual customer documents.

- [ ] **Step 5: Run full verification**

Run targeted RC1059 tests, then full Node contract and existing QR/Avis/pickup regressions. Expected: all PASS.

- [ ] **Step 6: Deploy and verify post-deploy probe**

Deploy production, TESTSERVICE, demo through the existing three-environment workflow. Wait for the workflow-run-triggered Storage Probe and inspect live RC1059 marker plus aggregate diagnostics.

- [ ] **Step 7: Commit**

```bash
git add api/exporthub-state/index.js api/exporthub-health/index.js .github/workflows/rc1050-storage-probe.yml test/rc1059-document-blob-store.test.mjs
git commit -m "RC1059: Dokument-Blob-Storage live absichern"
```

## Self-review

- Spec coverage: Blob store, no dead references, dual-read, environment isolation, protected download, QR/Avis compatibility, aggregate diagnostics and deferred migration are all mapped to tasks.
- Placeholder scan: no TBD/TODO or undefined implementation placeholders remain; Task 4 intentionally resolves the existing canonical browser helper by repository search before editing because the exact shared resolver must be identified from current main rather than guessed.
- Type consistency: `storage`, `blobName`, `sha256`, `size`, `mimeType` are used consistently across store, state, endpoint and browser resolver.
- RC1060 migration is intentionally excluded from this plan and starts only after RC1059 live verification.
