import { describe, expect, it } from "vitest";

import {
	dataEquals,
	extractAssetIds,
	isPublished,
	makeSlug,
	navigationToMenuItems,
	normalizeSortOrder,
	rewriteAssetUrls,
	richTextToPortableText,
	toImageFieldValue,
	type MediaMap,
	type SourceNavigationItem,
} from "./transform.js";
import { buildSchemaPlan, distinctTags } from "./schema-plan.js";

const UUID_A = "0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9";
const UUID_B = "ffffffff-0000-1111-2222-333333333333";

const mediaMap: MediaMap = new Map([
	[UUID_A, { id: "MEDIA_A", url: "/_emdash/api/media/file/MEDIA_A.png", width: 640, height: 480 }],
]);

describe("extractAssetIds", () => {
	it("finds directus asset uuids in html", () => {
		const html = `<p><img src="https://directus.example.com/assets/${UUID_A}?key=x"></p>
			<a href="/assets/${UUID_B}/download">file</a>`;
		expect(extractAssetIds(html)).toEqual([UUID_A, UUID_B]);
	});

	it("dedupes and handles empty input", () => {
		expect(extractAssetIds(`<img src="/assets/${UUID_A}"><img src="/assets/${UUID_A}">`)).toEqual([UUID_A]);
		expect(extractAssetIds(null)).toEqual([]);
		expect(extractAssetIds("<p>no assets</p>")).toEqual([]);
	});
});

describe("rewriteAssetUrls", () => {
	it("rewrites known assets and reports unknown ones", () => {
		const html = `<img src="https://d.example.com/assets/${UUID_A}?key=sponsor"> <img src="/assets/${UUID_B}">`;
		const result = rewriteAssetUrls(html, mediaMap);
		expect(result.html).toContain("/_emdash/api/media/file/MEDIA_A.png");
		expect(result.html).not.toContain(UUID_A);
		expect(result.html).toContain(UUID_B); // untouched
		expect(result.unresolved).toEqual([UUID_B]);
	});
});

describe("richTextToPortableText", () => {
	it("converts html paragraphs with links", () => {
		const { blocks, unresolvedAssets } = richTextToPortableText(
			`<p>Hello <a href="https://example.com">world</a></p>`,
			"html",
			new Map(),
		);
		expect(unresolvedAssets).toEqual([]);
		expect(blocks.length).toBeGreaterThan(0);
		const block = blocks[0] as { _type: string; children: Array<{ text: string }>; markDefs: Array<{ _type: string; href: string }> };
		expect(block._type).toBe("block");
		expect(block.children.map((c) => c.text).join("")).toBe("Hello world");
		expect(block.markDefs[0]).toMatchObject({ _type: "link", href: "https://example.com" });
	});

	it("converts markdown (event descriptions)", () => {
		const { blocks } = richTextToPortableText(
			"Some **bold** text and a [link](https://example.com).",
			"markdown",
			new Map(),
		);
		const block = blocks[0] as { _type: string; children: Array<{ text: string; marks?: string[] }> };
		expect(block._type).toBe("block");
		expect(block.children.some((c) => c.marks?.includes("strong"))).toBe(true);
		expect(block.children.map((c) => c.text).join("")).toContain("bold");
	});

	it("attaches media refs to migrated inline images", () => {
		const { blocks } = richTextToPortableText(
			`<p>intro</p><img src="/assets/${UUID_A}" alt="pic">`,
			"html",
			mediaMap,
		);
		const image = (blocks as Array<{ _type: string; asset?: { _ref?: string; url?: string } }>).find(
			(b) => b._type === "image",
		);
		expect(image).toBeDefined();
		expect(image!.asset!._ref).toBe("MEDIA_A");
	});

	it("returns empty blocks for empty input", () => {
		expect(richTextToPortableText("", "html", new Map()).blocks).toEqual([]);
		expect(richTextToPortableText(null, "markdown", new Map()).blocks).toEqual([]);
	});
});

describe("toImageFieldValue", () => {
	it("builds the emdash image field shape", () => {
		expect(toImageFieldValue(UUID_A.toUpperCase(), mediaMap, "Alt text")).toEqual({
			id: "MEDIA_A",
			src: "/_emdash/api/media/file/MEDIA_A.png",
			alt: "Alt text",
			width: 640,
			height: 480,
		});
	});

	it("returns undefined for missing file or mapping", () => {
		expect(toImageFieldValue(null, mediaMap, "x")).toBeUndefined();
		expect(toImageFieldValue(UUID_B, mediaMap, "x")).toBeUndefined();
	});
});

describe("makeSlug", () => {
	it("slugifies deterministically and dedupes with the directus id", () => {
		const taken = new Set<string>();
		expect(makeSlug("Hotel Indigo!", 1, taken)).toBe("hotel-indigo");
		expect(makeSlug("Hotel Indigo", 2, taken)).toBe("hotel-indigo-2");
		expect(makeSlug("", 3, taken)).toBe("item-3");
	});
});

