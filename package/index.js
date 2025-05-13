#!/usr/bin/env node

// index.js
//
// Usage:
//   bun index.js \
//     --bin path/to/your_binary \
//     --dir path/to/data \
//     --out path/to/packed_binary
//

import fs from "node:fs";

import { zipAssets } from "./build.js";
import { build } from "esbuild";
import { forceNodeProtocol } from "./force-node-protocol.js";

const args = process.argv.slice(2);

/**
 * Extracts a value from the command line arguments based on the given flag and type.
 * @param {string} flag The flag to search for, e.g. "--binary".
 * @param {"string"|"boolean"|"number"} type The type of value to return.
 * @param {*} [defaultValue=null] The value to return if the flag is not provided.
 * @returns {*} The value of the given type, or the default value if the flag is not provided.
 */
function getArgByFlag(flag, type, defaultValue = null) {
	const index = args.indexOf(flag);

	if (index === -1) {
		if (defaultValue !== null) {
			return defaultValue;
		} else {
			throw new Error(`Missing argument: ${flag}`);
		}
	}

	const value = args[index + 1];

	if (value === undefined) {
		if (type === "boolean") {
			return true;
		}

		throw new Error(`Missing value for argument: ${flag}`);
	}

	if (type === "string") {
		return value;
	} else if (type === "boolean") {
		return value === "true";
	} else if (type === "number") {
		return Number(value);
	}
}

const binPath = getArgByFlag("--bin", "string");
const dirPath = getArgByFlag("--dir", "string", ".");
const outPath = getArgByFlag("--out", "string");

const assetsDir = dirPath + "/assets";
const jsEntry = dirPath + "/index.js";

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

zipAssets(binPath, newAssets, outPath);

console.log("Building complete!");
console.log("Cleaning up...");

// Delete the assets directory
fs.rmSync(newAssets, { recursive: true });
fs.rmSync("./bundle.js");

console.log("Cleaning up complete!");
