# Exportexperte Zollwissen und Zoll-Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen nachvollziehbaren, quellenbasierten Bereich für Zollwissen und Zoll-Änderungen schaffen, der Fachinformationen strukturiert darstellt und Nutzer über relevante neue Änderungen informiert.

**Architecture:** Zollwissen und Zoll-Updates erhalten ein eigenes versioniertes Datenmodell mit Quellenmetadaten. Die Browser-UI liest ausschließlich validierte Datensätze; neue oder geänderte Inhalte werden serverseitig bzw. im kontrollierten Datenimport validiert. Es werden keine ungeprüften Webtexte automatisch als verbindliche Zollinformation veröffentlicht.

**Tech Stack:** Node.js >=20, ESM, ExportHUB API/State-Patterns, Browser-JavaScript, JSON/structured data, Node Test Runner, bestehender Build/E2E-Stack.

**Spec:** `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-design.md`

## Global Constraints

- Fachinformationen benötigen mindestens Quelle, Veröffentlichungsdatum soweit vorhanden, Prüfdatum, Link/Referenz und Themenbereich.
- Keine erfundenen oder nicht belegten Zolländerungen.
- Quelle und Informationsstand müssen für den Nutzer sichtbar sein.
- Updates werden nicht als „neu“ oder „geändert“ markiert, wenn keine belastbare Änderung vorliegt.
- Zollwissen und Zoll-Updates dürfen den ABD-Kern nicht verändern.
- Der Bereich ist responsive, durchsuchbar und klar zwischen Grundlagenwissen und zeitbezogenen Änderungen getrennt.

## Review Focus

- Artikel ohne Quelle oder Prüfdatum dürfen nicht als geprüft veröffentlicht werden.
- Ein Update mit gleichem stabilen Quellenschlüssel darf nicht mehrfach als neue Änderung erscheinen.
- Veraltete Inhalte müssen ihren Informationsstand weiterhin sichtbar zeigen.
- Externe Links dürfen keine internen Daten oder Tokens enthalten.
- Filter/Suche dürfen Fachartikel nicht versehentlich aus dem Datenbestand löschen oder verändern.

---

### Task 1: Fachliches Datenmodell und Validierung

**Files:**
- Create: `api/shared/customs-knowledge.js`
- Create: `data/customs-knowledge.json`
- Create: `data/customs-updates.json`
- Create: `test/rc1501-customs-knowledge.test.mjs`

**Interfaces:**
- Produces: `normalizeKnowledgeArticle(article)`, `validateKnowledgeArticle(article)`, `normalizeCustomsUpdate(update)`, `validateCustomsUpdate(update)`.
- Article fields: `id`, `slug`, `title`, `summary`, `content`, `topics`, `countries`, `sourceName`, `sourceUrl`, `publishedAt`, `checkedAt`, `status`, `updatedAt`.
- Update fields: `id`, `sourceKey`, `title`, `summary`, `area`, `countries`, `sourceName`, `sourceUrl`, `publishedAt`, `checkedAt`, `effectiveAt`, `status`, `changeFingerprint`.

- [ ] **Step 1: Write failing schema tests**
  - Missing source or checkedAt => invalid for published status.
  - Stable IDs/slugs normalized.
  - Unsafe/invalid source URL rejected.
  - Draft content may exist but is not returned as published.

- [ ] **Step 2: Run tests**
  - Expected: FAIL because module/data do not exist.

- [ ] **Step 3: Implement validators and seed minimal reviewed structure**
  - Seed only content explicitly verified during implementation; do not fill regulatory facts from memory.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add validated customs knowledge model"`

### Task 2: Read-only Knowledge API

**Files:**
- Create: `api/customs-knowledge/index.js`
- Create: `test/rc1501-customs-knowledge-api.test.mjs`

**Interfaces:**
- Consumes: validated knowledge/update datasets.
- Produces: authenticated read endpoints/actions for published articles, topics, updates and detail lookup.

- [ ] **Step 1: Write failing API tests**
  - Only published/validated records returned.
  - Filter by topic/country/area.
  - Detail by stable ID/slug.
  - No internal draft metadata leakage.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement API using existing auth/response helpers**
  - Read-only in this release slice.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: expose customs knowledge read API"`

