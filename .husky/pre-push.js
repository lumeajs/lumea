const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const packagePath1 = path.join(__dirname, "..", "package", "package.json");
const packagePath2 = path.join(__dirname, "..", "api", "package.json");
const cargoPath = path.join(__dirname, "..", "core", "Cargo.toml");

function getGitTag() {
	try {
		return execSync("git describe --tags --abbrev=0").toString().trim();
	} catch {
		return null;
	}
}

function getPackageVersion(packagePath) {
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
const pkgVersionApi = getPackageVersion(packagePath2);
const pkgVersionPackage = getPackageVersion(packagePath1);
const cargoVersion = getCargoVersion();

if (!gitTag) {
	console.error("❌ Not pushing from a tag. Please tag your commit.");
	process.exit(1);
}

if (
	gitTag !== pkgVersionApi ||
	gitTag !== pkgVersionPackage ||
	gitTag !== cargoVersion ||
	pkgVersionApi !== cargoVersion ||
	pkgVersionPackage !== cargoVersion
) {
	console.error(`❌ Version mismatch:
  package/package.json: ${pkgVersionPackage}
  api/package.json:     ${pkgVersionApi}
  Cargo.toml:   ${cargoVersion}
  git tag:      ${gitTag}`);
	process.exit(1);
}

console.log(`✅ Version matches tag: ${gitTag}`);
