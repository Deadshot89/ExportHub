# RC1443 Classic Layout Observer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unnecessary body-wide layout observation while the selected design is Classic, without changing Modern, Glass, Neon, navigation, forms, layout, data or event contracts.

**Architecture:** Keep the existing layout engine, design observer and lifecycle events. The body MutationObserver is only required when a non-Classic layout is active because Classic performs no DOM rearrangement. Disconnect it in Classic and re-enable it automatically when a non-Classic design becomes active.

**Tech Stack:** Browser JavaScript, Node.js `node:test`, `vm`, GitHub Actions.

**Spec:** User `/optimize` request in the current project conversation.

## Global Constraints

- Fully lossless and backward compatible.
- No visual, textual, functional, data, URL, tracking, print or API changes.
- No broad refactor.
- Modern, Glass and Neon observer behavior must remain active.
- Performance improvement is successful only with measured work reduction and green release gates.

## Review Focus

- Initial Classic startup must not observe the whole body.
- Design attribute observation must remain active in Classic.
- Switching Classic -> Modern must activate body observation.
- Switching Modern -> Classic must disconnect body observation.
- Existing generated-layout filtering and 90 ms scheduling remain unchanged.

---

### Task 1: Disable body observation in Classic

**Files:**
- Create: `test/rc1443-classic-layout-observer.test.mjs`
- Modify: `assets/rc1306-layout-engine.js`

**Interfaces:**
- Consumes: existing `design()`, `apply()`, `watch()`, `MutationObserver` lifecycle and `exporthub:designchange` event.
- Produces: unchanged public `ExportHUBLayoutEngine1306` API; body observer inactive in Classic and active in non-Classic designs.

- [ ] **Step 1: Write failing regression tests** for Classic startup and Modern/Classic switching.
- [ ] **Step 2: Run PR tests and verify RED** against current main behavior.
- [ ] **Step 3: Implement the minimal observer lifecycle guard**; do not alter layout generation or business DOM movement.
- [ ] **Step 4: Run targeted and full release tests and verify GREEN.**
- [ ] **Step 5: Record measured synthetic work reduction:** active body-wide layout observers in Classic `1 -> 0`; non-Classic remains `1`.
