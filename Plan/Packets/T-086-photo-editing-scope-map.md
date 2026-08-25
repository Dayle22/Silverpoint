# T-086 — Photo editing scope map

Task ID: T-086
Project ID: openpotlood
Packet state: Scope map — **not executable**
Project goal link: Plan/endgoal.md
Prepared: 2026-08-24
Prepared from: the user's request to scope photo editing before committing to it, with the stated competitive frame of Lightroom, Photoshop and Aftershoot
Related: T-015 (adjustments, Done), T-013 (clipping/masks, Done), T-084 (persona capability model, Brief), T-081/T-081a (`.op` native format, To Do), T-061 (CanvasKit memory, Done)

This file is a scope map in the sense T-070 is: it maps a request onto the live source and proposes a
landing order. It is not a step, has no acceptance criteria, and must not be executed. Executable work
comes out of it as separately expanded packets.

## Why this exists

Photo editing is the first request in this project whose cheapest route and its most ambitious route are
different *applications*, not different sized features. Committing to packets before that fork is chosen
would either under-build (another two sliders in the Effects panel) or silently start a rewrite of the
document model. This map states what the live code can absorb today, what it cannot, and what each route
actually costs.

## Verified starting state

Every claim below was read from the live tree on 2026-08-24.

### The raster surface that exists

| Path | Symbol | What is actually there |
| --- | --- | --- |
| `App/packages/scene-graph/src/types.ts` (~L128, L156-158) | `ImageScaleMode`, `imageHash`, `imageScaleMode`, `imageTransform` | Images exist **only as fills on a node**. `'FILL' \| 'FIT' \| 'CROP' \| 'TILE'` plus a transform matrix. There is no raster/pixel node type anywhere in the scene graph. |
| `App/packages/scene-graph/src/index.ts` (L73) | `images = new Map<string, Uint8Array>()` | Image bytes live in one flat, document-wide map of **encoded** bytes, keyed by content hash and therefore deduplicated. Not tiled, not mip-mapped, not decoded at rest. |
| `App/packages/scene-graph/src/images.ts` | `computeImageHash`, `readImagePixelSize` | 160-bit FNV-style content hash over the encoded bytes. Dimension sniffing supports **PNG, GIF, WebP, JPEG only**. No TIFF, no HEIC, no RAW. |
| `App/packages/core/src/canvas/fills.ts` (~L500) | `ck.MakeImageFromEncoded(data)` | Decoding happens at render time through CanvasKit, from the stored encoded bytes. |
| `App/src/components/fill-picker/ImageFillPicker.vue` (L14) | `{ value: 'CROP', label: 'Crop' }` | "Crop" in the UI today is a **scale-mode dropdown entry**, not a crop tool. There is no crop, straighten, or image-pan interaction on canvas. |

### The colour pipeline that exists

`App/packages/core/src/canvas/adjustments.ts` (92 lines) is the whole of it, and it is in good shape:

- `visibleAdjustments()` filters the node's effect list to the three adjustment types.
- `makeSkSL()` **generates a shader per type-sequence** — each adjustment contributes its own uniform
  declarations and one step line, concatenated in list order.
- Programs are cached by type-sequence (not by slider values), capped at `MAX_PROGRAMS = 32` with
  eviction and `.delete()`.
- Compilation goes through `RuntimeEffect.MakeForBlender`, values arrive as a flat `Float32Array` of
  uniforms, and the shader does explicit unpremultiply → adjust → premultiply → SrcOver.

The consequence that matters: **adding a new adjustment type is additive.** A new type is one branch in
`visibleAdjustments()`, one uniform block plus one step line in `makeSkSL()`, one push in `uniforms()`,
one entry in the `Effect` union (`types.ts` L192-220, where adjustment fields are already optional), one
Effects-panel control, one SVG primitive, and a `.fig` plugin-data value. T-015 built the extension point
and proved the persistence channel; most of the Photoshop colour toolbox can walk straight through it.

Two real limits of that pipeline, both currently invisible because the three landed adjustments are crude:

