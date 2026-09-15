# ExportHUB Browser E2E Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Playwright browser checks and require TESTSERVICE browser success before production deployment.

**Architecture:** Keep all existing Node/contract tests. Add a Playwright layer around `dist-rc1112`, run it locally, deploy TESTSERVICE first, run P0 browser checks there, then deploy production. Production receives read-only smoke checks.

**Tech Stack:** Node.js, Playwright 1.55.0, Chromium, GitHub Actions, Azure Static Web Apps.

**Spec:** `docs/superpowers/specs/2026-09-15-exporthub-browser-e2e-release-gate-design.md`

## Global constraints
- Keep all current regression tests.
- Required viewports: 360x800, 390x844, 768x1024, 1366x768, 1920x1080.
- TESTSERVICE must pass P0 browser checks before production deploy starts.
- Visible source leaks, page errors, unexpected console errors and critical request failures fail the gate.
- Do not change business rules or refactor the application monolith in this milestone.

### Task 1: Browser-gate contract
**Files:** Create `test/rc1124-browser-release-gate.test.mjs`.
- [ ] Write a failing Node test that requires `playwright.config.mjs`, `e2e/helpers/exporthub-browser.mjs`, navigation, notifications and public-smoke specs.
- [ ] Assert all five viewport sizes are configured.
- [ ] Assert workflow order is TESTSERVICE deploy -> `RC1124 TESTSERVICE Browser Gate` -> production deploy.
- [ ] Assert workflow installs `@playwright/test@1.55.0` and Chromium and watches `e2e/**`.
- [ ] Run `node --test test/rc1124-browser-release-gate.test.mjs`; expected FAIL before implementation.
- [ ] Commit `test: define RC1124 browser release gate contract`.

### Task 2: Playwright foundation
**Files:** Create `playwright.config.mjs`, `e2e/helpers/exporthub-browser.mjs`; update `.gitignore` only for generated output.
- [ ] Configure five projects for the required viewport sizes, workers 1, retries 0, timeout 45000, trace on failure and screenshot on failure.
- [ ] Default to local `dist-rc1112/demo.html` served by Python on port 4173; disable local server in live mode.
- [ ] Helper exports `waitReady`, `openExportHubView`, `assertNoSourceLeak`, `assertNoHorizontalOverflow`, `attachRuntimeGuards`, `assertRuntimeClean`.
- [ ] Reuse the resilient menu/view strategy from `browser/rc1018-sop-screenshots.mjs`.
- [ ] Detect the known raw-source patterns from the September 15 regressions.
- [ ] Run the contract again; expected still RED only for missing specs/workflow.
- [ ] Commit `test: add ExportHUB Playwright browser foundation`.

### Task 3: P0 application browser checks
**Files:** Create `e2e/specs/navigation.spec.mjs`, `e2e/specs/notifications.spec.mjs`.
- [ ] On every viewport verify dashboard, tasks, notifications, pickup calendar, shipment create, shipment overview, customer folder, pallet account, shipping costs, SOP and academy.
- [ ] On laptop/desktop additionally verify shipment view, documents/CMR, warehouse, customs and exams.
- [ ] After every navigation assert required content, no source leak and no horizontal overflow.
- [ ] Shipment regression requires visible `#rc363BlockDocuments`, visible `#rc543MailArea` and `Colli|Lademeter` in `#content`.
- [ ] Notification regression requires visible `#index236NotificationCenter`, forbids exact item titles `Aufgabe` and `Task`, and requires rendered item count to equal the `Offene Aufgaben` metric.
- [ ] Build RC1112, install Playwright 1.55.0 + Chromium and run both specs; fix product bugs instead of weakening assertions.
- [ ] Commit `test: add P0 ExportHUB browser navigation gate`.

### Task 4: Public read-only smoke
**Files:** Create `e2e/specs/public-smoke.spec.mjs`.
- [ ] Load pickup, customer avis and location pages; require visible body, no page error and no raw source leak.
- [ ] Verify an invalid avis link produces a controlled UI state instead of a broken page.
- [ ] Do not submit forms or perform state-changing actions.
- [ ] Run locally on laptop project; expected PASS.
- [ ] Commit `test: add read-only ExportHUB public browser smokes`.

### Task 5: TESTSERVICE before production
**Files:** Modify `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`.
- [ ] Add workflow path triggers for `e2e/**`, `playwright.config.mjs` and the RC1124 contract test.
- [ ] After build install exact Playwright 1.55.0 and Chromium.
- [ ] Run the local browser gate before any Azure deployment.
- [ ] Move existing TESTSERVICE deploy ahead of production.
- [ ] Immediately after TESTSERVICE deploy run `RC1124 TESTSERVICE Browser Gate` against the deployed demo/public pages.
- [ ] Only after this step passes may the existing production deploy run.
- [ ] Preserve `Live RC1122 HTML-Integrität prüfen`.
- [ ] After production deploy run only the read-only public smoke on the laptop project.
- [ ] On failure upload Playwright traces/screenshots/report for 14 days.
- [ ] Run the RC1124 Node contract; expected PASS.
- [ ] Commit `ci: gate ExportHUB production behind TESTSERVICE Playwright`.

### Task 6: Full regression and live acceptance
- [ ] Run RC1124 targeted contract; expected PASS.
- [ ] Run `npm run verify:release`; expected PASS.
- [ ] Run full Playwright suite across all five projects; expected PASS.
- [ ] Confirm Actions order: Node gate -> build -> local browser -> TESTSERVICE deploy -> TESTSERVICE browser -> production deploy -> live HTML check -> production read-only smoke -> existing live regressions.
- [ ] Verify failure artifact upload on an isolated non-main branch, remove deliberate failure, then integrate.

## Self-review
- Covers navigation, shipment-create, notification ghost tasks, five viewports, source leaks, runtime errors, TESTSERVICE-before-production and read-only production smoke.
- Authenticated mutation flows, valid QR lifecycle creation, physical print verification, Android release signing and monolith refactoring remain later milestones.
- Existing RC1122 HTML integrity and Node regressions remain independent gates.