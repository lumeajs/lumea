const fs = require("fs");
const path = require("path");

const packagePath = path.join(__dirname, "package", "package.json");
const apiPath = path.join(__dirname, "api", "package.json");

const version = process.argv[2];

if (!version) throw new Error("Missing version");

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

fs.writeFileSync(
	apiPath,
	JSON.stringify(
		{
			...JSON.parse(fs.readFileSync(apiPath, "utf8")),
			version,
		},
		null,
		2,
	),
);
