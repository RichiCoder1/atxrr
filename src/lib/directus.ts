import { type Schema } from "./collections";
import { createDirectus, rest, staticToken } from "@directus/sdk";

export function getDirectusClient() {
	let directus = createDirectus<Schema>(import.meta.env.PUBLIC_DIRECTUS_URL);

	if (import.meta.env.DIRECTUS_STATIC_TOKEN) {
		directus = directus.with(
			staticToken(import.meta.env.DIRECTUS_STATIC_TOKEN),
		);
	}
	return directus.with(rest());
}

export type DirectusClient = ReturnType<typeof getDirectusClient>;
