import { type Schema } from "./collections";
import { createDirectus, rest, staticToken } from "@directus/sdk";
import type { AstroGlobal } from "astro";

export function getDirectusClient(astro: AstroGlobal) {
	const env = astro.locals.runtime.env;
	let directus = createDirectus<Schema>(env.PUBLIC_DIRECTUS_URL);

	if (env.DIRECTUS_STATIC_TOKEN) {
		directus = directus.with(staticToken(env.DIRECTUS_STATIC_TOKEN));
	}
	return directus.with(rest());
}

export type DirectusClient = ReturnType<typeof getDirectusClient>;
