/// <reference types="astro/client" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

declare module "cloudflare:workers" {
	interface Env {
		CACHE?: KVNamespace;
		ENVIRONMENT?: string;
		PUBLIC_DIRECTUS_URL: string;
		DIRECTUS_STATIC_TOKEN?: string;
	}
	export const env: Env;
}
