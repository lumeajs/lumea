import { op_add_example } from "./funcs";
import { uselessFunction } from "./util";

export function hello() {
	console.log(uselessFunction());

	return "Hello World!";
}

export function add(a: number, b: number) {
	return op_add_example(a, b);
}
