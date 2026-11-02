# Verification record

Checks ran in the execution environment on 2 November 2026, without GitHub Actions. The backend used .NET 10 and real PostgreSQL 17 in a dedicated development project. Demonstration clubs and QA records are explicitly labelled. The frontend browser checks used Chromium at desktop 1440px and mobile 390px widths, with selected axe accessibility checks.

## Evidence

| Check | Evidence | Scope |
|---|---|---|
| Unit tests | [TRX](evidence/unit.trx), [output](evidence/unit-tests.txt) | Validation, signed raw-body webhooks, tenant filters/relationships, session refresh, connection revocation, provider keys and currency conversions |
| Provider integration | [TRX](evidence/integration.trx) | Real hosted API, Identity cookies, CSRF, migrations and PostgreSQL; simulated Stripe HTTP transport; activity checkout/payment/refund, expired membership checkout, subscription lost-response recovery and retired events |
| API workflows | [results](evidence/api-tests.json) | Club/role boundaries, registrations under contention, guardian eligibility, files, persistent messaging, reconnect and revocation, payments and signed duplicate events |
| Targeted integrity | [results](evidence/targeted-api.json) | Composite database constraints, resource exclusion, registration attempt reuse and late callbacks, active-member allowance |
| Advanced workflows | [results](evidence/advanced-tests.json) | Membership fees/renewal, reminders, notification opt-out, verification/onboarding/invitations, support/CMS/audit, expired paid reservations and refund retry |
| API contracts | [results](evidence/contracts.json), [OpenAPI](openapi.json) | Runtime schema assertions and exported API definitions |
| Full browser suite | [results](evidence/browser-tests.json) | 79 checks covering public/auth/member/staff/admin pages, responsive layouts, selected accessibility and form-driven publish/register/attendance |
| Focused browser regression | [results](evidence/browser-regression.json) | Staff permissions, draft edit/publish/cancel, offline handling, separate-browser chat/reconnect, public trial enquiry and staff follow-up |
| Restart persistence | [results](evidence/restart-test.json) | An existing session and saved messages remain valid after stopping/restarting the API with retained database/keys |
| Performance smoke | [results](evidence/performance.json) | Twelve authenticated bounded activity-list requests against PostgreSQL; not a concurrent scale benchmark |
| Production builds and lint | [frontend](evidence/frontend-build.txt), [backend](evidence/backend-build.txt), [lint](evidence/lint.txt) | Optimised Next.js build with TypeScript, .NET Release publish, ESLint |
| Dependency advisory snapshot | [npm production dependencies](evidence/npm-audit.json), [NuGet API dependencies](evidence/dotnet-audit.json) | No known vulnerabilities reported by the registries at verification time; not a security certification |
| GitHub Actions safety | [snapshot](evidence/github-actions-safety.json) | No workflow files on the default branch or release candidate; repository workflow history empty at the pre-publication check |
| Final sequential regression | [results](evidence/release.json) | Exit status and duration of the final API, targeted, advanced, contract, focused browser and performance suites |

## Practical limits

Provider transport simulation tests request headers, amounts, expiry bounds, stable idempotency keys, signed callbacks and durable state transitions. They do not establish a live Stripe integration or card acceptance. No live charge/refund, merchant approval, email delivery, real-device background push or AI completion is claimed. Development inbox entries are local sink records.

The supplied container configuration and encrypted backup/recovery scripts were inspected; shell syntax checks passed. Docker image execution and an encrypted restore drill were unavailable in this environment. Browser accessibility checks sample important pages and states, not every possible combination or a formal accessibility certification. Performance results are a small environment-specific smoke measurement.

The release is isolated from the existing production branch and deployment. See [launch dependencies](launch-dependencies.md) for host/provider, operational and business acceptance still required before customer launch.
