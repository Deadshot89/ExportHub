# SDD ledger — plan: docs/superpowers/plans/2026-10-15-sop-training-center-clean-rebuild.md

Workspace ruling: GitHub connector execution has no local authenticated worktree; PR #763 head `design/sop-training-center-rebuild-2026-10-15` is the isolated implementation workspace. All writes are explicitly scoped to that draft-PR branch; main is untouched.

Pre-flight shared interfaces:
- Task 1 → Task 2: new `ExportHubTrainingCenterModel` / Store contract feeds the shell runtime; interfaces align.
- Task 1 → Tasks 4/8: sanitizer and isolated `sopTrainingCenter` persistence define the only allowed durable training metadata; interfaces align.
- Task 2 → Task 5: new shell/runtime is the mount surface for training/tour UI; no legacy presentation dependency allowed.
- Task 3 → Tasks 5/6: standard SOP route/target metadata becomes tour/scenario input; interfaces align.
- Task 4 → Tasks 5/6: memory state, controller, demo adapter and write guard are mandatory dependencies for tour/scenario mutations; interfaces align.
- Task 5 → Task 6: target registry + tour engine consumes the 13-step scenario; interfaces align.
- Tasks 1–6 → Task 7: build wrapper must ship only the new namespace and remove legacy tags; interfaces align.
- Task 7 → Task 8: proven replacement build/cleanup safety is the prerequisite for deleting legacy runtime and release wiring; interfaces align.

## Status 15.10.2026

- Task 1 — ✅ isolated data contract/store/server sanitizer implemented and covered by regression tests.
- Task 2 — ✅ new Training-Center shell/runtime, responsive UI, keyboard navigation and six-language namespace implemented.
- Task 3 — ✅ first standard shipment SOP/customer deviation model and screenshot registry implemented; DHL Express added as first real SOP from the supplied source document.
- Task 4 — ✅ memory-only TrainingState, DemoAdapter, central write guard and lifecycle controller implemented; productive callbacks are blocked in training mode.
- Task 5 — ✅ stable target registry, tour engine, responsive tour UI and missing `tour.css` completed. Named scenario validators are executed fail-closed and cannot be bypassed with fabricated validation flags.
- Task 6 — ✅ `Meine erste Sendung` implemented with exactly 13 ordered actions, deliberately missing demo document, deterministic ABD/customs decision and memory-only mutations. Training end/reload leaves no demo shipment in persisted browser state.

Task-6 verification evidence on exact branch SHA `1748c9debe145d28f0de45896e550358978ca8db`:
- Training Center Native TDD run `38725825696`.
- Node contracts: **63/63 passed, 0 failed**.
- Playwright browser contracts: **36/36 passed, 0 failed** across desktop, tablet and mobile, including all four current themes, tour target visibility/focus handling, isolation and the complete 13-step first-shipment scenario.
- Browser proof records zero fetch writes and zero LocalStorage/SessionStorage writes for demo business data; after training end + reload, `TrainingState.snapshot()` remains null.

Current next gate: **Task 7 — build wiring, screenshot pipeline and narrowly allowlisted legacy cleanup safety**. Task 8 production cutover is not started. Project must remain below 100% until the exact green release SHA is deployed to production and production smoke + zero-demo-persistence proof pass.
