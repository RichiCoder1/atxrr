import { Calendar, type CalendarEventItem } from "./calendar";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// The nanostores router is module-level, so a test that selects a day leaves
// ?day= set for the next one. Reset the URL and notify the store between tests.
beforeEach(() => {
	window.history.replaceState({}, "", "/events");
	window.dispatchEvent(new PopStateEvent("popstate"));
});

function event(over: Partial<CalendarEventItem> = {}): CalendarEventItem {
	return {
		id: "demo",
		name: "Demo Event",
		event_start: "2026-02-20T18:00:00",
		event_end: "2026-02-20T20:00:00",
		venueTitle: "Skyline",
		description: [],
		...over,
	};
}

/** Portable Text block wrapping a single line of plain text. */
function block(text: string) {
	return {
		_type: "block",
		_key: text,
		children: [{ _type: "span", _key: `${text}-0`, text }],
	};
}

const renderCalendar = (events: CalendarEventItem[]) =>
	render(<Calendar events={events} params={{}} />);

const saturday = {
	event_start: "2026-02-21T10:00:00",
	event_end: "2026-02-21T11:00:00",
};

describe("weekday tabs", () => {
	it("renders one tab per weekday present, in event order", async () => {
		const screen = await renderCalendar([
			event({ id: "fri" }),
			event({ id: "sat", ...saturday }),
		]);

		await expect.element(screen.getByRole("tab", { name: "Friday" })).toBeVisible();
		await expect.element(screen.getByRole("tab", { name: "Saturday" })).toBeVisible();
		expect(screen.getByRole("tab").all()).toHaveLength(2);
	});

	it("selects the first weekday by default", async () => {
		const screen = await renderCalendar([
			event({ id: "fri" }),
			event({ id: "sat", ...saturday }),
		]);

		await expect
			.element(screen.getByRole("tab", { name: "Friday" }))
			.toHaveAttribute("aria-selected", "true");
	});

	it("switches the selected day on click", async () => {
		const screen = await renderCalendar([
			event({ id: "fri", name: "Friday Thing" }),
			event({ id: "sat", name: "Saturday Thing", ...saturday }),
		]);

		await screen.getByRole("tab", { name: "Saturday" }).click();

		await expect
			.element(screen.getByRole("tab", { name: "Saturday" }))
			.toHaveAttribute("aria-selected", "true");
		await expect.element(screen.getByText("Saturday Thing")).toBeVisible();
	});

	it("shows only the selected day's events", async () => {
		const screen = await renderCalendar([
			event({ id: "fri", name: "Friday Thing" }),
			event({ id: "sat", name: "Saturday Thing", ...saturday }),
		]);

		await expect.element(screen.getByText("Friday Thing")).toBeVisible();
		await expect.element(screen.getByText("Saturday Thing")).not.toBeInTheDocument();
	});
});

describe("time formatting", () => {
	it("collapses a shared meridiem for a same-day event", async () => {
		const screen = await renderCalendar([event()]);

		await expect.element(screen.getByText("6:00 PM")).toBeVisible();
		await expect.element(screen.getByText("– 8:00 PM")).toBeVisible();
	});

	it("omits the calendar date when an event crosses midnight", async () => {
		const screen = await renderCalendar([
			event({ event_start: "2026-02-20T22:00:00", event_end: "2026-02-21T02:00:00" }),
		]);

		await expect.element(screen.getByText("10:00 PM")).toBeVisible();
		await expect.element(screen.getByText("– 2:00 AM")).toBeVisible();
		// The overflow bug: formatRange widens to "– 2/21/2026, 2:00 AM".
		await expect.element(screen.getByText(/2\/21\/2026/)).not.toBeInTheDocument();
	});

	it("keeps the time column from overflowing its card", async () => {
		const screen = await renderCalendar([
			event({ event_start: "2026-02-20T22:00:00", event_end: "2026-02-21T02:00:00" }),
		]);
		await expect.element(screen.getByText("– 2:00 AM")).toBeVisible();

		const card = screen.getByText("Demo Event").element().closest("[data-slot=card]");
		expect(card).not.toBeNull();
		expect(card!.scrollWidth).toBeLessThanOrEqual(card!.clientWidth);
	});

	it("throws when an event has no duration", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			renderCalendar([
				event({
					name: "Zero Length",
					event_start: "2026-02-20T18:00:00",
					event_end: "2026-02-20T18:00:00",
				}),
			]),
		).rejects.toThrow(/Zero Length[\s\S]*no duration/);
		quiet.mockRestore();
	});

	it("throws when an event ends before it starts", async () => {
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			renderCalendar([
				event({
					event_start: "2026-02-21T22:00:00",
					event_end: "2026-02-21T02:00:00",
				}),
			]),
		).rejects.toThrow(/no duration/);
		quiet.mockRestore();
	});
});

describe("search", () => {
	it("matches against the description as well as the name", async () => {
		const screen = await renderCalendar([
			event({ id: "a", name: "Latex Lounge" }),
			event({
				id: "c",
				name: "Rope Demo",
				description: [block("harness tying")],
			}),
		]);

		await screen.getByRole("searchbox", { name: /search events/i }).fill("harness");

		await expect.element(screen.getByText("Rope Demo")).toBeVisible();
		await expect.element(screen.getByText("Latex Lounge")).not.toBeInTheDocument();
	});

	it("matches against the venue", async () => {
		const screen = await renderCalendar([
			event({ id: "a", name: "Latex Lounge", venueTitle: "Skyline" }),
			event({ id: "b", name: "Gear Swap", venueTitle: "Eagle" }),
		]);

		await screen.getByRole("searchbox", { name: /search events/i }).fill("eagle");

		await expect.element(screen.getByText("Gear Swap")).toBeVisible();
		await expect.element(screen.getByText("Latex Lounge")).not.toBeInTheDocument();
	});

	it("reports when nothing matches", async () => {
		const screen = await renderCalendar([event()]);

		await screen
			.getByRole("searchbox", { name: /search events/i })
			.fill("nothingmatchesthis");

		await expect.element(screen.getByText(/No events match/)).toBeVisible();
	});
});
