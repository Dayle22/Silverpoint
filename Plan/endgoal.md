# End goal

## What OpenPotlood is

OpenPotlood is a private, local-only Windows desktop design application in the Figma mould — a vector/canvas design tool that runs entirely on this machine, with no accounts, no cloud sync and no telemetry. It is forked from the open-source OpenPencil editor and customised for personal production work rather than for publishing as an open-source project.

Technically: a Vue 3 + TypeScript front end rendering to a CanvasKit/Skia canvas, Bun for tooling and package builds, and a Tauri (Rust) desktop shell packaged as an NSIS installer. Files round-trip through the `.fig` (Kiwi) format, so work can move between OpenPotlood and Figma.

## What it does

- **Design on an infinite canvas** — frames, shapes, paths, text, images, groups, layers, boolean operations, alignment and constraints.
- **Edit non-destructively** — image adjustments (brightness/contrast, saturation, curves/gamma) and effects applied as live properties rather than baked pixels.
- **Open and save `.fig` files** — import existing Figma work, keep editing locally, export back out.
- **Work offline, permanently** — every document, asset and setting stays on this machine; the app is installed as a normal Windows program.
- **Be driven by an agent** — a local MCP bridge exposes the editor to Claude, so design steps can be inspected and automated from a session rather than only clicked by hand.

The intended direction (not all built yet) is a tool that closes the gap between screen design and print production: physical units and print rulers, print presets, CMYK gamut warnings, a DPI inspector, production-grade PDF export and editable PDF import, plus practical utilities like a carousel slicer and QR/EAN-13 generation.

## How it is run

- Purpose: Deliver OpenPotlood as a reliable, customised, Figma-style Windows desktop design application.
- Parameters: Private and local-only; use the live app in `App/`; keep verification focused and proportionate; treat `Toolbox/` as supporting or historical material, never as live source.
- Current priority: Before extending the feature set, improve the existing editor experience and the local MCP experience through focused review and targeted repairs. The review scopes will be chosen in later planning sessions; do not assume specific focus areas yet.
- Done when: The agreed design capabilities work, delivered updates are built and installed on this machine, and the installed app launches and behaves as verified.
