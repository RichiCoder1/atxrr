import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import million from "million/compiler";

// https://astro.build/config
export default defineConfig({
	integrations: [
		react(),
		million.vite({
			mode: "react",
			server: true,
			auto: true,
		}),
	],
	output: "server",
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
		imageService: "compile",
	}),
	site:
		process.env.SITE_URL ??
		process.env.CF_PAGES_URL ??
		"http://localhost:4321/",
	vite: {
		resolve: {
			alias: import.meta.env.PROD && {
				"react-dom/server": "react-dom/server.edge",
			},
		},

		server: {
			proxy: {
				"^/tt/.*": {
					target: "https://cdn.tickettailor.com",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/tt/, ""),
				},
			},
		},

		ssr: {
			resolve: {
				conditions: ["workerd", "worker", "browser"],
			},
		},

		plugins: [tailwindcss({ applyBaseStyles: false })],
	},
});
