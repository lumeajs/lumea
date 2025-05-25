use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy, EventLoopWindowTarget},
    window::{Window, WindowBuilder, WindowId},
};

use wry::{WebView, WebViewBuilder};

use deno_core::error::{JsError, JsStackFrame};
use rustyscript::deno_core::{extension, op2};
use rustyscript::{Module, Runtime, RuntimeOptions};

use std::{collections::HashMap, time::SystemTime};
use std::{fs::File, sync::OnceLock};
use std::{
    io::{Read, Seek, SeekFrom, Write},
    sync::mpsc,
};

use colored::*;

use env_logger;
use log::{debug, error, info, warn};

use sourcemap::SourceMap;

static PROXY: OnceLock<EventLoopProxy<AppEvent>> = OnceLock::new();

#[derive(Debug)]
enum AppEvent {
    Add(i32, i32, mpsc::Sender<i32>),
    NewWindow,
}

fn remap_stack_frame(
    frame: &JsStackFrame,
    smap: &SourceMap,
) -> Option<(String, u32, u32, String, String)> {
    let line = frame.line_number? as u32;
    let col = frame.column_number? as u32;

    if let Some(token) = smap.lookup_token(line - 1, col - 1) {
        let file = token.get_source().unwrap_or("unknown").to_string();
        let orig_line = token.get_src_line() + 1;
        let orig_col = token.get_src_col() + 1;
        let function_name = token.get_name().unwrap_or("<anonymous>").to_string();

        // Read the line that contains the token
        let line_contents = token
            .get_source_view()
            .unwrap()
            .lines()
            .nth(orig_line as usize - 1)
            .unwrap_or("<invalid line number>");

        Some((
            file,
            orig_line as u32,
            orig_col as u32,
            function_name,
            line_contents.to_string(),
        ))
    } else {
        None
    }
}

fn format_js_error_as_node(error: &JsError, smap: &SourceMap) -> String {
    let name = error.name.as_deref().unwrap_or("Error");
    let message = error.message.as_deref().unwrap_or("Unknown error");

    // Top-level error message
    let mut out = format!("{}: {}", name.red().bold(), message.red().bold());

    // Full stack trace
    for frame in &error.frames {
        if let Some((file, line, col, function, _)) = remap_stack_frame(frame, &smap) {
            // Stack line in V8 format
            let location = format!("{}:{}:{}", file, line, col);

            let stack_line = format!("    at {} ({})", function, location);
            out.push('\n');
            out.push_str(&stack_line.bright_black());
        }
    }

    // Source + caret underline (only for top frame)
    if let Some(frame) = error.frames.first() {
        if let Some((_, _, col, _, source)) = remap_stack_frame(frame, &smap) {
            out.push_str(&format!("\n\n{}\n", source));

            let caret_pos = col.saturating_sub(1).min(source.len() as u32) as usize;
            let mut caret_line = String::new();
            for (i, c) in source.chars().enumerate() {
                if i == caret_pos {
                    caret_line.push_str(&"^".blue().underline().to_string());
                    break;
                }
                caret_line.push(if c == '\t' { '\t' } else { ' ' });
            }
            out.push_str(&caret_line);
        }
    }

    out
}

fn load_embedded_assets() -> Vec<u8> {
    // 1) open our own executable
    let mut exe = File::open(std::env::current_exe().unwrap()).unwrap();

    // 2) read footer (magic + size) from EOF
    exe.seek(SeekFrom::End(-(4 + 8) as i64)).unwrap();
    let mut magic = [0u8; 4];
    exe.read_exact(&mut magic).unwrap();

    if &magic != b"ASST" {
        debug!("Magic number isn't correct. Magic number: {:?}", magic);
        panic!("Can't find embedded assets, make sure you use the build script.");
    }

    let mut size_bytes = [0u8; 8];
    exe.read_exact(&mut size_bytes).unwrap();
    let zip_size = u64::from_le_bytes(size_bytes);

    debug!("Zip size: {}", zip_size);

    // 3) seek to start of ZIP
    exe.seek(SeekFrom::End(-((4 + 8) as i64 + zip_size as i64)))
        .unwrap();

    // 4) read the ZIP archive into memory
    let mut buf = Vec::with_capacity(zip_size as usize);
    exe.take(zip_size).read_to_end(&mut buf).unwrap();
    buf
}

