# Design Workflow

You use OpenPencil design tools to read, create, modify, and export design documents. Always read before you write — never guess node IDs, types, or property names.

## Quick Reference — Tool Groups

### Discover & Navigate
- `list_documents` → list open docs/tabs with IDs. **Call first** when targeting a specific document.
- `list_pages` → pages in the document.
- `switch_page` → change active page.
- `get_current_page` → current page name and ID.

### Read the Canvas
- `get_page_tree` → lightweight tree: id, type, name, size. Use `depth`, `root_id`, or `node_types` to keep it small.
- `get_node` → full properties of one node. Use `depth: 0` for the node only.
- `find_nodes` → search by name substring and/or type. Case-insensitive.
- `get_selection` → currently selected nodes with full properties.
- `describe` → semantic description: layout role, visual properties, alignment issues.
- `get_jsx` → JSX representation of a node subtree.

### Create
- `render` → **preferred** — create entire component trees from JSX in one call.
- `create_shape` → create one shape: FRAME, RECTANGLE, ELLIPSE, TEXT, LINE, STAR, POLYGON, SECTION.
- `import_svg` → import SVG markup as a vector node.
- `create_component` / `create_instance` → component system.

### Modify
- `set_fill` → fill colour (hex).
- `set_stroke` → stroke colour, weight, dash pattern.
- `set_layout` → auto-layout (direction, spacing, padding, alignment).
- `set_layout_child` → child sizing, grow, alignment within auto-layout.
- `update_node` → general-purpose: position, size, opacity, corner radius, text, font.
- `set_text` / `set_text_properties` → text content and alignment/case/truncation.
- `set_effects` → shadows and blurs.
- `batch_update` → multiple modifications in one call with one layout recompute.

### Structure
- `reparent_node` → move a node into a different parent.
- `group_nodes` / `ungroup_node` → grouping.
- `clone_node` → duplicate.
- `delete_node` → remove.
- `arrange` → align or distribute nodes.

### Export & Save
- `export_svg` → SVG markup (or write to file if path given).
- `export_image` → PNG/JPG/WEBP as base64 (or write to file).
- `export_pdf` → PDF export.
- `save_file` → save the document to .fig.

## Common Workflows

### 1. Read an existing design
```
list_documents                           → get document_id
get_page_tree  document_id=X             → see the node hierarchy
get_node       id=<interesting_node>     → full properties of one node
describe       id=<node>                 → semantic analysis
```

### 2. Create a simple UI component
```
render  jsx="<Frame name='Card' width={320} height={200} fill='#FFFFFF' cornerRadius={12} layoutMode='VERTICAL' padding={16} itemSpacing={8}><Text name='Title' characters='Hello' fontSize={18} fontWeight={700} /><Text name='Body' characters='Description text' fontSize={14} fill='#666666' /></Frame>"
```

### 3. Modify existing nodes
```
find_nodes    name="Card" type="FRAME"   → get the ID
set_fill      id=<id> color="#F0F0F0"    → change background
set_layout    id=<id> spacing=12         → adjust spacing
set_stroke    id=<id> color="#DDDDDD" weight=1
```

### 4. Bulk modifications
```
batch_update  operations=[{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]
```

### 5. Export
```
export_svg    ids=["0:5"]                → get SVG markup
export_image  ids=["0:5"] format="PNG" scale=2  → high-res PNG
save_file                                → save document
```

## Key Rules

1. **Always call `list_documents` first** when more than one document may be open. Pass `document_id` explicitly.
2. **Use `batch_update`** for bulk edits — it's faster than many individual calls and avoids redundant layout recomputes.
3. **Node IDs** look like `"0:5"`, `"1:23"`. Never fabricate IDs — always read them from tool results.
4. **Tools operate on the current page** by default. Pass `page_id` to target a different page.
5. **Prefer `render`** over multiple `create_shape` + `set_*` calls for creating complex layouts.
6. **Use `describe`** when you need to understand what a node represents semantically.
7. **Colours** are hex strings: `"#FF0000"`, `"#FF000080"` (with alpha).
8. **Auto-layout directions**: `"HORIZONTAL"` or `"VERTICAL"`.
9. **Sizing modes**: `"FIXED"`, `"HUG"`, `"FILL"`.
10. **Alignment**: `"MIN"`, `"CENTER"`, `"MAX"`, `"SPACE_BETWEEN"`.
