#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:https";

// prettier-ignore
import packageJson from "./package.json" with { type: "json" };
const { version } = packageJson;

const platformPath = getPlatformPath();

if (isInstalled()) {
	process.exit(0);
}

const dirname = path.dirname(process.argv[1]);

const platformArchToName = {
	"win32-x64": "x86_64-pc-windows-msvc",
}

const platform = process.platform;
const arch = process.arch;

if (
	platform === "darwin" &&
	arch === "x64"
) {
	// When downloading for macOS ON macOS and we think we need x64 we should
	// check if we're running under rosetta and download the arm64 version if appropriate
	try {
		const output = childProcess.execSync("sysctl -in sysctl.proc_translated");
		if (output.toString().trim() === "1") {
			arch = "arm64";
		}
	} catch {
		// Ignore failure
	}
}

// downloads if not cached
downloadArtifact({
	version,
	artifactName: "lumea",
	platform,
	arch,
}).catch((err) => {
	console.error(err.stack);
	process.exit(1);
});

async function downloadFile(url, dest) {
	const file = fs.createWriteStream(dest);

	return new Promise((resolve, reject) => {
		const request = http.get(url, (response) => {
			const redirectUrl = response.headers.location;
			if (redirectUrl) {
				console.log(`Redirecting to ${redirectUrl}`);
				request.abort();
				downloadFile(redirectUrl, dest).then(resolve).catch(reject);
			} else {
				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			}
		}).on("error", (err) => {
			console.error(err.stack);

			fs.unlink(dest);
			reject(err);
		});
	});
}

function isInstalled() {
	try {
		if (
			fs
				.readFileSync(path.join(dirname, "dist", "version"), "utf-8")
				.replace(/^v/, "") !== version
		) {
			return false;
		}

		if (
			fs.readFileSync(path.join(dirname, "path.txt"), "utf-8") !==
			platformPath
		) {
			return false;
		}
	} catch {
		return false;
	}

	const lumeaPath = path.join(dirname, "dist", platformPath);

	return fs.existsSync(lumeaPath);
}

function downloadArtifact({ version, artifactName, platform, arch }) {
	const downloadName = platformArchToName[`${platform}-${arch}`];

	if (!downloadName) {
		throw new Error(
			`Lumea builds are not available on platform: ${platform}-${arch}`,
		);
	}

    fs.mkdirSync(path.join(dirname, "dist"), { recursive: true });

	const p1 = new Promise((resolve, reject) => {
		const url = `https://github.com/lumeajs/lumea/releases/download/v${version}/${artifactName}-${downloadName}`;

        console.log(`Downloading ${url}`);
		downloadFile(url, path.join(dirname, "dist", platformPath)).then(() => {
			resolve();
		})
	});

    // Download the .d.ts file
    const p2 = new Promise((resolve, reject) => {
        const url = `https://github.com/lumeajs/lumea/releases/download/v${version}/${artifactName}.d.ts`;

        console.log(`Downloading ${url}`);
		downloadFile(url, path.join(dirname, "dist", `${artifactName}.d.ts`)).then(() => {
			resolve();
		})
    });

    return Promise.all([p1, p2]);
}

function getPlatformPath() {
	const platform = os.platform();

	switch (platform) {
		case "mas":
		case "darwin":
			return "Lumea.app/Contents/MacOS/Lumea";
		case "freebsd":
		case "openbsd":
		case "linux":
			return "lumea";
		case "win32":
			return "lumea.exe";
		default:
			throw new Error(
				"Lumea builds are not available on platform: " + platform,
			);
	}
}
