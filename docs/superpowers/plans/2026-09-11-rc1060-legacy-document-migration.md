# RC1060 Legacy-Dokumentmigration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bestehende Inline-Legacy-Dokumente sicher, batchweise und idempotent in den RC1059-Dokument-Blob-Storage migrieren.

**Architecture:** Ein admin-geschützter Migrationsendpunkt scannt den aktuellen State pro Umgebung, migriert höchstens einen kleinen Batch über den bestehenden RC1059-Blob-Store und ersetzt Inline-Payloads erst nach erfolgreicher Blob-Verifikation. Fortschritt wird ausschließlich aggregiert gemeldet; bestehende Dual-Read- und Downloadpfade bleiben unverändert.

**Tech Stack:** Node.js 20/24, Azure Static Web Apps Functions, Azure Blob Storage, bestehende `api/shared/document-blob-store.js` und `api/shared/blob-rest.js`, Node Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-11-rc1060-legacy-document-migration-design.md`

## Global Constraints
- Keine Löschung eines Inline-Payloads vor erfolgreichem Upload und erfolgreicher Blob-Verifikation.
- Produktion und TESTSERVICE bleiben strikt getrennt.
- Bestehende QR-Codes, Avis-Links, Legacy-URLs und bereits migrierte Blob-Referenzen bleiben kompatibel.
- Migration ist idempotent und in kleinen Batches fortsetzbar.
- Diagnoseausgaben enthalten keine Dokumentinhalte oder Secrets.
- TDD: jede Verhaltensänderung beginnt mit einer nachweislich roten Regression.

---

### Task 1: Migrationskern mit Verifikation

**Files:**
- Modify: `api/shared/document-blob-store.js`
- Create: `test/rc1060-legacy-document-migration.test.mjs`

**Interfaces:**
- Consumes: bestehende RC1059 Data-URL-Dekodierung, hashbasierte Blobablage und Environment-Pfade.
- Produces: `migrateLegacyDocuments(state, options)` mit aggregiertem Ergebnis `{state, found, migrated, skipped, failed, remaining, bytesMoved, done}`.

- [ ] **Step 1: Write the failing test**

Testfälle erzeugen einen State mit zwei Inline-Dateien, einer vorhandenen Blob-Referenz und einem simulierten Upload-/Verify-Fehler. Assertions: Batchlimit wird eingehalten; erfolgreiche Datei wird zur Blob-Referenz; fehlerhafte Datei bleibt bytegenau inline; bestehende Blob-Referenz bleibt unverändert; Zähler stimmen.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rc1060-legacy-document-migration.test.mjs`
Expected: FAIL, weil `migrateLegacyDocuments` noch nicht existiert.

- [ ] **Step 3: Write minimal implementation**

Implementiere den Scanner über die bereits von RC1059 unterstützten Dokumentfelder. Für jeden migrierbaren Eintrag: Payload dekodieren, Hash/Bytes bestimmen, Blob schreiben, Blob erneut lesen/verifizieren und erst danach eine Kopie des Eintrags ohne Inline-Payload mit RC1059-Blobmetadaten erzeugen. Fehler lassen den Originaleintrag unverändert. `limit` begrenzt nur Migrationsversuche, nicht die Diagnosezählung.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/rc1060-legacy-document-migration.test.mjs test/rc1059-document-blob-store.test.mjs test/rc1059-document-dual-read.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `RC1060: Legacy-Dokumente verifiziert batchweise migrieren`

### Task 2: Geschützter Admin-Migrationsendpunkt

**Files:**
- Create: `api/exporthub-document-migrate/function.json`
- Create: `api/exporthub-document-migrate/index.js`
- Modify: `api/exporthub-state/index.js` only if a shared state read/write helper is required without duplicating persistence logic.
- Create: `test/rc1060-document-migration-endpoint.test.mjs`

**Interfaces:**
- Consumes: gültige ExportHUB-Session, Adminprüfung, `migrateLegacyDocuments`.
- Produces: `POST /api/exporthub-document-migrate` with body `{environment, limit}` and aggregate response `{ok, found, migrated, skipped, failed, remaining, bytesMoved, done}`.

- [ ] **Step 1: Write the failing test**

