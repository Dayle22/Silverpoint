use serde::Deserialize;
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder};

#[cfg(target_os = "macos")]
use tauri::menu::PredefinedMenuItem;

#[cfg(not(target_os = "macos"))]
use tauri::Manager;

#[derive(Deserialize)]
struct MenuGroup {
    label: String,
    items: Vec<MenuEntry>,
}

#[derive(Deserialize)]
struct MenuEntry {
    #[serde(default)]
    r#type: Option<String>,
    id: Option<String>,
    label: Option<String>,
    accelerator: Option<String>,
    #[serde(default)]
    checkbox: bool,
    #[serde(default)]
    sub: Vec<MenuEntry>,
}

fn build_submenu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    label: &str,
    items: &[MenuEntry],
) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);

    for entry in items {
        if entry.r#type.as_deref() == Some("separator") {
            builder = builder.separator();
            continue;
        }

        let label = entry.label.as_deref().unwrap_or_default();
        if !entry.sub.is_empty() {
            let submenu = build_submenu(app, label, &entry.sub)?;
            builder = builder.item(&submenu);
            continue;
        }

        if entry.checkbox {
            let mut item = CheckMenuItemBuilder::new(label).checked(false);
            if let Some(id) = &entry.id {
                item = item.id(id);
            }
            if let Some(accelerator) = &entry.accelerator {
                item = item.accelerator(accelerator);
            }
            builder = builder.item(&item.build(app)?);
        } else {
            let mut item = MenuItemBuilder::new(label);
            if let Some(id) = &entry.id {
                item = item.id(id);
            }
            if let Some(accelerator) = &entry.accelerator {
                item = item.accelerator(accelerator);
            }
            builder = builder.item(&item.build(app)?);
        }
    }

    builder.build()
}

#[derive(serde::Deserialize)]
pub struct PanelMenuEntry {
    pub id: String,
    pub label: String,
    pub checked: bool,
}

fn find_window_submenu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Submenu<R>, String> {
    let menu = app.menu().ok_or_else(|| "application menu is not installed".to_string())?;
    menu.items().map_err(|error| error.to_string())?
        .into_iter()
        .filter_map(|item| item.as_submenu().cloned())
        .find(|submenu| submenu.items().map(|items| items.iter().any(|item| item.id().0 == "window-panel-pages")).unwrap_or(false))
        .ok_or_else(|| "Window submenu is not installed".to_string())
}

#[tauri::command]
pub fn sync_panel_menu(
    app: tauri::AppHandle,
    window_label: String,
    reset_label: String,
    panels: Vec<PanelMenuEntry>,
) -> Result<(), String> {
    let submenu = find_window_submenu(&app)?;
    submenu.set_text(window_label).map_err(|error| error.to_string())?;

    for panel in panels {
        let item = submenu
            .items().map_err(|error| error.to_string())?
            .into_iter()
            .find(|item| item.id().0 == format!("window-panel-{}", panel.id))
            .ok_or_else(|| format!("unknown panel ID: {}", panel.id))?;
        let checkbox = item
            .as_check_menuitem()
            .ok_or_else(|| format!("panel item has wrong type: {}", panel.id))?;
        checkbox.set_text(panel.label).map_err(|error| error.to_string())?;
        checkbox.set_checked(panel.checked).map_err(|error| error.to_string())?;
    }

    let reset = submenu
        .items().map_err(|error| error.to_string())?
        .into_iter()
        .find(|item| item.id().0 == "reset-panel-layout")
        .ok_or_else(|| "unknown reset panel item".to_string())?;
    let reset_item = reset
        .as_menuitem()
        .ok_or_else(|| "reset panel item has wrong type".to_string())?;
    reset_item.set_text(reset_label).map_err(|error| error.to_string())?;
    Ok(())
}

fn build_schema_menus<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<Vec<Submenu<R>>> {
    let groups: Vec<MenuGroup> = serde_json::from_str(include_str!("../generated/menu.json"))?;
    groups
        .iter()
        .map(|group| build_submenu(app, &group.label, &group.items))
        .collect()
}

pub fn install_app_menu<R: tauri::Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    let app_menu = SubmenuBuilder::new(app, "Silverpoint")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About Silverpoint"),
            None,
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let handle = app.handle().clone();
    let schema_menus = build_schema_menus(&handle)?;
    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        builder = builder.item(&app_menu);
    }

    for menu in &schema_menus {
        builder = builder.item(menu);
    }

    app.set_menu(builder.build()?)?;

    // Windows and Linux draw the menu as a row inside the window frame. That row
    // moved into the app-icon dropdown in the tab strip (src/components/Shell/AppMenu.vue),
    // so hide it here. The menu stays installed on purpose: hiding is SetMenu(hwnd, NULL)
    // in muda, which leaves the accelerator table and the on_menu_event route intact, and
    // keeps sync_panel_menu's app.menu() lookup working. macOS is untouched because its
    // menu lives in the system menu bar, not in the window.
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = app.get_webview_window("main") {
        window.hide_menu()?;
    }

    Ok(())
}
