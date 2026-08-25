# T-070d2 - Tab-drop preview and commit (scope map)

Task ID: T-070d2
Packet state: Retired as executable packet - split into T-070d2a and T-070d2b
Depends on: T-070d1
Superseded by: `T-070d2a-tab-drop-model-commit.md`, then `T-070d2b-tab-drop-preview-ui.md`

## Scope Map

The original packet combined pure move semantics, reactive API migration, gesture activation, three visual consumers and E2E. Expansion against live source exceeded the packet file-footprint guardrail and would create an unsafe intermediate where a tab drop could commit before its matching indicator existed.

- **T-070d2a** adds and verifies the `DropTarget`-driven panel mutation path while the live gesture remains `{ allowTab: false }`.
- **T-070d2b** activates tab targeting and lands ring/caret preview, barrel exports and E2E atomically.

No status is recorded here. `Plan/plan.md` is authoritative for T-070d2a and T-070d2b.

## Revision History

- Revision 1 - 2026-08-20: brief split from combined T-070d.
- Revision 2 - 2026-08-21: retired as an executable packet after live expansion; replaced by model/commit and preview/UI slices.
