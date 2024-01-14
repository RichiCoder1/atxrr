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

export interface Person {
	id: number;
	sort: number;
	display_name: string;
	bio: string;
	profile_pic: string;
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
	vendors: Vendor[];
	sponsors: Sponsor[];
	people: Person[];
	vendor_page: VendorPage;
}

export interface Sponsor {
	id: number;
	name: string;
	website: string;
	logo: string;
	info: string;
	invert_logo: boolean;
}

export interface Vendor {
	id: number;
	name: string;
	website: string;
	logo: string;
	info: string;
}

export interface VendorPage {
	id: number;
	title: string;
	body: string;
}
