import { definePlugin } from "emdash";

/** Native entrypoint: EmDash calls this and expects a ResolvedPlugin back. */
export function createPlugin() {
	return definePlugin({
		id: "atxrr-extensions",
		version: "1.0.0",
		// Without this the content:beforeSave hook is skipped at load, silently.
		capabilities: ["content:write"],
		hooks: {
			"content:beforeSave": async (event) => {
				if (event.collection !== "events") return;

				const { event_start, event_end } = event.content;
				if (typeof event_start !== "string" || typeof event_end !== "string") {
					return;
				}

				// Stored as naive wall-clock; compare as UTC so neither side drifts.
				const start = Date.parse(`${event_start}Z`);
				const end = Date.parse(`${event_end}Z`);
				if (Number.isNaN(start) || Number.isNaN(end)) return;

				if (end <= start) {
					throw new Error(
						`End (${event_end}) must be after start (${event_start}). ` +
							`An event ending after midnight needs the next day's date.`,
					);
				}
			},
		},
	});
}