Prüfe 401 ohne Session, 403 für Nicht-Admin, Ablehnung eines Environment-Mismatch, Limit-Cap und eine erfolgreiche Admin-Migration mit aggregierter Antwort ohne `data`, `dataUrl`, Base64 oder Blob-Inhalt.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rc1060-document-migration-endpoint.test.mjs`
Expected: FAIL, weil Route/Handler fehlen.

- [ ] **Step 3: Write minimal implementation**

Implementiere POST-only Function. Session und Adminrolle werden vor jedem State-/Blobzugriff validiert. Erlaubtes Batchlimit: 1–10, Default 5. Environment muss zur aufgerufenen Umgebung passen. State wird gelesen, Migrationskern ausgeführt und nur bei mindestens einer erfolgreichen Änderung atomar über den bestehenden State-Speicherpfad persistiert. Antwort enthält ausschließlich Aggregatzähler.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/rc1060-document-migration-endpoint.test.mjs test/rc1060-legacy-document-migration.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `RC1060: geschützten Dokument-Migrationsendpunkt ergänzen`

### Task 3: Release- und Live-Regression

**Files:**
- Modify: `.github/workflows/rc1050-storage-probe.yml`
- Modify: `api/exporthub-health/index.js`
- Create: `test/rc1060-release-contract.test.mjs`

**Interfaces:**
- Consumes: RC1060 Endpoint und RC1059 Health/State-Diagnostik.
- Produces: Health marker `RC1060 / legacy-document-migration` und Probe, die Route ohne Session als geschützt bestätigt.

- [ ] **Step 1: Write the failing test**

Prüfe Healthmarker, Einbindung der RC1060-Regressionen in den Storage-Probe und Live-Sicherheitscheck, dass die Migrationsroute ohne Session nicht erfolgreich ausführbar ist.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rc1060-release-contract.test.mjs`
Expected: FAIL auf RC1059-Marker bzw. fehlender Probe-Einbindung.

- [ ] **Step 3: Write minimal implementation**

Setze Health auf `version:'RC1060'` und `release:'legacy-document-migration'`. Ergänze Storage-Probe um RC1060-Tests und einen unauthentifizierten Live-Aufruf der Migrationsroute, der 401 erwartet. Der Probe darf keine Migration auslösen.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/rc1060-release-contract.test.mjs test/rc1060-*.test.mjs test/rc1059-*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `RC1060: Migration in Releasevertrag und Storage-Probe absichern`

### Task 4: Vollständige Freigabe und kontrollierter Rollout

**Files:**
- No product-code changes unless a failing regression identifies a defect.

**Interfaces:**
- Consumes: vollständigen RC1060-Branch.
- Produces: verifizierten Release und danach kontrollierte Migration TESTSERVICE → Produktion.

- [ ] **Step 1: Run full regression**

Run through existing GitHub Main/Release contract. Expected: alle Node-, QR-, Avis-, Aufgaben-, Android-, Build- und RC1060-Regressionen PASS.

- [ ] **Step 2: Deploy RC1060**

Fast-forward only when branch is 0 commits behind main and all required checks are green. Existing Drei-Umgebungen-Deploy must complete Production, TESTSERVICE and Live checks successfully.

- [ ] **Step 3: Verify automatic Storage Probe**

Expected live health: `RC1060 / legacy-document-migration`; Production and TESTSERVICE state health `ok`, storage reachable and team state readable; migration endpoint unauthenticated check returns 401.

- [ ] **Step 4: Migrate TESTSERVICE in batches**

Use authenticated admin calls with `limit:5`. After every batch compare `teamStateBytes`, `inlinePayloadCount`, `blobDocumentEntries`, `documentPayloadBytes`, `teamReadMs` and failures. Stop immediately on any failed entry or unexpected counter movement; investigate before continuing.

- [ ] **Step 5: Migrate Production in batches**

Only after TESTSERVICE reaches `inlinePayloadCount=0` for migratable payloads with green document-read verification. Use `limit:5`, verify health after each batch, and continue until production reports no migratable inline payloads.

- [ ] **Step 6: Final verification**

Expected: no migratable inline legacy payloads remain; blob document count increased; state size materially decreased; protected document download and ZIP dual-read regressions remain green; no QR/Avis contract regression.
