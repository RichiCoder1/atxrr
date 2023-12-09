import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";
import million from 'million/compiler';

// https://astro.build/config
export default defineConfig({
	integrations: [react(), million.vite({ mode: "react", server: true, auto: true }), tailwind({
		applyBaseStyles: false
	})],
	output: "server",
	adapter: cloudflare({ mode: "directory" })
});