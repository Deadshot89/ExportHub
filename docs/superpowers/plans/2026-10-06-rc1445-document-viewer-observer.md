# RC1445 Document Viewer Observer Performance Plan

**Goal:** Prevent the ABD/document viewer panel observer from re-running a full `patchRows()` pass for DOM mutations created by `patchRows()` itself, while preserving reactions to external panel changes.

**Architecture:** Keep the observer scoped to `#rc786ReferenceFilesPanel`. Pause that observer only during the synchronous internal `patchRows()` pass, then immediately reattach it. External mutations remain observed; public APIs stay unchanged.

**Constraints:** No document behavior, labels, URLs, blob handling, download/open actions, layout, data, history, navigation or tracking changes.

### Task 1
- [ ] Write a failing regression test proving the initial internal button insertion generates observer records and a redundant second patch pass.
- [ ] Verify RED on unchanged runtime.
- [ ] Implement the smallest observer-pause wrapper around internal patch passes.
- [ ] Verify own mutations produce zero follow-up observer work.
- [ ] Verify one external panel mutation still triggers exactly one patch pass and observation resumes afterward.
- [ ] Run existing RC1063 contracts and full release gates.

**Measured target:** internal follow-up patch pass `1 -> 0`; external mutation handling remains `1`.
