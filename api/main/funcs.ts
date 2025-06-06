declare const Deno: {
    core: {
        ops: Record<string, (...args: any[]) => any>;
    };
};

export function op_add_example(a: number, b: number): number {
  return Deno.core.ops.op_add_example!(a, b);
}
export function new_window(): void {
  return Deno.core.ops.new_window!();
}
