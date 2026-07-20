/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Astro documents `getViteConfig()` for this, but it loads astro.config.mjs and
 * with it the Cloudflare adapter's Vite plugin, which rejects the
 * `resolve.external` Vitest sets on the ssr environment. The components under
 * test are plain React, so a standalone config plus the `@` alias is enough.
 *
 * A real browser rather than jsdom: React Aria and Ariakit both depend on APIs
 * jsdom lacks (CSS.escape, CSS.supports) and on real layout for visibility. The
 * Tailwind plugin is required for that last part — see src/test-setup.ts.
 */
export default defineConfig({
	plugins: [tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		testTimeout: 2000,
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["./src/test-setup.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});
