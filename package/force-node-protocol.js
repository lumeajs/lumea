// force-node-protocol.js
export const forceNodeProtocol = {
	name: "force-node-protocol",
	setup(build) {
		const nodeBuiltins = new Set([
			"assert",
			"buffer",
			"child_process",
			"cluster",
			"console",
			"constants",
			"crypto",
			"dgram",
			"dns",
			"domain",
			"events",
			"fs",
			"http",
			"https",
			"module",
			"net",
			"os",
			"path",
			"process",
			"punycode",
			"querystring",
			"readline",
			"repl",
			"stream",
			"string_decoder",
			"timers",
			"tls",
			"tty",
			"url",
			"util",
			"v8",
			"vm",
			"zlib",
			"worker_threads",
			"inspector",
		]);

		build.onResolve({ filter: /^[a-z0-9_]+$/ }, (args) => {
			if (nodeBuiltins.has(args.path)) {
				return {
					path: `node:${args.path}`,
					external: true, // Let Node.js resolve it at runtime
				};
			}
		});
	},
};
