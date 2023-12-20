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

export interface About {
	id: number;
	body: string;
}

export interface Qna {
	id: number;
	status: string;
	question: string;
	answer: string;
}

export interface Schema {
	events: Event[];
	qna: Qna[];
	about: About;
}
