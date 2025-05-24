const path = require("path");
const fs = require("fs");

const packagePath = path.join(__dirname, "..", "install.js");
const cargoPath = path.join(__dirname, "../..", "core", "Cargo.toml");

function writePackageVersion(version) {
	const data = fs.readFileSync(packagePath, "utf8");

	fs.writeFileSync(packagePath, data.replace(/CI_INPUT_VERSION/g, version));
}

function getCargoVersion() {
	const toml = fs.readFileSync(cargoPath, "utf8");
	const versionMatch = toml.match(/version = "([^"]+)"/);
	if (!versionMatch) {
		throw new Error("Could not find version in Cargo.toml");
	}
	const cargoVersion = versionMatch[1];

	return `v${cargoVersion}`;
}

const version = getCargoVersion();

writePackageVersion(version);

console.log("✅ Package version set to", version);
