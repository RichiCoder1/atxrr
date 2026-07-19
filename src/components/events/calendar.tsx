import { buttonVariants } from "../ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "../ui/card";
import { Tabs, TabsTrigger, TabsList, TabsContent } from "../ui/tabs";
import { cn } from "@/lib/utils";
import { useStore } from "@nanostores/react";
import { createRouter, openPage } from "@nanostores/router";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { TypedObject } from "@portabletext/types";
import slugify from "@sindresorhus/slugify";
import { groupBy, sortBy } from "lodash-es";
import { Check, Link2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Event times are stored as naive wall-clock at the venue ("2026-02-20T18:00:00",
 * no zone). `new Date` reads those as the *runtime's* local zone, so the server
 * (UTC) and the browser (Central) built different instants and rendered
 * different text — the React #418 hydration mismatch on this page.
 *
 * Parsing as UTC and formatting in UTC round-trips the stored wall clock
 * verbatim and identically in both places. That is also the behaviour an
 * attendee wants: doors at 6 PM means 6 PM in Austin, not shifted into
 * whatever zone they happen to be browsing from.
 */
function parseEventTime(value: string): Date {
	const hasZone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(value);
	return new Date(hasZone ? value : `${value}Z`);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
	timeStyle: "short",
	timeZone: "UTC",
});

/**
 * Split an event's time range into the large start label and the smaller end
 * label shown beside it.
 *
 * The subtlety is `formatRange`: given a range that stays inside one day it
 * collapses the shared meridiem ("6:00 – 8:00 PM"), but the moment the range
 * crosses midnight it silently switches to including the *calendar date* on
 * both sides — "2/20/2026, 10:00 PM – 2/21/2026, 2:00 AM" — even though this
 * formatter only asked for `timeStyle`. That string is roughly three times
 * longer than the same-day one and blew out the fixed `auto` time column.
 *
 * So the collapsing path is used only when it is actually safe (same day), and
 * day-crossing events format each endpoint on its own. `crossesMidnight` is
 * returned so the caller can label the end time as landing on the next day —
 * dropping the date entirely would otherwise make a 10 PM–2 AM party read as a
 * sixteen-hour one.
 */
function formatTimeRange(start: Date, end: Date) {
	// Compared in UTC because event times are parsed as UTC wall-clock; see
	// `parseEventTime`. Using local getters here would reintroduce the drift.
	const crossesMidnight =
		start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10);
	const isInstant = start.getTime() === end.getTime();

	if (crossesMidnight || isInstant) {
		return {
			startPart: timeFormatter.format(start),
			// A zero-length event has no meaningful end to show. `formatRange`
			// used to emit the whole range here, leaving the start label as a
			// bare " PM", because its start-of-range lookup found no hour part.
			endPart: isInstant ? "" : `– ${timeFormatter.format(end)}`,
			crossesMidnight,
		};
	}

	const timeParts = timeFormatter.formatRangeToParts(start, end);
	const dayPeriod = timeParts.find(
		(part) => part.type === "dayPeriod" && part.source === "shared",
	)?.value;
	const timeStart = timeParts.findIndex(
		(part) => part.type === "hour" && part.source === "startRange",
	);
	timeParts.splice(0, timeStart);

	return {
		startPart:
			timeParts
				.filter((part) => part.source === "startRange")
				.map((part) => part.value)
				.join("") + (dayPeriod ? ` ${dayPeriod}` : ""),
		endPart: timeParts
			.filter((part) => part.source !== "startRange")
			.map((part) => part.value)
			.join("")
			.trim(),
		crossesMidnight,
	};
}

/**
 * Flatten Portable Text to plain text so descriptions are searchable. Only
 * span children carry text; anything else (images, embeds) has nothing to match.
 */
function blocksToPlainText(blocks: TypedObject[] | undefined): string {
	if (!Array.isArray(blocks)) return "";
	const parts: string[] = [];
	for (const block of blocks) {
		const children = (block as { children?: unknown }).children;
		if (!Array.isArray(children)) continue;
		for (const child of children) {
			const text = (child as { text?: unknown }).text;
			if (typeof text === "string") parts.push(text);
		}
	}
	return parts.join(" ");
}

const richTextComponents: PortableTextComponents = {
	marks: {
		link: ({ value, children }) => (
			<a
				href={value?.href}
				className={cn(
					buttonVariants({
						variant: "link",
					}),
					"h-[unset] p-0 underline hover:text-primary/80",
				)}
			>
				{children}
			</a>
		),
	},
};

export type CalendarEventItem = {
	id: string;
	name: string;
	event_start: string;
	event_end: string;
	location?: string;
	venueTitle: string;
	description: TypedObject[];
};

