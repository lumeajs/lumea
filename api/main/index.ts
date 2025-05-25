import { op_add_example, new_window } from "./funcs";
import { uselessFunction } from "./util";

export function hello() {
	console.log(uselessFunction());

	return "Hello World!";
}

export function add(a: number, b: number) {
	return op_add_example(a, b);
}

export function newWindow() {
	new_window();
}
