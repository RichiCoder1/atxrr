import type { AstroGlobal } from "astro";
import {
	getEmDashCollection,
	getEmDashEntry,
	type ContentEntry,
	type MediaValue,
	type PortableTextBlock,
} from "emdash";

// Hand-maintained equivalents of the generated emdash-env.d.ts shapes, so the
// explicit generics below stay accurate before the schema exists in an instance.

interface BaseEntryData {
	/**
	 * The entry's ULID — this is what reference fields point at. Note it differs
	 * from the entry-level `entry.id`, which is the slug; joining on that one
	 * silently yields no matches.
	 */
	id: string;
	slug: string | null;
	status: string;
	sort?: number;
	directus_id?: number;
}

export interface EventData extends BaseEntryData {
	name: string;
	event_start: string;
	event_end: string;
	/** Entry id in `venues` (reference fields store the raw id) */
	venue?: string;
	location?: string;
	description?: PortableTextBlock[];
	tags?: string[];
}

export interface VenueData extends BaseEntryData {
	title: string;
	body?: PortableTextBlock[];
	address?: string;
	maps_embed?: string;
}

export interface SponsorData extends BaseEntryData {
	name: string;
	website?: string;
	logo?: MediaValue;
	info?: PortableTextBlock[];
	invert_logo?: boolean;
	tags?: string[];
}

export interface VendorData extends BaseEntryData {
	name: string;
	website?: string;
	logo?: MediaValue;
	info?: PortableTextBlock[];
}

export interface PersonData extends BaseEntryData {
	display_name: string;
	bio?: string;
	profile_pic?: MediaValue;
	tags?: string[];
}

export interface QnaData extends BaseEntryData {
	question: string;
	answer?: PortableTextBlock[];
}

export interface PageData extends BaseEntryData {
	title: string;
	content?: PortableTextBlock[];
}

export interface CollectionDataMap {
	events: EventData;
	venues: VenueData;
	sponsors: SponsorData;
	vendors: VendorData;
	people: PersonData;
	qna: QnaData;
	pages: PageData;
}

export type Entry<C extends keyof CollectionDataMap> = ContentEntry<
	CollectionDataMap[C]
>;

/** Fetch all published entries of a collection, unwrapping the result envelope. */
export async function getCollection<C extends keyof CollectionDataMap>(
	collection: C,
): Promise<Entry<C>[]> {
	const { entries, error } = await getEmDashCollection<
		C,
		CollectionDataMap[C]
	>(collection, { status: "published" });
	if (error) throw error;
	return entries;
}

/** Fetch a single page from the `pages` collection by slug. Throws if missing. */
export async function getPage(slug: string) {
	const { entry, error, isPreview } = await getEmDashEntry<
		"pages",
		PageData
	>("pages", slug);
	if (error) throw error;
	if (!entry) throw new Error(`Missing page entry: ${slug}`);
	return { page: entry, isPreview };
}

export function bySort<T extends { data: { sort?: number } }>(a: T, b: T) {
	return (a.data.sort ?? 0) - (b.data.sort ?? 0);
}

/** Public cache headers, unless EmDash already set one or this is a preview. */
export function setContentCacheHeaders(
	astro: AstroGlobal,
	opts?: { isPreview?: boolean },
) {
	if (opts?.isPreview) return;
	if (astro.response.headers.has("Cache-Control")) return;
	astro.response.headers.set(
		"Cache-Control",
		"public, max-age=300, stale-while-revalidate=3600",
	);
}
