# RC1442 Visible Release DOM Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unnecessary full-document version scans for removal-only DOM mutations without changing visible version behavior.

**Architecture:** Keep the existing global observer and all version-patching contracts. Change only mutation scheduling so child-list records that solely remove nodes do not arm a patch; additions and character-data changes continue to use the existing scoped patching path, and explicit lifecycle events continue to trigger a full patch.

**Tech Stack:** Browser JavaScript, Node.js `node:test`, `vm`, GitHub Actions.

**Spec:** User `/optimize` request in the current project conversation.

## Global Constraints

- No content, design, function, URL, data, tracking, print, upload/download, auth, API, or responsive behavior may change.
- No broad refactor.
- Performance improvement must be measured or marked `NICHT VERIFIZIERT`.
- Build and relevant regression tests must pass before the change is considered successful.

## Review Focus

- Removal-only child-list mutation must not schedule work.
- Added nodes must still be patched.
- Character-data mutations must still be patched.
- Explicit ExportHUB render/view/state events must still support full patching.
- Initial DOM-ready patch must remain intact.

---

### Task 1: Guard removal-only mutations

**Files:**
- Create: `test/rc1442-visible-release-mutation-performance.test.mjs`
- Modify: `assets/rc1193-visible-release.js`

**Interfaces:**
- Consumes: existing `scheduleMutations(records)` observer callback and `ExportHUBVisibleRelease1193.schedule()` public API.
- Produces: same public API and visible behavior, with no timer/full scan for removal-only records.

- [ ] **Step 1: Write the failing regression test** proving removal-only records create no timer while additions/character-data/full schedule still work.
- [ ] **Step 2: Run the targeted test and verify RED** on current `main` behavior.
- [ ] **Step 3: Implement the minimal scheduler guard** in `scheduleMutations(records)`; do not alter observer scope or patching rules.
- [ ] **Step 4: Run the targeted test and verify GREEN.**
- [ ] **Step 5: Run repository release tests / PR gates and inspect failures.**
- [ ] **Step 6: Compare measurable synthetic work before/after:** removal-only mutation scheduled patch timers `1 -> 0`; full-document scan trigger `1 -> 0` for that case. Core Web Vitals remain `NICHT VERIFIZIERT` unless an actual browser measurement is available.