1. **It works in sRGB at `half` precision.** There is no linear-light working space and no colour
   management. Fine for design; it is *not* what Lightroom does, and banding and hue shifts will appear
   once serious curve and white-balance work stacks up.
2. **Uniforms only, no textures.** Freeform curves and LUTs need either a uniform array sampled in the
   shader or a child shader carrying a LUT image. That is a design decision, not a blocker.

### Supporting facts

- **Histogram is reachable.** `App/packages/core/src/io/formats/raster/render.ts` (L98, L240) already
  renders to an offscreen surface and calls `canvas.readPixels(...)`. A histogram is that route plus
  binning; no new capability is needed.
- **Undo is closure-based and capped.** `App/packages/scene-graph/src/undo.ts` — `UndoEntry` is
  `{ label, forward, inverse }` with `DEFAULT_HISTORY_LIMIT = 200`. Perfect for property edits. It has
  no concept of a dirty region, so a pixel-painting route cannot use it unmodified without holding up to
  200 image buffers in memory.
- **Node blend modes already exist** (`types.ts` L152 paint, L208 effect, L394 node).
- **Masks exist, but vector only** — T-013 delivered clipping and layer masks. There is no raster
  selection, no marching-ants marquee, no lasso, no per-pixel mask channel.
- **The MCP surface is document-level.** `App/packages/mcp/src/tool/registration.ts` registers
  `list_documents`, `save_file`, `open_file`, `new_document`, `get_codegen_prompt`. Nothing addresses
  nodes, adjustments or pixels yet.
- **There is a Rust process available.** The Tauri shell is a real native side. Anything genuinely
  unsuited to WASM — RAW decode, ICC transforms, ONNX inference for subject/sky selection — has a
  plausible home there. This is the single most under-used asset for a photo route.
- **The document format is still `.fig`.** T-081/T-081a (`.op` native container) are To Do and
  unexpanded. Any route that stores pixel data must either wait for `.op` or abuse plugin data.

## The competitive frame, stated honestly

The three named competitors are three different products, and OpenPotlood is not equidistant from them.

| Product | What it actually is | Distance from OpenPotlood today |
| --- | --- | --- |
| **Photoshop** | Pixel compositor: raster layers, selections, brushes, retouch, masks, filters. Its non-destructive half — adjustment layers, smart objects, layer masks, blend modes — is architecturally close to what OpenPotlood already does. | **Nearest.** The non-destructive half is reachable through the existing effect stack and node model. The pixel half needs a new node type and a new memory/undo model. |
| **Lightroom** | A *catalogue* plus a RAW developer. The editing is parametric and non-destructive; the hard parts are RAW decode, colour management, and managing tens of thousands of images with batch sync. | **Far, and sideways.** OpenPotlood is document-centric: files opened in tabs (T-025), version history per document (T-058). A catalogue is a database and a different application shape. Chasing it means building a second product inside this one. |
| **Aftershoot** | AI culling and style-learned batch editing for working photographers. Value is throughput over thousands of frames, not editing depth. | **Far, but interesting.** It presumes a catalogue too. However, its *agent-driven* premise is the one thing OpenPotlood is already structurally set up for — the MCP bridge and local-only inference are a genuine wedge no incumbent has locally. |

**The recommendation implied by this table:** compete with Photoshop's non-destructive half inside the
design document, treat Lightroom's catalogue as an explicit non-goal unless the project is willing to
become a photo manager, and hold Aftershoot's territory as the long-term agent play that follows from
the MCP bridge rather than from pixel features.

## Route A — "Photoshop-like, now" (no new node type)

Everything in this route lands through the existing effect stack, node model and fill model. No pixel
buffers, no format change, no undo change, `.fig` round-trip through the channel T-015 already proved.
This is the bucket the user described as *"we can add photoshop like features to it for now."*

