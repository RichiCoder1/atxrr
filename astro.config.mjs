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
		mode: "directory",
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
		server: {
			proxy: {
				"^/tt/.*": {
					target: "https://cdn.tickettailor.com",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/tt/, ""),
				},
			},
		},

		plugins: [tailwindcss({ applyBaseStyles: false })],
	},
});
