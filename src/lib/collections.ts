export interface Event {
	id: number;
	status: string;
	event_start: string;
	event_end: string;
	name: string;
	location?: string;
	description: string;
	tags: string[];
}

export interface Schema {
	events: Event[];
}
