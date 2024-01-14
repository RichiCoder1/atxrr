import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";
import million from 'million/compiler';
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
	integrations: [react(), million.vite({
		mode: "react",
		server: true,
		auto: true
	}), tailwind({
		applyBaseStyles: false
	})],
	output: "server",
	adapter: cloudflare({
		mode: "directory"
	}),
	site: process.env.SITE_URL ?? process.env.CF_PAGES_URL ?? 'http://localhost:4321/',
	vite: {
		server: {
			proxy: {
				'^/tt/.*': {
					target: 'https://cdn.tickettailor.com',
					changeOrigin: true,
					rewrite: path => path.replace(/^\/tt/, '')
				}
			}
		}
	}
});