### Task 3: Zollwissen UI

**Files:**
- Create: `assets/rc1501-customs-knowledge.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: Exportexperte subnavigation integration point
- Create: `test/rc1501-customs-knowledge-ui.test.mjs`
- Modify: `e2e/specs/navigation.spec.mjs`

**Interfaces:**
- Consumes: knowledge API.
- Produces: searchable/filterable article list and article detail with visible source and information date.

- [ ] **Step 1: Write failing UI tests**
  - Subnav entry `Zollwissen`.
  - Search and topic filters.
  - Article detail shows source, publication date when present, checkedAt and link.
  - Empty/no-result state is explicit.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement compact responsive UI**
  - Use accessible headings, buttons, filters and status labels.

- [ ] **Step 4: Run tests/E2E**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add customs knowledge UI"`

### Task 4: Zoll-Updates UI und gelesen/ungelesen

**Files:**
- Create: `assets/rc1501-customs-updates.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: existing user preference/state location for read markers, not global article data
- Create: `test/rc1501-customs-updates-ui.test.mjs`

**Interfaces:**
- Consumes: validated update feed.
- Produces: updates list, unread count, mark-read state keyed by `update.id`/fingerprint.

- [ ] **Step 1: Write failing update UI tests**
  - Shows title, area, source, published/checked/effective date as available.
  - New fingerprint => unread.
  - Same fingerprint remains read after reload.
  - Changed fingerprint may re-surface as changed/unread without duplicating record.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement read-marker persistence using existing user-scoped state pattern**
  - Do not mutate global update dataset when a user marks read.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add customs updates and read state"`

### Task 5: Kontrollierter Update-Import / Änderungsdetektion

**Files:**
- Create: `scripts/customs-update-import.mjs`
- Modify: `api/shared/customs-knowledge.js`
- Modify: `test/rc1501-customs-knowledge.test.mjs`

**Interfaces:**
- Consumes: explicitly supplied/approved structured source records.
- Produces: normalized update dataset and deterministic `changeFingerprint`.

- [ ] **Step 1: Write failing dedup/change tests**
  - Identical sourceKey + content => no duplicate/new change.
  - Same sourceKey + material content/date change => updated fingerprint.
  - Missing source metadata => reject.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement deterministic import tool**
  - No uncontrolled crawling in this step; input must be traceable and reviewable.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: validate and deduplicate customs updates"`

### Task 6: Notification hook for verified changes

**Files:**
- Modify: `assets/rc1501-customs-updates.js`
- Modify/Create: existing in-app notification integration adapter
- Modify: `test/rc1501-customs-updates-ui.test.mjs`

**Interfaces:**
- Consumes: unread verified updates.
- Produces: unobtrusive Exportexperte badge/notification; never a fabricated regulatory alert.

- [ ] **Step 1: Write failing notification tests**
  - No unread verified update => no alert.
  - Unread verified update => badge/count.
  - Mark read clears user-specific badge.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement notification hook**
  - No push/email automation unless separately configured and approved.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: notify users of verified customs updates"`

### Task 7: Regression and release gate

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Create/Modify: RC1501 release contract tests

**Interfaces:**
- Consumes: all Zollwissen/update tasks.
- Produces: release evidence.

- [ ] **Step 1: Add E2E cases**
  - Open Zollwissen, search/filter, inspect source.
  - Open updates, verify unread/read behavior and source metadata.
  - Verify ABD routes remain unaffected.

- [ ] **Step 2: Run focused tests**
  - `node --test --test-concurrency=1 test/rc1501-customs-knowledge.test.mjs test/rc1501-customs-knowledge-api.test.mjs test/rc1501-customs-knowledge-ui.test.mjs test/rc1501-customs-updates-ui.test.mjs`
  - Expected: PASS.

- [ ] **Step 3: Run full tests**
  - `npm test`
  - Expected: PASS.

- [ ] **Step 4: Run release verification**
  - `npm run verify:release`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "test: verify customs knowledge and updates"`
