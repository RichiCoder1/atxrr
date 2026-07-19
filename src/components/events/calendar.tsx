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
import { useMemo } from "react";

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
};

const $router = createRouter(
	{
		home: "/",
		events: "/events",
	},
	{ links: false },
);

export function Calendar({ events, params: astroParams }: CalendarProps) {
	const weekdays = useMemo(() => {
		const extendedEvents = sortBy(events, (event) => event.event_start).map(
			(event) => {
				const [start, end] = [
					parseEventTime(event.event_start),
					parseEventTime(event.event_end),
				];
				const parts = dateFormatter.formatToParts(start);
				const timeParts = timeFormatter.formatRangeToParts(start, end);

				const dayPeriod = timeParts.find(
					(part) => part.type === "dayPeriod" && part.source === "shared",
				)?.value;

				const timeStart = timeParts.findIndex(
					(part) => part.type === "hour" && part.source === "startRange",
				);
				timeParts.splice(0, timeStart);

				return {
					...event,
					weekday: parts.find((part) => part.type === "weekday")!.value,
					timeDisplay: timeFormatter.formatRange(start, end),
					start,
					end,
					startPart:
						timeParts
							.filter((part) => part.source === "startRange")!
							.map((part) => part.value)
							.join("") + (dayPeriod ? ` ${dayPeriod}` : ""),
					endPart: timeParts
						.filter((part) => part.source !== "startRange")!
						.map((part) => part.value)
						.join(""),
				} satisfies CalendarEvent;
			},
		);
		return groupBy(extendedEvents, (event) => event.weekday);
	}, [events]);
	const weekdayKeys = Object.keys(weekdays);

	const page = useStore($router);
	const merged = { ...astroParams, ...page?.search };
	const selectedWeekday =
		merged.day && weekdayKeys.includes(merged.day)
			? merged.day
			: weekdayKeys[0];

	return (
		<Tabs
			defaultValue={selectedWeekday}
			onValueChange={(newValue) =>
				openPage($router, "events", {}, { ...page?.search, day: newValue })
			}
			className="flex flex-col items-center my-4"
		>
			<TabsList>
				{weekdayKeys.map((weekday) => (
					<TabsTrigger key={weekday} value={weekday}>
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
		<TabsContent value={weekday} className="flex flex-col gap-2 w-full">
			{events.map((event) => (
				<Card
					key={event.id}
					className="w-full rounded-sm p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"
				>
					<div>
						<div className="text-primary leading-none text-2xl font-semibold">
							{event.startPart}
						</div>
						<div className="text-sm font-light">{event.endPart}</div>
					</div>
					<div>
						<CardTitle>{event.name}</CardTitle>
						{/* CardDescription already renders a <p>; nesting another inside it
						    is invalid HTML, and the parser's fixup made the client DOM
						    diverge from the SSR markup (React #418). These children are
						    inline, so they belong directly in the description. */}
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