fn main() {
    let start = SystemTime::now();
    println!("Startup at {}", start.elapsed().unwrap().as_millis());

    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format(|buf, record| writeln!(buf, "{}", record.args().to_string()))
        .init();

    info!("Logger set up at {}", start.elapsed().unwrap().as_millis());
    debug!("Application starting...");

    // Replace panic hook to log errors with context
    std::panic::set_hook(Box::new(|panic_info| {
        if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            error!("{} ({}:{})", s, file!(), line!());
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            error!("{} ({}:{})", s, file!(), line!());
        } else {
            error!("{:?} ({}:{})", panic_info, file!(), line!());
        }
    }));

    info!(
        "Panic hook set up at {}",
        start.elapsed().unwrap().as_millis()
    );

    let assets_zip = load_embedded_assets();

    info!("Assets loaded at {}", start.elapsed().unwrap().as_millis());

    let reader = std::io::Cursor::new(assets_zip);
    let mut zip = zip::ZipArchive::new(reader).unwrap_or_else(|e| {
        panic!("Failed to open ZIP archive: {}", e);
    });

    info!(
        "ZIP archive opened at {}",
        start.elapsed().unwrap().as_millis()
    );

    let mut js = String::new();
    let mut smap_data = String::new();
    for i in 0..zip.len() {
        let mut file = zip.by_index(i).unwrap();
        debug!(
            "Processing file '{}' with {} bytes",
            file.name(),
            file.size()
        );

        if file.name() == "bundle.js" {
            debug!("Found bundle.js");

            file.read_to_string(&mut js).unwrap_or_else(|e| {
                panic!("Failed to read bundle.js: {}", e);
            });

            info!(
                "JavaScript loaded at {}",
                start.elapsed().unwrap().as_millis()
            );
        }

        if file.name() == "bundle.js.map" {
            debug!("Found bundle.js.map");

            file.read_to_string(&mut smap_data).unwrap_or_else(|e| {
                panic!("Failed to read bundle.js.map: {}", e);
            });

            info!(
                "Source map loaded at {}",
                start.elapsed().unwrap().as_millis()
            );
        }
    }

    info!(
        "All assets loaded at {}",
        start.elapsed().unwrap().as_millis()
    );

    if js.trim().is_empty() || smap_data.trim().is_empty() {
        warn!("One or more critical assets are empty",);
    }

    let smap = SourceMap::from_slice(smap_data.as_bytes()).unwrap_or_else(|e| {
        panic!("Failed to parse source map: {}", e);
    });

    info!(
        "Source map parsed at {}",
        start.elapsed().unwrap().as_millis()
    );

    let event_loop = EventLoopBuilder::with_user_event().build();
    let proxy = event_loop.create_proxy();

    PROXY.set(proxy).unwrap();

    std::thread::spawn(move || {
        #[op2(fast)]
        fn op_add_example(a: i32, b: i32) -> i32 {
            if let Some(proxy) = PROXY.get() {
                let (tx, rx) = mpsc::channel();
                proxy.send_event(AppEvent::Add(a, b, tx)).unwrap();
                rx.recv().unwrap_or(0)
            } else {
                0
            }
        }

        #[op2(fast)]
        fn new_window() {
            if let Some(proxy) = PROXY.get() {
                proxy.send_event(AppEvent::NewWindow).unwrap();
            }
        }

        extension!(example_extension, ops = [op_add_example, new_window]);

        info!(
            "Extension loaded at {}",
            start.elapsed().unwrap().as_millis()
        );

        let module = Module::new("index.js", js);

        info!("Module created at {}", start.elapsed().unwrap().as_millis());

        let mut runtime = Runtime::new(RuntimeOptions {
            extensions: vec![example_extension::init_ops_and_esm()],
            ..Default::default()
        })
        .unwrap_or_else(|e| {
            panic!("Failed to JavaScript create runtime: {}", e);
        });

        info!(
            "Runtime created at {}",
            start.elapsed().unwrap().as_millis()
        );

        debug!("Loading module...");
        runtime
            .load_module(&module)
            .unwrap_or_else(|err| match &err {
                rustyscript::Error::JsError(js_err) => {
                    eprintln!("{}", format_js_error_as_node(js_err, &smap));
                    std::process::exit(1);
                }
                _ => {
                    panic!("Non-JS error: {} ({}:{})", err, file!(), line!());
                }
            });

        info!("Module loaded at {}", start.elapsed().unwrap().as_millis());

        debug!("Module loaded successfully.");
    });

    info!(
        "Application started at {}",
        start.elapsed().unwrap().as_millis()
    );

    let mut windows: HashMap<WindowId, Window> = HashMap::new();
    let mut webviews: HashMap<WindowId, WebView> = HashMap::new();

    // Winit Event Loop
    event_loop.run(move |event, event_loop, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::UserEvent(AppEvent::Add(a, b, tx)) => {
                let _ = tx.send(a + b);
            }
            Event::UserEvent(AppEvent::NewWindow) => {
                let window = create_new_window(event_loop);
                let webview = create_new_webview(&window);

                // TODO: We really shouldn't be using the windowId for the webview
                // But I have no idea how to create random numbers in rust
                let id = window.id();

                windows.insert(id, window);
                webviews.insert(id, webview);
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
            }

            _ => (),
        }
    });
}

fn create_new_window(event_loop: &EventLoopWindowTarget<AppEvent>) -> Window {
    let window = WindowBuilder::new().build(event_loop).unwrap();
    window
}

fn create_new_webview(window: &Window) -> WebView {
    let builder = WebViewBuilder::new()
        .with_devtools(true) // TODO: Make this configurable
        .with_on_page_load_handler(move |event, _url| match event {
            wry::PageLoadEvent::Started => {}  // TODO,
            wry::PageLoadEvent::Finished => {} // TODO
        });
    #[cfg(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    ))]
    let webview = builder.build(&window).unwrap();
    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    let webview = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        let vbox = window.default_vbox().unwrap();
        builder.build_gtk(vbox)?
    };

    webview
}
