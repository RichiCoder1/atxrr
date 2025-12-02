/// <reference types="astro/client" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;
type ENV = {
	CACHE: KVNamespace;
	ENVIRONMENT?: string;
	PUBLIC_DIRECTUS_URL: string;
	DIRECTUS_STATIC_TOKEN?: string;
};

// Depending on your adapter mode
// use `AdvancedRuntime<ENV>` for advance runtime mode
// use `DirectoryRuntime<ENV>` for directory runtime mode
type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;
declare namespace App {
	interface Locals extends Runtime {}
}
