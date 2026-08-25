# T-068c - Property-transfer context menu and end-to-end flow

Task ID: T-068c
Packet state: Brief
Depends on: T-068b

## Intended Outcome
Expose the two existing commands in `CanvasMenu.vue` and prove menu, context menu and shortcuts reach one implementation.

## Contract
Modify only `CanvasMenu.vue` and `tests/e2e/properties/copy-paste-properties.spec.ts`, plus an existing context-menu regression if required. No property model, clipboard, menu schema or shortcut edits.

## Verification
Development loop: the focused copy/paste-properties Playwright spec with its existing E2E header. Final once: context-menu regression, type checks, focused Oxlint and browser check.

## Status record
2026-08-20 — Context-surface-only split; expand after T-068b is Done.