describe("normalizeSortOrder", () => {
	it("replicates null-as-zero stable sort and bakes in sequential values", () => {
		// Mirrors the venues case: nulls sort before explicit 1/2, in fetch order.
		const items = [
			{ id: "indigo", sort: 1 },
			{ id: "eagle", sort: 2 },
			{ id: "sanctuary", sort: null },
			{ id: "pelons", sort: null },
		];
		const result = normalizeSortOrder(items);
		expect(result.map((i) => i.id)).toEqual(["sanctuary", "pelons", "indigo", "eagle"]);
		expect(result.map((i) => i.sort)).toEqual([0, 1, 2, 3]);
	});
});

describe("isPublished", () => {
	it("treats missing status as published", () => {
		expect(isPublished(undefined)).toBe(true);
		expect(isPublished("published")).toBe(true);
		expect(isPublished("draft")).toBe(false);
		expect(isPublished("archived")).toBe(false);
	});
});

describe("dataEquals", () => {
	it("ignores key order and undefined values", () => {
		expect(dataEquals({ a: 1, b: [1, 2], c: undefined }, { b: [1, 2], a: 1 })).toBe(true);
		expect(dataEquals({ a: 1 }, { a: 2 })).toBe(false);
		expect(dataEquals({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toBe(true);
	});

	it("treats booleans as equal to SQLite 0/1", () => {
		expect(dataEquals({ invert_logo: false }, { invert_logo: 0 })).toBe(true);
		expect(dataEquals({ invert_logo: true }, { invert_logo: 1 })).toBe(true);
		expect(dataEquals({ invert_logo: true }, { invert_logo: 0 })).toBe(false);
	});

	it("compares media values by id+alt, ignoring server enrichment", () => {
		const generated = { id: "M1", src: "/_emdash/api/media/file/x.png", alt: "Logo", width: 100, height: 50 };
		const stored = {
			id: "M1",
			alt: "Logo",
			provider: "local",
			blurhash: "LPJ...",
			dominantColor: "rgb(1,2,3)",
			filename: "x.png",
			mimeType: "image/png",
			width: 100,
			height: 50,
			meta: { storageKey: "x.png" },
		};
		expect(dataEquals({ logo: generated }, { logo: stored })).toBe(true);
		expect(dataEquals({ logo: generated }, { logo: { ...stored, id: "M2" } })).toBe(false);
	});
});

describe("navigationToMenuItems", () => {
	const nav: SourceNavigationItem[] = [
		{
			id: 1,
			sort: 0,
			name: "root",
			children: [
				{
					id: 3,
					sort: 2,
					name: "Attend",
					description: "How to attend",
					children: [
						{ id: 5, sort: 1, name: "Register", href: "/attend/register", children: [] },
						{
							id: 4,
							sort: 0,
							name: "Discord",
							href: "https://discord.gg/x",
							is_external: true,
							description: "Chat with us",
							children: [],
						},
					],
				},
				{ id: 2, sort: 1, name: "Home", href: "/", children: [] },
			],
		},
	];

	it("uses root children, sorts recursively, maps target/titleAttr", () => {
		const items = navigationToMenuItems(nav);
		expect(items.map((i) => i.label)).toEqual(["Home", "Attend"]);
		const attend = items[1];
		expect(attend.titleAttr).toBe("How to attend");
		expect(attend.children.map((c) => c.label)).toEqual(["Discord", "Register"]);
		expect(attend.children[0]).toMatchObject({ target: "_blank", titleAttr: "Chat with us" });
		expect(attend.children[1].target).toBeUndefined();
	});

	it("returns empty when no root item exists", () => {
		expect(navigationToMenuItems([])).toEqual([]);
	});
});

describe("buildSchemaPlan", () => {
	it("computes multiSelect options from source data", () => {
		const plan = buildSchemaPlan({
			eventTags: distinctTags([{ tags: ["social"] }, { tags: ["education", "social"] }]),
			sponsorTags: ["primary"],
			personTags: [],
		});
		const events = plan.find((c) => c.slug === "events")!;
		const tagsField = events.fields.find((f) => f.slug === "tags")!;
		expect(tagsField.options).toEqual({ options: ["education", "social"] });
		const people = plan.find((c) => c.slug === "people")!;
		expect(people.fields.find((f) => f.slug === "tags")!.options).toEqual({
			options: ["untagged"],
		});
	});

	it("gives every collection a directus_id field and events a venue reference", () => {
		const plan = buildSchemaPlan({ eventTags: [], sponsorTags: [], personTags: [] });
		for (const collection of plan) {
			expect(collection.fields.some((f) => f.slug === "directus_id")).toBe(true);
		}
		const venueField = plan
			.find((c) => c.slug === "events")!
			.fields.find((f) => f.slug === "venue")!;
		expect(venueField).toMatchObject({ type: "reference", options: { collection: "venues" } });
	});
});
