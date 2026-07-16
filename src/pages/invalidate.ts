import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import * as v from "valibot";

const directusSchema = v.variant("event", [
	v.object({
		event: v.literal("items.sort"),
		collection: v.string(),
		item: v.union([v.string(), v.number()]),
	}),
	v.object({
		event: v.string("items.update"),
		collection: v.string(),
		keys: v.array(v.union([v.string(), v.number()])),
		payload: v.any(),
	}),
	v.object({
		event: v.string("items.create"),
		collection: v.string(),
		key: v.union([v.string(), v.number()]),
		payload: v.any(),
	}),
	v.object({
		event: v.string("items.delete"),
		collection: v.string(),
		keys: v.array(v.union([v.string(), v.number()])),
		payload: v.any(),
	}),
]);

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json();
	const eventBody = v.parse(directusSchema, body);

	await env.CACHE?.delete(eventBody.collection);

	return new Response(null, { status: 204 });
};
