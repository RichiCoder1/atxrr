/**
 * Destination schema for the migrated collections. multiSelect option sets
 * are computed from the actual Directus data so validation never rejects a
 * migrated value.
 */

export interface FieldPlan {
	slug: string;
	label: string;
	type: string;
	required?: boolean;
	options?: Record<string, unknown>;
	sortOrder?: number;
}

export interface CollectionPlan {
	slug: string;
	label: string;
	labelSingular?: string;
	fields: FieldPlan[];
}

const DIRECTUS_ID: FieldPlan = {
	slug: "directus_id",
	label: "Directus ID",
	type: "integer",
};

const SORT: FieldPlan = { slug: "sort", label: "Sort", type: "integer" };

export function distinctTags(items: Array<{ tags?: string[] | null }>): string[] {
	const tags = new Set<string>();
	for (const item of items) for (const tag of item.tags ?? []) tags.add(tag);
	return [...tags].sort();
}

function multiSelect(slug: string, values: string[]): FieldPlan {
	return {
		slug,
		label: "Tags",
		type: "multiSelect",
		options: { options: values.length > 0 ? values : ["untagged"] },
	};
}

export function buildSchemaPlan(source: {
	eventTags: string[];
	sponsorTags: string[];
	personTags: string[];
}): CollectionPlan[] {
	return [
		{
			slug: "venues",
			label: "Venues",
			labelSingular: "Venue",
			fields: [
				{ slug: "title", label: "Title", type: "string", required: true },
				{ slug: "body", label: "Body", type: "portableText" },
				{ slug: "address", label: "Address", type: "string" },
				{ slug: "maps_embed", label: "Maps Embed URL", type: "url" },
				SORT,
				DIRECTUS_ID,
			],
		},
		{
			slug: "events",
			label: "Events",
			labelSingular: "Event",
			fields: [
				{ slug: "name", label: "Name", type: "string", required: true },
				{ slug: "event_start", label: "Start", type: "datetime", required: true },
				{ slug: "event_end", label: "End", type: "datetime", required: true },
				{
					slug: "venue",
					label: "Venue",
					type: "reference",
					options: { collection: "venues" },
				},
				{ slug: "location", label: "Location", type: "string" },
				{ slug: "description", label: "Description", type: "portableText" },
				multiSelect("tags", source.eventTags),
				SORT,
				DIRECTUS_ID,
			],
		},
		{
			slug: "sponsors",
			label: "Sponsors",
			labelSingular: "Sponsor",
			fields: [
				{ slug: "name", label: "Name", type: "string", required: true },
				{ slug: "website", label: "Website", type: "url" },
				{ slug: "logo", label: "Logo", type: "image" },
				{ slug: "info", label: "Info", type: "portableText" },
				{ slug: "invert_logo", label: "Invert Logo", type: "boolean" },
				multiSelect("tags", source.sponsorTags),
				SORT,
				DIRECTUS_ID,
			],
		},
		{
			slug: "vendors",
			label: "Vendors",
			labelSingular: "Vendor",
			fields: [
				{ slug: "name", label: "Name", type: "string", required: true },
				{ slug: "website", label: "Website", type: "url" },
				{ slug: "logo", label: "Logo", type: "image" },
				{ slug: "info", label: "Info", type: "portableText" },
				SORT,
				DIRECTUS_ID,
			],
		},
		{
			slug: "people",
			label: "People",
			labelSingular: "Person",
			fields: [
				{ slug: "display_name", label: "Display Name", type: "string", required: true },
				{ slug: "bio", label: "Bio", type: "text" },
				{ slug: "profile_pic", label: "Profile Picture", type: "image" },
				multiSelect("tags", source.personTags),
				SORT,
				DIRECTUS_ID,
			],
		},
		{
			slug: "qna",
			label: "Q&A",
			labelSingular: "Q&A",
			fields: [
				{ slug: "question", label: "Question", type: "string", required: true },
				{ slug: "answer", label: "Answer", type: "portableText" },
				SORT,
				DIRECTUS_ID,
			],
		},
		// NOTE: the built-in `pages` collection (title + content portableText)
		// is reused for the five Directus singletons; it is not created here.
	];
}
