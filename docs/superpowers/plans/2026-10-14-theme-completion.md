# Theme Completion Implementation Plan

> **For agentic workers:** Execute inline with TDD and verification-before-completion.

**Goal:** Complete the visible redesign of Modern Business, Glass and Neon Night while keeping Klassisch visually and functionally untouched.

**Architecture:** Extend only the scoped non-classic theme layer in `assets/rc1304-theme-switcher.css`. Cover the remaining UI families with shared theme tokens plus explicit Modern/Glass/Neon personality overrides. Do not change business logic, data handling, routing, persistence or classic selectors.

**Tech Stack:** HTML/CSS/vanilla JavaScript, Node.js `node:test` regression suite.

**Spec:** `Eingefügter Text(20261012-194216).txt` (project specification)

## Global Constraints

- `Klassisch` remains completely untouched.
- No business-logic changes.
- No information or function may be removed.
- No overlaps or clipped text.
- New styles must be scoped to non-classic themes or to an explicit Modern/Glass/Neon selector.
- Preserve semantic success/warning/error/info colors.
- Responsive behavior must remain usable on desktop, tablet and smartphone.

## Review Focus

- Native checkbox/radio controls must not inherit full-width text-input geometry.
- Menus/popovers/tooltips must remain legible in all three themes.
- Disabled/focus states must be obvious and keyboard accessible.
- Upload/loading/alert/chart surfaces must not fall back to legacy styling.
- Mobile bottom navigation and table overflow must not regress.

---

### Task 1: Add completion regression contract

**Files:**
- Create: `test/rc1532-theme-completion.test.mjs`

- [ ] Add tests for remaining component families, scoped non-classic guards, semantic states and responsive coverage.
- [ ] Run the new test and confirm RED because the RC1532 completion marker/styles do not exist yet.

### Task 2: Complete component-level redesign

**Files:**
- Modify: `assets/rc1304-theme-switcher.css`

- [ ] Add a scoped `RC1532 THEME COMPLETION PASS` using existing theme variables.
- [ ] Style focus/disabled, checkbox/radio/switch, dropdown/popover/listbox, tooltip, upload, progress/loading, alerts, footer, charts, accordions, pagination/breadcrumbs and date controls.
- [ ] Add distinct Modern Business, Glass and Neon Night presentation rules.
- [ ] Keep every new selector out of Classic.
- [ ] Run the focused test until GREEN.

### Task 3: Full regression and release integration

**Files:**
- Existing release/build files only if a cache/release contract requires it.

- [ ] Run `npm test` and the existing RC1304 theme test.
- [ ] Verify release asset contract still includes the theme stylesheet.
- [ ] Review diff for accidental business-logic or Classic changes.
- [ ] Only after all gates are green, proceed through the normal PR/deployment path.
