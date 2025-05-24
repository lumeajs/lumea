#!/usr/bin/env node

import os from "node:os";
import { program } from "commander";
import { readPackageJson } from "./util";
import { createBinary } from "./api/build";

const version = readPackageJson(".").version;

program.version(version).description("Lumea CLI");

program
	.command("build")
	.description("Builds the Lumea binary")
	.argument("<dir>", "Directory to build from")
	.option(
		"-o, --out <path>",
		"Output path for the binary",
		`./dist/lumea-app${os.platform() === "win32" ? ".exe" : ""}`,
	)
	.action(async (dir, options) => {
		await createBinary(dir, options.out);
	});

program.parse();
