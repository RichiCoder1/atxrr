import { expect, test, type Page } from "@playwright/test";

const ADMIN = "/_emdash/admin";
// Signs in as a seeded admin, skipping passkey setup. Dev-only — see the
// webServer note in playwright.config.ts.
const BYPASS = "/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin";

/**
 * Open the schedule and wait for its island to hydrate — Astro drops the `ssr`
 * attribute once it has — so a click can't land before React attaches and be
 * silently dropped. Scoped to this one island on purpose: the mobile nav is
 * `client:visible` and never hydrates at a desktop viewport, so waiting on
 * every island would hang.
 */
async function gotoSchedule(page: Page) {
	await page.goto("/events");
	await page
		.locator("astro-island:not([ssr])")
		.filter({ has: page.getByRole("tablist") })
		.waitFor();
}

test.describe("event schedule", () => {
	test("renders a tab per event day, with the first selected", async ({ page }) => {
		await gotoSchedule(page);

		expect(await page.getByRole("tab").count()).toBeGreaterThan(0);
		await expect(page.getByRole("tab").first()).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(page.locator("[data-slot=card]").first()).toBeVisible();
	});

	test("swaps the visible events when another day is selected", async ({ page }) => {
		await gotoSchedule(page);
		const panel = page.getByRole("tabpanel");
		const before = await panel.innerText();

		const second = page.getByRole("tab").nth(1);
		await second.click();

		await expect(second).toHaveAttribute("aria-selected", "true");
		await expect(panel).not.toHaveText(before);
	});

	test("filters events by search and reports an empty result", async ({ page }) => {
		await gotoSchedule(page);
		const cards = page.locator("[data-slot=card]");
		expect(await cards.count()).toBeGreaterThan(0);

		await page.getByRole("searchbox", { name: "Search events" }).fill("zzzznope");

		await expect(cards).toHaveCount(0);
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
