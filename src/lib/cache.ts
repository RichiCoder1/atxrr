import type { Schema } from "./collections";
import type { DirectusClient } from "./directus";
import {
	readItems,
	readSingleton,
	type RegularCollections,
	type SingletonCollections,
} from "@directus/sdk";
import type { AstroGlobal } from "astro";

const TwoDays = 60 * 60 * 24 * 2;

export async function loadSingleton<
	TCollection extends SingletonCollections<Schema>,
>(astro: AstroGlobal, directus: DirectusClient, collection: TCollection) {
	return getCollectionCache(astro, collection, async () => {
		return await directus.request(readSingleton(collection));
	});
}

export async function loadItems<TCollection extends RegularCollections<Schema>>(
	astro: AstroGlobal,
	directus: DirectusClient,
	collection: TCollection,
) {
	return getCollectionCache(astro, collection, async () => {
		return await directus.request(readItems(collection));
	});
}

export async function getCollectionCache<
	TData,
	Collection extends keyof Schema,
>(astro: AstroGlobal, collection: Collection, cacheFn: () => Promise<TData>) {
	if (astro.locals.runtime == null || astro.locals.runtime.env.CACHE == null) {
		console.info(
			`Skipping cache due to running outside wrangler or in preview environment. Use pages:dev to test cache.`,
		);
		return await cacheFn();
	}

	if (astro.url.searchParams.has("preview")) {
		return await cacheFn();
	}

	const cache = astro.locals.runtime.env.CACHE;

	const cacheKey = astro.url.hostname.endsWith("atxrr.pages.dev")
		? astro.url.hostname.replace(".atxrr.pages.dev", "__") + collection
		: collection;

	const cacheData = await cache.get<TData>(cacheKey, "json");
	let data: TData;
	if (cacheData == null) {
		data = await cacheFn();
		await cache.put(cacheKey, JSON.stringify(data), {
			expirationTtl: TwoDays,
		});
	} else {
		data = cacheData;
	}
	return data;
}
