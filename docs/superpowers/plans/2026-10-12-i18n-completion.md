# ExportHUB360 i18n Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining release-gating and dynamic-field coverage gaps in the existing six-language ExportHUB360 i18n system.

**Architecture:** Keep RC1267 as the single i18n runtime. Harden the existing static audit/CI gate and widen only the dynamic-field classifier; do not add a parallel translation system or touch business logic.

**Tech Stack:** Node.js 20, browser JavaScript, CommonJS API helpers, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-i18n-completion-design.md`

## Global Constraints
- Supported languages: `de`, `en`, `pl`, `es`, `fr`, `it`.
- Original dynamic text must never be overwritten.
- Product/customer names and identifiers must not be translated.
- No business-rule, permissions, shipment/status, API-contract or document-logic changes.
- Existing save performance controls remain unchanged.

## Review Focus
- New asset runtime with hardcoded German UI must trigger the i18n workflow.
- New camelCase note/hint fields must become translatable.
- Reference/name/number/code fields must remain untouched.
- Translator outage must still preserve source text and save behavior.
- Existing RC1267 language persistence/public-page behavior must not regress.

---

### Task 1: Lock the missing contracts with tests

**Files:**
- Modify: `tests/rc1267-dynamic-i18n.test.cjs`
- Modify: `test/rc1267-i18n.test.mjs`

**Interfaces:**
- Consumes: `collect(root, fallback, options)` and `enrichDynamicTranslations(root, fallback, options)` from `api/shared/dynamic-i18n.js`.
- Produces: regression contracts for field classification and release-gate coverage.

- [ ] Add a failing dynamic-i18n test for `customerNote`, `internalNote`, `externalHint` and `taskDescription`.
- [ ] Add a failing dynamic-i18n test proving `customerName`, `referenceNumber`, `trackingNumber`, `itemNumber` stay outside `_localizedText`.
- [ ] Add a failing i18n contract test requiring `verify:i18n` to call `i18n:audit:strict`.
- [ ] Add a failing i18n contract test requiring the PR workflow to cover `assets/**`.
- [ ] Run the affected tests and confirm they fail for the intended missing behavior.
- [ ] Commit the RED tests.

### Task 2: Widen dynamic-text classification safely

**Files:**
- Modify: `api/shared/dynamic-i18n.js`

**Interfaces:**
- Consumes: string field names from the existing recursive collector.
- Produces: `isLocalizableField(key) -> boolean`, used only by `collect`.

- [ ] Implement `isLocalizableField(key)` with existing exact names plus semantic suffix matching for note/hint/description/instruction/remark families.
- [ ] Keep explicit identifier/name/number/code/reference/tracking fields excluded.
- [ ] Replace the exact regex check in `collect` with the classifier.
- [ ] Run dynamic-i18n tests and confirm GREEN.
- [ ] Commit the implementation.

### Task 3: Make i18n verification unavoidable for new UI assets

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/rc1267-i18n-verify.yml`

**Interfaces:**
- Produces: strict local/CI verification command and PR path coverage for every production asset.

- [ ] Change `verify:i18n` to end with `npm run i18n:audit:strict`.
- [ ] Change PR path coverage to include `assets/**` instead of only selected asset files.
- [ ] Run i18n contract tests and confirm GREEN.
- [ ] Run full `npm test` and `npm run verify:i18n`.
- [ ] Commit the release-gate hardening.

### Task 4: Release verification

**Files:** none unless a failing regression requires a scoped fix.

- [ ] Open a PR against `main` so the RC1267 verification workflow runs.
- [ ] Confirm unit/contract tests, full regression, three-environment build, audit artifact and strict i18n gate are green.
- [ ] Review the diff for business-logic drift.
- [ ] Report remaining limitations separately; do not call the entire website fully translated unless all six-language UI/public/mobile checks are actually proven.
