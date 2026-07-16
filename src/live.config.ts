import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

// EmDash's query helpers (getEmDashCollection/getEmDashEntry/getMenu) resolve
// through this live collection — it must be registered even though pages only
// use the helper functions.
export const collections = {
	_emdash: defineLiveCollection({ loader: emdashLoader() }),
};
