import "dotenv/config";
import * as esbuild from "esbuild";
import tailwindPlugin from "esbuild-plugin-tailwindcss";
import { solidPlugin } from "esbuild-plugin-solid";

const context = await esbuild.context({
	plugins: [
		tailwindPlugin({
			/* options */
		}),
		solidPlugin(),
	],
	entryPoints: ["src/index.tsx"],
	bundle: true,
	format: "esm",
	platform: "browser",
	outdir: "dist",
	logLevel: "info",
	// packages: "external",
	target: "es2020",
	// metafile: true,
	// external: externalImports,
	tsconfig: "tsconfig.json",
	define: {
		"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
	},
	conditions: [process.env.NODE_ENV],
});

await context.watch();

let { hosts, port } = await context.serve({
	servedir: "./",
});