export type CalendarProps = {
	events: CalendarEventItem[];
	params: Record<string, string | undefined>;
};

type CalendarEvent = CalendarEventItem & {
	weekday: string;
	timeDisplay: string;
	start: Date;
	end: Date;
	startPart: string;
	endPart: string;
	/** End time lands on the day after the start; the card labels it as such. */
	crossesMidnight: boolean;
	/** Pre-lowercased haystack for filtering. */
	searchText: string;
};

const $router = createRouter(
	{
		home: "/",
		events: "/events",
	},
	{ links: false },
);

export function Calendar({ events, params: astroParams }: CalendarProps) {
	// Search stays in component state rather than the URL. Workers Cache keys on
	// the full query string, so syncing every keystroke would mint an unbounded
	// number of cache entries for what is throwaway UI state. Sharing a specific
	// event is handled by `?event=`, which is a bounded, meaningful set of URLs.
	const [query, setQuery] = useState("");

	const allEvents = useMemo(
		() =>
			sortBy(events, (event) => event.event_start).map((event) => {
				const [start, end] = [
					parseEventTime(event.event_start),
					parseEventTime(event.event_end),
				];
				const parts = dateFormatter.formatToParts(start);
				const { startPart, endPart, crossesMidnight } = formatTimeRange(
					start,
					end,
				);

				return {
					...event,
					weekday: parts.find((part) => part.type === "weekday")!.value,
					timeDisplay: timeFormatter.formatRange(start, end),
					start,
					end,
					startPart,
					endPart,
					crossesMidnight,
					searchText: [
						event.name,
						event.venueTitle,
						event.location,
						blocksToPlainText(event.description),
					]
						.filter(Boolean)
						.join(" ")
						.toLowerCase(),
				} satisfies CalendarEvent;
			}),
		[events],
	);

	const page = useStore($router);
	// Params come from Astro until hydration finishes, then from the router.
	//
	// Both halves matter. Merging the two (`{...astroParams, ...page.search}`)
	// makes params sticky — spreading can add or override a key but never remove
	// one, so clearing `?event=` left the server-rendered value in place and the
	// filter never lifted. But reading the router straight away does not work
	// either: during SSR it yields an *empty* search rather than undefined, which
	// silently dropped the deep link from the no-JS render and then mismatched on
	// hydration. Deferring the handover keeps the first client render identical
	// to the server's.
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	const merged = hydrated ? (page?.search ?? {}) : astroParams;
	const focusedSlug = merged.event;

	const visibleEvents = useMemo(() => {
		let list = allEvents;
		if (focusedSlug) {
			list = list.filter((event) => event.id === focusedSlug);
		}
		const trimmed = query.trim().toLowerCase();
		if (trimmed) {
			// Every term must match somewhere, so "demo friday" narrows rather than
			// widens — closer to what people expect than matching the raw string.
			const terms = trimmed.split(/\s+/);
			list = list.filter((event) =>
				terms.every((term) => event.searchText.includes(term)),
			);
		}
		return list;
	}, [allEvents, focusedSlug, query]);

	const weekdays = useMemo(
		() => groupBy(visibleEvents, (event) => event.weekday),
		[visibleEvents],
	);
	const weekdayKeys = Object.keys(weekdays);

	// Tabs must be controlled: filtering changes which weekdays exist, and an
	// uncontrolled `defaultValue` would keep pointing at a tab that no longer
	// renders. Falling back to the first available day means a search that only
	// matches Sunday switches to Sunday instead of showing an empty Friday.
	const selectedWeekday =
		merged.day && weekdayKeys.includes(merged.day) ? merged.day : weekdayKeys[0];

	// `merged` can carry undefined values (Astro params are optional); the router
	// only accepts defined ones.
	const defined = (input: Record<string, string | undefined>) =>
		Object.fromEntries(
			Object.entries(input).filter(
				(entry): entry is [string, string] => entry[1] !== undefined,
			),
		);

	const clearFocus = () => {
		const { event: _event, ...rest } = merged;
		openPage($router, "events", {}, defined(rest));
	};

	return (
		<div className="my-4 flex w-full flex-col items-center gap-4">
			<div className="flex w-full max-w-md flex-col gap-2">
				<div className="relative">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60"
					/>
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search events, venues, descriptions…"
						aria-label="Search events"
						className="w-full rounded-sm border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					/>
				</div>
				{focusedSlug ? (
					<div className="flex items-center justify-between gap-2 text-sm">
						<span>Showing a single event.</span>
						<button
							type="button"
							onClick={clearFocus}
							className={cn(
								buttonVariants({ variant: "link" }),
								"h-[unset] p-0 underline",
							)}
						>
							Show all events
						</button>
					</div>
				) : null}
				{/* Announce result counts to screen readers as the list narrows. */}
				<p aria-live="polite" className="sr-only">
					{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}{" "}
					shown
				</p>
			</div>

			{visibleEvents.length === 0 ? (
				<p className="py-8 text-center">
					{focusedSlug && !query ? (
						<>
							No event matches that link.{" "}
							<button
								type="button"
								onClick={clearFocus}
								className={cn(
									buttonVariants({ variant: "link" }),
									"h-[unset] p-0 underline",
								)}
							>
								Show all events
							</button>
						</>
					) : (
						<>No events match “{query.trim()}”.</>
					)}
				</p>
			) : (
				<Tabs
					selectedKey={selectedWeekday ?? null}
					onSelectionChange={(key) =>
						openPage(
							$router,
							"events",
							{},
							defined({ ...merged, day: String(key) }),
						)
					}
					className="flex w-full flex-col items-center"
				>
					<TabsList>
						{weekdayKeys.map((weekday) => (
							<TabsTrigger key={weekday} id={weekday}>
								{weekday}
							</TabsTrigger>
						))}
					</TabsList>
					{weekdayKeys.map((weekday) => (
						<CalendarWeekday
							key={weekday}
							weekday={weekday}
							events={weekdays[weekday]}
						/>
					))}
				</Tabs>
			)}
		</div>
	);
}

