import { DesktopMenu, MobileMenu, type NavItem } from "./NavMenu";
import { describe, expect, it, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

function item(over: Partial<NavItem> = {}): NavItem {
	return { id: "home", label: "Home", url: "/", children: [], ...over };
}

const items: NavItem[] = [
	item(),
	item({
		id: "attend",
		label: "Attend",
		url: "/",
		children: [
			item({
				id: "around",
				label: "Getting Around",
				url: "/attend/getting-around",
			}),
			item({
				id: "hotel",
				label: "Hotel Reservations",
				url: "https://example.com/hotel",
				target: "_blank",
			}),
		],
	}),
	item({ id: "about", label: "About Us", url: "/about" }),
];

// With real CSS loaded the two menus are mutually exclusive across the `lg`
// breakpoint (1024px): DesktopMenu is `hidden lg:flex`, MobileMenu's toggle and
// drawer are `lg:hidden`. Each suite must run at a width where its menu shows.
describe("DesktopMenu", () => {
	beforeEach(async () => {
		await page.viewport(1280, 800);
	});

	it("renders every top-level item", async () => {
		const screen = await render(<DesktopMenu path="/" items={items} />);

		for (const label of ["Home", "Attend", "About Us"]) {
			await expect.element(screen.getByText(label)).toBeVisible();
		}
	});

	it("links items that have a url", async () => {
		const screen = await render(<DesktopMenu path="/" items={items} />);

		await expect
			.element(screen.getByRole("menuitem", { name: "About Us" }))
			.toHaveAttribute("href", "/about");
	});

	it("marks the current page", async () => {
		const screen = await render(<DesktopMenu path="/about" items={items} />);

		await expect
			.element(screen.getByRole("menuitem", { name: "About Us" }))
			.toHaveAttribute("aria-current", "page");
	});

	it("leaves other items unmarked rather than aria-current=false", async () => {
		const screen = await render(<DesktopMenu path="/about" items={items} />);

		await expect
			.element(screen.getByRole("menuitem", { name: "Home" }))
			.not.toHaveAttribute("aria-current");
	});

	it("reveals child items when a parent menu opens", async () => {
		const screen = await render(<DesktopMenu path="/" items={items} />);
		await expect
			.element(screen.getByText("Getting Around"))
			.not.toBeInTheDocument();

		await screen.getByRole("menuitem", { name: "Attend" }).hover();

		await expect.element(screen.getByText("Getting Around")).toBeVisible();
		await expect.element(screen.getByText("Hotel Reservations")).toBeVisible();
	});
});

describe("MobileMenu", () => {
	beforeEach(async () => {
		await page.viewport(390, 844);
	});

	it("keeps the drawer hidden until the toggle is pressed", async () => {
		const screen = await render(<MobileMenu path="/" items={items} />);

		// This Dialog has no `unmountOnHide`, so the drawer's contents stay in the
		// DOM while closed — hidden, not absent.
		await expect.element(screen.getByText("About Us")).not.toBeVisible();
	});

	it("opens the drawer and lists the navigation", async () => {
		const screen = await render(<MobileMenu path="/" items={items} />);
		const toggle = screen.getByRole("button").first();
		await expect.element(toggle).toHaveAttribute("aria-expanded", "false");

		await toggle.click();

		await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
		await expect.element(screen.getByText("About Us")).toBeVisible();
		await expect.element(screen.getByText("Attend")).toBeVisible();
	});

	// Not via the toggle: the dialog is modal, and its backdrop (inset: 0) covers
	// the X, so a tap there lands on the backdrop and dismisses the dialog rather
	// than firing the button. Escape is the path that is actually reachable.
	it("closes on Escape and re-syncs the toggle", async () => {
		const screen = await render(<MobileMenu path="/" items={items} />);
		const toggle = screen.getByRole("button").first();
		await toggle.click();
		await expect.element(screen.getByText("About Us")).toBeVisible();

		await userEvent.keyboard("{Escape}");

		await expect.element(screen.getByText("About Us")).not.toBeVisible();
		await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
	});

	it("expands a parent to reveal its children", async () => {
		const screen = await render(<MobileMenu path="/" items={items} />);
		await screen.getByRole("button").first().click();

		await screen.getByRole("button", { name: "Attend" }).click();

		await expect.element(screen.getByText("Getting Around")).toBeVisible();
	});
});
