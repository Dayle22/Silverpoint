# T-068b - Property-transfer commands, menus and shortcuts

Task ID: T-068b
Packet state: Brief
Depends on: T-068a

## Intended Outcome
Expose Copy Properties and Paste Properties through identical browser/native menu commands and remappable shortcuts.

## Contract
Bound files: menu schema, both action maps, menu messages and keyboard registry plus focused menu/shortcut tests. Command ids remain `copy-properties` and `paste-properties`; shortcuts default to `$mod+Alt+KeyC/V`. No canvas component.

## Verification
Development loop: `bun test tests/engine/app/shell/menu/schema.test.ts`. Final once: shortcut test, type checks, focused Oxlint and browser/native action read-back.

## Status record
2026-08-20 — Command-only split; expand after T-068a is Done.
