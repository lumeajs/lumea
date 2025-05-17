const fs = require("fs");
const path = require("path");

const corePath = path.join(__dirname, "core", "Cargo.toml");
const packagePath = path.join(__dirname, "package", "package.json");

const version = process.argv[2];

fs.writeFileSync(
	corePath,
	fs
		.readFileSync(corePath, "utf8")
		.replace(/version = "([^"]+)"/, `version = "${version}"`),
);

fs.writeFileSync(
	packagePath,
	JSON.stringify(
		{
			...JSON.parse(fs.readFileSync(packagePath, "utf8")),
			version,
		},
		null,
		2,
	),
);
