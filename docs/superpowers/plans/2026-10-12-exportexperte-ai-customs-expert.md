# Exportexperte KI-Zollexperte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen rein beratenden KI-Zollexperten integrieren, der Zollfragen mit nachvollziehbaren Quellen beantwortet und optional den aktuellen ABD-/Rechnungskontext lesen kann, ohne Geschäftsobjekte selbstständig zu verändern.

**Architecture:** Die KI-Funktion erhält einen eigenen Server-Endpunkt und einen Provider-Adapter. Kontext wird serverseitig aus ausdrücklich erlaubten Feldern reduziert, Zollwissen/Updates werden als zitierbare Wissensbasis eingebunden, und der Browser erhält ausschließlich Antwort, Quellen und Informationsstand. Schreibaktionen auf `abdRequests`, Sendungen, Aufgaben oder Dokumente sind aus diesem Modul nicht möglich.

**Tech Stack:** Node.js >=20, ESM, bestehende ExportHUB Auth/API-Helfer, provider-neutraler LLM-Adapter, Browser-JavaScript, Node Test Runner, bestehender Build/E2E-Stack.

**Spec:** `docs/superpowers/specs/2026-10-12-exportexperte-upgrade-design.md`

## Global Constraints

- KI-Zollexperte ist ausschließlich beratend.
- Keine autonome Änderung an ABD, Sendung, Aufgaben, Dokumenten oder Status.
- Antworten zeigen verwendete Quellen und Informationsstand.
- Unsicherheit und fehlende Belege werden explizit kenntlich gemacht.
- Aktueller ABD-/Rechnungskontext wird nur lesend und nur mit notwendigen Feldern übergeben.
- Keine Secrets, Tokens oder internen technischen Daten an das Modell weitergeben.
- Ohne belastbare Quelle keine verbindliche Zollbehauptung als Fakt darstellen.

## Review Focus

- Prompt-Injection-Inhalte aus Rechnungen/Dokumenten dürfen keine Systemregeln oder Schreibrechte überschreiben.
- Sensible interne Felder, Tokens und Dokument-URLs dürfen nicht im Modellkontext landen.
- Eine Frage ohne ausreichende Wissensbasis muss Unsicherheit zeigen statt Fakten zu erfinden.
- Kontextwechsel zwischen zwei ABD-Vorgängen darf keine Daten aus dem vorherigen Vorgang übernehmen.
- Providerfehler/Timeout darf die Exportexperte-Seite nicht blockieren oder bestehende Daten verändern.

---

### Task 1: Provider-neutraler KI-Adapter

**Files:**
- Create: `api/shared/customs-ai-provider.js`
- Create: `test/rc1502-customs-ai-provider.test.mjs`

**Interfaces:**
- Produces: `askCustomsModel({ systemInstructions, question, context, sources }) -> { answer, citations, modelInfo }`.
- Provider configuration is read only from server environment/config; no provider key reaches browser.

- [ ] **Step 1: Write failing adapter tests**
  - Missing provider config => explicit unavailable result/error.
  - Provider timeout/error => normalized recoverable error.
  - Returned citation IDs must map to supplied source IDs.

- [ ] **Step 2: Run tests**
  - Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement provider adapter behind one interface**
  - Do not hardwire UI to one vendor response shape.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add provider-neutral customs AI adapter"`

### Task 2: Sichere Kontextreduktion

**Files:**
- Create: `api/shared/customs-ai-context.js`
- Create/Modify: `test/rc1502-customs-ai-context.test.mjs`

**Interfaces:**
- Consumes: optional current ABD request and invoice analysis snapshot.
- Produces: `buildCustomsAiContext({ abdRequest, invoiceAnalysis }) -> SafeCustomsContext` containing only allowlisted business fields.

- [ ] **Step 1: Write failing context tests**
  - Include allowed: reference, destination country, grouped HS/origin/value, currency, review status, invoice header basics.
  - Exclude: session tokens, auth data, raw blob URLs, internal secrets, unrelated user data.
  - New request context fully replaces old context.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement explicit allowlist mapper**
  - Never spread whole objects into model context.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: sanitize customs AI context"`

### Task 3: Quellenpaket aus Zollwissen und Updates

**Files:**
- Create: `api/shared/customs-ai-sources.js`
- Modify: `test/rc1502-customs-ai-context.test.mjs`
- Reuse: `api/shared/customs-knowledge.js`

