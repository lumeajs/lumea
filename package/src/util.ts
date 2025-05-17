import os from "node:os";
import fs from "node:fs";

export function getPlatformPath() {
	const platform = os.platform();

	switch (platform) {
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

export function readPackageJson() {
	return JSON.parse(fs.readFileSync("./package.json", "utf-8"));
}
