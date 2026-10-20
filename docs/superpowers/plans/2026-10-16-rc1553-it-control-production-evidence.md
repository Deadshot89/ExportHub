# RC1553 IT Control Center Production Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the IT Control Center a trustworthy runtime identity so it can distinguish “code changed” from “the expected build is actually running”.

**Architecture:** Extend the existing `exporthub-health` endpoint instead of creating a parallel health API. Preserve the legacy RC1060 health contract for existing probes, add a fail-closed `deployment` identity, and make both the TESTSERVICE verification workflow and the manual Production Release workflow materialize the checked-out SHA plus visible/technical release metadata before Azure deploys the API.

**Tech Stack:** Node.js 20, Azure Functions, GitHub Actions, `node:test`.

**Spec:** User IT Control Center requirements from 2026-10-16; existing diagnostics/autofix architecture is reused.

## Global Constraints

- Existing diagnostics, autofix, release and monitoring functions must remain intact.
- Existing RC1060 `version`/`release` health markers remain backward compatible until their dependent probes are migrated.
- Unknown deployment identity must be reported as unknown, never as verified.
- No secrets, tokens or credentials may be returned by the endpoint.
- No direct write to `main`; ship through PR gates.
- 100%/“behoben” is only valid after production deployment and live production verification.

## Review Focus

- Missing runtime metadata must fail closed.
- A stale workflow SHA must not be presented as the deployed checkout SHA.
- Correlation IDs must be bounded and safe before echoing.
- Existing RC1060 storage/runtime probes must continue to pass.
- Production and TESTSERVICE must each expose the metadata from the checkout they actually deploy.

---

### Task 1: Health deployment identity contract

**Files:**
- Modify: `api/exporthub-health/index.js`
- Create: `test/rc1553-it-control-production-evidence.test.mjs`

**Interfaces:**
- Consumes: runtime metadata from `process.env` or `api/release-metadata.json`.
- Produces: `deployment.{status,verified,buildId,visibleRelease,technicalBuild,builtAt,environment,source}` and `correlationId`.

- [ ] Write failing health contract tests.
- [ ] Verify RED in PR CI.
- [ ] Implement minimal endpoint changes while preserving RC1060 legacy markers.
- [ ] Verify focused test and full `npm test` green.

### Task 2: Deployment metadata materialization

**Files:**
- Modify: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- Modify: `.github/workflows/exporthub-production-release.yml`
- Test: `test/rc1553-it-control-production-evidence.test.mjs`

**Interfaces:**
- Consumes: checked-out `git rev-parse HEAD` and `release-version.json`.
- Produces: `api/release-metadata.json` immediately before each Azure API deployment.

- [ ] Add failing workflow contract assertions for TESTSERVICE and Production Release.
- [ ] Verify RED.
- [ ] Materialize metadata before TESTSERVICE deploy.
- [ ] Materialize metadata from the explicit `release_sha` checkout before production deploy.
- [ ] Verify PR gates.

### Task 3: Release verification

**Files:**
- Modify only if required by existing release gates after Task 1-2.

- [ ] Confirm no RC1060 probe regression.
- [ ] Confirm build and full regression green.
- [ ] Merge only after gates are green.
- [ ] Verify deployed production health identity against merged/released SHA.
- [ ] Only after live verification report RC1553 as 100% complete.
