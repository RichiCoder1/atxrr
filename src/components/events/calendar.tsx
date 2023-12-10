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
				console.log({ timeParts });
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
					className="w-full rounded-sm p-4 flex flex-row gap-4"
				>
					<div>
						<div className="text-primary text-2xl font-semibold">
							{event.startPart}
						</div>
						<div className="text-sm font-light">{event.endPart}</div>
					</div>
					<div>
						<CardTitle>{event.name}</CardTitle>
						<CardDescription className="pt-1">
							<p>{event.location}</p>
						</CardDescription>
						<CardContent className="pl-0 pt-1">
							<div
								dangerouslySetInnerHTML={{
									__html: marked.parse(event.description),
								}}
							></div>
						</CardContent>
					</div>
				</Card>
			))}
		</TabsContent>
	);
}