function CopyEventLink({ slug, name }: { slug: string; name: string }) {
	const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

	const copy = async () => {
		// Built at click time, not render: reading `location` during render would
		// differ between the server and the browser.
		const url = `${window.location.origin}/events?event=${encodeURIComponent(slug)}`;
		try {
			await navigator.clipboard.writeText(url);
			setState("copied");
		} catch {
			// Clipboard access can be refused (permissions, insecure context).
			setState("failed");
		}
		window.setTimeout(() => setState("idle"), 2000);
	};

	return (
		<button
			type="button"
			onClick={copy}
			aria-label={`Copy link to ${name}`}
			title={state === "failed" ? "Copy failed" : "Copy link to this event"}
			className="shrink-0 rounded-sm p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			{state === "copied" ? (
				<Check aria-hidden="true" className="h-4 w-4 text-primary" />
			) : (
				<Link2 aria-hidden="true" className="h-4 w-4" />
			)}
			<span aria-live="polite" className="sr-only">
				{state === "copied"
					? "Link copied"
					: state === "failed"
						? "Copy failed"
						: ""}
			</span>
		</button>
	);
}

function CalendarWeekday({
	events,
	weekday,
}: {
	events: CalendarEvent[];
	weekday: string;
}) {
	return (
		<TabsContent id={weekday} className="flex flex-col gap-2 w-full">
			{events.map((event) => (
				<Card
					key={event.id}
					className="w-full rounded-sm p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"
				>
					{/* `min-w-0` lets this track shrink instead of forcing the card
					    wider than its container on narrow viewports. */}
					<div className="min-w-0">
						<div className="text-primary leading-none text-2xl font-semibold whitespace-nowrap">
							{event.startPart}
						</div>
						<div className="text-sm font-light whitespace-nowrap">
							{event.endPart}
							{event.crossesMidnight && (
								<>
									{" "}
									<span
										// Visually terse so the column stays narrow; the full
										// wording is what assistive tech announces.
										aria-hidden="true"
										title="Ends the next day"
										className="text-muted-foreground"
									>
										+1d
									</span>
									<span className="sr-only"> the next day</span>
								</>
							)}
						</div>
					</div>
					<div>
						<div className="flex items-start justify-between gap-2">
							<CardTitle>{event.name}</CardTitle>
							<CopyEventLink slug={event.id} name={event.name} />
						</div>
						{/* Children stay inline here. CardDescription renders a <div> as
						    of the React Aria rewrite, so the old invalid-nested-<p> hazard
						    (React #418) is gone, but there is still nothing to gain from
						    wrapping these in a block element. */}
						<CardDescription className="pt-1">
							{event.venueTitle ? (
								<a href={`/attend/getting-around#${slugify(event.venueTitle)}`}>
									{event.venueTitle}
								</a>
							) : null}
							{event.location ? <span> | {event.location}</span> : null}
						</CardDescription>
					</div>
					<CardContent className="pl-0 col-start-auto col-span-2 md:col-start-2 md:col-span-1">
						<div>
							<PortableText
								value={event.description}
								components={richTextComponents}
							/>
						</div>
					</CardContent>
				</Card>
			))}
		</TabsContent>
	);
}
