import type { MiddlewareHandler } from "astro";

/**
 * Keep staging out of search results.
 *
 * Staging runs on a subdomain of the live domain (so one passkey covers both)
 * and builds with the apex as SITE_URL, which means its pages carry canonical
 * URLs pointing at production. That combination is exactly what gets a mirror
 * indexed, so the staging deploy sets IS_STAGING and we mark every response
 * noindex. Production leaves the header off entirely.
 */
export const onRequest: MiddlewareHandler = async (_context, next) => {
	const response = await next();
	if (process.env.IS_STAGING === "true") {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}
	return response;
};
