import { buttonVariants } from "../ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "../ui/card";
import { Tabs, TabsTrigger, TabsList, TabsContent } from "../ui/tabs";
import type { Event } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { useStore } from "@nanostores/react";
import { createSearchParams } from "@nanostores/router";
import { groupBy, sortBy } from "lodash-es";
import { marked } from "marked";
import { useMemo } from "react";

const dateFormatter = new Intl.DateTimeFormat(["en-US"], {
	weekday: "long",
});
const timeFormatter = new Intl.DateTimeFormat(["en-US"], {
	timeStyle: "short",
});

marked.use({
	renderer: {
		link(href, title, text) {
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

const $searchParams = createSearchParams();

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

				return {
					...event,
					weekday: parts.find((part) => part.type === "weekday")!.value,
					timeDisplay: timeFormatter.formatRange(start, end),
					start,
					end,
					startPart: timeParts
						.filter((part) => part.source === "startRange")!
						.map((part) => part.value)
						.join(""),
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

	const params = useStore($searchParams);
	const merged = { ...astroParams, ...params };
	const selectedWeekday =
		merged.day && weekdayKeys.includes(merged.day)
			? merged.day
			: weekdayKeys[0];

	return (
		<Tabs
			defaultValue={selectedWeekday}
			onValueChange={(newValue) =>
				$searchParams.open({ ...params, day: newValue })
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
							<p>{event.location}</p>
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
