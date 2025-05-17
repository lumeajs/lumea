const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const packagePath = path.join(__dirname, "..", "package", "package.json");
const cargoPath = path.join(__dirname, "..", "core", "Cargo.toml");

function getGitTag() {
	try {
		return execSync("git describe --tags --abbrev=0").toString().trim();
	} catch {
		return null;
	}
}

function getPackageVersion() {
	const json = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	return `v${json.version}`;
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

const gitTag = getGitTag();
const pkgVersion = getPackageVersion();
const cargoVersion = getCargoVersion();

if (!gitTag) {
	console.error("❌ Not pushing from a tag. Please tag your commit.");
	process.exit(1);
}

if (
	gitTag !== pkgVersion ||
	gitTag !== cargoVersion ||
	pkgVersion !== cargoVersion
) {
	console.error(`❌ Version mismatch:
  package.json: ${pkgVersion}
  Cargo.toml:   ${cargoVersion}
  git tag:      ${gitTag}`);
	process.exit(1);
}

console.log(`✅ Version matches tag: ${gitTag}`);
