import { buttonVariants } from "../ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "../ui/card";
import { Tabs, TabsTrigger, TabsList, TabsContent } from "../ui/tabs";
import type { Event, Venue } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { useStore } from "@nanostores/react";
import { createRouter, openPage } from "@nanostores/router";
import slugify from "@sindresorhus/slugify";
import { groupBy, sortBy } from "lodash-es";
import { marked } from "marked";
import { useMemo } from "react";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
	timeStyle: "short",
});

marked.use({
	renderer: {
		link({ href, title, text }) {
			return `<a href="${href}" title="${title ?? ""}" class="${cn(
				buttonVariants({
					variant: "link",
				}),
				"h-[unset] p-0 underline hover:text-primary/80",
			)}">${text}</a>`;
		},
	},
});

export type CalendarProps = {
	events: Event[];
	params: Record<string, string | undefined>;
};

type CalendarEvent = Event & {
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
					new Date(event.event_start),
					new Date(event.event_end),
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
						<CardDescription className="pt-1">
							<p>
								<a
									href={`/attend/getting-around#${slugify(
										(event.venue as Venue).title,
									)}`}
								>
									{(event.venue as Venue).title}
								</a>
								{event.location ? <span> | {event.location}</span> : null}
							</p>
						</CardDescription>
					</div>
					<CardContent className="pl-0 col-start-auto col-span-2 md:col-start-2 md:col-span-1">
						<div
							dangerouslySetInnerHTML={{
								__html: marked.parse(event.description),
							}}
						></div>
					</CardContent>
				</Card>
			))}
		</TabsContent>
	);
}
