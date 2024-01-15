export interface Event {
	id: number;
	status: string;
	event_start: string;
	event_end: string;
	name: string;
	venue: number | Venue;
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
	getting_around_page: GettingAroundPage;
	venues: Venue[];
	sponsors_page: SponsorsPage;
	contact_page: ContactPage;
}

export interface Sponsor {
	id: number;
	sort: number;
	name: string;
	website: string;
	logo: string;
	info: string;
	invert_logo: boolean;
	tags: string[];
}

export interface Vendor {
	id: number;
	name: string;
	website: string;
	logo: string;
	info: string;
	sort: number;
}

export interface VendorPage {
	id: number;
	title: string;
	body: string;
}

export interface GettingAroundPage {
	id: number;
	date_updated: string;
	title: string;
	body: string;
}

export interface Venue {
	id: number;
	status: string;
	sort: number;
	title: string;
	body: string;
	address: string;
	maps_embed?: string;
}

export interface SponsorsPage {
	id: number;
	body: string;
}

export interface ContactPage {
	id: number;
	Information: string;
}
