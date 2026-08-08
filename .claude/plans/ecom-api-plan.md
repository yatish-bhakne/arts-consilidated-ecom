# E-commerce API — Project Plan

Business/project-specific decisions for this assignment. General engineering
conventions (layering, error handling, config, docker, testing) are defined
once in `.claude/conventions/backend-service-conventions.md` and apply here
without repetition — this file only covers what's specific to _this_ system.

## Assignment recap

Build a REST API over `https://dummyjson.com/products` data, backed by MySQL
(system of record) and Elasticsearch (search), fully runnable via
`docker compose up`. Endpoints: `/categories`, `/products`,
`/products/{id}`, `/products?query=`, `/products?category=`.

## Stack chosen for this project

(Following the general conventions above.)

- Express (no heavier framework needed for four endpoints)
- Prisma against MySQL
- `@elastic/elasticsearch` official client

## MySQL schema

- `categories(id, name unique)` — `name` is dummyjson's raw category string
  (e.g. `home-decoration`).
- `products(id, title, description, category_id FK -> categories.id, price,
discount_percentage, rating, stock, brand, sku unique, weight, width,
height, depth, warranty_information, shipping_information,
availability_status, return_policy, minimum_order_quantity, thumbnail,
created_at, updated_at)` — `thumbnail` stays a plain column, not a pointer
  into `product_images`. Weighed both ways: but opted for keeping as `products`
- `product_images(id, product_id FK, url, position)` — real one-to-many,
  each image is a record with its own shape/ordering, never shared across
  products; kept as a proper table rather than a JSON column on `products`.
- `product_tags(product_id FK, tag)` — composite key, same reasoning.
- `product_reviews(id, product_id FK, rating, comment, reviewer_name,
reviewer_email, reviewed_at)` — dummyjson ships this data; modeling it
  relationally is part of "proper schema," even though no endpoint reads it
  yet. Called out in the README as present-but-unused.

## Elasticsearch

Single `products` index, rebuilt entirely by the seed script (never written
to by request handlers). Mapping: `id`/`sku`/`category`/`brand`/`tags` as
`keyword` (exact filter + aggregation), `title`/`description` as plain
`text` (full-text search only — no endpoint needs exact-match, sort, or
aggregation on title, so no `keyword` sub-field).

## Read routing (the core design decision of this system)

- `GET /categories` → MySQL `DISTINCT` categories.
- `GET /products` (no params) → MySQL, paginated (`page`, `limit`, default
  20, cap 100).
- `GET /products?query=...` → ES `multi_match` across
  title/description/brand/tags.
- `GET /products?category=...` → ES `term` filter on `category` keyword.
  `query` and `category` combine into a single ES call when both are given.
- `GET /products/:id` → MySQL, with images/tags/reviews joined in.

**Trade-off to state explicitly in the README**: MySQL and ES are not kept in
sync by any live mechanism. ES is a derived, rebuildable index populated only
at seed time — acceptable for a catalog seeded once from a static dummy
dataset, not acceptable if products were being written continuously.

## Compose boot order

`mysql` + `elasticsearch` (healthy) → `seed` service (fetch dummyjson → MySQL
upsert → ES bulk index, idempotent, exits non-zero on partial failure) → `api`
(depends on `seed` completing successfully). Result: `docker compose up`
alone yields a fully populated, queryable API.

## Build sequencing / agent task breakdown

This is one cohesive TypeScript codebase — Prisma's generated types and the
ES mapping shape flow into nearly every file, so the foundational layers are
built sequentially by a single agent/session rather than split across agents
that can't see each other's work. Parallel agents are used only where two
work items are independent _after_ that foundation exists.

1. **Scaffold** (sequential) — `package.json`/`tsconfig`/lint config, folder
   skeleton, config loader, logger, error classes, error middleware,
   request-id middleware. Establishes the shared conventions every later
   file imports.
2. **Data layer** (sequential, depends on 1) — `prisma/schema.prisma` +
   migration; ES mapping JSON + `search/esClient.ts` wrapper.
3. **Seed script** (sequential, depends on 2) — fetch, map, upsert MySQL,
   bulk-index ES, idempotent, fails loudly on partial failure.
4. **API modules** (parallelize once 1+2 land):
   - Agent A — products module (routes/controller/service/repository/search
     query builder/zod schemas)
   - Agent B — categories module (same pattern, smaller surface)
     Both briefed explicitly on the response/pagination/error contract from
     steps 1–2 so they don't diverge; diffs reviewed together before merging.
5. **Docker** (parallelizable with 4 — no code dependency) — Dockerfile,
   docker-compose.yml, the completion-gated dependency chain above.
6. **Tests** (after 4 stabilizes) — unit tests per module (parallelizable by
   module), integration tests against real MySQL+ES in Docker.
7. **README** — written last, summarizing decisions already recorded in this
   file rather than re-deriving them.

## Verification gates between phases

- After 2: `prisma migrate dev` runs clean; ES mapping applies without error
  against a local ES container.
- After 4: both modules build (`tsc --noEmit`) and lint clean before tests
  start.
- After 5: `docker compose up` from a cold state reaches a running,
  queryable API with no manual steps.
- Before 7: full `docker compose up` + a manual smoke test of all four
  endpoints.
