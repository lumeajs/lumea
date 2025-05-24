const path = require("path");
const fs = require("fs");

const packagePath = path.join(__dirname, "..", "install.js");
const cargoPath = path.join(__dirname, "../..", "core", "Cargo.toml");

function writePackageVersion(version) {
	const data = fs.readFileSync(packagePath, "utf8");

	fs.writeFileSync(packagePath, data.replace(/CI_INPUT_VERSION/g, version));
}

function getGitTag() {
	try {
		return execSync("git describe --tags --abbrev=0").toString().trim();
	} catch {
		return null;
	}
}

const version = getGitTag();

if (!version) {
	console.error("❌ Not pushing from a tag. Please tag your commit.");
	process.exit(1);
}

writePackageVersion(version);

console.log("✅ Package version set to", version);
