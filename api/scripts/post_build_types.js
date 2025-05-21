import fs from "fs";

const modules = ["main"];

let output = "";

for (const module of modules) {
	const path = `dist/api_${module}.d.ts`;
	const content = fs.readFileSync(path, "utf-8");
	const wrapped = `declare module "lumea/${module}" {\n${content}\n}`;
	output += `${wrapped}\n\n`;

	fs.rmSync(path);
}

fs.writeFileSync("dist/types.d.ts", output);
console.log("✅ types.d.ts created at dist/types.d.ts");
