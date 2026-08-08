# E-commerce API

A REST API over [dummyjson.com/products](https://dummyjson.com/products), backed by **MySQL** (system of record) and **Elasticsearch** (search), built with Node.js/TypeScript/Express/Prisma.

## How to run it

```bash
docker compose up
```

That's it — no manual steps. This brings up MySQL and Elasticsearch, waits for both to report healthy, runs a one-shot `seed` job that fetches all 194 products from dummyjson, migrates the schema, upserts everything into MySQL, and indexes it into Elasticsearch, then starts the API on **http://localhost:3000** once seeding has completed successfully (the `api` container won't even start until `seed` exits `0` — see `docker-compose.yml`'s `condition: service_completed_successfully`).

MySQL (`localhost:3306`) and Elasticsearch (`localhost:9200`) ports are also published to the host, so you can inspect either directly (e.g. connect a DB client, or `curl localhost:9200/products/_search`) while the stack is running.

To tear everything down (including the data volumes, for a clean re-seed next time):
```bash
docker compose down -v
```

### Endpoints

| Endpoint | Store | Notes |
|---|---|---|
| `GET /categories` | MySQL | All categories |
| `GET /products` | MySQL | Paginated (`page`, `limit`, default 20, max 100) |
| `GET /products/:id` | MySQL | Full detail incl. images, tags, reviews |
| `GET /products?query=<term>` | Elasticsearch | Full-text search across title/description/brand/tags |
| `GET /products?category=<name>` | Elasticsearch | Exact category filter; combinable with `query` |
| `GET /health` | — | Liveness check |

### Local development (without Docker, for iterating on code)

Requires Node 20+ and a running MySQL + Elasticsearch (`docker compose up mysql elasticsearch` works well for this — just the infra, no app containers).

```bash
npm install
cp .env.example .env   # then point DATABASE_URL/ELASTICSEARCH_NODE at your local instances
npx prisma migrate deploy   # NOT `migrate dev` — the app's DB user only has
                             # privileges on its own database (see "MySQL
                             # user privileges" below), and `migrate dev`
                             # needs a shadow database it can't create
npm run seed
npm run dev             # http://localhost:3000, restarts on file change
```

`.env` is loaded automatically (via `dotenv`, imported at the top of `src/config/env.ts`) — every entry point (`dev`, `seed`, `start`) picks it up the same way. Docker never touches this file at all (it's excluded via `.dockerignore`); `docker-compose.yml`'s own `environment:` blocks are fully self-contained with inline defaults, so `docker compose up` needs no `.env` to work.

### Tests

```bash
npm test                 # unit tests — pure logic, no external dependencies
npm run test:integration # runs against the real MySQL + Elasticsearch from `docker compose up`
```

## Thought process and trade-offs

**Why MySQL *and* Elasticsearch, rather than one store doing everything.** The assignment asks for both, and the honest reason to actually split reads between them is that each is good at something different: MySQL is the natural fit for a simple paginated listing and exact lookup by id; Elasticsearch is the natural fit for full-text search and faceted filtering, which is the entire reason it exists. So `/products` (plain) and `/products/:id` are served from MySQL; `?query=` and `?category=` are served from Elasticsearch. This also means MySQL stays queryable as a ground truth independent of Elasticsearch — useful if the index is ever stale or wrong.

An alternative I considered and deliberately didn't take: routing *all* reads through Elasticsearch (treating MySQL as a pure write-side store, CQRS-style). That pattern earns its complexity when write and read load are both significant and need to scale independently, or the read shape genuinely diverges from the write shape — neither is true for a ~200-row catalog seeded once. It would also mean MySQL is never actually read by the API, which undercuts the point of the exercise.

**Elasticsearch field types match how each field is actually queried, not just its data type.** `category`/`sku` are `keyword` (exact filter only, never in free-text search); `brand`/`tags` are `text`, same as `title`/`description`, because they're part of the `multi_match` search fields — mapping them `keyword` would have made search on them silently case- and whole-string-sensitive while every other searched field behaved normally. This wasn't caught by review, it was caught by actually querying the running stack (`?query=gadgetmaster` returning 0 results against a product with `brand: "GadgetMaster"`) and fixing the mapping, not just noting it as a known issue.

**Elasticsearch is a derived, rebuildable index, not a second source of truth.** It's populated only by the seed script and never written to by request handlers. The explicit trade-off: MySQL and Elasticsearch are not kept in sync by any live mechanism. That's fine for a catalog seeded once from a static dataset; it would not be fine if products were being created/updated continuously in production without a corresponding write-path into Elasticsearch (e.g. via change-data-capture or dual-write with a queue).

**MySQL user privileges.** The app connects as `ecom`, which the official `mysql` image scopes to `GRANT ALL PRIVILEGES ON ecom.* TO ecom` — full read/write/DDL on its own database, nothing on any other database, no admin operations. `root` is never used by any running container. One consequence worth knowing: `prisma migrate dev` (used only when actively changing `schema.prisma` during development) needs to create a throwaway shadow database to diff against, which requires `CREATE DATABASE` privilege that `ecom` deliberately doesn't have — that command needs a privileged user (e.g. `root`) and is never run inside a container. `prisma migrate deploy` (what both the Docker `seed` service and the local-dev instructions above use) just applies already-generated migration files and needs no such privilege, which is why it's the one wired into the actual running system.

**Schema normalization decisions** (see `.claude/plans/ecom-api-plan.md` for the full reasoning trail):
- `categories(id, name unique)` — `name` is dummyjson's raw category string; no separate `slug`, since the source data doesn't distinguish a display name from a URL-safe one.
- `product_images`, `product_tags`, `product_reviews` are real relational tables, not JSON columns — each row is a genuine, independently-shaped record (own url/position, own tag, own rating/comment/reviewer), so normalizing them is the correct default rather than collapsing them into JSON blobs on `products`.
- `thumbnail` stays a denormalized column on `products` rather than living in `product_images`: it's semantically a different kind of thing (a display rendition, not a gallery image), and it's needed on every row of the highest-traffic endpoint (`/products` listing) — avoiding a join there is worth the minor duplication, especially since the seed script is the only writer of both fields and they can't drift out of sync from concurrent writes.
- `Product.id` is not auto-generated — it's dummyjson's own product id, preserved as-is, so `/products/:id` maps directly onto the source dataset.

**Layering.** `routes → controller → service → repository`, one direction of dependency. Repositories translate Prisma's generated types into plain domain interfaces (`src/modules/*/*.types.ts`) before they leave the repository — `@prisma/client` types never reach the service or controller layer, so a schema change can't silently ripple into business logic or response shapes.

**Validation and errors.** Request query/params are validated at the edge via `zod` schemas, wired in as Express middleware rather than inline in controllers, so a controller only ever runs against already-valid, already-typed data. All thrown errors are typed (`NotFoundError`, `ValidationError`, both extending `AppError`), mapped to HTTP responses by one central error-handling middleware — no scattered `try/catch` per route.

**Testing.** Table-driven tests (`it.each`) for pure functions and many-input-shape validation (pagination math, zod schema edge cases, the MySQL-vs-Elasticsearch routing decision, with the repository/search dependencies mocked so the test never touches a real DB or ES connection); an integration suite that runs the real Express app against the real MySQL/Elasticsearch from `docker compose up` (no mocks), exercising every endpoint including its validation-error and 404 paths. The seed script itself (`scripts/seed.ts`) has no dedicated automated test — it's exercised indirectly every time `docker compose up` runs and the integration suite passes against its output, but that's coverage-by-consequence, not a real test of the script's own logic (e.g. its upsert/idempotency behavior on a second run is unverified).

## Known limitations

- **Elasticsearch/MySQL consistency is seed-time only.** There's no live sync mechanism; re-running the seed script is the only way to bring the index back in line with MySQL after a manual change to either.
- **Reviews are returned by `GET /products/:id` but not independently queryable or paginated.** They're modeled relationally (`product_reviews`) and included in full on the detail response; there's no `GET /products/:id/reviews` or review-level pagination, since the assignment doesn't call for one.
- **No caching layer.** Every request hits MySQL or Elasticsearch directly. Fine at this scale; would need revisiting under real load.
- **No authentication/authorization.** Out of scope for the assignment — all endpoints are public reads.
- **The Elasticsearch mapping (`src/search/productsIndexMapping.ts`) and the `ProductDocument` domain type are kept in sync by hand.** Nothing enforces that a field added to one exists in the other.
- **Single-node Elasticsearch, no replicas.** Appropriate for local/dev; a production setup would need a proper cluster.
- **Full-text search matches whole tokens, not substrings.** `?query=phone` won't match a product titled "iPhone X" (`iPhone` indexes as one token, `iphone`, not two), and `?query=Gadget` won't match a brand `GadgetMaster`. This is standard-analyzer behavior, the same as any out-of-the-box Elasticsearch text search — partial/substring matching would need an n-gram analyzer or wildcard queries, which is a bigger feature not implemented here.
- **`scripts/seed.ts` has no dedicated automated test.** It's designed to be idempotent (upsert + delete-then-recreate on child rows); manually re-running it against an already-seeded database was verified to produce identical row counts with no duplication, but that's a one-off manual check made during development, not something an automated test guards against regressing.
