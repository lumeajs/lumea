import fs from "fs";

const modules = ["main"];

let output = "";

for (const module of modules) {
	const path = `dist/api_${module}.d.ts`;
	let content = fs.readFileSync(path, "utf-8");
	content = content.replace("export declare", "export"); // Remove export declare
	const wrapped = `declare module "lumea/${module}" {\n${content}\n}`;
	output += `${wrapped}\n\n`;

	fs.rmSync(path);
}

fs.writeFileSync("dist/types.d.ts", output);
console.log("✅ types.d.ts created at dist/types.d.ts");
