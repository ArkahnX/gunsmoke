import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as esbuild from "esbuild";
import tailwindPlugin from "esbuild-plugin-tailwindcss";
import { solidPlugin } from "esbuild-plugin-solid";

const isBuild = process.argv.includes("--build");

const options = {
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
};

if (isBuild) {
	// always a production bundle, whatever .env says, so Solid's dev build isn't shipped
	await esbuild.build({
		...options,
		minify: true,
		sourcemap: false,
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		conditions: ["production"],
	});
} else {
	const context = await esbuild.context({
		...options,
		sourcemap: true,
		define: {
			"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
		},
		conditions: [process.env.NODE_ENV],
	});

	await context.watch();

	// esbuild's server makes every request wait on a rebuild (~1s), so images arrive late and all at once. Static files
	// are served straight from disk instead, and only the bundle goes through esbuild so it's never served mid-build.
	const root = path.resolve(".");
	const mimeTypes = {
		".html": "text/html",
		".js": "text/javascript",
		".css": "text/css",
		".json": "application/json",
		".map": "application/json",
		".png": "image/png",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".ico": "image/x-icon",
	};
	let esbuildPort = 0;

	const server = http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		if (url.pathname.startsWith("/dist/")) {
			const proxyReq = http.request(
				{ hostname: "127.0.0.1", port: esbuildPort, path: req.url, method: req.method, headers: req.headers },
				(proxyRes) => {
					res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
					proxyRes.pipe(res);
				}
			);
			proxyReq.on("error", () => res.writeHead(502).end());
			req.pipe(proxyReq);
			return;
		}

		let file;
		try {
			file = path.join(root, decodeURIComponent(url.pathname));
		} catch {
			return res.writeHead(400).end();
		}
		if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
		fs.stat(file, (err, stats) => {
			if (!err && stats.isDirectory()) {
				file = path.join(file, "index.html");
				stats = fs.existsSync(file) ? fs.statSync(file) : undefined;
			}
			if (err || !stats) return res.writeHead(404).end();
			// revalidated every time, so a replaced image shows up on reload, but unchanged files are a cheap 304
			const lastModified = stats.mtime.toUTCString();
			const headers = { "Cache-Control": "no-cache", "Last-Modified": lastModified };
			if (req.headers["if-modified-since"] === lastModified) return res.writeHead(304, headers).end();
			res.writeHead(200, {
				...headers,
				"Content-Type": mimeTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
				"Content-Length": stats.size,
			});
			fs.createReadStream(file).pipe(res);
		});
	});
	const port = Number(process.env.PORT ?? 8000);
	await new Promise((resolve) => server.listen(port, resolve));

	// an explicit port: Windows lets esbuild bind 127.0.0.1 on the same port, which would take localhost traffic
	({ port: esbuildPort } = await context.serve({ servedir: "./", host: "127.0.0.1", port: port + 1 }));
	console.log(`\n > Local: http://localhost:${port}/ (bundle from esbuild on ${esbuildPort})\n`);
}
