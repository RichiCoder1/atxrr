import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { google } from "emdash/auth/providers/google";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { cloudflareEmail } from "@emdash-cms/cloudflare/plugins";
import { atxrrExtensions } from "./src/plugins/atxrr-extensions/index.ts";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

// https://astro.build/config
export default defineConfig({
	integrations: [
		react(),
		emdash({
			// NOTE: d1 session mode must stay disabled — "auto" is incompatible
			// with the global_fetch_strictly_public compatibility flag (silent
			// SSR hangs; see emdash-cms/emdash#1273).
			database: d1({ binding: "DB" }),
			storage: r2({ binding: "MEDIA" }),
			// Client-delivered editor toolbar so public HTML stays cacheable.
			toolbar: "client",
			authProviders: [google()],
			plugins: [
				atxrrExtensions(),
				// Sends from a dedicated subdomain rather than the apex: the apex
				// already runs Email Routing, and onboarding it for sending would
				// rewrite the SPF record that inbound forwarding depends on.
				cloudflareEmail({
					from: {
						email: "cms@mail.atxrubberroundup.com",
						name: "ATX Rubber Roundup",
					},
					replyTo: "info@atxrubberroundup.com",
				}),
			],
		}),
	],
	output: "server",
	adapter: cloudflare({
		// Bundled assets pre-optimized at build; CMS media resized at runtime.
		// Plain "compile" provisions no IMAGES binding in production, so EmDash
		// streams R2 originals unresized.
		imageService: { runtime: "cloudflare-binding" },
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
