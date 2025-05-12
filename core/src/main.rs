use rustyscript::deno_core::{extension, op2};
use rustyscript::{Error, Module, Runtime, RuntimeOptions};
use std::collections::HashSet;

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};

fn load_embedded_assets() -> Vec<u8> {
    // 1) open our own executable
    let mut exe = File::open(std::env::current_exe().unwrap()).unwrap();

    // 2) read footer (magic + size) from EOF
    exe.seek(SeekFrom::End(-(4 + 8) as i64)).unwrap();
    let mut magic = [0u8; 4];
    exe.read_exact(&mut magic).unwrap();
    assert_eq!(&magic, b"ASST", "no assets found");

    let mut size_bytes = [0u8; 8];
    exe.read_exact(&mut size_bytes).unwrap();
    let zip_size = u64::from_le_bytes(size_bytes);

    println!("Zip size: {}", zip_size);

    // 3) seek to start of ZIP
    exe.seek(SeekFrom::End(-((4 + 8) as i64 + zip_size as i64)))
        .unwrap();

    // 4) read the ZIP archive into memory
    let mut buf = Vec::with_capacity(zip_size as usize);
    exe.take(zip_size).read_to_end(&mut buf).unwrap();
    buf
}

fn main() -> Result<(), Error> {
    let assets_zip = load_embedded_assets();
    let reader = std::io::Cursor::new(assets_zip);
    let mut zip = zip::ZipArchive::new(reader).unwrap();

    let mut js = String::new();
    for i in 0..zip.len() {
        let mut file = zip.by_index(i).unwrap();
        // TODO: remove
        println!("file {} has {} bytes", file.name(), file.size());

        if file.name() == "bundle.js" {
            file.read_to_string(&mut js).unwrap();
        }
    }

    #[op2(fast)]
    fn op_add_example(a: i32, b: i32) -> i32 {
        a + b
    }

    extension!(
        example_extension,
        ops = [op_add_example],
        esm_entry_point = "core:calculator",
        esm = ["core:calculator" = "example_extension.js"],
    );

    let module = Module::new("index.js", js);

    // Whitelist the example: schema for the module
    let mut schema_whlist = HashSet::new();
    schema_whlist.insert("core:".to_string());

    // We provide a function returning the set of extensions to load
    // It needs to be a function, since deno_core does not currently
    // allow clone or copy from extensions
    let mut runtime = Runtime::new(RuntimeOptions {
        schema_whlist,
        extensions: vec![example_extension::init_ops_and_esm()],
        ..Default::default()
    })?;

    runtime.load_module(&module)?;

    Ok(())
}
