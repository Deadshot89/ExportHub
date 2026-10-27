# Pickup Container Last Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the container/photo step last on the QR pickup form without weakening the existing dual storage, preview and server-side confirmation rules.

**Architecture:** Reorder `pickup.html` sections and wizard indicators; release driver and photo sections together after Colli validation. Reuse `/api/pickup-container-document`, `/api/container-document` and the shipment overview view without changing their contracts.

**Tech Stack:** HTML, browser JavaScript, Azure Functions/Node.js, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-27-pickup-container-last-design.md`

## Global Constraints

- Existing QR links, partial pickups, POD confirmation and server-side sea-freight photo requirements remain intact.
- Uploaded images must still be stored in Azure Blob, in the Microsoft Graph Ref folder, and linked to the team shipment before success.
- The user requested existing shipment preview and photo downloads be preserved, not replaced.

## Review Focus

- Wrong Colli count still prevents every later step.
- Sea freight with missing photos allows driver entry but not final confirmation.
- Partial pickups can finish without container documentation.
- A failed or pending photo upload cannot be treated as a completed mandatory photo.
- Previously issued QR URL variants continue using existing token extraction.

---

### Task 1: Last-step user flow

**Files:**
- Modify: `pickup.html`
- Modify: `test/rc1259-container-documentation.test.mjs`
- Test: `test/pickup-container-last.test.mjs`

**Interfaces:** Existing DOM IDs, public QR token and `/api/pickup-confirm-v2` payload stay unchanged.

- [ ] Write the test expecting Driver and confirmation blocks before the Container block and before final submission.
- [ ] Run `node --test test/pickup-container-last.test.mjs test/rc1259-container-documentation.test.mjs` and observe the expected order/unlock failure.
- [ ] Reorder the markup/step names, unlock driver on successful Colli check, and keep the photo busy/three-photo/siegel checks in submit.
- [ ] Run the same focused tests and verify they pass.
- [ ] Commit this task.

### Task 2: Photo preservation and final regression

**Files:**
- Test: `test/rc1259-container-documentation.test.mjs`, `test/pickup-container-last.test.mjs`
- Review: `api/shared/container-document-store.js`, `api/pickup-container-document/index.js`, `assets/rc1014-shipment-overview.js`

**Interfaces:** Ref folder upload via `referenceFolder.upload`, saved team metadata and authorized preview download.

- [ ] Verify existing tests cover upload to both locations, API error on failed team sync and authenticated preview.
- [ ] Extend tests only if a real contractual behavior is untested; first observe failing test for needed behavior.
- [ ] Run focused tests, `npm test`, and relevant release build verification.
- [ ] Commit tests or fixes when required.
