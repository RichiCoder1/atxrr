import { expect, test } from "@playwright/test";

const ADMIN = "/_emdash/admin";
// Signs in as a seeded admin, skipping passkey setup. Dev-only — see the
// webServer note in playwright.config.ts.
const BYPASS = "/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin";

/**
 * Islands hydrate after load, so an interaction can land before React attaches
 * and be silently lost. Repeat it until the effect shows up; every `act` passed
 * here is idempotent.
 */
async function retryUntil(act: () => Promise<void>, settled: () => Promise<boolean>) {
	await expect
		.poll(async () => {
			await act();
			return settled();
		})
		.toBe(true);
}

test.describe("event schedule", () => {
	test("renders a tab per event day, with the first selected", async ({ page }) => {
		await page.goto("/events");

		await expect(page.getByRole("tab").first()).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(await page.getByRole("tab").count()).toBeGreaterThan(0);
		expect(await page.locator("[data-slot=card]").count()).toBeGreaterThan(0);
	});

	test("swaps the visible events when another day is selected", async ({ page }) => {
		await page.goto("/events");
		const before = await page.getByRole("tabpanel").innerText();

		const second = page.getByRole("tab").nth(1);
		await retryUntil(
			() => second.click(),
			async () => (await second.getAttribute("aria-selected")) === "true",
		);

		expect(await page.getByRole("tabpanel").innerText()).not.toBe(before);
	});

	test("filters events by search and reports an empty result", async ({ page }) => {
		await page.goto("/events");
		const cards = page.locator("[data-slot=card]");
		expect(await cards.count()).toBeGreaterThan(0);

		const search = page.getByRole("searchbox", { name: "Search events" });
		await retryUntil(
			() => search.fill("zzzznope"),
			async () => (await cards.count()) === 0,
		);

		await expect(page.getByText(/No events match/)).toBeVisible();
	});
});

test.describe("admin", () => {
	test("signs in through the dev bypass and loads the dashboard", async ({ page }) => {
		await page.goto(BYPASS);

		await page.waitForURL(`**${ADMIN}`);
		await expect(page.locator("#admin-root")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Dashboard" }).first(),
		).toBeVisible();
	});

	test("lists event entries in the events collection", async ({ page }) => {
		await page.goto(BYPASS);
		await page.waitForURL(`**${ADMIN}`);

		await page.goto(`${ADMIN}/content/events`);

		await expect(page.locator("#admin-root h1")).toHaveText("Events");
		await expect(
			page.locator("#admin-root table tbody tr").first(),
		).toBeVisible();
	});
});
