import { build } from "esbuild";
import { join } from "node:path";

async function buildPackage(path) {
	await build({
		entryPoints: ["index.ts"],
		outfile: `../dist/api_${path}.cjs`,
		absWorkingDir: join(process.cwd(), path),
		sourcemap: true,
		bundle: true,
		format: "cjs",
		target: "es2020",
		platform: "node",
		minify: true,
		external: ["node:*"],
	});
}

async function buildAll() {
	console.log("Building Main package...");

	buildPackage("main");

	console.log("Done!");
}

buildAll();