| # | Candidate | Route through live code | Rough size |
| --- | --- | --- | --- |
| A1 | **Real Curves** — composite + per-channel R/G/B, freeform points — replacing today's gamma-only `CURVES` | New adjustment type carrying sampled control points; SkSL samples a uniform array. Must keep the existing `CURVES` gamma value readable so landed documents do not break. | Medium |
| A2 | **Levels + live Histogram** | Levels is a pure SkSL step. Histogram reuses the offscreen `readPixels` route in `raster/render.ts` and bins it. | Medium |
| A3 | **Exposure, Shadows/Highlights, Vibrance, White Balance (temp/tint), Colour Balance, HSL / selective colour, Channel Mixer, Black & White, Photo Filter, Invert, Threshold, Posterize** | Each is one branch + one uniform block + one step line + one control + one SVG primitive. Individually small; the cost is breadth and the Effects panel becoming a list of twenty items. | Small each, large in aggregate |
| A4 | **Crop, straighten and pan on an image fill** | `imageTransform` already exists in the model; this is a canvas tool and handles, not a data change. Highest perceived "photo app" value per unit of work in this whole map. | Medium |
| A5 | **Standalone adjustment layer** — a node that adjusts everything beneath it | T-015 explicitly deferred exactly this and named the consequence: a new scene-node type and a compositing model. No pixel buffer needed, so it stays in Route A, but it is the largest item in it. | Large |
| A6 | **LUT import (`.cube`) / Colour Lookup** | Needs a child shader carrying a LUT texture — the first thing in this route that exceeds "uniforms only". | Medium |
| A7 | **Linear working space + colour management** | Not a feature; a correctness foundation under A1-A3. Cheap to do before them, expensive to retrofit after. | Medium, and time-sensitive |

Sequencing note: A7 before A1/A2 if serious colour work is wanted, because moving the working space after
users have saved curve values changes their documents' appearance.

## Route B — "Pixel layer" (Photoshop's other half)

Brush, eraser, clone, heal, raster selections, per-pixel masks. This requires, at minimum:

- a new raster scene-node type owning a pixel buffer, and a tiling strategy — `graph.images` is a flat
  map of whole encoded images and cannot represent a mutable 50MP canvas;
- a dirty-region undo model, because `UndoEntry` closures at a 200-entry limit would hold buffers;
- a document container that can store pixel data, i.e. **T-081/T-081a (`.op`) must land first**;
- a defined `.fig` degradation story, since Figma has no equivalent node;
- export and memory work on top of T-061.

This is not a packet. It is a track, and it should not start before `.op` exists.

## Route C — "Lightroom/Aftershoot" (catalogue + RAW + AI)

Adds, on top of Route A: RAW decode (realistically libraw on the Rust side), a catalogue database,
multi-image batch sync, culling, and local inference for subject/sky selection and style learning.

Explicit finding: **this is a second application.** It should only be opened if the project decides
OpenPotlood is also a photo manager. If it is ever opened, the Rust shell and the local-only, no-cloud
posture are real advantages — every incumbent here is subscription-and-cloud shaped.

## Open decisions — for the user

1. **How far does photo editing go?** Route A only; A then B; or A then C. This is the fork the whole
   map exists to expose. *Recommendation:* commit to Route A now, keep B behind `.op`, and treat C as a
   separate product decision rather than a backlog item.
2. **Does photo become a fourth persona?** T-084 is being written now with `essential / advanced / dev`.
   Route A alone probably does not justify a fourth persona; Route B clearly would. Deciding late is
   cheap for T-084 and expensive for T-032a/T-073.
3. **Colour correctness now or later?** A7 is much cheaper before A1-A3 than after.
4. **Where does the Effects panel stop?** Twenty adjustment types in one flat list is a worse experience
   than three. Route A needs a grouping/search decision, plausibly folded into T-045's compact list.

## Non-goals of this map

- No packet is authorised by this file.
- No change to `App/` follows from it.
- It does not settle T-084's persona list, and it does not modify T-015.

## Revision history

| Revision | Date | Change |
| --- | --- | --- |
| 1 | 2026-08-24 | Initial scope map, verified against live source at plan state of 2026-08-24. |
