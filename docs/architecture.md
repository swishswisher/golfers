# Architecture and API contracts

## Boundaries

Next.js App Router renders public and authenticated pages. Client components handle forms and realtime interaction. Server components forward the current cookie to the API and fetch uncached responses. Business decisions are made by ASP.NET Core, not by the browser club selector.

The API is a modular application: Identity, Clubs/Members, Activities/Bookings, Messaging, Notifications/Jobs, Billing/Fees, Accounts/Automations, Public content and Platform operations. EF Core stores authoritative data in PostgreSQL. SQL migrations include composite foreign keys, uniqueness, checks, an overlap exclusion constraint, and indexes for club-scoped queries.

Every club entity has a server-populated `ClubId` filter. HTTP endpoint filters resolve active membership and role from the database before accessing a club. Resource lookups remain within that scope. Cross-club parent links use composite `(ClubId, Id)` foreign keys. `IgnoreQueryFilters` is restricted to verified platform, provider-event, worker and initial membership-resolution paths; those paths explicitly select/check the club.

## Roles

| Role | Operations |
|---|---|
| Platform administrator | Platform clubs/entitlements, suspension, public CMS, enquiries, support and audit; this is a database flag independent of club role |
| Owner | Club manager operations, staff role assignment and software subscription/merchant configuration |
| Manager | Members/imports, verified guardian links, teams, publishing, facilities, finance, club content, reporting, delivery and exports |
| Coach | Assigned team coaching/training and rosters/attendance; private club messaging and own account |
| ProShop | Own coaching sessions, promotions and announcements; facilities and authorised conversations |
| Treasurer | Fee requests, independently verified offline transactions, refunds and financial reports |
| Caterer | Own social events/announcements, menus and offers; authorised conversations |
| Member | Own/eligible activities, own payments/preferences, opt-in adult directory and authorised conversations |
| Guardian | Member functions plus explicitly verified junior links and participant-specific consent |

A guardian who can see a team session through one child cannot register a different ineligible child. Junior records do not appear in the adult directory or ordinary private conversation creation.

## Browser sessions

Identity issues an HttpOnly cookie (`__Host-Clubline.Session`, Secure in Production, SameSite=Lax, root path). Each cookie includes a server-session ID; the database checks revocation/expiry on every request. Sessions last seven days without silent sliding. Logout revokes the database session and aborts its realtime connections; password reset revokes all sessions. Identity transitions reload the document to clear cached UI from the previous account. Identity security-stamp refresh preserves the separately revocable session claim. No access/refresh tokens are stored in browser storage.

Unsafe API requests require the antiforgery cookie and `X-CSRF-TOKEN` from `GET /api/auth/csrf`. Tokens are refreshed after identity changes. The configured public origin is checked for HTTP and SignalR. Stripe events use exact-body signature verification instead of browser CSRF. Login forms remain disabled until hydrated and submit POST if JavaScript is unavailable, preventing credentials in query strings.

## Important contracts

The running API exposes its generated contract at `/api/openapi/v1.json`. The frontend uses explicit TypeScript request/response contracts in `src/lib/contracts.ts`. Errors are Problem Details with HTTP status, safe title and trace ID. Mutations never report a payment or provider delivery as successful from a browser redirect.

| API | Behaviour |
|---|---|
| `/api/auth/*` | Register/verify/login/logout/me, resend confirmation, password reset and CSRF |
| `POST /api/clubs` | Creates club, owner, member profile and 14-day trial |
| `/api/clubs/{clubId}/members`, `/invitations`, `/teams`, `/guardians` | Scoped management, reviewed import, token-hashed invitations and verified family relationships |
| `/activities`, `/{id}/publish`, `/{id}/register` | Draft/publication, transactional outbox, participant eligibility, reserved capacity and waitlists |
| `/registrations/{id}/attendance`, `/cancel` | Authorised attendance and capacity release/promotion |
| `/resources`, `/bookings` | Resource locks plus PostgreSQL overlap exclusion; no double reservation |
| `/conversations/{id}/messages?after=sequence` | Authorised history, 100-message cursor pages |
| `POST /conversations/{id}/messages` | Caller-supplied UUID, same-ID/same-body dedupe; conflicting reuse returns 409 |
| `/hubs/chat`, `JoinConversation(clubId, conversationId, after)` | Server-authorised session, membership and conversation; content fanout only to active recipient sessions |
| `/files` | Bounded, whitelisted uploads with private metadata; authenticated attachment download, club and conversation checks |
| `/notifications`, `/preferences`, `/push-subscriptions` | Persistent in-app updates, user consent/preferences and supported browser push |
| `/fees`, `/payments/*`, `/refunds` | Server-assigned membership fees, verified offline receipts, provider checkout, reserved refund amounts and durable retries |
| `/billing/*`, `/api/webhooks/stripe` | Per-club software subscription, portal/cancellation, merchant onboarding and signed/deduplicated provider events |
| `/automations`, `/assistant/draft` | Welcome/reminder/digest rules; optional reviewed AI text with no publishing authority |
| `/api/admin/*` | Database-authorised platform operations and recorded audit |

Amounts are integer minor units with an explicit currency. Activity instants are UTC; display uses the club IANA zone. Date/time input explicitly says device time zone. Membership renewal expiry is extended only after verified payment. Refunds do not silently rewrite membership terms; staff review membership adjustments separately.

## Concurrency and recovery

Activity registration/publication/cancellation and waitlist promotion lock the activity row inside a transaction. Expired paid reservations release capacity. Each re-registration creates a new attempt ID; checkout and notification operations bind to that attempt, and verified guardians can see registrations for their linked children. An earlier attempt’s callback cannot confirm a later attempt. A late successful payment is retained as `PaidNeedsReview` and never silently adds an over-capacity participant. Membership limits lock the subscription row for imports, invitation acceptance and individual creation.

Messages lock their conversation before sequence assignment and commit before realtime fanout. This prevents reconnect cursors skipping a slower earlier commit. Clients page saved history to exhaustion, merge by ID, retry sends with the original UUID, and poll while realtime is unavailable. Unread cursors advance monotonically within authorised history.

Notifications and outbox jobs commit with publication. Workers lease jobs with `FOR UPDATE SKIP LOCKED`, retain operation keys across retries, and cap retries. Email/push preferences and active membership are checked again at dispatch. Resend/Stripe keys remain stable. Push tags reduce duplicate browser presentation; exactly-once external delivery cannot be guaranteed. `Accepted`, `DevelopmentInbox`, `Skipped`, `Blocked` and `Failed` are distinct from delivery/read confirmation.

Provider events use signature timestamp tolerance, exact HMAC comparison, a unique provider event ID and transaction advisory locks. Subscription state is fetched from Stripe while holding the club subscription lock, handling out-of-order webhook arrival. Refund requests reserve the remaining refundable amount before creating a durable provider job.

## Deployment limits

The supplied deployment runs one API process and its workers. Multi-club isolation and SQL concurrency do not depend on a single browser. Multiple API replicas require a distributed SignalR connection/session registry/backplane and shared durable file/key storage; do not scale replicas before adding and testing those pieces. Current request lists are bounded; member search and reviewed batch imports support larger directories, with server-backed member/directory search and bounded selector queries, while full exports remain available. Team rosters load in one authorised batch. Load-test the selected hosting tier before promising service levels.
