# RC990 Progress

Branch: `rc990-large-ux`

## Completed blocks

### Release Center
- Root cause for confirmation scroll/position jumps corrected.
- Shared open-change status source.
- Downstream full renders preserve the position.

### Design & Layout
- Canonical `#rc990-design-system` added once.
- Legacy `exporthub-rc364-mobile-overflow-fix` viewport-width layer replaced in-place instead of stacked.
- Dashboard, Lager, Aufgaben/Planer, notification center and warning center use the scoped compact system.
- Notification center remains informational/blue; warning center remains separate/amber.
- Draggable card transitions are not added; RC946 remains authoritative.
- RC971/RC977-RC980 and document/print geometry remain outside the new screen layer.
- The apply helper refuses unsafe closing-tag insertion and asserts that all 73 script blocks remain byte-identical.

Verification before the TESTVERSION commit on Node 20.20.2:
- `node --test test/rc990-design-system.test.mjs`: 8/8 passed.
- `npm test`: passed with zero failures.
- `TESTVERSION.html` was then committed by the branch-only apply workflow.

## Next block
Rendering / focus / navigation:
- audit existing RC950 frame batching and loading system,
- preserve focus, selection, visible value and scroll through legitimate rerenders,
- avoid older team state overwriting local active input,
- reduce unnecessary full renders/save cascades,
- preserve true previous-area navigation and prevent duplicate layouts during fast switching.

Production and TESTSERVICE remain unchanged until RC990 total integration is verified.
