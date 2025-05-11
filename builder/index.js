// index.js
//
// Usage:
//   bun index.js \
//     --binary=path/to/your_binary \
//     --assets=path/to/static_assets \
//     --js-entry=path/to/entry.js \
//     --out=path/to/packed_binary
//

import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { build } from "esbuild";
import { forceNodeProtocol } from "./force-node-protocol.js";

const args = process.argv.slice(2);

const binPath = args.find((arg) => arg.startsWith("--binary="))?.split("=")[1];
const assetsDir = args
	.find((arg) => arg.startsWith("--assets="))
	?.split("=")[1];
const jsEntry = args
	.find((arg) => arg.startsWith("--js-entry="))
	?.split("=")[1];
const outPath = args.find((arg) => arg.startsWith("--out="))?.split("=")[1];

if (!binPath || !assetsDir || !jsEntry || !outPath) {
	throw new Error("Missing args, see comment above");
}

const newAssets = "./assets";
const newAssetsStatic = "./assets/assets";

console.log("Bundling...");

await build({
	entryPoints: [jsEntry],
	outfile: "bundle.js",
	bundle: true,
	platform: "node",
	format: "esm",
	plugins: [forceNodeProtocol],
	target: "esnext",
	external: ["node:*", "core:*"],
	minify: true,
	loader: { ".ts": "ts", ".js": "js", ".json": "json", ".wasm": "base64" },
});

console.log("Bundling complete!");
console.log("Moving extra assets...");
// Create the assets directory, else clean it
if (fs.existsSync(newAssets)) {
	fs.rmSync(newAssets, { recursive: true });
}
fs.mkdirSync(newAssets, { recursive: true });

// Copy the assets to the new directory
fs.copyFileSync("bundle.js", `${newAssets}/bundle.js`);
fs.cpSync(assetsDir, newAssetsStatic, { recursive: true });

console.log("Moving extra assets complete!");
console.log("Building binary...");

// Run the prebuild script
const command = ["./builder.exe", binPath, newAssets, outPath];
spawnSync(command[0], command.slice(1), { stdio: "inherit" });

console.log("Building complete!");
console.log("Cleaning up...");

// Delete the assets directory
fs.rmSync(newAssets, { recursive: true });
fs.rmSync("./bundle.js");

console.log("Cleaning up complete!");
