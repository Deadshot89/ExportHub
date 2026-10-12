# Exportexperte ABD-Historie und AV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gespeicherte ABD-Anfragen kompakt durchsuchbar machen und einen sicheren, duplikatfreien AV-Lifecycle mit automatischen Aufgaben ergänzen.

**Architecture:** Die bestehende Collection `abdRequests`, die bestehende Dokumentablage und der vorhandene Task-Lifecycle werden erweitert statt ersetzt. AV-Status wird aus Dokumentmetadaten abgeleitet; fehlende AVs erzeugen genau eine idempotente Systemaufgabe pro ABD-Vorgang.

**Tech Stack:** Node.js >=20, ESM, bestehende ExportHUB State-/Document-/Task-APIs, Browser-JavaScript, Node Test Runner, bestehender Build/E2E-Stack.

**Spec:** `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-design.md` und `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-self-review.md`

## Global Constraints

- Keine zweite ABD-Datenhaltung; `abdRequests` bleibt führend.
- Neue Felder sind optional und rückwärtskompatibel.
- Große Binärdateien bleiben außerhalb des State in bestehender sicherer Dokument-/Blob-Infrastruktur.
- AV-Aufgaben verwenden logisch den Schlüssel `missing-av:<abdRequestId>`.
- Wiederholte Prüfungen dürfen keine doppelte offene Aufgabe erzeugen.
- Ein hinterlegter gültiger AV schließt die zugehörige offene Aufgabe automatisch.
- Bestehende ABD-Datensätze ohne Analyse-/AV-Felder bleiben lesbar und bearbeitbar.

## Review Focus

- Alte ABD-Einträge ohne neue Felder dürfen weder aus Tabelle noch Suche verschwinden.
- Mehrfaches Öffnen/Aktualisieren eines Vorgangs mit fehlendem AV darf keine Task-Duplikate erzeugen.
- AV-Status darf nur „vorhanden“ sein, wenn ein gültiges zugeordnetes Dokument existiert.
- Suche nach HS-Code muss auch Analysegruppen finden, ohne die Hauptansicht pro Tastendruck komplett neu zu rendern.
- Entfernen/Ungültigmachen eines AV muss Status und Aufgabe konsistent nachführen.

---

### Task 1: Rückwärtskompatibles ABD-Metadatenmodell

**Files:**
- Modify: vorhandene ABD-Persistenz-/State-Normalisierung
- Reference: `api/shared/merge.js`
- Reference: `api/shared/state-write-guard.js`
- Modify/Create: `test/rc1500-abd-history-model.test.mjs`

**Interfaces:**
- Consumes: vorhandene `abdRequests`.
- Produces: optionales Modell `invoiceAnalysis`, `invoiceFiles`, `avFiles`, `avStatus`, `avUpdatedAt`, `customsReviewStatus`.

- [ ] **Step 1: Write backward-compatibility tests**
  - Legacy record without new fields normalizes and renders.
  - New metadata survives merge/save roundtrip.
  - ABD write rights remain enforced.

- [ ] **Step 2: Run focused tests**
  - Expected: FAIL only where extension support is missing.

- [ ] **Step 3: Implement optional normalization**
  - Do not migrate or rewrite existing records eagerly.

- [ ] **Step 4: Re-run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: extend ABD request metadata safely"`

### Task 2: Kompakte gespeicherte ABD-Tabelle

**Files:**
- Modify: existing Exportexperte saved-ABD UI module or focused new `assets/rc1500-abd-history.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Create/Modify: `test/rc1500-abd-history-ui.test.mjs`
- Modify: `e2e/specs/navigation.spec.mjs`

**Interfaces:**
- Consumes: normalized `abdRequests`.
- Produces: table columns ABD/MRN, Datum, Referenz, Kunde, Rechnung, Land, Wert, Status, AV, Aktion; optional columns per spec.

- [ ] **Step 1: Write failing UI contracts**
  - Legacy and new records both render.
  - Responsive table preserves all data.
  - AV status is visible without opening detail.

- [ ] **Step 2: Run tests**
  - Expected: FAIL for new table contracts.

- [ ] **Step 3: Implement focused table renderer**
  - Stable keys by request ID/ref; no destructive mutation of records.

- [ ] **Step 4: Run tests/E2E**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add compact saved ABD overview"`

