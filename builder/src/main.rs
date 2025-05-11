// asset_packer.rs
//
// Usage:
//   cargo run --release -- \
//     path/to/your_binary \
//     path/to/static_assets \
//     path/to/packed_binary
//

use std::{
    env, fs,
    fs::File,
    io::{self, Cursor, Write},
    time::SystemTime,
};
use walkdir::WalkDir;
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

const MAGIC: &[u8; 4] = b"ASST"; // marker for footer

fn main() -> io::Result<()> {
    let start_time = SystemTime::now();
    println!("Zipping...");

    // ----------------------
    // 1) parse args
    // ----------------------
    let mut args = env::args();
    let _exe = args.next(); // skip program name

    let bin_path = args.next().expect("Missing --bin-path");
    let assets_dir = args.next().expect("Missing --assets-dir");
    let out_path = args.next().expect("Missing --out-path");

    // ----------------------
    // 2) zip assets into Vec<u8>
    // ----------------------
    let mut zip_buffer = Vec::new();
    {
        let cursor = Cursor::new(&mut zip_buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);

        for entry in WalkDir::new(&assets_dir).into_iter().filter_map(Result::ok) {
            let path = entry.path();
            if path.is_file() {
                // compute relative path inside archive
                let rel_path = path
                    .strip_prefix(&assets_dir)
                    .unwrap()
                    .to_string_lossy()
                    .replace("\\", "/"); // for Windows compatibility

                // start new file in zip
                zip.start_file(rel_path, options)?;

                // copy file contents
                let mut f = File::open(path)?;
                io::copy(&mut f, &mut zip)?;
            }
        }

        zip.finish()?;
    }

    println!(
        "Zip created in {}ms",
        start_time.elapsed().unwrap().as_millis()
    );

    let zip_size = zip_buffer.len() as u64;

    // 3) copy original binary
    fs::copy(&bin_path, &out_path)?;

    println!(
        "Files copied in {}ms",
        start_time.elapsed().unwrap().as_millis()
    );

    // 4) Open the output for appending your ZIP + footer
    let mut out_file = std::fs::OpenOptions::new().append(true).open(&out_path)?;

    println!(
        "Data read in {}ms",
        start_time.elapsed().unwrap().as_millis()
    );

    // 5) append zip data
    out_file.write_all(&zip_buffer)?;

    println!(
        "Wrote zip in {}ms",
        start_time.elapsed().unwrap().as_millis()
    );

    // 6) append footer: MAGIC + 8-byte LE size
    out_file.write_all(MAGIC)?;
    out_file.write_all(&zip_size.to_le_bytes())?;

    println!(
        "Packed `{}` ({} bytes ZIP) into `{}` in {}ms ✔️",
        assets_dir,
        zip_size,
        out_path,
        start_time.elapsed().unwrap().as_millis()
    );
    Ok(())
}
