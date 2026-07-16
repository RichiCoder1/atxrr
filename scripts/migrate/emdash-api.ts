/** Minimal EmDash REST client for the one-off migration. */

export interface EmDashConfig {
	url: string;
	token: string;
}

export interface EmDashMediaItem {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	width?: number;
	height?: number;
	storageKey: string;
	url: string;
}

export interface EmDashContentItem {
	id: string;
	slug: string | null;
	status: string;
	data: Record<string, unknown>;
}

export interface EmDashField {
	slug: string;
	label: string;
	type: string;
	options?: Record<string, unknown>;
}

export interface EmDashCollectionInfo {
	slug: string;
	label: string;
}

async function api<T>(
	config: EmDashConfig,
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	const res = await fetch(new URL(`/_emdash/api${path}`, config.url), {
		method,
		headers: {
			Authorization: `Bearer ${config.token}`,
			...(body !== undefined && !(body instanceof FormData)
				? { "Content-Type": "application/json" }
				: {}),
		},
		body:
			body === undefined
				? undefined
				: body instanceof FormData
					? body
					: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(
			`EmDash ${method} ${path} failed: ${res.status} ${await res.text()}`,
		);
	}
	if (res.status === 204) return undefined as T;
	const parsed = (await res.json()) as { data: T };
	return parsed.data;
}

// ---- Schema ----

export async function listCollections(config: EmDashConfig) {
	return api<{ collections: EmDashCollectionInfo[] } | EmDashCollectionInfo[]>(
		config,
		"GET",
		"/schema/collections",
	);
}

export async function createCollection(
	config: EmDashConfig,
	input: { slug: string; label: string; labelSingular?: string },
) {
	return api(config, "POST", "/schema/collections", input);
}

export async function listFields(config: EmDashConfig, collection: string) {
	return api<{ fields: EmDashField[] } | EmDashField[]>(
		config,
		"GET",
		`/schema/collections/${collection}/fields`,
	);
}

export async function createField(
	config: EmDashConfig,
	collection: string,
	field: EmDashField & { required?: boolean; sortOrder?: number },
) {
	return api(config, "POST", `/schema/collections/${collection}/fields`, field);
}

// ---- Content ----

export async function listAllContent(
	config: EmDashConfig,
	collection: string,
): Promise<EmDashContentItem[]> {
	const items: EmDashContentItem[] = [];
	let cursor: string | undefined;
	do {
		const query = new URLSearchParams({ limit: "100", status: "all" });
		if (cursor) query.set("cursor", cursor);
		const page = await api<{ items: EmDashContentItem[]; nextCursor?: string }>(
			config,
			"GET",
			`/content/${collection}?${query}`,
		);
		items.push(...page.items);
		cursor = page.nextCursor;
	} while (cursor);
	return items;
}

export async function createContent(
	config: EmDashConfig,
	collection: string,
	input: { data: Record<string, unknown>; slug?: string },
): Promise<EmDashContentItem> {
	const result = await api<{ item: EmDashContentItem } | EmDashContentItem>(
		config,
		"POST",
		`/content/${collection}`,
		input,
	);
	return "item" in result ? result.item : result;
}

export async function updateContent(
	config: EmDashConfig,
	collection: string,
	id: string,
	input: { data: Record<string, unknown>; slug?: string; skipRevision?: boolean },
): Promise<void> {
	await api(config, "PUT", `/content/${collection}/${id}`, input);
}

export async function publishContent(
	config: EmDashConfig,
	collection: string,
	id: string,
	publishedAt?: string,
): Promise<void> {
	await api(
		config,
		"POST",
		`/content/${collection}/${id}/publish`,
		publishedAt ? { publishedAt } : {},
	);
}

// ---- Media ----

export async function listAllMedia(
	config: EmDashConfig,
): Promise<EmDashMediaItem[]> {
	const items: EmDashMediaItem[] = [];
	let cursor: string | undefined;
	do {
		const query = new URLSearchParams({ limit: "100" });
		if (cursor) query.set("cursor", cursor);
		const page = await api<{ items: EmDashMediaItem[]; nextCursor?: string }>(
			config,
			"GET",
			`/media?${query}`,
		);
		items.push(...page.items);
		cursor = page.nextCursor;
	} while (cursor);
	return items;
}

export async function uploadMedia(
	config: EmDashConfig,
	file: Blob,
	filename: string,
	dimensions?: { width?: number | null; height?: number | null },
): Promise<{ item: EmDashMediaItem; deduplicated?: boolean }> {
	const form = new FormData();
	form.append("file", file, filename);
	if (dimensions?.width) form.append("width", String(dimensions.width));
	if (dimensions?.height) form.append("height", String(dimensions.height));
	return api<{ item: EmDashMediaItem; deduplicated?: boolean }>(
		config,
		"POST",
		"/media",
		form,
	);
}

// ---- Menus ----

export interface EmDashMenuItemOut {
	id: string;
	label: string;
	url?: string;
	target?: string;
	titleAttr?: string;
	children?: EmDashMenuItemOut[];
}

export async function getMenu(
	config: EmDashConfig,
	name: string,
): Promise<{ items: EmDashMenuItemOut[] } | null> {
	try {
		return await api<{ items: EmDashMenuItemOut[] }>(
			config,
			"GET",
			`/menus/${name}`,
		);
	} catch (err) {
		if (err instanceof Error && err.message.includes(" 404 ")) return null;
		if (err instanceof Error && err.message.includes("failed: 404")) return null;
		throw err;
	}
}

export async function createMenu(
	config: EmDashConfig,
	name: string,
	label: string,
): Promise<void> {
	await api(config, "POST", "/menus", { name, label });
}

export async function createMenuItem(
	config: EmDashConfig,
	menuName: string,
	input: {
		type: "custom";
		label: string;
		customUrl: string;
		target?: string;
		titleAttr?: string;
		parentId?: string;
		sortOrder?: number;
	},
): Promise<{ id: string }> {
	const result = await api<{ item: { id: string } } | { id: string }>(
		config,
		"POST",
		`/menus/${menuName}/items`,
		input,
	);
	return "item" in result ? result.item : result;
}

export async function deleteMenuItem(
	config: EmDashConfig,
	menuName: string,
	id: string,
): Promise<void> {
	await api(config, "DELETE", `/menus/${menuName}/items/${id}`);
}
