import { readFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";

import { fileURLToPath } from "node:url";
const __dirname = join(fileURLToPath(import.meta.url), "..");

const rustFilePath = join(__dirname, "..", "..", "core", "src", "main.rs");
const rustCode = readFileSync(rustFilePath, "utf-8");

const tsFilePath = join(__dirname, "..", "main", "funcs.ts");
const writeStream = createWriteStream(tsFilePath);

writeStream.write(`declare const Deno: {
    core: {
        ops: Record<string, (...args: any[]) => any>;
    };
};\n\n`);

const typeMap = {
	u32: "number",
	i32: "number",
	i64: "number",
	f32: "number",
	bool: "boolean",
	String: "string",
	"&str": "string",
	"()": "void",
};

const rustToTsType = (type) => {
	if (type.startsWith("Result<")) {
		// Result<T, E>
		type = type.split("<")[1].split(",")[0];
		return rustToTsType(type);
	}
	return typeMap[type.trim()] || "any";
};

const functionRegex =
	/#\[op[^\]]*]\s*fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^ {]+))?\s*{/g;

const matches = [...rustCode.matchAll(functionRegex)];

console.log("Found", matches.length, "functions");

for (const match of matches) {
	const [_, fnName, argsStr, returnType] = match;

	console.log(fnName, argsStr, returnType);

	const args =
		argsStr.trim() === ""
			? []
			: argsStr.split(",").map((arg) => {
					const [name, type] = arg.trim().split(/\s*:\s*/);
					return { name, type: rustToTsType(type) };
			  });

	const tsArgs = args.map(({ name, type }) => `${name}: ${type}`).join(", ");
	const tsCallArgs = args.map(({ name }) => name).join(", ");
	const tsReturnType = rustToTsType(returnType || "()");

	writeStream.write(`export function ${fnName}(${tsArgs}): ${tsReturnType} {
  return Deno.core.ops.${fnName}!(${tsCallArgs});
}\n`);
}
