import { defineConfig } from "@playwright/test";

const BASE_URL = "http://localhost:4321/";

export default defineConfig({
	testDir: "./e2e",
	// Astro's guide points webServer at `preview`, but the admin flow signs in
	// through EmDash's dev bypass, which is gated on import.meta.env.DEV.
	webServer: {
		command: "pnpm dev",
		url: BASE_URL,
		timeout: 120 * 1000,
		reuseExistingServer: !process.env.CI,
		// Astro detaches the dev server when it detects an AI agent environment,
		// which reads to Playwright as "webServer exited early". This is the flag
		// Astro itself uses to mark a process as already-backgrounded, so setting
		// it keeps the server in the foreground where Playwright can manage it.
		env: { ASTRO_DEV_BACKGROUND: "1" },
	},
	// Dev compiles a route on first hit and the admin bundle is large, so the
	// first test to reach it needs more than the 30s default.
	timeout: 90 * 1000,
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
	},
});
