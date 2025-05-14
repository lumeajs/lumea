import { join, parse } from "node:path";
import { writeFile, readFile, readdir } from "fs/promises";

const binaryStart = "core-";

const SysToNodePlatform = {
	linux: "linux",
	freebsd: "freebsd",
	darwin: "darwin",
	windows: "win32",
};

const CpuToNodeArch = {
	x86_64: "x64",
	aarch64: "arm64",
	i686: "ia32",
	armv7: "arm",
	riscv64gc: "riscv64",
	powerpc64le: "ppc64",
};

function parseTriple(rawTriple) {
	const triple = rawTriple.endsWith("eabi")
		? `${rawTriple.slice(0, -4)}-eabi`
		: rawTriple;
	const triples = triple.split("-");
	let cpu;
	let sys;
	let abi = null;
	if (triples.length === 2) {
		// aarch64-fuchsia
		// ^ cpu   ^ sys
		[cpu, sys] = triples;
	} else {
		// aarch64-unknown-linux-musl
		// ^ cpu           ^ sys ^ abi
		// aarch64-apple-darwin
		// ^ cpu         ^ sys  (abi is None)
		[cpu, , sys, abi = null] = triples;
	}

	const platform = SysToNodePlatform[sys] ?? sys;
	const arch = CpuToNodeArch[cpu] ?? cpu;
	return {
		triple: rawTriple,
		platformArchABI: abi ? `${platform}-${arch}-${abi}` : `${platform}-${arch}`,
		platform,
		arch,
		abi,
	};
}

export async function collectArtifacts() {
	const distDirs = await readdir("./npm");

	console.log(distDirs);

	await collectNodeBinaries("./artifacts").then((output) =>
		Promise.all(
			output.map(async (filePath) => {
				console.log(`Read [${filePath}]`);
				const sourceContent = await readFile(filePath);
				const parsedName = parse(filePath);
				const terms = parsedName.name.split(".");
				let platformArchABI = terms.pop();
				const _binaryName = terms.join(".");

				console.log(platformArchABI);

				platformArchABI = platformArchABI.split("core-")[1];

				platformArchABI = parseTriple(platformArchABI).platformArchABI;

				console.log(platformArchABI);

				if (_binaryName.startsWith(binaryStart)) {
					console.warn(
						`[${_binaryName}] is not matched with [${binaryStart}], skip`,
					);
					return;
				}
				const dir = distDirs.find((dir) => dir.includes(platformArchABI));

				if (!dir) {
					throw new Error(`No dist dir found for ${filePath}`);
				}

				const distFilePath = join("npm", dir, parsedName.base);
				console.log(`Write file content to [${distFilePath}]`);
				await writeFile(distFilePath, sourceContent);

				const packageJsonPath = join("npm", dir, "package.json");
				console.log(`Read package.json from [${packageJsonPath}]`);
				const packageJsonContent = await readFile(packageJsonPath);
				const packageJson = JSON.parse(packageJsonContent);
				packageJson.files.push(parsedName.base);
				console.log(`Write file content to [${packageJsonPath}]`);
				await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 4));
			}),
		),
	);
}

async function collectNodeBinaries(root) {
	const files = await readdir(root, { withFileTypes: true });
	const nodeBinaries = files.map((file) => join(root, file.name));

	const dirs = files.filter((file) => file.isDirectory());
	for (const dir of dirs) {
		if (dir.name !== "node_modules") {
			nodeBinaries.push(...(await collectNodeBinaries(join(root, dir.name))));
		}
	}
	return nodeBinaries;
}

collectArtifacts();
