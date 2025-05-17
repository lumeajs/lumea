import { addAssetsToBin } from "@lumea/build-helper";
import { build } from "esbuild";
import { join } from "path";
import fs from "fs";
import { getPlatformPath, readPackageJson } from "../util";

const forceNodeProtocol = {
	name: "force-node-protocol",
	setup(build: any) {
		const nodeBuiltins = new Set([
			"assert",
			"buffer",
			"child_process",
			"cluster",
			"console",
			"constants",
			"crypto",
			"dgram",
			"dns",
			"domain",
			"events",
			"fs",
			"http",
			"https",
			"module",
			"net",
			"os",
			"path",
			"process",
			"punycode",
			"querystring",
			"readline",
			"repl",
			"stream",
			"string_decoder",
			"timers",
			"tls",
			"tty",
			"url",
			"util",
			"v8",
			"vm",
			"zlib",
			"worker_threads",
			"inspector",
		]);

		build.onResolve({ filter: /^[a-z0-9_]+$/ }, (args: any) => {
			if (nodeBuiltins.has(args.path)) {
				return {
					path: `node:${args.path}`,
					external: true, // Let Node.js resolve it at runtime
				};
			}
		});
	},
};

function bundleJs(input: string, output: string) {
	build({
		entryPoints: [input],
		bundle: true,
		outfile: output,
		format: "cjs",
		target: "es2020",
		platform: "node",
		minify: true,
		external: ["node:*"],
		plugins: [forceNodeProtocol],
	});
}

function bundleAssets(dir: string, output: string) {
	// If output exists, remove it
	if (fs.existsSync(output)) {
		fs.rmSync(output, { recursive: true });
	}

	fs.mkdirSync(output, { recursive: true });
	fs.mkdirSync(join(output, "assets"), { recursive: true });

	// Copy all the files from dir/assets to output/assets
	fs.cpSync(join(dir, "assets"), join(output, "assets"), {
		recursive: true,
	});

	// Get the main file
	const mainFile = readPackageJson().main || "index.js";

	// Bundle the javascript
	bundleJs(join(dir, mainFile), join(output, "index.js"));
}

export function createBinary(dir: string, outBin: string) {
	const tempPath = "./.lumea/tmp";
	const binPath = join("dist", getPlatformPath());

	console.log(binPath, outBin);

	bundleAssets(dir, tempPath);
	addAssetsToBin(binPath, tempPath, outBin);

	fs.rmSync(tempPath, { recursive: true });
}
