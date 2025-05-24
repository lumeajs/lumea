const path = require("path");
const fs = require("fs");

const packagePath = path.join(__dirname, "..", "install.js");

function writePackageVersion(version) {
	const data = fs.readFileSync(packagePath, "utf8");

	fs.writeFileSync(packagePath, data.replace(/CI_INPUT_VERSION/g, version));
}

const version = process.argv[2];

if (!version) {
	console.error("❌ Not pushing from a tag. Please tag your commit.");
	process.exit(1);
}

writePackageVersion(version);

console.log("✅ Package version set to", version);
