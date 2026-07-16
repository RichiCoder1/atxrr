/** Minimal Directus REST client for the one-off migration. */

export interface DirectusConfig {
	url: string;
	token?: string;
}

export interface DirectusNavigationItem {
	id: number;
	sort: number | null;
	name: string;
	description?: string | null;
	href?: string | null;
	is_external?: boolean | null;
	children: DirectusNavigationItem[];
}

async function directusGet<T>(
	config: DirectusConfig,
	path: string,
): Promise<T> {
	const url = new URL(path, config.url);
	const res = await fetch(url, {
		headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
	});
	if (!res.ok) {
		throw new Error(`Directus GET ${path} failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as { data: T };
	return body.data;
}

export async function fetchItems<T>(
	config: DirectusConfig,
	collection: string,
	fields = "*",
): Promise<T[]> {
	return directusGet<T[]>(
		config,
		`/items/${collection}?limit=-1&fields=${encodeURIComponent(fields)}`,
	);
}

export async function fetchSingleton<T>(
	config: DirectusConfig,
	collection: string,
): Promise<T> {
	return directusGet<T>(config, `/items/${collection}`);
}

export async function fetchNavigation(
	config: DirectusConfig,
): Promise<DirectusNavigationItem[]> {
	return fetchItems<DirectusNavigationItem>(
		config,
		"navigation",
		"*,children.*,children.children.*",
	);
}

export interface DirectusFileMeta {
	id: string;
	filename_download: string;
	type: string;
	width?: number | null;
	height?: number | null;
}

export async function fetchFileMeta(
	config: DirectusConfig,
	fileId: string,
): Promise<DirectusFileMeta> {
	return directusGet<DirectusFileMeta>(config, `/files/${fileId}`);
}

export async function downloadAsset(
	config: DirectusConfig,
	fileId: string,
): Promise<Blob> {
	const url = new URL(`/assets/${fileId}?download`, config.url);
	const res = await fetch(url, {
		headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
	});
	if (!res.ok) {
		throw new Error(`Directus asset download ${fileId} failed: ${res.status}`);
	}
	return await res.blob();
}
