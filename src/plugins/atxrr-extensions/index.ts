import type { PluginDescriptor } from "emdash";

export function atxrrExtensions(): PluginDescriptor {
	return {
		id: "atxrr-extensions",
		version: "1.0.0",
		entrypoint: "@/plugins/atxrr-extensions/plugin",
		format: "native",
	};
}
