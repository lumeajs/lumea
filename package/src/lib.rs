#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use std::{
  fs,
  fs::File,
  io::{self, Cursor, Write},
  time::SystemTime,
};
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

const MAGIC: &[u8; 4] = b"ASST"; // marker for footer

#[napi]
pub fn zip_assets(bin_path: String, assets_dir: String, out_path: String) {
  let start_time = SystemTime::now();
  println!("Zipping...");

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
        zip.start_file(rel_path, options).unwrap();

        // copy file contents
        let mut f = File::open(path).unwrap();
        io::copy(&mut f, &mut zip).unwrap();
      }
    }

    zip.finish().unwrap();
  }

  let zip_size = zip_buffer.len() as u64;

  // 3) copy original binary
  fs::copy(&bin_path, &out_path).unwrap();

  // 4) Open the output for appending your ZIP + footer
  let mut out_file = std::fs::OpenOptions::new()
    .append(true)
    .open(&out_path)
    .unwrap();

  // 5) append zip data
  out_file.write_all(&zip_buffer).unwrap();

  // 6) append footer: MAGIC + 8-byte LE size
  out_file.write_all(MAGIC).unwrap();
  out_file.write_all(&zip_size.to_le_bytes()).unwrap();

  println!(
    "Packed `{}` ({} bytes ZIP) into `{}` in {}ms ✔️",
    assets_dir,
    zip_size,
    out_path,
    start_time.elapsed().unwrap().as_millis()
  );
}
