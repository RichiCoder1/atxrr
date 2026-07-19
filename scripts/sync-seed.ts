/**
 * Pull the live D1 schema into `.emdash/seed.json`.
 *
 * Mirrors the documented flow (https://docs.emdashcms.com/deployment/schema-evolution/)
 * with two departures forced by this project:
 *
 *   - `wrangler d1 export` refuses to dump a database containing FTS5 virtual
 *     tables ("cannot export databases with Virtual Tables (fts5)"), and EmDash
 *     creates them for page/post search. So the export names the tables
 *     explicitly, enumerated from the live database and filtered, rather than
 *     dumping everything. Enumerating (instead of hardcoding a list) means a
 *     table added by a future EmDash migration is picked up automatically.
 *
 *   - The docs pipe the dump through the `sqlite3` CLI, which is not a given on
 *     developer machines (it is absent on Windows by default). Node's built-in
 *     `node:sqlite` loads the dump with no extra dependency.
 *
 * `_emdash_migrations` is deliberately included in the export: `export-seed`
 * runs migrations when it opens the database, and without that table it tries
 * to recreate tables that already exist and fails.
 *
 * Usage:
 *   pnpm seed:sync                 # schema only (matches the committed seed)
 *   pnpm seed:sync --with-content  # also embed entries
 *
 * Reads D1_DATABASE / CLOUDFLARE_ACCOUNT_ID if you need to point it elsewhere.
 * Staging and production currently share one database, so there is nothing to
 * choose between by default.
 */
import { exec } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(exec);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PATH = join(ROOT, ".emdash", "seed.json");
const DATABASE = process.env.D1_DATABASE ?? "atxrr-cms";
const ACCOUNT_ID =
	process.env.CLOUDFLARE_ACCOUNT_ID ?? "80db9794f2580aa741a8fb8bbc3278e3";

/**
 * Quote a path for the shell. Everything interpolated is either a temp path we
 * generate or a table name from sqlite_master, so double quotes are enough for
 * both cmd.exe and sh.
 */
const q = (value: string) => `"${value}"`;

/** Shadow tables of an FTS5 virtual table, plus the virtual table itself. */
const isFtsTable = (name: string) => /_fts_|_fts$/.test(name);

/** Serialize with sorted keys so key ordering alone never reads as a change. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		const entries = Object.keys(value as object)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * Both CLIs print human-readable progress to stdout ahead of their payload
 * ("├ Checking…"), so the output is not parseable as-is. Scan for the first
 * bracket that parses cleanly to the end rather than assuming a fixed prefix.
 */
function extractJson<T>(stdout: string, what: string): T {
	for (let i = 0; i < stdout.length; i++) {
		const ch = stdout[i];
		if (ch !== "{" && ch !== "[") continue;
		try {
			return JSON.parse(stdout.slice(i)) as T;
		} catch {
			// keep scanning — this bracket was part of the progress output
		}
	}
	throw new Error(`No JSON found in ${what} output:\n${stdout}`);
}

async function sh(command: string, maxBuffer = 64 * 1024 * 1024) {
	const { stdout } = await run(command, {
		cwd: ROOT,
		env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
		maxBuffer,
	});
	return stdout;
}

async function listTables(): Promise<string[]> {
	// Must be --command, not --file: file ingestion reports query stats rather
	// than returning rows. The single quotes and `%` survive both cmd.exe and sh
	// unharmed inside the surrounding double quotes.
	const sql =
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
	const stdout = await sh(
		`pnpm exec wrangler d1 execute ${DATABASE} --remote --json --command "${sql}"`,
	);
	// Wrangler's --json shape has moved around between versions; accept both.
	const raw = extractJson<Record<string, any>>(stdout, "wrangler d1 execute");
	const rows: { name?: string }[] =
		raw?.[0]?.results ?? raw?.result?.[0]?.results ?? [];
	const names = rows.map((r) => r.name).filter((n): n is string => Boolean(n));
	if (names.length === 0) {
		throw new Error(`No tables returned for ${DATABASE}; refusing to export.`);
	}
	// `_cf_KV` and `_cf_METADATA` are Cloudflare's own bookkeeping, not schema.
	return names.filter((n) => !isFtsTable(n) && !n.startsWith("_cf_"));
}

function summarize(seed: {
	collections?: { fields?: unknown[] }[];
	taxonomies?: unknown[];
	menus?: { items?: unknown[] }[];
}) {
	// Menu items nest, so count children too — otherwise a nav restructure that
	// only moves items into submenus reads as "no change".
	const countItems = (items: unknown[] | undefined): number =>
		(items ?? []).reduce<number>(
			(n, item) =>
				n + 1 + countItems((item as { children?: unknown[] }).children),
			0,
		);
	return {
		collections: seed.collections?.length ?? 0,
		fields:
			seed.collections?.reduce((n, c) => n + (c.fields?.length ?? 0), 0) ?? 0,
		taxonomies: seed.taxonomies?.length ?? 0,
		menuItems: seed.menus?.reduce((n, m) => n + countItems(m.items), 0) ?? 0,
	};
}

async function main() {
	const withContent = process.argv.includes("--with-content");
	const workdir = await mkdtemp(join(tmpdir(), "emdash-seed-"));
	const sqlPath = join(workdir, "prod.sql");
	const dbPath = join(workdir, "prod.db");

	try {
		process.stdout.write(`Reading table list from ${DATABASE} (remote)...\n`);
		const tables = await listTables();
		process.stdout.write(
			`  ${tables.length} tables (FTS virtual tables excluded)\n`,
		);

		process.stdout.write("Exporting...\n");
		const tableArgs = tables.map((t) => `--table ${t}`).join(" ");
		await sh(
			`pnpm exec wrangler d1 export ${DATABASE} --remote ${tableArgs} --output ${q(sqlPath)}`,
		);

		process.stdout.write("Loading dump into a local SQLite file...\n");
		const db = new DatabaseSync(dbPath);
		db.exec(await readFile(sqlPath, "utf8"));
		db.close();

		process.stdout.write("Exporting seed...\n");
		const seedOut = await sh(
			`pnpm exec emdash export-seed --database ${q(dbPath)}` +
				(withContent ? " --with-content all" : ""),
			256 * 1024 * 1024,
		);

		const seed = extractJson<Record<string, unknown>>(seedOut, "export-seed");

		let previous: Record<string, unknown> | null = null;
		try {
			previous = JSON.parse(await readFile(SEED_PATH, "utf8"));
		} catch {
			// first run — no existing seed
		}
		const before = previous ? summarize(previous) : null;
		const after = summarize(seed);
		// Compare the documents themselves, not just the counts: a collection
		// gaining `search` support or a urlPattern leaves every count identical.
		const unchanged =
			previous !== null && stableStringify(previous) === stableStringify(seed);

		await writeFile(SEED_PATH, `${JSON.stringify(seed, null, "\t")}\n`);

		process.stdout.write(`\nWrote ${SEED_PATH}\n`);
		for (const key of Object.keys(after) as (keyof typeof after)[]) {
			const from = before?.[key];
			const delta =
				from === undefined || from === after[key] ? "" : `  (was ${from})`;
			process.stdout.write(`  ${key}: ${after[key]}${delta}\n`);
		}
		process.stdout.write(
			unchanged
				? "\nSeed already matched production.\n"
				: "\nSeed updated — commit it with the code that depends on the new schema.\n",
		);
	} finally {
		await rm(workdir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
