import { createDirectus, rest, staticToken } from "@directus/sdk";
import { type Schema } from "./collections";

export function getDirectusClient() {
	let directus = createDirectus<Schema>(import.meta.env.PUBLIC_DIRECTUS_URL);

	if (import.meta.env.DIRECTUS_STATIC_TOKEN) {
		directus = directus.with(
			staticToken(import.meta.env.DIRECTUS_STATIC_TOKEN),
		);
	}
	return directus.with(rest());
}
