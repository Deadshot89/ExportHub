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

Task 1: RED tests committed at fc7cbd4; awaiting/observing full Node regression failure before production implementation.
