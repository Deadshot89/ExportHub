# ExportHUB Release-Gates Deepfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a green, verifiable release path from current `main` without changing unrelated business behavior.

**Architecture:** Treat GitHub Actions as the authoritative runner because the local sandbox cannot resolve GitHub DNS. Fix one proven gate failure at a time, starting with the stale RC1305/RC1460 test contract, then rerun PR CI and follow any newly exposed P0/P1 failure to its root cause.

**Tech Stack:** Static HTML/JavaScript, Node.js built-in test runner, GitHub Actions, Azure Static Web Apps release workflow.

**Spec:** User `/deepfix` instruction in the current project conversation.

## Global Constraints

- Root cause before fix.
- Failing regression proof before production-code change.
- Minimal safe changes only; no unrelated refactors.
- A point is only complete after CI/build/re-test evidence.
- Production deployment remains blocked until release gates are green.

## Review Focus

- RC1460 attachment expansion must preserve the older RC1305 document-merge behavior.
- Tests must assert behavior/contract without pinning an obsolete implementation string.
- Main Contract and three-environment deploy must both pass the same regression suite.
- No print, AVIS, shipment-save, pickup, or history regression may be introduced.
- Merge is allowed only after the PR head has green required workflows.

---

### Task 1: Repair stale RC1305/RC1460 regression contract

**Files:**
- Modify: `test/rc1305-shipment-view-documents-history.test.mjs`
- Production reference only: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Consumes: `loadReferenceDocs(sh, fallback)` build source and RC1460 attachment field expansion.
- Produces: regression assertions that accept the current semantic fallback merge while still proving filtering and merge behavior.

- [ ] **Step 1: Confirm RED**

Use the current `main` Actions result as the failing proof: `RC1112 Main Contract` -> `Gesamte Node-Regression` fails, and the deploy workflow fails at `RC1112 Freigabevertrag prüfen`.

- [ ] **Step 2: Pin the semantic contract**

Change the brittle RC1305 assertion so it verifies the fallback array is normalized/filtered and then merged with the RC1460 extras, instead of requiring the obsolete exact source fragment.

- [ ] **Step 3: Run PR CI**

Expected: the RC1305/RC1460 test file passes and the full Node regression advances past the prior failure.

### Task 2: Follow the next highest release blocker

**Files:**
- Determined from the next failing GitHub Actions job/step only.

**Interfaces:**
- Consumes: CI failure evidence from Task 1 PR head.
- Produces: minimal root-cause fix plus regression coverage.

- [ ] **Step 1: Inspect all failing PR workflows**
- [ ] **Step 2: Reproduce from workflow evidence and code path**
- [ ] **Step 3: Add/adjust a failing regression test where needed**
- [ ] **Step 4: Apply the smallest safe fix**
- [ ] **Step 5: Rerun all PR workflows**

### Task 3: Release verification

**Files:**
- No production changes unless a regression is found.

**Interfaces:**
- Consumes: green PR head.
- Produces: merged `main` with green Main Contract and deployment path.

- [ ] **Step 1: Verify PR diff contains only intended files**
- [ ] **Step 2: Verify all PR workflows are green**
- [ ] **Step 3: Merge with expected head SHA**
- [ ] **Step 4: Verify `main` post-merge workflows, including Main Contract and three-environment deploy**
- [ ] **Step 5: Report only evidence-backed remaining blockers**