**Interfaces:**
- Consumes: user question, current safe context, published validated Zollwissen/Updates.
- Produces: bounded list `{ id, title, excerpt, sourceName, sourceUrl, publishedAt, checkedAt }[]`.

- [ ] **Step 1: Write failing retrieval tests**
  - Only published/validated knowledge enters source set.
  - Source metadata remains attached.
  - No result => empty source list, not fabricated source.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement deterministic bounded retrieval**
  - Start with project-local topic/keyword matching; do not introduce uncontrolled live web retrieval in this task.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: supply verified sources to customs AI"`

### Task 4: Read-only KI-Zollexperte API

**Files:**
- Create: `api/customs-ai/index.js`
- Create: `test/rc1502-customs-ai-api.test.mjs`

**Interfaces:**
- Consumes: authenticated question plus optional current request/analysis identifier.
- Produces: `{ answer, sources, checkedAt, uncertainty, contextSummary }`; no mutation methods.

- [ ] **Step 1: Write failing API tests**
  - Authentication required.
  - Question length/rate limits enforced using existing API conventions.
  - Context fetched/read only for authorized user/module rights.
  - API has no write action and no mutation side effects.
  - Provider failure returns safe UI-compatible response.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement endpoint**
  - Build safe context -> retrieve sources -> call adapter -> validate citations -> return response.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add read-only customs AI endpoint"`

### Task 5: Anti-Prompt-Injection und Antwortregeln

**Files:**
- Modify: `api/shared/customs-ai-provider.js`
- Modify: `api/shared/customs-ai-context.js`
- Modify: `test/rc1502-customs-ai-provider.test.mjs`

**Interfaces:**
- Consumes: document-derived text only as quoted untrusted data.
- Produces: model instructions that distinguish system policy, verified sources, user question and untrusted invoice/document content.

- [ ] **Step 1: Write failing adversarial tests**
  - Invoice description like `ignore previous instructions` remains data, not instruction.
  - Request to alter/send/save ABD is refused by AI module and redirected to normal UI actions.
  - Unsupported factual claim receives uncertainty/no-source treatment.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement strict prompt/context boundaries**
  - Treat all document text as untrusted quoted content.

- [ ] **Step 4: Run tests**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "security: harden customs AI prompt boundaries"`

### Task 6: KI-Zollexperte UI

**Files:**
- Create: `assets/rc1502-customs-ai.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: Exportexperte subnavigation integration point
- Create: `test/rc1502-customs-ai-ui.test.mjs`
- Modify: `e2e/specs/navigation.spec.mjs`

**Interfaces:**
- Consumes: customs AI API responses.
- Produces: question input, answer panel, source list, info date, visible active context and clear advisory disclaimer.

- [ ] **Step 1: Write failing UI tests**
  - Navigation item `KI-Zollexperte`.
  - Active ABD/rechnung context clearly visible and removable.
  - Answer shows source list and checked/info date.
  - Uncertainty/provider unavailable states are clear.
  - No Save/Send/Change-ABD action exists in AI panel.

- [ ] **Step 2: Run tests**
  - Expected: FAIL.

- [ ] **Step 3: Implement accessible responsive chat/Q&A UI**
  - Keep conversation state local/session-scoped unless an explicit persistence requirement is later approved.

- [ ] **Step 4: Run tests/E2E**
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - `git commit -m "feat: add customs AI advisor UI"`

### Task 7: Regression, security and release gate

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Create/Modify: RC1502 release contract tests

**Interfaces:**
- Consumes: all AI tasks.
- Produces: evidence that AI is advisory, sourced and isolated from write paths.

- [ ] **Step 1: Add E2E scenarios**
  - Ask sourced question without context.
  - Ask with current ABD/invoice context.
  - Switch context and verify no stale data.
  - Simulate provider error.
  - Verify manual ABD, send-from-shipment and invoice analysis still work.

- [ ] **Step 2: Run focused tests**
  - `node --test --test-concurrency=1 test/rc1502-customs-ai-provider.test.mjs test/rc1502-customs-ai-context.test.mjs test/rc1502-customs-ai-api.test.mjs test/rc1502-customs-ai-ui.test.mjs`
  - Expected: PASS.

- [ ] **Step 3: Run security suite**
  - `npm run test:security`
  - Expected: PASS.

- [ ] **Step 4: Run full tests**
  - `npm test`
  - Expected: PASS.

- [ ] **Step 5: Run release verification**
  - `npm run verify:release`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  - `git commit -m "test: verify customs AI advisor isolation"`
