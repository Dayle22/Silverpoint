# OpenPencil — Agent Quick Reference

OpenPencil is a vector design editor (like Figma) that runs as a desktop app and in the browser. You control it through MCP tools that read and modify the design document.

## Getting Started

1. Call `get_design_prompt` for a full workflow guide with recipes
2. Call `list_documents` to see open documents — always pass `document_id` on subsequent calls
3. Call `get_page_tree` to see what's on the canvas

## Core Tools (start here)

**Read:** `get_selection`, `get_node`, `find_nodes`, `get_page_tree`, `get_jsx`, `describe`
**Create:** `render` (JSX — preferred), `create_shape`, `import_svg`
**Modify:** `set_fill`, `set_stroke`, `set_layout`, `set_text`, `update_node`, `batch_update`
**Structure:** `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
**Export:** `export_svg`, `export_image`, `save_file`

## Essential Concepts

- **Node IDs** look like `"0:5"`, `"1:23"`. Never make them up — always read them from tool results.
- **Node types:** FRAME, RECTANGLE, ELLIPSE, TEXT, LINE, STAR, POLYGON, SECTION, GROUP, COMPONENT, INSTANCE, VECTOR.
- **Colours** are hex strings: `"#FF0000"`, `"#FF000080"` (last two digits = alpha).
- **Auto-layout** uses `"HORIZONTAL"` or `"VERTICAL"` direction, with `"FIXED"`, `"HUG"`, or `"FILL"` sizing.
- **Alignment:** `"MIN"` (start), `"CENTER"`, `"MAX"` (end), `"SPACE_BETWEEN"`.
- Most tools operate on the **current page**. Pass `page_id` to target a different page.

## Preferred Patterns

- **Creating layouts:** Use `render` with JSX rather than multiple `create_shape` + `set_*` calls:
  ```
  render jsx="<Frame name='Card' width={320} fill='#FFF' layoutMode='VERTICAL' padding={16}><Text characters='Hello' fontSize={18} /></Frame>"
  ```
- **Bulk edits:** Use `batch_update` instead of many separate calls — it's faster and triggers only one layout recompute.
- **Understanding a node:** Call `describe` for semantic analysis, `get_jsx` for structure, `get_node` for raw properties.

## Common Mistakes to Avoid

1. Don't guess node IDs — always read the canvas first with `get_page_tree` or `find_nodes`
2. Don't forget `list_documents` when multiple documents might be open
3. Don't use many individual `set_*` calls when `batch_update` can do it in one
4. Don't call `create_shape` repeatedly when `render` can create a whole tree at once
