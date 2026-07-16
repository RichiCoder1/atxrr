/**
 * One-off Directus → EmDash content migration.
 *
 * Env:
 *   DIRECTUS_URL           (default: https://directus.atxrubberroundup.com/)
 *   DIRECTUS_STATIC_TOKEN  (optional; needed if Directus isn't public-read)
 *   EMDASH_URL             (default: http://localhost:4321)
 *   EMDASH_TOKEN           (required; ec_pat_* token with content/schema/media scopes)
 *
 * Run: pnpm migrate:content
 *
 * Idempotent: entries upsert by `directus_id` (slug for pages), media is
 * checkpointed locally and deduplicated server-side by content hash. A second
 * run against an unchanged source reports zero creates/updates/uploads.
 * Exits non-zero when integrity checks find blockers.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as directus from "./directus-api.js";
import * as emdash from "./emdash-api.js";
import { buildSchemaPlan, distinctTags, type CollectionPlan } from "./schema-plan.js";
import {
	dataEquals,
	extractAssetIds,
	isPublished,
	makeSlug,
	navigationToMenuItems,
	richTextToPortableText,
	toImageFieldValue,
	type DesiredMenuItem,
	type MediaMap,
	type MediaRef,
} from "./transform.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_PATH = join(scriptDir, ".checkpoint.json");
const REPORT_PATH = join(scriptDir, "..", "..", "migration-report.json");

const directusConfig: directus.DirectusConfig = {
	url: process.env.DIRECTUS_URL ?? "https://directus.atxrubberroundup.com/",
	token: process.env.DIRECTUS_STATIC_TOKEN,
};
const emdashConfig: emdash.EmDashConfig = {
	url: process.env.EMDASH_URL ?? "http://localhost:4321",
	token: process.env.EMDASH_TOKEN ?? "",
};
if (!emdashConfig.token) {
	console.error("EMDASH_TOKEN is required (create a PAT in the EmDash admin).");
	process.exit(2);
}

// ---- Directus source types ----

interface DEvent {
	id: number;
	status: string;
	event_start: string;
	event_end: string;
	name: string;
	venue: number | null;
	location?: string | null;
	description: string;
	tags?: string[] | null;
}
interface DVenue {
	id: number;
	status: string;
	sort: number | null;
	title: string;
	body: string;
	address?: string | null;
	maps_embed?: string | null;
}
interface DSponsor {
	id: number;
	sort: number | null;
	name: string;
	website?: string | null;
	logo?: string | null;
	info?: string | null;
	invert_logo?: boolean | null;
	tags?: string[] | null;
}
interface DVendor {
	id: number;
	sort: number | null;
	name: string;
	website?: string | null;
	logo?: string | null;
	info?: string | null;
}
interface DPerson {
	id: number;
	sort: number | null;
	display_name: string;
	bio?: string | null;
	profile_pic?: string | null;
	tags?: string[] | null;
}
interface DQna {
	id: number;
	status: string;
	question: string;
	answer?: string | null;
}

// ---- Report ----

interface Report {
	startedAt: string;
	source: Record<string, number>;
	destination: Record<string, { published: number; draft: number }>;
	media: { referenced: number; uploaded: number; reusedFromCheckpoint: number; deduplicated: number };
	entries: { created: number; updated: number; unchanged: number; published: number };
	menu: { sourceItems: number; destinationItems: number; recreated: boolean };
	warnings: string[];
	blockers: string[];
}

const report: Report = {
	startedAt: new Date().toISOString(),
	source: {},
	destination: {},
	media: { referenced: 0, uploaded: 0, reusedFromCheckpoint: 0, deduplicated: 0 },
	entries: { created: 0, updated: 0, unchanged: 0, published: 0 },
	menu: { sourceItems: 0, destinationItems: 0, recreated: false },
	warnings: [],
	blockers: [],
};

function warn(msg: string) {
	report.warnings.push(msg);
	console.warn(`  WARN: ${msg}`);
}
function block(msg: string) {
	report.blockers.push(msg);
	console.error(`  BLOCKER: ${msg}`);
}

// ---- Checkpoint ----

type Checkpoint = Record<string, MediaRef>;

function loadCheckpoint(): Checkpoint {
	if (!existsSync(CHECKPOINT_PATH)) return {};
	return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8")) as Checkpoint;
}
function saveCheckpoint(cp: Checkpoint) {
	writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, "\t"));
}

// ---- Main ----

async function main() {
	console.log(`Directus: ${directusConfig.url}`);
	console.log(`EmDash:   ${emdashConfig.url}`);

	// 1. Fetch everything from Directus.
	console.log("\n[1/6] Fetching Directus content...");
	const [events, venues, sponsors, vendors, people, qna, navigation] =
		await Promise.all([
			directus.fetchItems<DEvent>(directusConfig, "events"),
			directus.fetchItems<DVenue>(directusConfig, "venues"),
			directus.fetchItems<DSponsor>(directusConfig, "sponsors"),
			directus.fetchItems<DVendor>(directusConfig, "vendors"),
			directus.fetchItems<DPerson>(directusConfig, "people"),
			directus.fetchItems<DQna>(directusConfig, "qna"),
			directus.fetchNavigation(directusConfig),
		]);
	const [about, vendorPage, gettingAroundPage, sponsorsPage, contactPage] =
		await Promise.all([
			directus.fetchSingleton<{ body: string }>(directusConfig, "about"),
			directus.fetchSingleton<{ title: string; body: string }>(directusConfig, "vendor_page"),
			directus.fetchSingleton<{ title: string; body: string }>(directusConfig, "getting_around_page"),
			directus.fetchSingleton<{ body: string }>(directusConfig, "sponsors_page"),
			directus.fetchSingleton<{ Information: string }>(directusConfig, "contact_page"),
		]);

	report.source = {
		events: events.length,
		venues: venues.length,
		sponsors: sponsors.length,
		vendors: vendors.length,
		people: people.length,
		qna: qna.length,
		pages: 5,
	};
	console.log(`  ${JSON.stringify(report.source)}`);

	// 2. Ensure destination schema.
	console.log("\n[2/6] Ensuring EmDash schema...");
	const plan = buildSchemaPlan({
		eventTags: distinctTags(events),
		sponsorTags: distinctTags(sponsors),
		personTags: distinctTags(people),
	});
	await ensureSchema(plan);

	// 3. Media.
	console.log("\n[3/6] Migrating media...");
	const richTextHtml = [
		...venues.map((v) => v.body),
		...sponsors.map((s) => s.info),
		...vendors.map((v) => v.info),
		...qna.map((q) => q.answer),
		about.body,
		vendorPage.body,
		gettingAroundPage.body,
		sponsorsPage.body,
		contactPage.Information,
	];
	const fileIds = new Set<string>([
		...sponsors.flatMap((s) => (s.logo ? [s.logo.toLowerCase()] : [])),
		...vendors.flatMap((v) => (v.logo ? [v.logo.toLowerCase()] : [])),
		...people.flatMap((p) => (p.profile_pic ? [p.profile_pic.toLowerCase()] : [])),
		...richTextHtml.flatMap((html) => extractAssetIds(html)),
		// event descriptions are markdown but may still embed asset URLs
		...events.flatMap((e) => extractAssetIds(e.description)),
	]);
	report.media.referenced = fileIds.size;
	const mediaMap = await migrateMedia(fileIds);

	// 4. Entries (dependency order: venues before events).
	console.log("\n[4/6] Upserting entries...");

	const venueIdMap = await upsertCollection(
		"venues",
		venues,
		(v) => v.title,
		(v) => ({
			title: v.title,
			body: richText(v.body, "html", mediaMap, `venues/${v.id}`),
			address: v.address ?? undefined,
			maps_embed: v.maps_embed ?? undefined,
			sort: v.sort ?? 0,
			directus_id: v.id,
		}),
		(v) => isPublished(v.status),
	);

	await upsertCollection(
		"events",
		events,
		(e) => e.name,
		(e) => ({
			name: e.name,
			event_start: e.event_start,
			event_end: e.event_end,
			venue: e.venue != null ? venueIdMap.get(e.venue) : undefined,
			location: e.location ?? undefined,
			description: richText(e.description, "markdown", mediaMap, `events/${e.id}`),
			tags: e.tags ?? [],
			sort: 0,
			directus_id: e.id,
		}),
		(e) => isPublished(e.status),
	);

	await upsertCollection(
		"sponsors",
		sponsors,
		(s) => s.name,
		(s) => ({
			name: s.name,
			website: s.website ?? undefined,
			logo: imageField(s.logo, mediaMap, `${s.name} logo`, `sponsors/${s.id}`),
			info: richText(s.info, "html", mediaMap, `sponsors/${s.id}`),
			invert_logo: s.invert_logo ?? false,
			tags: s.tags ?? [],
			sort: s.sort ?? 0,
			directus_id: s.id,
		}),
		() => true,
	);

	await upsertCollection(
		"vendors",
		vendors,
		(v) => v.name,
		(v) => ({
			name: v.name,
			website: v.website ?? undefined,
			logo: imageField(v.logo, mediaMap, `${v.name} logo`, `vendors/${v.id}`),
			info: richText(v.info, "html", mediaMap, `vendors/${v.id}`),
			sort: v.sort ?? 0,
			directus_id: v.id,
		}),
		() => true,
	);

	await upsertCollection(
		"people",
		people,
		(p) => p.display_name,
		(p) => ({
			display_name: p.display_name,
			bio: p.bio ?? "",
			profile_pic: imageField(p.profile_pic, mediaMap, p.display_name, `people/${p.id}`),
			tags: p.tags ?? [],
			sort: p.sort ?? 0,
			directus_id: p.id,
		}),
		() => true,
	);

	await upsertCollection(
		"qna",
		qna,
		(q) => q.question,
		(q, index) => ({
			question: q.question,
			answer: richText(q.answer, "html", mediaMap, `qna/${q.id}`),
			sort: index,
			directus_id: q.id,
		}),
		(q) => isPublished(q.status),
	);

	await upsertPages([
		{ slug: "about", title: "About Us", html: about.body },
		{ slug: "market", title: vendorPage.title, html: vendorPage.body },
		{ slug: "sponsors", title: "Sponsors and Social Hosts", html: sponsorsPage.body },
		{ slug: "getting-around", title: gettingAroundPage.title, html: gettingAroundPage.body },
		{ slug: "contact", title: "Contact Us", html: contactPage.Information },
	], mediaMap);

	// 5. Menu.
	console.log("\n[5/6] Migrating navigation menu...");
	await migrateMenu(navigation);

	// 6. Verify.
	console.log("\n[6/6] Verifying...");
	await verify(venueIdMap);

	writeFileSync(REPORT_PATH, JSON.stringify(report, null, "\t"));
	console.log(`\nReport written to ${REPORT_PATH}`);
	console.log(
		`created=${report.entries.created} updated=${report.entries.updated} unchanged=${report.entries.unchanged} uploaded=${report.media.uploaded}`,
	);
	if (report.blockers.length > 0) {
		console.error(`\n${report.blockers.length} blocker(s) — see report.`);
		process.exit(1);
	}
	console.log(`\nOK (${report.warnings.length} warning(s)).`);
}

// ---- Helpers ----

function richText(
	value: string | null | undefined,
	format: "html" | "markdown",
	mediaMap: MediaMap,
	context: string,
) {
	const result = richTextToPortableText(value, format, mediaMap);
	for (const id of result.unresolvedAssets) {
		block(`${context}: unresolved Directus asset ${id} in rich text`);
	}
	if (result.htmlBlockCount > 0) {
		warn(`${context}: ${result.htmlBlockCount} raw htmlBlock(s) preserved — review in admin`);
	}
	return result.blocks;
}

function imageField(
	fileId: string | null | undefined,
	mediaMap: MediaMap,
	alt: string,
	context: string,
) {
	const value = toImageFieldValue(fileId, mediaMap, alt);
	if (fileId && !value) block(`${context}: image ${fileId} missing from media map`);
	return value;
}

async function ensureSchema(plan: CollectionPlan[]) {
	const existingRaw = await emdash.listCollections(emdashConfig);
	const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw.collections;
	const existingSlugs = new Set(existing.map((c) => c.slug));

	if (!existingSlugs.has("pages")) {
		block(`built-in "pages" collection not found — was the default schema removed?`);
	}

	for (const collection of plan) {
		if (!existingSlugs.has(collection.slug)) {
			console.log(`  creating collection ${collection.slug}`);
			await emdash.createCollection(emdashConfig, {
				slug: collection.slug,
				label: collection.label,
				labelSingular: collection.labelSingular,
			});
		}
		const fieldsRaw = await emdash.listFields(emdashConfig, collection.slug);
		const fields = Array.isArray(fieldsRaw) ? fieldsRaw : fieldsRaw.fields;
		const fieldSlugs = new Set(fields.map((f) => f.slug));
		let sortOrder = fields.length;
		for (const field of collection.fields) {
			if (fieldSlugs.has(field.slug)) continue;
			console.log(`  creating field ${collection.slug}.${field.slug} (${field.type})`);
			await emdash.createField(emdashConfig, collection.slug, {
				...field,
				sortOrder: sortOrder++,
			});
		}
	}
}

async function migrateMedia(fileIds: Set<string>): Promise<MediaMap> {
	const checkpoint = loadCheckpoint();
	const mediaMap: MediaMap = new Map();

	// Trust checkpoint entries only if the media item still exists remotely.
	const remote = await emdash.listAllMedia(emdashConfig);
	const remoteIds = new Set(remote.map((m) => m.id));

	for (const fileId of fileIds) {
		const cached = checkpoint[fileId];
		if (cached && remoteIds.has(cached.id)) {
			mediaMap.set(fileId, cached);
			report.media.reusedFromCheckpoint += 1;
			continue;
		}
		try {
			const meta = await directus.fetchFileMeta(directusConfig, fileId);
			const blob = await directus.downloadAsset(directusConfig, fileId);
			const { item, deduplicated } = await emdash.uploadMedia(
				emdashConfig,
				blob,
				meta.filename_download || `${fileId}`,
				{ width: meta.width, height: meta.height },
			);
			if (deduplicated) report.media.deduplicated += 1;
			else report.media.uploaded += 1;
			const ref: MediaRef = {
				id: item.id,
				url: item.url,
				width: item.width,
				height: item.height,
			};
			mediaMap.set(fileId, ref);
			checkpoint[fileId] = ref;
			saveCheckpoint(checkpoint);
			console.log(`  ${fileId} -> ${item.id}${deduplicated ? " (dedup)" : ""}`);
		} catch (err) {
			block(`media ${fileId}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	return mediaMap;
}

async function upsertCollection<T extends { id: number }>(
	collection: string,
	items: T[],
	nameOf: (item: T) => string,
	toData: (item: T, index: number) => Record<string, unknown>,
	shouldPublish: (item: T) => boolean,
): Promise<Map<number, string>> {
	console.log(`  ${collection} (${items.length})`);
	const existing = await emdash.listAllContent(emdashConfig, collection);
	const byDirectusId = new Map(
		existing
			.filter((e) => typeof e.data.directus_id === "number")
			.map((e) => [e.data.directus_id as number, e] as const),
	);
	const takenSlugs = new Set(
		existing.flatMap((e) => (e.slug ? [e.slug] : [])),
	);
	const idMap = new Map<number, string>();

	for (const [index, item] of items.entries()) {
		const data = toData(item, index);
		const current = byDirectusId.get(item.id);
		let entryId: string;
		if (!current) {
			const slug = makeSlug(nameOf(item), item.id, takenSlugs);
			const created = await emdash.createContent(emdashConfig, collection, {
				data,
				slug,
			});
			entryId = created.id;
			report.entries.created += 1;
		} else {
			entryId = current.id;
			// Compare only the keys we manage so admin-added fields survive.
			const currentSubset = Object.fromEntries(
				Object.keys(data).map((k) => [k, current.data[k]]),
			);
			if (dataEquals(currentSubset, data)) {
				report.entries.unchanged += 1;
			} else {
				await emdash.updateContent(emdashConfig, collection, entryId, { data });
				report.entries.updated += 1;
			}
		}
		const wasPublished = current?.status === "published";
		if (shouldPublish(item) && !wasPublished) {
			await emdash.publishContent(emdashConfig, collection, entryId);
			report.entries.published += 1;
		}
		idMap.set(item.id, entryId);
	}
	return idMap;
}

async function upsertPages(
	pages: Array<{ slug: string; title: string; html: string }>,
	mediaMap: MediaMap,
) {
	console.log(`  pages (${pages.length})`);
	const existing = await emdash.listAllContent(emdashConfig, "pages");
	const bySlug = new Map(existing.map((e) => [e.slug, e] as const));

	for (const page of pages) {
		const data = {
			title: page.title,
			content: richText(page.html, "html", mediaMap, `pages/${page.slug}`),
		};
		const current = bySlug.get(page.slug);
		let entryId: string;
		if (!current) {
			const created = await emdash.createContent(emdashConfig, "pages", {
				data,
				slug: page.slug,
			});
			entryId = created.id;
			report.entries.created += 1;
		} else {
			entryId = current.id;
			const currentSubset = { title: current.data.title, content: current.data.content };
			if (dataEquals(currentSubset, data)) {
				report.entries.unchanged += 1;
			} else {
				await emdash.updateContent(emdashConfig, "pages", entryId, { data });
				report.entries.updated += 1;
			}
		}
		if (current?.status !== "published") {
			await emdash.publishContent(emdashConfig, "pages", entryId);
			report.entries.published += 1;
		}
	}
}

async function migrateMenu(navigation: directus.DirectusNavigationItem[]) {
	const desired = navigationToMenuItems(navigation);
	const countItems = (items: DesiredMenuItem[]): number =>
		items.reduce((n, item) => n + 1 + countItems(item.children), 0);
	report.menu.sourceItems = countItems(desired);

	const existing = await emdash.getMenu(emdashConfig, "primary");
	if (existing) {
		const normalize = (items: emdash.EmDashMenuItemOut[]): DesiredMenuItem[] =>
			items.map((item) => ({
				label: item.label,
				url: item.url ?? "",
				target: item.target || undefined,
				titleAttr: item.titleAttr || undefined,
				children: normalize(item.children ?? []),
			}));
		if (dataEquals(normalize(existing.items), desired)) {
			console.log("  menu unchanged");
			report.menu.destinationItems = report.menu.sourceItems;
			return;
		}
		console.log("  menu drifted — recreating items");
		for (const item of existing.items) {
			await emdash.deleteMenuItem(emdashConfig, "primary", item.id);
		}
		report.menu.recreated = true;
	} else {
		await emdash.createMenu(emdashConfig, "primary", "Primary Navigation");
	}

	let created = 0;
	const createTree = async (items: DesiredMenuItem[], parentId?: string) => {
		for (const [index, item] of items.entries()) {
			const { id } = await emdash.createMenuItem(emdashConfig, "primary", {
				type: "custom",
				label: item.label,
				customUrl: item.url || "/",
				target: item.target,
				titleAttr: item.titleAttr,
				parentId,
				sortOrder: index,
			});
			created += 1;
			await createTree(item.children, id);
		}
	};
	await createTree(desired);
	report.menu.destinationItems = created;
}

async function verify(venueIdMap: Map<number, string>) {
	for (const collection of ["venues", "events", "sponsors", "vendors", "people", "qna", "pages"]) {
		const entries = await emdash.listAllContent(emdashConfig, collection);
		const published = entries.filter((e) => e.status === "published").length;
		report.destination[collection] = {
			published,
			draft: entries.length - published,
		};

		// duplicate directus_id check
		const ids = entries
			.map((e) => e.data.directus_id)
			.filter((v): v is number => typeof v === "number");
		const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
		if (dupes.length > 0) {
			block(`${collection}: duplicate directus_id values ${[...new Set(dupes)].join(", ")}`);
		}

		// count check vs source
		const sourceCount = report.source[collection];
		if (sourceCount !== undefined && entries.length < sourceCount) {
			block(`${collection}: destination has ${entries.length} entries, source has ${sourceCount}`);
		}
	}

	// venue references resolve
	const venueEntryIds = new Set(venueIdMap.values());
	const events = await emdash.listAllContent(emdashConfig, "events");
	for (const event of events) {
		const venue = event.data.venue;
		if (venue != null && venue !== "" && !venueEntryIds.has(venue as string)) {
			block(`events/${event.slug}: venue reference "${String(venue)}" does not resolve`);
		}
	}

	// image fields resolve
	const media = await emdash.listAllMedia(emdashConfig);
	const mediaIds = new Set(media.map((m) => m.id));
	for (const [collection, field] of [
		["sponsors", "logo"],
		["vendors", "logo"],
		["people", "profile_pic"],
	] as const) {
		const entries = await emdash.listAllContent(emdashConfig, collection);
		for (const entry of entries) {
			const value = entry.data[field] as { id?: string } | undefined;
			if (value?.id && !mediaIds.has(value.id)) {
				block(`${collection}/${entry.slug}: ${field} media ${value.id} not found`);
			}
		}
	}

	// menu integrity
	if (report.menu.destinationItems !== report.menu.sourceItems) {
		block(
			`menu: source has ${report.menu.sourceItems} items, destination has ${report.menu.destinationItems}`,
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(2);
});