### Task 3: Suche und Filter

**Files:**
- Modify: `assets/rc1500-abd-history.js` or existing history module
- Modify: `test/rc1500-abd-history-ui.test.mjs`

**Interfaces:**
- Consumes: normalized records and optional analysis groups.
- Produces: normalized search index and filters for ABD/MRN, ref, invoice, customer, recipient, country, HS; date/customer/country/status/AV filters.

- [ ] **Step 1: Write failing search/filter tests**
  - Search each required field.
  - Search HS-Code within saved analysis groups.
  - Combined filters intersect correctly.
  - Reset restores full result set.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement precomputed normalized search fields**
  - Debounce input or update only result rows; do not rebuild unrelated page regions per keystroke.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: search and filter saved ABD requests"`

### Task 4: AV-Dokumentzuordnung

**Files:**
- Modify: existing document metadata/store adapter
- Modify/Create: focused AV service `api/shared/abd-av.js`
- Modify: history/detail UI
- Create: `test/rc1500-abd-av.test.mjs`

**Interfaces:**
- Consumes: `abdRequestId`, uploaded PDF document reference.
- Produces: `attachAv(abdRequestId, documentRef)`, `getAvStatus(request)`, `removeAv(...)` following existing document security patterns.

- [ ] **Step 1: Write failing AV tests**
  - Only valid authorized document refs accepted.
  - Attach sets AV present and timestamp.
  - Open/download uses existing protected document route.
  - Invalid/missing doc never yields present status.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement AV service over existing document store**
  - No public direct blob URLs.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: attach and manage ABD exit notes"`

### Task 5: Idempotente Missing-AV-Aufgabe

**Files:**
- Modify: `assets/rc1014-task-lifecycle.js` only through its supported public interface, or add `api/shared/abd-av-task.js`
- Modify: ABD lifecycle/save hook at narrow integration point
- Modify: `test/rc1500-abd-av.test.mjs`

**Interfaces:**
- Consumes: completed/executed ABD request with `avStatus != present`.
- Produces: `ensureMissingAvTask(request) -> task` with idempotency key `missing-av:<abdRequestId>`.

- [ ] **Step 1: Write failing idempotency tests**
  - First check creates one task.
  - Repeated checks return/reuse same open task.
  - Task contains MRN, customer, reference, shipment/date context available in request.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement idempotent task lookup/create**
  - Use existing task model and permissions.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: create idempotent missing AV tasks"`

### Task 6: AV hinterlegt => Aufgabe automatisch schließen

**Files:**
- Modify: `api/shared/abd-av.js`
- Modify: `api/shared/abd-av-task.js` or equivalent
- Modify: `test/rc1500-abd-av.test.mjs`

**Interfaces:**
- Consumes: AV attachment/removal events.
- Produces: `completeMissingAvTask(abdRequestId)` and reconciliation behavior.

- [ ] **Step 1: Write failing lifecycle tests**
  - Attach valid AV closes open missing-AV task.
  - Repeat attach does not create/close unrelated tasks.
  - Remove/invalid AV returns request to missing state and reconciliation can recreate/reopen exactly one task according to existing task semantics.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement reconciliation**
  - Ensure task and AV state update atomically enough for existing store semantics; on partial failure surface explicit retry state.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: reconcile AV tasks with document state"`

### Task 7: Regression and release gate

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Modify/Create: targeted RC1500 release tests

**Interfaces:**
- Consumes: all history/AV tasks.
- Produces: release evidence.

- [ ] **Step 1: Add E2E cases**
  - Legacy ABD visible.
  - Search/filter combinations.
  - Add/open/download AV.
  - Missing AV creates one task; adding AV closes it.

- [ ] **Step 2: Run focused tests**
  - `node --test --test-concurrency=1 test/rc1500-abd-history-model.test.mjs test/rc1500-abd-history-ui.test.mjs test/rc1500-abd-av.test.mjs`
  - Expected: PASS.

- [ ] **Step 3: Run full test suite**
  - `npm test`
  - Expected: PASS.

- [ ] **Step 4: Run release verification**
  - `npm run verify:release`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "test: verify ABD history and AV lifecycle"`
