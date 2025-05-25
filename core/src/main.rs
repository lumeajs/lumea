use deno_core::error::{JsError, JsStackFrame};
use rustyscript::deno_core::{extension, op2};
use rustyscript::{Module, Runtime, RuntimeOptions};

use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::time::SystemTime;

use colored::*;

use env_logger;
use log::{debug, error, info, warn};

use sourcemap::SourceMap;

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
        let function_name = frame
            .function_name
            .as_ref()
            .or_else(|| frame.method_name.as_ref())
            .map_or("<anonymous>".to_string(), |name| name.clone());

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

    #[op2(fast)]
    fn op_add_example(a: i32, b: i32) -> i32 {
        a + b
    }

    extension!(example_extension, ops = [op_add_example]);

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
                panic!("{}", format_js_error_as_node(js_err, &smap));
            }
            _ => {
                panic!("Non-JS error: {} ({}:{})", err, file!(), line!());
            }
        });

    info!("Module loaded at {}", start.elapsed().unwrap().as_millis());

    debug!("Module loaded successfully.");
}
