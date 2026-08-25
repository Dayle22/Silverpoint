use font_kit::source::SystemSource;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct FontFamily {
    family: String,
    styles: Vec<String>,
}

static FONT_CACHE: OnceLock<Vec<FontFamily>> = OnceLock::new();

fn enumerate_system_fonts() -> Vec<FontFamily> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let source = SystemSource::new();
        let mut families: Vec<FontFamily> = Vec::new();

        if let Ok(family_names) = source.all_families() {
            for name in family_names {
                if name.trim().is_empty() {
                    continue;
                }
                families.push(FontFamily {
                    family: name,
                    styles: vec![
                        "Regular".into(),
                        "Bold".into(),
                        "Italic".into(),
                        "Bold Italic".into(),
                    ],
                });
            }
        }

        families.sort_by(|a, b| a.family.cmp(&b.family));
        families.dedup_by(|a, b| a.family == b.family);
        families
    }));

    result.unwrap_or_default()
}

#[tauri::command]
pub async fn list_system_fonts() -> Vec<FontFamily> {
    if let Some(cached) = FONT_CACHE.get() {
        return cached.clone();
    }

    let families = tauri::async_runtime::spawn_blocking(enumerate_system_fonts)
        .await
        .unwrap_or_default();
    let _ = FONT_CACHE.set(families.clone());
    families
}

fn load_system_font_blocking(family: String, style: String) -> Result<Vec<u8>, String> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let source = SystemSource::new();
        let family_handle = source
            .select_family_by_name(&family)
            .map_err(|e| format!("Font family not found: {e}"))?;

        let is_italic = style.contains("Italic");
        let weight_str = style.replace(" Italic", "");
        let weight = match weight_str.as_str() {
            "Thin" => font_kit::properties::Weight::THIN,
            "ExtraLight" => font_kit::properties::Weight::EXTRA_LIGHT,
            "Light" => font_kit::properties::Weight::LIGHT,
            "Regular" | "" => font_kit::properties::Weight::NORMAL,
            "Medium" => font_kit::properties::Weight::MEDIUM,
            "SemiBold" => font_kit::properties::Weight::SEMIBOLD,
            "Bold" => font_kit::properties::Weight::BOLD,
            "ExtraBold" => font_kit::properties::Weight::EXTRA_BOLD,
            "Black" => font_kit::properties::Weight::BLACK,
            _ => font_kit::properties::Weight::NORMAL,
        };
        let style_prop = if is_italic {
            font_kit::properties::Style::Italic
        } else {
            font_kit::properties::Style::Normal
        };

        for handle in family_handle.fonts() {
            if let Ok(font) = handle.load() {
                let props = font.properties();
                let w_diff = (props.weight.0 - weight.0).abs();
                if w_diff < 50.0 && props.style == style_prop {
                    if let Some(data) = font.copy_font_data() {
                        return Ok((*data).clone());
                    }
                }
            }
        }

        // Fallback: try first readable font in the family
        for handle in family_handle.fonts() {
            if let Ok(font) = handle.load() {
                if let Some(data) = font.copy_font_data() {
                    return Ok((*data).clone());
                }
            }
        }

        Err(format!("Font face not found: {family} {style}"))
    }));

    match result {
        Ok(res) => res,
        Err(_) => Err(format!("Panic occurred while loading font: {family} {style}")),
    }
}

#[tauri::command]
pub async fn load_system_font(family: String, style: String) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || load_system_font_blocking(family, style))
        .await
        .map_err(|e| format!("Font load task failed: {e}"))?
}
