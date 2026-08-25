use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

const MAX_PROMPT_BYTES: usize = 512 * 1024;
type OwnedChild = Arc<Mutex<Child>>;

#[derive(Default)]
pub struct CodexProcesses {
    children: Arc<Mutex<HashMap<u32, OwnedChild>>>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "payload", rename_all = "camelCase")]
pub enum CodexProcessEvent {
    Stdout(Vec<u8>),
    Stderr(String),
    Terminated { code: Option<i32> },
}

fn native_codex_path(home: PathBuf) -> PathBuf {
    home.join("AppData")
        .join("Roaming")
        .join("npm")
        .join("node_modules")
        .join("@openai")
        .join("codex")
        .join("node_modules")
        .join("@openai")
        .join("codex-win32-x64")
        .join("vendor")
        .join("x86_64-pc-windows-msvc")
        .join("bin")
        .join("codex.exe")
}

fn codex_args(workspace: &std::path::Path) -> Vec<String> {
    vec![
        "--ask-for-approval".into(),
        "never".into(),
        "exec".into(),
        "--json".into(),
        "--color".into(),
        "never".into(),
        "--skip-git-repo-check".into(),
        "--sandbox".into(),
        "workspace-write".into(),
        "--ephemeral".into(),
        "--ignore-user-config".into(),
        "--ignore-rules".into(),
        "--strict-config".into(),
        "-C".into(),
        workspace.to_string_lossy().into_owned(),
        "-c".into(),
        "sandbox_workspace_write.network_access=true".into(),
        "-c".into(),
        "mcp_servers.silverpoint.url=\"http://127.0.0.1:7600/mcp\"".into(),
        "-c".into(),
        "mcp_servers.silverpoint.bearer_token_env_var=\"SILVERPOINT_MCP_AUTH_TOKEN\"".into(),
    ]
}

fn stream_reader<R, F>(mut reader: R, mut send: F) -> thread::JoinHandle<()>
where
    R: Read + Send + 'static,
    F: FnMut(Vec<u8>) + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(length) => send(buffer[..length].to_vec()),
            }
        }
    })
}

#[tauri::command]
pub fn spawn_codex_chat(
    app: AppHandle,
    state: State<'_, CodexProcesses>,
    prompt: String,
    auth_token: String,
    on_event: Channel<CodexProcessEvent>,
) -> Result<u32, String> {
    if prompt.trim().is_empty() || prompt.len() > MAX_PROMPT_BYTES {
        return Err("Codex prompt is empty or exceeds the bounded size.".into());
    }
    if auth_token.len() != 64 || !auth_token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Bundled MCP authentication is invalid.".into());
    }

    let executable = native_codex_path(app.path().home_dir().map_err(|error| error.to_string())?);
    if !executable.is_file() {
        return Err("Codex CLI was not found in the supported global npm installation.".into());
    }

    let workspace = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("ai-workspace");
    std::fs::create_dir_all(&workspace).map_err(|error| error.to_string())?;

    let mut command = Command::new(executable);
    command
        .args(codex_args(&workspace))
        .current_dir(&workspace)
        .env("SILVERPOINT_MCP_AUTH_TOKEN", auth_token)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let pid = child.id();
    let stdout = child
        .stdout
        .take()
        .ok_or("Codex stdout pipe is unavailable.")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Codex stderr pipe is unavailable.")?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or("Codex stdin pipe is unavailable.")?;

    if let Err(error) = stdin
        .write_all(prompt.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
    {
        let _ = child.kill();
        return Err(error.to_string());
    }
    drop(stdin);

    let child = Arc::new(Mutex::new(child));
    state
        .children
        .lock()
        .map_err(|_| "Codex process registry is unavailable.")?
        .insert(pid, child.clone());

    let stdout_channel = on_event.clone();
    let stdout_thread = stream_reader(stdout, move |bytes| {
        let _ = stdout_channel.send(CodexProcessEvent::Stdout(bytes));
    });
    let stderr_channel = on_event.clone();
    let stderr_thread = stream_reader(stderr, move |bytes| {
        let _ = stderr_channel.send(CodexProcessEvent::Stderr(
            String::from_utf8_lossy(&bytes).into_owned(),
        ));
    });
    let children = state.children.clone();
    thread::spawn(move || {
        let code = loop {
            let status = child
                .lock()
                .ok()
                .and_then(|mut process| process.try_wait().ok())
                .flatten();
            if let Some(status) = status {
                break status.code();
            }
            thread::sleep(Duration::from_millis(25));
        };
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();
        if let Ok(mut owned) = children.lock() {
            owned.remove(&pid);
        }
        let _ = on_event.send(CodexProcessEvent::Terminated { code });
    });

    Ok(pid)
}

#[tauri::command]
pub fn cancel_codex_chat(state: State<'_, CodexProcesses>, job_id: u32) -> Result<(), String> {
    let child = state
        .children
        .lock()
        .map_err(|_| "Codex process registry is unavailable.")?
        .get(&job_id)
        .cloned();
    if let Some(child) = child {
        child
            .lock()
            .map_err(|_| "Codex process is unavailable.")?
            .kill()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

impl CodexProcesses {
    pub fn kill_all(&self) {
        if let Ok(children) = self.children.lock() {
            for child in children.values() {
                if let Ok(mut process) = child.lock() {
                    let _ = process.kill();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{codex_args, native_codex_path};
    use std::path::PathBuf;

    #[test]
    fn fixes_the_global_native_executable_and_stdin_invocation() {
        let executable = native_codex_path(PathBuf::from(r"C:\Users\tester"));
        assert!(executable.ends_with(
            r"AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe"
        ));

        let args = codex_args(std::path::Path::new(r"C:\Silverpoint\ai-workspace"));
        assert!(args.windows(2).any(|pair| pair == ["exec", "--json"]));
        assert!(!args.iter().any(|arg| arg == "-"));
    }
}
