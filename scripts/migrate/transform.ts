/**
 * Pure transformation functions for the Directus → EmDash migration.
 * Kept free of network access so they can be unit-tested directly.
 */
import { htmlToPortableText } from "@emdash-cms/gutenberg-to-portable-text";
import slugify from "@sindresorhus/slugify";
import { marked } from "marked";

export interface MediaRef {
	id: string;
	url: string;
	width?: number;
	height?: number;
}

export type MediaMap = Map<string, MediaRef>;

const DIRECTUS_ASSET_UUID =
	/\/assets\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;

/** Extract Directus file UUIDs referenced by /assets/ URLs inside HTML. */
export function extractAssetIds(html: string | null | undefined): string[] {
	if (!html) return [];
	const ids = new Set<string>();
	for (const match of html.matchAll(DIRECTUS_ASSET_UUID)) {
		ids.add(match[1].toLowerCase());
	}
	return [...ids];
}

/**
 * Rewrite Directus asset URLs inside HTML to their EmDash media URLs.
 * Unknown asset ids are left untouched and reported by the caller.
 */
export function rewriteAssetUrls(
	html: string,
	mediaMap: MediaMap,
): { html: string; unresolved: string[] } {
	const unresolved: string[] = [];
	const rewritten = html.replace(
		new RegExp(`(?:https?://[^"'\\s)]+)?/assets/([0-9a-fA-F-]{36})[^"'\\s)]*`, "g"),
		(full, id: string) => {
			const media = mediaMap.get(id.toLowerCase());
			if (!media) {
				unresolved.push(id.toLowerCase());
				return full;
			}
			return media.url;
		},
	);
	return { html: rewritten, unresolved };
}

export interface RichTextResult {
	blocks: unknown[];
	unresolvedAssets: string[];
	htmlBlockCount: number;
}

/**
 * Convert a Directus rich-text value to Portable Text.
 * `format` is "markdown" for event descriptions (edited as markdown in
 * Directus), "html" for everything else (Directus WYSIWYG output).
 */
export function richTextToPortableText(
	value: string | null | undefined,
	format: "html" | "markdown",
	mediaMap: MediaMap,
): RichTextResult {
	if (!value || value.trim() === "") {
		return { blocks: [], unresolvedAssets: [], htmlBlockCount: 0 };
	}
	const html =
		format === "markdown" ? (marked.parse(value, { async: false }) as string) : value;
	const { html: rewritten, unresolved } = rewriteAssetUrls(html, mediaMap);
	const blocks = htmlToPortableText(rewritten);
	// Attach media ids to image blocks the converter produced from <img> tags
	// so they reference the EmDash media library instead of bare URLs.
	const urlToMedia = new Map(
		[...mediaMap.values()].map((m) => [m.url, m] as const),
	);
	let htmlBlockCount = 0;
	for (const block of blocks as unknown as Array<Record<string, unknown>>) {
		if (block._type === "htmlBlock") htmlBlockCount += 1;
		if (block._type === "image") {
			const asset = block.asset as
				| { _ref?: string; url?: string }
				| undefined;
			const media = asset?.url ? urlToMedia.get(asset.url) : undefined;
			if (asset && media) asset._ref = media.id;
		}
	}
	return { blocks, unresolvedAssets: unresolved, htmlBlockCount };
}

/** Image field value shape expected by EmDash's image field schema. */
export function toImageFieldValue(
	directusFileId: string | null | undefined,
	mediaMap: MediaMap,
	alt: string,
): { id: string; src: string; alt: string; width?: number; height?: number } | undefined {
	if (!directusFileId) return undefined;
	const media = mediaMap.get(directusFileId.toLowerCase());
	if (!media) return undefined;
	return {
		id: media.id,
		src: media.url,
		alt,
		...(media.width ? { width: media.width } : {}),
		...(media.height ? { height: media.height } : {}),
	};
}

/**
 * Deterministic entry slugs: slugified display name, de-duplicated within a
 * collection by suffixing the Directus id.
 */
export function makeSlug(
	name: string,
	directusId: number | string,
	taken: Set<string>,
): string {
	const base = slugify(name) || `item-${directusId}`;
	const slug = taken.has(base) ? `${base}-${directusId}` : base;
	taken.add(slug);
	return slug;
}

/** Directus status → should the EmDash entry be published? */
export function isPublished(status: string | null | undefined): boolean {
	// Directus defaults: published | draft | archived. Collections without a
	// status field (people, sponsors, vendors, navigation) are always live.
	return status == null || status === "published";
}

export interface SourceNavigationItem {
	id: number;
	sort: number | null;
	name: string;
	description?: string | null;
	href?: string | null;
	is_external?: boolean | null;
	children: SourceNavigationItem[];
}

export interface DesiredMenuItem {
	label: string;
	url: string;
	target?: string;
	titleAttr?: string;
	children: DesiredMenuItem[];
}

/**
 * Directus `navigation` (children of the "root" item, sorted) → the menu
 * structure to create in EmDash. Dropdown descriptions become titleAttr.
 */
export function navigationToMenuItems(
	navigation: SourceNavigationItem[],
): DesiredMenuItem[] {
	const root = navigation.find((item) => item.name === "root");
	if (!root) return [];
	const convert = (item: SourceNavigationItem): DesiredMenuItem => ({
		label: item.name,
		url: item.href ?? "",
		target: item.is_external ? "_blank" : undefined,
		titleAttr: item.description ?? undefined,
		children: [...(item.children ?? [])]
			.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
			.map(convert),
	});
	return [...(root.children ?? [])]
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
		.map(convert);
}

/** Stable deep-ish equality for migrated data objects (JSON semantics). */
export function dataEquals(a: unknown, b: unknown): boolean {
	return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, v]) => v !== undefined)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => [k, sortKeys(v)]),
		);
	}
	return value;
}
