# ExportHUB360 i18n Browser + Production Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove six-language responsive rendering, remove the remaining German-only public locale formatting, and expose safe translator configuration status.

**Architecture:** Extend the existing RC1267 system only. Use a real Playwright page test for `customer-avis.html`, delegate visible locale formatting to `ExportHUBI18n`, and enrich the existing admin-only i18n status response with non-secret translator metadata.

**Tech Stack:** Node.js 20, Playwright, browser JavaScript, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-i18n-browser-production-proof-design.md`

## Global Constraints
- Languages: `de`, `en`, `pl`, `es`, `fr`, `it`.
- No business-logic changes.
- Never expose translator credentials.
- Preserve RC1267 and `_localizedText` architecture.

## Review Focus
- Browser test must inspect actual visible page output, not just translation JSON.
- Mobile must have no horizontal page overflow.
- English/Polish/etc. must not keep German date/number formatting on customer AVIS.
- Translator diagnostics must remain admin-only and secret-free.
- Existing full regression/build/audit must stay green.

---

### Task 1: RED contracts
**Files:**
- Create: `test/rc1511-i18n-browser-proof.test.mjs`
- Modify: `tests/rc1267-dynamic-i18n.test.cjs`

- [ ] Require a six-language Playwright spec and dedicated PR workflow.
- [ ] Require both `mobile-standard` and `laptop` execution.
- [ ] Require customer AVIS formatters to use central format helpers rather than hardcoded `de-DE`.
- [ ] Require admin i18n status to expose safe translator provider/configuration metadata.
- [ ] Run the existing PR checks and verify RED for the intended missing contracts.

### Task 2: Browser proof + locale formatting
**Files:**
- Create: `e2e/specs/rc1511-six-language-i18n.spec.mjs`
- Create: `.github/workflows/rc1511-i18n-browser.yml`
- Modify: `customer-avis.html`

- [ ] Implement six-language actual-render Playwright coverage for customer AVIS.
- [ ] Run on mobile-standard and laptop.
- [ ] Assert `<html lang>`, runtime language, translated visible title, no overflow, clean runtime.
- [ ] Delegate date/number display to `ExportHUBI18n.formatDate/formatNumber` with safe fallback.
- [ ] Verify GREEN.

### Task 3: Safe translator diagnostics
**Files:**
- Modify: `api/shared/dynamic-i18n.js`
- Modify: `api/exporthub-state/index.js`

- [ ] Add a secret-free `translatorStatus()` helper derived from `translatorConfig()`.
- [ ] Include it only in the existing admin-only `mode=i18n-status` response.
- [ ] Verify no key/credential value is returned.
- [ ] Verify GREEN.

### Task 4: Full release verification
- [ ] Run Node/full regression gates.
- [ ] Run RC1511 Playwright workflow.
- [ ] Run three-environment build and strict i18n audit.
- [ ] Review diff for business-logic drift.
- [ ] Report whether production translator configuration is proven or still requires an authenticated production status call.
