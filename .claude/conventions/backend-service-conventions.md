# Backend Service Conventions

## Language & tooling

- TypeScript, `strict: true`. No `any` used to paper over a type you haven't
  modeled yet — model it or narrow it.
- ESLint + Prettier, enforced in CI (or at minimum a pre-commit/lint script),
  not left to reviewer taste.
- Prefer explicit composition (new DI wiring) unless specified.

## Layering

`routes → controller → service → repository`, dependencies point one
direction only.

- **routes**: wiring only — path, HTTP verb, which controller method.
- **controller**: HTTP concerns (parse request, validate input, shape
  response, map errors to status codes). No business logic.
- **service**: business logic. No knowledge of `req`/`res`.
- **repository**: the only layer that talks to a datastore. Swappable
  without touching business logic.
- ORM/driver-generated types (e.g. Prisma's generated client types) never
  leak past the repository. Repositories map them into plain domain
  interfaces that the service/controller layers depend on instead — otherwise
  "swappable without touching business logic" is fiction, since a schema
  migration would ripple straight into services and response shapes.

## Config & environment variables

- All configuration comes from environment variables. No hardcoded hosts,
  ports, credentials, or feature flags in source.
- A single config module loads and validates env vars **at process startup**
  — the process should fail immediately with a clear error if a required
  var is missing or malformed, not fail confusingly on first use later.
- Ship a `.env.example` alongside every service listing every var the
  service reads, with a comment on what it's for and a safe example value.
  Never commit a real `.env`.
- Secrets (DB passwords, API keys) are env vars like everything else in
  local/dev; how they're injected in higher environments is out of scope for
  the service code itself.

## Error handling

- Domain errors are typed classes (e.g. `NotFoundError`, `ValidationError`),
  thrown from services/repositories.
- One error-handling middleware at the edge maps typed errors to HTTP status
  codes. No `try/catch` + manual `res.status(...)` scattered through
  controllers.
- Unexpected (unhandled) errors are logged with full context and returned as
  a generic 500 — never leak stack traces or internal details to the client.

## Logging

- Structured (JSON) logs, one logger instance shared via a small wrapper
  module — not `console.log`.
- Every request gets a request-id (generated or propagated from an incoming
  header), included in every log line for that request, and echoed back in
  the response headers.
- Log at service/repository boundaries when something notable happens
  (external call made, external call failed, retried). Don't log inside
  tight loops or on the happy path of trivial operations.

## Docker

- Multi-stage Dockerfiles: install deps → build → copy only build output +
  production deps into a slim runtime image. Never ship dev dependencies or
  source TypeScript in the runtime image.
- Every long-running service in `docker-compose.yml` gets a real
  `healthcheck` (actual readiness probe, not a fixed sleep).
- One-shot jobs (migrations, seeding) are their own compose service, gated
  with `depends_on: condition: service_completed_successfully` on anything
  that needs them to have finished — never a hardcoded sleep/retry loop to
  simulate "wait until ready."
- The whole point of `docker compose up` is zero manual steps. If a reviewer
  has to run a command by hand after `up` for the system to be usable, that's
  a bug in the compose setup, not a documentation gap.

## Testing

- Unit tests for services and repositories (pure logic, no network).
- Integration tests for the HTTP layer run against real dependencies
  (real MySQL, real Elasticsearch, in Docker) rather than mocks — a passing
  mocked test that doesn't catch a real schema/query mismatch is worse than
  no test.
- Tests are part of "done," not a follow-up task.

## Documentation

- Every service ships a README covering: how to run it locally, the
  reasoning behind non-obvious decisions and trade-offs, and known
  limitations. Written last, after the implementation has settled, so it
  describes what was actually built rather than what was planned.
