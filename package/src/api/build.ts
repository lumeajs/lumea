import { addAssetsToBin } from "@lumea/build-helper";
import { build } from "esbuild";
import { join, relative } from "path";
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

async function bundleJs(dir: string, file: string, output: string) {
	await build({
		alias: {
			"lumea/main": join(__dirname, "api_main.cjs"),
		},
		entryPoints: [join(process.cwd(), dir, file)],
		absWorkingDir: join(process.cwd(), dir),
		sourcemap: true,
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

async function bundleAssets(dir: string, output: string) {
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
	const mainFile = readPackageJson(dir).main || "index.js";

	// Bundle the javascript
	await bundleJs(dir, mainFile, join(output, "bundle.js"));

	const map = JSON.parse(
		fs.readFileSync(join(process.cwd(), dir, output, "bundle.js.map"), "utf8"),
	);
	map.sources = map.sources.map((src: string) =>
		relative(join(process.cwd(), dir), join(process.cwd(), output, src)),
	);

	fs.writeFileSync(
		join(process.cwd(), dir, output, "bundle.js.map"),
		JSON.stringify(map),
	);
}

export async function createBinary(dir: string, outBin: string) {
	const tempPath = join(dir, "./.lumea/tmp");
	const binPath = join(__dirname, getPlatformPath());

	await bundleAssets(dir, tempPath);
	addAssetsToBin(binPath, tempPath, outBin);

	fs.rmSync(tempPath, { recursive: true, force: true });
}
