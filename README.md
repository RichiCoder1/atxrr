# atxrubberroundup.com

Astro site for the Austin Rubber Roundup, rendered on Cloudflare Workers with
[EmDash](https://docs.emdashcms.com) as the CMS (D1 for content, R2 for media).

## Commands

| Command | Action |
| :------ | :----- |
| `pnpm dev` | Dev server on `localhost:4321` (admin at `/_emdash/admin`) |
| `pnpm build` | `astro check` then a production build into `./dist/` |
| `pnpm test` | Component tests (Vitest browser mode, real Chromium) |
| `pnpm test:e2e` | End-to-end smoke test (Playwright, starts its own dev server) |
| `pnpm seed:sync` | Pull the live D1 schema into `.emdash/seed.json` |

Node and pnpm are pinned by `.node-version` and `packageManager`; CI honours both.

## Environments

Both environments share one D1 database and one R2 bucket, so content migrated
once is visible from both.

| Worker | Domain |
| :----- | :----- |
| `atxrr-production` | `atxrubberroundup.com`, `www.atxrubberroundup.com` |
| `atxrr-staging` | `staging.atxrubberroundup.com` |

## Deploying

The environment must be chosen at **build** time, not deploy time:

```sh
CLOUDFLARE_ENV=production SITE_URL=https://atxrubberroundup.com pnpm build
pnpm exec wrangler deploy
```

`wrangler deploy --env production` does **not** work. The Astro Cloudflare
adapter writes `dist/server/wrangler.json` and points wrangler at it via
`.wrangler/deploy/config.json`; that generated file is already flattened to one
resolved environment, so `--env` has nothing to select and is ignored. The
deploy silently lands on the default `atxrr` worker with empty `vars` and no
custom domain, while still reporting success.

`SITE_URL` is needed at build time too — it becomes Astro's `site`, so canonical
URLs and OG tags bake it in. It is separate from the runtime `SITE_URL` var in
`wrangler.toml`.

Before deploying, confirm the generated config resolved correctly:

```sh
node -e "const c=require('./dist/server/wrangler.json');console.log(c.name,c.vars,c.routes)"
```

### Cache turnover after a deploy

Content pages are served `public, max-age=300, stale-while-revalidate=3600`, and
asset filenames are content-hashed. For up to ~5 minutes after a deploy the edge
can still serve HTML from the previous build, whose `_astro/*.js` URLs no longer
exist — pages render and links work, but the hydrated islands (day tabs, event
search, mobile nav, FAQ) stay inert until the cache turns over. It resolves on
its own; a cache purge would avoid it, which needs an API token with
`Zone:Cache Purge`.

## Automatic deploys (Workers Builds)

Each Worker is connected to this repository separately, under **Settings →
Builds** for that Worker in the Cloudflare dashboard. Because the environment is
selected at build time, it is carried by a build variable rather than a flag:

| Setting | `atxrr-production` | `atxrr-staging` |
| :------ | :----------------- | :-------------- |
| Build command | `pnpm build` | `pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` | `pnpm exec wrangler deploy` |
| Build variables | `CLOUDFLARE_ENV=production`, `SITE_URL=https://atxrubberroundup.com` | `CLOUDFLARE_ENV=staging`, `SITE_URL=https://staging.atxrubberroundup.com` |

Leave the deploy command bare, for the same reason `--env` is not used above.

If Cloudflare offers a pull request renaming `name` in `wrangler.toml` to match
the dashboard Worker, decline it. The top-level name is `atxrr` and the
per-environment names (`atxrr-production`, `atxrr-staging`) are derived from it;
rewriting it breaks that derivation for the other environment.
