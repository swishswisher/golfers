# Clubline (Golfers)

A sports club service for clubs worldwide, built with Next.js/React/TypeScript and an authoritative .NET 10 / PostgreSQL / SignalR backend. The Golfers repository and Git history are retained. Clubline is the working product identity.

Public website, self-service club creation, verified account/invitation flows, membership imports, families and guardians, team coaching, activities and announcements, capacity-safe registrations/waitlists, attendance, facilities, persistent chat, opt-in notifications, fees/refunds, software subscriptions, club pages, support and platform administration are implemented.

English is the launch interface. Clubs configure sports, country, currency, IANA time zone and branding. Online payments depend on merchant-country/provider availability. Native apps, federation scoring, handicaps and external tee-time integrations are later phases.

## Run locally

Requirements: Node 24+, .NET SDK 10, PostgreSQL 17+, and a browser. No GitHub Actions are used.

```bash
npm ci
dotnet tool restore
dotnet restore Clubline.slnx
cp .env.example .env.local
```

Set the frontend values in `.env.local`. Export the ASP.NET configuration values from `.env.example` through your shell or secret manager; Next.js dotenv files do not configure the .NET process. Use the same public origin in `App__PublicUrl` and the browser. Run migrations and the API:

```bash
dotnet run --project api/Clubline.Api -- --migrate
dotnet run --project api/Clubline.Api --no-launch-profile --urls http://localhost:5225
npm run dev
```

The browser calls relative `/api` and `/hubs` URLs. Next.js proxies these to `API_INTERNAL_URL`; the .NET API owns identity, club membership, permissions and data. Do not expose PostgreSQL publicly or replace the .NET API with frontend demo state.

## Isolated demonstration

Use a separate database. Set `ASPNETCORE_ENVIRONMENT=Development`, `App__SeedDemo=true`, `App__DevelopmentInbox=true` and `NEXT_PUBLIC_DEMO_MODE=true`. Run migrations before startup. Seeding refuses to run in Production.

Fictional accounts: `manager`, `coach`, `treasurer`, `caterer`, `member`, `member2`, `guardian`, `outside`, and `platform` at `clubline.test`. Development password: `ClublineDemo!2026`. `manager` owns Harbour; `outside` owns a separate Riverside club. The development inbox is a local sink, not delivered email. Never expose a development inbox or these accounts on a customer production instance.

`scripts/configure-local.py`, `run-api.py` and `proxy-postgres.mjs` are optional execution-environment helpers. The latter uses Neon's documented TLS WebSocket PostgreSQL transport while respecting the configured HTTPS proxy. Production uses a normal PostgreSQL connection. Local settings and credentials are ignored by Git.

`npm run build && npm run start` runs the standalone production frontend locally; the helper stages its public/static assets before starting. Export the API runtime variables for the chosen host.

## Checks

```bash
npm run lint
npm run build
dotnet test api/Clubline.Tests
dotnet publish api/Clubline.Api -c Release
node tests/api.mjs
node tests/advanced.mjs
node tests/contracts.mjs
node tests/browser.mjs
node tests/release.mjs
```

Integration scripts require the isolated demo API at port 5225 and ignored `.local/settings.json` with a test PostgreSQL connection; they deliberately create labelled QA records. `tests/browser.mjs` uses the Next.js server at port 3000 and Playwright Chromium (or `CHROMIUM_PATH`). See [verification](docs/verification.md) for the actual evidence and limitations. Provider boundary tests use controlled HTTP handlers; no live payment success is claimed. `api/Clubline.IntegrationTests` hosts the real API with cookies/CSRF and an isolated PostgreSQL database. Supply its test database through `ConnectionStrings__Database` plus the test configuration in `scripts/run-integration.py`, or create `clubline_gateway_tests` under the local test role and run that helper. It applies all migrations and creates labelled demonstration clubs, so use only an isolated test database. Never point these tests at customer production.

## Release and operation

- [Architecture, roles and contracts](docs/architecture.md)
- [Deployment and configuration](docs/deployment.md)
- [Backup and recovery](docs/recovery.md)
- [Service workflows and acceptance](docs/service-map.md)
- [Remaining launch dependencies](docs/launch-dependencies.md)

Dockerfiles and `deploy/compose.yaml` describe a single API instance with persistent data and a same-origin TLS edge. No automatic Actions workflows are present. The existing production branch/deployment is preserved; release requires an explicit operator decision after staging checks.
