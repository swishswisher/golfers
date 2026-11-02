# Service map and acceptance

| Service | Working journey and acceptance |
|---|---|
| Public business website | Home/platform/sports/role solutions/member experience/pricing/about/trust/contact/demo/resources; genuine saved enquiries; published resource CMS |
| Worldwide club signup | Verified account → create club → choose country/currency/IANA zone/sports/colour → 14-day trial; no automatic claim of approved merchant payments |
| Staff/member onboarding | Scoped invitation → verification → matching-email token acceptance → active membership; reviewed CSV preview then transactional import |
| Membership and segments | Member search/edit/status, directory consent, sports and team audiences, staff permissions and full export; member/guardian account links stay private |
| Families | Manager verifies guardian link → guardian sees juniors → participant-specific activity eligibility and consent |
| Staff publishing | Authorised draft/create/edit → review → publish transaction → persistent in-app notifications/outbox → role-appropriate attendance management |
| Events/coaching/social | UTC instants, club-zone display, capacity-safe registration, paid reservation expiry, waitlist promotion, attendance, cancellation and explicit refund review |
| Pro Shop/catering | Pro Shop owns coaching/promotions/announcements; caterers own social publishing plus menus/offers; unrelated staff permissions are denied |
| Facilities | Manager creates resources → member reserves → conflicting concurrent requests yield one reservation → owner/manager cancellation |
| Messaging | Eligible adult group/private conversation → saved UUID-deduplicated message → separate-session realtime → cursor history recovery/retry/unread state → scoped report/review |
| Files | Private bounded uploads and authenticated download, with server club/conversation checks; no public storage URLs |
| Notifications | Persistent in-app updates; email and push preference checks; browser opt-in; background outbox leases/retries; honest acceptance/blocked/sink statuses |
| Automations | Accepted invitation welcome, confirmed registration reminders and Monday club-zone digest, with deterministic notification keys |
| Fees and renewal | Treasurer assigns fee to active adult/verified guardian → member fee list → hosted checkout or independently verified offline receipt → membership expiry extends after confirmation |
| Refunds | Finance reserves refundable amount → durable provider job or offline transfer verification → confirmed refund total; repeated keys cannot duplicate money records |
| Software subscriptions | Trial → server-priced checkout with recoverable provider key → verified provider state → entitlements; portal, billing history and period-end cancellation |
| Club public presence | Staff edit/publish menus/offers/pages/sponsors → public club page → recorded membership/trial enquiry |
| Support and administration | User case → platform status/response → requester reads response; platform club/suspension/entitlement/CMS/enquiry operations and audit |
| Optional AI | Authorised bounded activity facts → provider draft → staff edit/review; no automatic publication or invented participation data |
| PWA | Manifest/worker, offline recovery page and supported push; authenticated/API/file/message content is never cached by the worker |

Acceptance evidence is in `docs/evidence`. Demonstration analytics come from saved fictional records. Live provider acceptance, external sports integrations, legal policies and operational host acceptance are separate dependencies detailed in `launch-dependencies.md`.
