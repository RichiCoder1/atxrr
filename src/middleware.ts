import type { MiddlewareHandler } from "astro";

/**
 * Keep staging out of search results. It builds with the apex as SITE_URL, so
 * its pages carry canonical URLs pointing at production — exactly what gets a
 * mirror indexed.
 */
export const onRequest: MiddlewareHandler = async (_context, next) => {
	const response = await next();
	if (process.env.IS_STAGING === "true") {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}
	return response;
};
