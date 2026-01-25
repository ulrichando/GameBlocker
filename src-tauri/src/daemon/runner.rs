//! Daemon runner - main loop and client connection handling.

use crate::blocking::{self, process};
use crate::config::ConfigManager;
use crate::daemon::ipc::{
    read_message, write_message, BlockedProcessInfo, DaemonRequest, DaemonResponse,
};
use std::collections::HashSet;
use std::io::{BufReader, BufWriter};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

#[cfg(unix)]
use crate::daemon::ipc::SOCKET_PATH;
#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};
#[cfg(unix)]
use std::path::Path;

#[cfg(windows)]
use crate::daemon::ipc::PIPE_NAME;

/// Daemon state shared across threads
pub struct DaemonState {
    pub running: AtomicBool,
    pub blocked_count: AtomicU32,
    pub start_time: Instant,
}

impl DaemonState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(true),
            blocked_count: AtomicU32::new(0),
            start_time: Instant::now(),
        }
    }
}

/// Run the daemon main loop (Unix version)
#[cfg(unix)]
pub fn run_daemon() -> std::io::Result<()> {
    info!("Starting ParentShield daemon...");

    let state = Arc::new(DaemonState::new());

    // Create socket directory
    let socket_dir = Path::new(SOCKET_PATH).parent().unwrap();
    fs::create_dir_all(socket_dir)?;

    // Remove stale socket file
    if Path::new(SOCKET_PATH).exists() {
        fs::remove_file(SOCKET_PATH)?;
    }

    // Create Unix socket listener
    let listener = UnixListener::bind(SOCKET_PATH)?;

    // Set socket permissions (world readable/writable so GUI can connect)
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(SOCKET_PATH, fs::Permissions::from_mode(0o666))?;
    }

    info!("Daemon listening on {}", SOCKET_PATH);

    // Spawn blocking check thread
    let state_clone = Arc::clone(&state);
    let blocking_thread = std::thread::spawn(move || {
        run_blocking_loop(state_clone);
    });

    // Set non-blocking mode for accept with timeout
    listener.set_nonblocking(true)?;

    // Main accept loop
    while state.running.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((stream, _)) => {
                let state_clone = Arc::clone(&state);
                std::thread::spawn(move || {
                    if let Err(e) = handle_client_unix(stream, state_clone) {
                        warn!("Client handler error: {}", e);
                    }
                });
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No connection pending, sleep briefly
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                error!("Accept error: {}", e);
            }
        }
    }

    info!("Daemon shutting down...");

    // Clean up socket
    let _ = fs::remove_file(SOCKET_PATH);

    // Wait for blocking thread
    let _ = blocking_thread.join();

    Ok(())
}

/// Run the daemon main loop (Windows version using named pipes)
#[cfg(windows)]
pub fn run_daemon() -> std::io::Result<()> {
    use windows::Win32::Storage::FileSystem::PIPE_ACCESS_DUPLEX;
    use windows::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW,
        PIPE_READMODE_MESSAGE, PIPE_TYPE_MESSAGE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
    };
    use windows::core::PCWSTR;

    info!("Starting ParentShield daemon...");

    let state = Arc::new(DaemonState::new());

    // Spawn blocking check thread
    let state_clone = Arc::clone(&state);
    let blocking_thread = std::thread::spawn(move || {
        run_blocking_loop(state_clone);
    });

    info!("Daemon listening on {}", PIPE_NAME);

    // Main loop - create named pipe instances and wait for clients
    while state.running.load(Ordering::Relaxed) {
        // Create a named pipe instance
        let pipe_name: Vec<u16> = PIPE_NAME.encode_utf16().chain(std::iter::once(0)).collect();

        let pipe = unsafe {
            CreateNamedPipeW(
                PCWSTR(pipe_name.as_ptr()),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
                PIPE_UNLIMITED_INSTANCES,
                4096,
                4096,
                0,
                None,
            )
        };

        // Check if pipe creation failed (returns INVALID_HANDLE_VALUE on error)
        if pipe.is_invalid() {
            let err = unsafe { windows::Win32::Foundation::GetLastError() };
            error!("Failed to create named pipe: {:?}", err);
            std::thread::sleep(Duration::from_secs(1));
            continue;
        }

        // Wait for a client to connect (with timeout via polling)
        let connected = unsafe { ConnectNamedPipe(pipe, None) };

        if connected.is_ok() || unsafe { windows::Win32::Foundation::GetLastError() } == windows::Win32::Foundation::ERROR_PIPE_CONNECTED {
            let state_clone = Arc::clone(&state);
            // Extract raw handle value before moving into thread (raw pointer is not Send)
            let raw_handle = pipe.0 as usize;
            std::thread::spawn(move || {
                // Convert raw handle back to a file for reading/writing
                use std::os::windows::io::FromRawHandle;
                let file = unsafe { std::fs::File::from_raw_handle(raw_handle as *mut std::ffi::c_void) };

                if let Err(e) = handle_client_windows(file, state_clone) {
                    warn!("Client handler error: {}", e);
                }
            });
        } else {
            error!("Failed to connect named pipe");
            std::thread::sleep(Duration::from_millis(100));
        }
    }

    info!("Daemon shutting down...");

    // Wait for blocking thread
    let _ = blocking_thread.join();

    Ok(())
}

