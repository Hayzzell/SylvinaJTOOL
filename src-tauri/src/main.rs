#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use rfd::FileDialog;
use serde::{Deserialize, Serialize};

type CommandResult<T> = Result<T, String>;

const DEFAULT_NUI_FILTER_NAME: &str = "NUI Files";
const DEFAULT_NUI_FILTER_EXTENSIONS: &[&str] = &["nui"];
const MISSING_SAVE_PATH_ERROR: &str = "Missing save-file payload path.";
const MISSING_SAVE_BYTES_ERROR: &str = "Missing save-file payload bytes.";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DialogFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavePayload {
    path: Option<String>,
    bytes_base64: Option<String>,
    suggested_name: Option<String>,
    filters: Option<Vec<DialogFilter>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenFileResult {
    name: String,
    path: String,
    bytes_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveFileResult {
    canceled: bool,
    name: Option<String>,
    path: Option<String>,
}

impl SaveFileResult {
    fn canceled() -> Self {
        Self {
            canceled: true,
            name: None,
            path: None,
        }
    }

    fn saved(path: &Path) -> CommandResult<Self> {
        Ok(Self {
            canceled: false,
            name: file_name(path),
            path: Some(path_to_string(path)?),
        })
    }
}

fn to_string_error(error: impl ToString) -> String {
    error.to_string()
}

fn required_field<T>(value: Option<T>, message: &str) -> CommandResult<T> {
    value.ok_or_else(|| message.to_string())
}

fn file_name(path: &Path) -> Option<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(str::to_owned)
}

fn required_file_name(path: &Path) -> CommandResult<String> {
    file_name(path).ok_or_else(|| "Failed to resolve file name.".to_string())
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn executable_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn resolve_static_assets_dir() -> CommandResult<PathBuf> {
    let project_assets_dir = project_root().join("static-assets");
    let candidates = [
        executable_dir().map(|dir| dir.join("static-assets")),
        Some(project_assets_dir.clone()),
    ];

    let assets_dir = candidates
        .into_iter()
        .flatten()
        .find(|candidate| candidate.exists())
        .unwrap_or(project_assets_dir);

    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(to_string_error)?;
    }

    Ok(assets_dir)
}

fn safe_join(base_dir: &Path, relative_path: &str) -> CommandResult<PathBuf> {
    let mut resolved_path = PathBuf::from(base_dir);

    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => resolved_path.push(part),
            Component::CurDir => {}
            _ => return Err("Invalid asset path.".into()),
        }
    }

    Ok(resolved_path)
}

fn read_file_bytes(path: &Path) -> CommandResult<Vec<u8>> {
    fs::read(path).map_err(to_string_error)
}

fn read_optional_file_bytes(path: &Path) -> CommandResult<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(to_string_error(error)),
    }
}

fn write_file_bytes(path: &Path, bytes: &[u8]) -> CommandResult<()> {
    if let Some(parent_dir) = path.parent() {
        fs::create_dir_all(parent_dir).map_err(to_string_error)?;
    }

    fs::write(path, bytes).map_err(to_string_error)
}

fn decode_base64(value: &str) -> CommandResult<Vec<u8>> {
    STANDARD.decode(value).map_err(to_string_error)
}

fn encode_base64(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}

fn decode_payload_bytes(payload: &SavePayload) -> CommandResult<Vec<u8>> {
    let bytes_base64 = required_field(payload.bytes_base64.as_deref(), MISSING_SAVE_BYTES_ERROR)?;
    decode_base64(bytes_base64)
}

fn apply_filters(mut dialog: FileDialog, filters: Option<&[DialogFilter]>) -> FileDialog {
    let filters = filters.unwrap_or(&[]);

    if filters.is_empty() {
        return dialog.add_filter(DEFAULT_NUI_FILTER_NAME, DEFAULT_NUI_FILTER_EXTENSIONS);
    }

    for filter in filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        dialog = dialog.add_filter(filter.name.as_str(), &extensions);
    }

    dialog
}

fn save_dialog(payload: &SavePayload) -> FileDialog {
    let dialog = match payload.suggested_name.as_deref() {
        Some(suggested_name) => FileDialog::new().set_file_name(suggested_name),
        None => FileDialog::new(),
    };

    apply_filters(dialog, payload.filters.as_deref())
}

fn path_to_string(path: &Path) -> CommandResult<String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "Path contains invalid Unicode.".into())
}

fn resolve_asset_path(relative_path: &str) -> CommandResult<PathBuf> {
    safe_join(&resolve_static_assets_dir()?, relative_path)
}

fn read_optional_asset_bytes(relative_path: &str) -> CommandResult<Option<Vec<u8>>> {
    read_optional_file_bytes(&resolve_asset_path(relative_path)?)
}

fn save_bytes_to_path(path: &Path, bytes: &[u8]) -> CommandResult<SaveFileResult> {
    write_file_bytes(path, bytes)?;
    SaveFileResult::saved(path)
}

#[tauri::command]
fn open_nui_file() -> CommandResult<Option<OpenFileResult>> {
    let Some(path) = apply_filters(FileDialog::new(), None).pick_file() else {
        return Ok(None);
    };

    let bytes = read_file_bytes(&path)?;

    Ok(Some(OpenFileResult {
        name: required_file_name(&path)?,
        path: path_to_string(&path)?,
        bytes_base64: encode_base64(&bytes),
    }))
}

#[tauri::command]
fn save_file(payload: SavePayload) -> CommandResult<SaveFileResult> {
    let target_path = PathBuf::from(required_field(
        payload.path.as_deref(),
        MISSING_SAVE_PATH_ERROR,
    )?);
    let bytes = decode_payload_bytes(&payload)?;
    save_bytes_to_path(&target_path, &bytes)
}

#[tauri::command]
fn save_file_as(payload: SavePayload) -> CommandResult<SaveFileResult> {
    let Some(path) = save_dialog(&payload).save_file() else {
        return Ok(SaveFileResult::canceled());
    };

    let bytes = decode_payload_bytes(&payload)?;
    save_bytes_to_path(&path, &bytes)
}

#[tauri::command]
fn read_asset_text(relative_path: String) -> CommandResult<Option<String>> {
    match read_optional_asset_bytes(&relative_path)? {
        Some(bytes) => Ok(Some(String::from_utf8_lossy(&bytes).into_owned())),
        None => Ok(None),
    }
}

#[tauri::command]
fn read_asset_bytes(relative_path: String) -> CommandResult<Option<String>> {
    Ok(read_optional_asset_bytes(&relative_path)?.map(|bytes| encode_base64(&bytes)))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_nui_file,
            save_file,
            save_file_as,
            read_asset_text,
            read_asset_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
