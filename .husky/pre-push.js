const path = require("path");
const fs = require("fs");

const packagePath1 = path.join(__dirname, "..", "package", "package.json");
const packagePath2 = path.join(__dirname, "..", "api", "package.json");

function getPackageVersion(packagePath) {
	const json = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	return `v${json.version}`;
}

const pkgVersionApi = getPackageVersion(packagePath2);
const pkgVersionPackage = getPackageVersion(packagePath1);

if (pkgVersionPackage !== pkgVersionApi) {
	console.error(`❌ Version mismatch:
  package/package.json: ${pkgVersionPackage}
  api/package.json:     ${pkgVersionApi}`);
	process.exit(1);
}

console.log(`✅ Version matches tag: ${pkgVersionPackage}`);
