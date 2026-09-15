# Sprint 2A.2 stability notes

Production workspace records are stored in Turso via `@libsql/client`. Leads, import reports, audit jobs, audit result attempts, decisions, statuses, notes, and audit JSON are server-side records. The browser no longer serializes production records to localStorage; only transient UI state remains client-side.

Screenshots are uploaded to the private Vercel Blob store under `audit-screenshots/<leadId>/`. The audit stores the durable Blob URL. The app serves that URL through an authenticated screenshot route. A failed upload is stored as `screenshotError` while the deterministic HTML evidence and audit status remain usable.

Production write and audit endpoints require an HttpOnly admin session created from the server-only `DIGINEST_ADMIN_TOKEN`. Audit requests are rate limited per forwarded client address, accept only HTTP(S), reject localhost/private/internal IPs and private DNS resolutions, and re-check redirect destinations before parsing content. The crawler does not receive browser-visible secrets.

Objective crawling and qualitative review are separate state machines. Objective completion moves qualitative review to `PENDING`; it does not qualify a website lead. Existing Sprint 1 records are migrated on load, including legacy `status` values and stale `AUDITING` records.

Imports require `APPEND LEADS` or `REPLACE WORKSPACE`. Replace requires confirmation and clears production audit jobs/results. Append deduplicates against existing production identities. Demo data is never written into the production tables.

Deployment requires the four server-only environment variables in `.env.example`. The current Vercel Blob token is connected; the Turso marketplace resource still requires accepting Turso terms in the Vercel account before its database URL/token can be connected. Until then, production workspace APIs fail closed with a configuration error rather than falling back to localStorage.
