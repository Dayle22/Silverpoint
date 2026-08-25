---
title: Exporting
description: Export images, SVG, and .fig subsets, and open .fig or .pen documents in OpenPencil.
---

# Exporting

Export PNG, JPG/JPEG, WEBP, SVG, and PDF files from the Export panel or File menu. PNG preserves transparency; JPG uses an opaque white matte at quality 90. PDF produces one target-sized page.

Export individual nodes as images or `.fig` subsets, and open full `.fig` or `.pen` documents.

## Image Export

Select a node and use the Export section in the properties panel.

### Export Settings

- **Scale** — 0.5×, 0.75×, 1×, 1.5×, 2×, 3×, or 4× (hidden for SVG — vectors are resolution-independent)
- **Format** — PNG (transparent background), JPG (white background), WEBP (transparent background), SVG (vector), PDF, PDF (print), IDML (InDesign / Affinity Publisher), `.fig` (native document subset)

You can add multiple export settings to export the same node at different scales or formats in one go. A live preview with a checkerboard background shows what will be exported.

Each selected node is exported as its own target. With no selection, the current page's visible artwork is exported as one content-sized target. Multiple files are bundled into one ZIP with sanitised, disambiguated names. Guides, margins, display-only bleed, rulers, selection chrome, and node controls are editor-only and never change export bounds or appear in exports.

Ordinary SVG and PDF exports retain vector structure where supported. A visible background blur uses one whole-target PNG fallback so the scene backdrop is preserved; it is not represented as a foreground Gaussian blur. PDF output is not print-ready output.

### IDML & Print Export

- **IDML (InDesign)** — Exports target frames to an Adobe InDesign Markup Language package (`.idml`), supported by Adobe InDesign and Affinity Publisher. Preserves pages, vector paths (`<Rectangle>`, `<Oval>`, `<Polygon>`), solid color swatches, font references, linked story text frames, and embedded raster images. Unsupported effects (drop shadows, blurs, layer masks, gradient fills) automatically fall back to embedded high-resolution raster images with explicit preflight warnings.
- **PDF (print)** — Generates production-ready PDF output with standard trim, bleed, art boxes, and optional crop marks for print workflows.

### Export Methods

| Method | Mac | Windows / Linux |
|--------|-----|-----------------|
| Keyboard shortcut | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Context menu | Right-click <kbd>→</kbd> Export… | Right-click <kbd>→</kbd> Export… |
| Properties panel | Click "Export" button | Click "Export" button |

The exported file is saved via a native dialog (desktop) or browser download.

## Copy/Paste as

In addition to file export, you can copy the selection to the clipboard in multiple formats via the context menu (right-click → Copy/Paste as):

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| Copy as text | — | — |
| Copy as SVG | — | — |
| Copy as PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Copy as JSX | — | — |

- **Copy as text** — copies visible text content from the selection
- **Copy as SVG** — copies the selection as SVG markup (paste into code editors, Inkscape, etc.)
- **Copy as PNG** — renders at 2× and copies to the clipboard (ready to paste into Slack, Notion, etc.)
- **Copy as JSX** — copies the OpenPencil JSX representation (compatible with `renderJsx()`)

## .fig File Operations

OpenPencil uses the .fig format for full documents — the same binary format as Figma.

### Opening Files

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Open file | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |

A file picker dialog opens, filtered for `.fig` and `.pen` files. On the desktop app, this uses the native OS dialog.

### Saving Files

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Save | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Save As | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

- **Save** overwrites the currently open file without a dialog
- **Save As** opens a save dialog to choose a new location

Saved files are compressed and include a thumbnail image for preview in file browsers.

### Round-trip Compatibility

Files exported from OpenPencil can be opened in Figma, and vice versa. The .fig format preserves all node types, properties, fills, strokes, effects, vector data, and layout settings.

## IDML Import

Open or drag an `.idml` file from Adobe InDesign or Affinity Publisher into Silverpoint. Before anything is added to the canvas, an import dialog shows the file name, page count, and diagnostics found during the initial scan. Choose **Cancel** to leave the current document unchanged, or **Import** to create editable Silverpoint objects.

IDML import is lossy by design. Unsupported colour spaces such as spot and LAB colours, external image links, tables, footnotes, anchored objects, and text wrap may be skipped with diagnostics. Threaded stories and transforms that Silverpoint cannot represent exactly may be approximated with diagnostics. The importer preserves supported objects as editable nodes; it does not replace unsupported content with a flattened raster fallback.

An imported IDML document uses `.fig` as its save format. Silverpoint does not save changes back to the source `.idml` or overwrite that source file; IDML remains available separately as an export format.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Export selection | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Copy as PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Open file | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Save | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Save As | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

## Tips

- Use 2× or 3× scale when exporting for high-DPI screens.
- JPG always uses a white background — use PNG or WEBP if you need transparency.
- Use SVG export when you need a vector format for further editing in Illustrator, Inkscape, or code.
- The thumbnail in exported .fig files enables preview in file browsers and Figma's file picker.
