// Copy the files from api/dist to package/dist, run npm run build in dist, and copy the resulting files back to test/node_modules/lumea/dist
// Then copy core/target/debug/core[.exe] to test/node_modules/lumea/dist/lumea[.exe]

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const apiDist = path.join(__dirname, "..", "api", "dist");
const packageDist = path.join(__dirname, "..", "package", "dist");
const testDist = path.join(
	__dirname,
	"..",
	"test",
	"node_modules",
	"lumea",
	"dist",
);

fs.rmSync(packageDist, { recursive: true, force: true });
fs.mkdirSync(packageDist);

fs.readdirSync(apiDist).forEach((fileName) => {
	const filePath = path.join(apiDist, fileName);
	const fileContent = fs.readFileSync(filePath);
	fs.writeFileSync(path.join(packageDist, fileName), fileContent);
});

process.chdir(packageDist);
execSync("npm run build", { stdio: "inherit" });

fs.readdirSync(packageDist).forEach((fileName) => {
	const filePath = path.join(packageDist, fileName);
	const fileContent = fs.readFileSync(filePath);
	fs.writeFileSync(path.join(testDist, fileName), fileContent);
});

console.log("✅ lumea/dist copied to test/node_modules/lumea/dist");
const coreDebug = path.join(__dirname, "..", "core", "target", "debug");
const coreFileName = `core${os.platform() === "win32" ? ".exe" : ""}`;
const coreSourcePath = path.join(coreDebug, coreFileName);
const coreDestPath = path.join(
	testDist,
	`lumea${os.platform() === "win32" ? ".exe" : ""}`,
);

fs.copyFileSync(coreSourcePath, coreDestPath);

console.log(`✅ core/debug/core copied to test/node_modules/lumea/dist/lumea`);
