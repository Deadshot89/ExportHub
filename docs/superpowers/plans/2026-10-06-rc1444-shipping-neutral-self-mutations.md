# RC1444 Shipping Neutral Self-Mutation Performance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the shipping-neutral MutationObserver from scheduling a redundant second full shipping scan for mutations that were already neutralized by its own run, without missing real external updates.

**Architecture:** Keep the existing scoped observer on `#rc626Shipping`, RAF coalescing, text replacement, notice suppression and attribute handling. Filter delivered mutation records before scheduling: child-list changes remain conservative and always schedule; character-data and observed attributes schedule only when their current state still requires neutralization or notice-state reconciliation.

**Tech Stack:** Browser JavaScript, Node.js `node:test`, `vm`, GitHub Actions.

**Spec:** User `/optimize` request in the current project conversation.

## Global Constraints

- Fully lossless and backward compatible.
- No copy, layout, design, API, data, navigation, print or tracking changes.
- Do not reduce the observer scope or remove supported observed mutation types.
- External Gate41/shipping text or observed attribute changes must still schedule processing.
- Child-list changes remain fail-safe and continue to schedule.
- Performance success requires measured synthetic work reduction plus green release tests.

## Review Focus

- A self-neutralized characterData record must not schedule a second RAF.
- An external characterData value containing Gate41 must still schedule.
- An external observed attribute containing Gate41 must still schedule.
- Child-list mutations must still schedule.
- Existing replacement/suppression contracts remain unchanged.

---

### Task 1: Filter already-neutralized observer records

**Files:**
- Create: `test/rc1444-shipping-neutral-self-mutation.test.mjs`
- Modify: `assets/rc1114-shipping-neutral.js`

**Interfaces:**
- Consumes: existing `replaceText`, `shouldSuppressNotice`, scoped `MutationObserver`, and `schedule()`.
- Produces: unchanged public `ExportHUBRC1114ShippingNeutral` API with fewer redundant RAF scans.

- [ ] **Step 1: Write failing behavior tests** for self-neutralized character data versus real external character/attribute/child-list changes.
- [ ] **Step 2: Verify RED** on the unchanged runtime.
- [ ] **Step 3: Add the smallest mutation-record relevance filter** and use it only inside the existing observer callback.
- [ ] **Step 4: Verify GREEN** and run the existing RC1114 contracts.
- [ ] **Step 5: Run full release gates.**
- [ ] **Step 6: Record measured synthetic follow-up RAF work:** self-neutralized mutation `1 -> 0`; external relevant mutation remains `1`.