/// Handle a client connection (Unix version)
#[cfg(unix)]
fn handle_client_unix(stream: UnixStream, state: Arc<DaemonState>) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;

    let mut reader = BufReader::new(stream.try_clone()?);
    let mut writer = BufWriter::new(stream);

    loop {
        // Read request
        let request: DaemonRequest = match read_message(&mut reader) {
            Ok(req) => req,
            Err(ref e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                // Client disconnected
                break;
            }
            Err(e) => {
                error!("Failed to read request: {}", e);
                break;
            }
        };

        // Process request
        let response = process_request(request, &state);

        // Send response
        if let Err(e) = write_message(&mut writer, &response) {
            error!("Failed to send response: {}", e);
            break;
        }

        // Check if we should stop accepting requests on this connection
        if let DaemonResponse::Ok = response {
            // Continue processing
        }
    }

    Ok(())
}

/// Handle a client connection (Windows version)
#[cfg(windows)]
fn handle_client_windows(pipe: std::fs::File, state: Arc<DaemonState>) -> std::io::Result<()> {
    let mut reader = BufReader::new(pipe.try_clone()?);
    let mut writer = BufWriter::new(pipe);

    loop {
        // Read request
        let request: DaemonRequest = match read_message(&mut reader) {
            Ok(req) => req,
            Err(ref e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                // Client disconnected
                break;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::BrokenPipe => {
                // Client disconnected
                break;
            }
            Err(e) => {
                error!("Failed to read request: {}", e);
                break;
            }
        };

        // Process request
        let response = process_request(request, &state);

        // Send response
        if let Err(e) = write_message(&mut writer, &response) {
            error!("Failed to send response: {}", e);
            break;
        }

        // Check if we should stop accepting requests on this connection
        if let DaemonResponse::Ok = response {
            // Continue processing
        }
    }

    Ok(())
}

/// Process a daemon request and return a response
fn process_request(request: DaemonRequest, state: &Arc<DaemonState>) -> DaemonResponse {
    match request {
        DaemonRequest::Ping => DaemonResponse::Pong,

        DaemonRequest::GetStatus => {
            match get_daemon_status(state) {
                Ok(status) => status,
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::UpdateConfig {
            game_blocking,
            ai_blocking,
            dns_blocking,
            browser_blocking,
        } => {
            match update_config(game_blocking, ai_blocking, dns_blocking, browser_blocking) {
                Ok(_) => DaemonResponse::Ok,
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::RunBlockingCheck => {
            match run_blocking_check_now(state) {
                Ok(processes) => DaemonResponse::BlockedProcesses { processes },
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::ApplyBlocking => {
            match apply_blocking_now() {
                Ok(_) => DaemonResponse::Ok,
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::EnableFirewall => {
            match enable_firewall_blocking() {
                Ok(_) => DaemonResponse::Ok,
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::DisableFirewall => {
            match disable_firewall_blocking() {
                Ok(_) => DaemonResponse::Ok,
                Err(e) => DaemonResponse::Error {
                    message: e.to_string(),
                },
            }
        }

        DaemonRequest::Shutdown => {
            info!("Shutdown requested");
            state.running.store(false, Ordering::Relaxed);
            DaemonResponse::Ok
        }
    }
}

/// Get current daemon status
fn get_daemon_status(state: &Arc<DaemonState>) -> Result<DaemonResponse, Box<dyn std::error::Error>> {
    let manager = ConfigManager::new()?;
    let config = manager.load()?;

    let should_block = crate::scheduler::should_block_now(&config.schedules);
    let firewall_active = blocking::is_doh_blocked();

    Ok(DaemonResponse::Status {
        running: true,
        blocking_active: should_block,
        game_blocking: config.game_blocking_enabled,
        ai_blocking: config.ai_blocking_enabled,
        dns_blocking: config.dns_blocking_enabled,
        browser_blocking: config.browser_blocking_enabled,
        firewall_active,
        blocked_count: state.blocked_count.load(Ordering::Relaxed),
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

/// Update configuration
fn update_config(
    game_blocking: Option<bool>,
    ai_blocking: Option<bool>,
    dns_blocking: Option<bool>,
    browser_blocking: Option<bool>,
) -> Result<(), Box<dyn std::error::Error>> {
    let manager = ConfigManager::new()?;
    let mut config = manager.load()?;

    if let Some(v) = game_blocking {
        config.game_blocking_enabled = v;
    }
    if let Some(v) = ai_blocking {
        config.ai_blocking_enabled = v;
    }
    if let Some(v) = dns_blocking {
        config.dns_blocking_enabled = v;
    }
    if let Some(v) = browser_blocking {
        config.browser_blocking_enabled = v;
    }

    manager.save(&config)?;

    // Apply the new blocking settings
    apply_blocking_now()?;

    Ok(())
}

/// Run blocking check immediately
fn run_blocking_check_now(state: &Arc<DaemonState>) -> Result<Vec<BlockedProcessInfo>, Box<dyn std::error::Error>> {
    let manager = ConfigManager::new()?;
    let config = manager.load()?;

    if !crate::scheduler::should_block_now(&config.schedules) {
        return Ok(Vec::new());
    }

    let blocker = process::create_blocker();

    let mut blocked_set = HashSet::new();
    if config.game_blocking_enabled {
        blocked_set.extend(blocking::get_default_gaming_processes());
    }
    if config.ai_blocking_enabled {
        blocked_set.extend(blocking::get_default_ai_processes());
    }
    blocked_set.extend(config.blocked_processes.clone());

    let blocked = blocker.block_processes(&blocked_set, &config.allowed_processes, &config.allowed_domains)?;

    // Update blocked count
    let count = blocked.len() as u32;
    state.blocked_count.fetch_add(count, Ordering::Relaxed);

    Ok(blocked
        .into_iter()
        .map(|p| BlockedProcessInfo {
            pid: p.pid,
            name: p.name,
        })
        .collect())
}

/// Apply current blocking settings (hosts file, firewall)
fn apply_blocking_now() -> Result<(), Box<dyn std::error::Error>> {
    let manager = ConfigManager::new()?;
    let config = manager.load()?;

    info!(
        "Config loaded: game_blocking={}, ai_blocking={}, dns_blocking={}, browser_blocking={}",
        config.game_blocking_enabled,
        config.ai_blocking_enabled,
        config.dns_blocking_enabled,
        config.browser_blocking_enabled
    );

    let should_block = crate::scheduler::should_block_now(&config.schedules);
    info!("Schedule check: should_block={}", should_block);

    // Update hosts file
    if !should_block {
        blocking::unblock_all_domains()?;
    } else {
        let mut domains_to_block: HashSet<String> = HashSet::new();

        if config.ai_blocking_enabled {
            domains_to_block.extend(blocking::get_default_ai_domains());
        }
        if config.game_blocking_enabled {
            domains_to_block.extend(blocking::get_default_gaming_domains());
        }
        if config.dns_blocking_enabled {
            // Custom Websites blocks all domains in the blocklist (defaults + user-added)
            domains_to_block.extend(blocking::get_default_gaming_domains());
            domains_to_block.extend(blocking::get_default_ai_domains());
            domains_to_block.extend(config.blocked_domains.clone());
        }

        // Remove allowed domains (including subdomains)
        let domains_to_remove: Vec<String> = domains_to_block
            .iter()
            .filter(|domain| {
                for allowed in &config.allowed_domains {
                    if *domain == allowed || domain.ends_with(&format!(".{}", allowed)) {
                        return true;
                    }
                }
                false
            })
            .cloned()
            .collect();
        for domain in domains_to_remove {
            domains_to_block.remove(&domain);
        }

        info!("Domains to block: {} total", domains_to_block.len());

        if domains_to_block.is_empty() {
            info!("No domains to block, clearing hosts file");
            blocking::unblock_all_domains()?;
        } else {
            // Use direct write since daemon runs as root
            blocking::block_domains_direct(&domains_to_block)?;
        }
    }

    // Apply firewall blocking if needed (Linux only for now)
    #[cfg(target_os = "linux")]
    {
        let any_blocking = config.game_blocking_enabled || config.ai_blocking_enabled || config.dns_blocking_enabled;
        if should_block && any_blocking {
            // Enable firewall blocking (direct, no pkexec)
            let _ = blocking::apply_network_blocking_direct();
        } else {
            let _ = blocking::remove_network_blocking_direct();
        }
    }

    Ok(())
}

/// Enable firewall blocking (Linux only)
#[cfg(target_os = "linux")]
fn enable_firewall_blocking() -> Result<(), Box<dyn std::error::Error>> {
    blocking::block_doh_providers_direct()?;
    Ok(())
}

/// Enable firewall blocking (no-op on non-Linux)
#[cfg(not(target_os = "linux"))]
fn enable_firewall_blocking() -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

/// Disable firewall blocking (Linux only)
#[cfg(target_os = "linux")]
fn disable_firewall_blocking() -> Result<(), Box<dyn std::error::Error>> {
    blocking::unblock_doh_providers_direct()?;
    Ok(())
}

/// Disable firewall blocking (no-op on non-Linux)
#[cfg(not(target_os = "linux"))]
fn disable_firewall_blocking() -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

/// Background thread that runs blocking checks periodically
fn run_blocking_loop(state: Arc<DaemonState>) {
    info!("Starting blocking check loop...");

    // Apply initial blocking
    if let Err(e) = apply_blocking_now() {
        error!("Failed to apply initial blocking: {}", e);
    }

    let check_interval = Duration::from_secs(5);

    while state.running.load(Ordering::Relaxed) {
        std::thread::sleep(check_interval);

        // Run blocking check
        if let Err(e) = run_blocking_check_now(&state) {
            error!("Blocking check error: {}", e);
        }
    }

    info!("Blocking check loop stopped");
}
