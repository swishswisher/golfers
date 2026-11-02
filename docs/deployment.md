# Deployment

The supplied target is a container host with persistent PostgreSQL and API storage. Next.js, the .NET API and SignalR share one public HTTPS origin. Existing production is not overwritten by setup scripts.

1. Choose an isolated staging hostname and host with Docker Compose. Create a private environment file from `.env.example`, using new credentials and the actual hostname. Generate a high-entropy hexadecimal database password (for example, `openssl rand -hex 32`) so it is safe in the Compose connection-string field.
2. From `deploy`, run `docker compose --env-file /private/clubline.env config --quiet`, then `docker compose --env-file /private/clubline.env build`.
3. Run `docker compose --env-file /private/clubline.env up -d`. The one-shot migration service completes before the API starts. Caddy obtains TLS for `PUBLIC_HOST`; DNS must already point to the host.
4. Verify `/health/ready` inside the API container, public identity/CSRF flows, separate-session messaging, registration and restore procedures. Keep the database/API ports private.
5. Bootstrap an administrator with a one-shot API invocation using `--bootstrap-admin` and secret-manager-injected `Bootstrap__Email` / `Bootstrap__Password`. It refuses to alter an existing account. Delete bootstrap variables immediately. No production administrator or default password is seeded.
6. Configure providers and run their sandbox acceptance flows before accepting money or claiming email/push delivery. Route customer traffic only after the launch dependencies are resolved.

Docker/Compose image execution was not available in the coding environment. Application production builds and API/database/browser checks are recorded separately; do not interpret the configuration as a completed container-host rollout.

## Required configuration

- `ConnectionStrings__Database`: PostgreSQL connection, TLS `VerifyFull` when connecting over a public network; use a migration role separately from a least-privilege runtime role.
- `App__PublicUrl`: exact browser origin; no trailing path. Cookies, links and origin checks depend on it.
- `App__DataPath`: persistent private directory for Data Protection keys and private uploads. Back up it with the database. Restrict filesystem access to the API user.
- `API_INTERNAL_URL`: frontend server's private API address. Next.js rewrites use the value at build time; rebuild when changing it. Docker passes it as a build argument and runtime variable.
- `NEXT_PUBLIC_APP_URL`: public metadata URL. Set `NEXT_PUBLIC_DEMO_MODE=false` for customer production.
- `ASPNETCORE_ENVIRONMENT=Production`, `App__SeedDemo=false`, `App__DevelopmentInbox=false`, `App__MigrateOnStart=false` on the normal API process.

## Providers

Email: Resend API key, verified sender/domain and `Email__From`. The service records provider acceptance, not mailbox delivery. Configure provider monitoring, bounces and an operational support address before rollout.

Web push: generate VAPID keys with a trusted Web Push library, supply public/private keys and a real `mailto:` subject. Serve HTTPS, keep the worker at `/sw.js`, and test actual supported browsers, installed iOS PWA behaviour and consent. In-app notifications work independently. Live browser push was not verified without these keys/devices.

Stripe: provide the platform secret key, webhook signing secret and configured monthly USD Community/Club price IDs. Configure the endpoint `/api/webhooks/stripe` for platform subscription/invoice and connected-account payment/refund/account events. This implementation pins API version `2024-06-20`; configure the webhook endpoint to that version. Set `Billing__ConnectWebhookSecret` for the Connect destination when its signing secret differs. Both trusted destinations are verified; `Billing__LiveMode` must match event livemode (`false` for sandbox, explicitly `true` for live). Never disable signature checks. Test account onboarding and country/currency eligibility with Stripe; worldwide club signup is independent of merchant approval.

Hosted checkout only enables card payments. The provider adapter converts ISK/UGX legacy Stripe representations for charges, refund verification and invoices; see [Stripe currency rules](https://docs.stripe.com/currencies). Confirm currency availability and provider minimums in sandbox. Activity reservations start at 30 minutes; starting online checkout extends the displayed deadline to one hour from the persisted payment attempt. Retries retain that deadline and provider idempotency key. Confirm SCA, checkout expiry, returned checkout, duplicate events, late payment and refund webhooks using the provider sandbox before launch. Software plan changes are recorded from verified provider state, not client-supplied prices. Final prices, taxes, customer terms and cancellation policies require business approval.

AI: optional `AI__ApiKey` and `AI__Model`. Uses the OpenAI Responses API, `store=false`, bounded activity facts and staff-reviewed output. No member directory or payment records are sent, and generated text never publishes itself. See the [official Responses reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create). No live AI request was made without credentials.

## Operations

Use JSON logs and trace IDs; send them to your chosen log sink without request bodies, credentials, cookies or provider payloads. Alert on health failures, repeated 5xx, job `Blocked`/`Failed`, old queued jobs, database saturation, disk space and `PaidNeedsReview`. Review audit records and support cases. Restrict administrative accounts, enforce strong account handling and rotate secrets through the deployment secret manager.

Rate limits are per API instance. Forwarded IP/protocol headers are accepted only from explicitly configured `App__TrustedProxyNetworks__0` networks (Compose supplies its private subnet; change `CLUBLINE_NETWORK_SUBNET` if it conflicts with the host). At scale, add a distributed edge rate limiter before horizontally scaling. Never trust arbitrary forwarded IP headers. Configure provider outbound timeouts and monitor webhook retries.

Upgrades: back up first, build/test locally, run the migration job once, then replace the application containers. Roll back application code only with a compatible schema. Prefer forward data corrections to destructive database down-migrations. Keep the previous images and recovery instructions available.

Vercel Services is a possible later container host, but the current connected Hobby project has no configured durable .NET file/key storage. The existing Golfers frontend deployment alone cannot host this complete service. No host upgrade, paid service purchase or production promotion was performed.
