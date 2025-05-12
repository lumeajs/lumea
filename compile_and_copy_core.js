import { execSync } from "child_process";
import { copyFileSync } from "fs";
import os from "os";

const args = process.argv.slice(2);

const isRelease = args.includes("--release");

// Navigate to the core directory
process.chdir("core");
// Run the build command
execSync(`cargo build ${isRelease ? "--release" : ""}`, { stdio: "inherit" });
// Copy the built files to the root directory
const extension =
	os.type() === "Windows_NT"
		? ".exe"
		: os.type() === "Linux"
		? ".so"
		: ".dylib";
const dir = isRelease ? "target/release" : "target/debug";
copyFileSync(`${dir}/core${extension}`, `../bin${extension}`);
