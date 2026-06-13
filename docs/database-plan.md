# Database Plan

This project uses Neon Postgres through Prisma for app-owned persistent data. The database must never replace bizBox as the source of truth for real network documents.

## Stored In Postgres

- Users: local app user identity metadata and future account ownership.
- Companies: app-known companies, including VAT/tax ID, registration number, eLocation/eAddress and address data.
- UserCompany: relation between users and companies, including the active-company relationship.
- InvoiceDraft: persistent invoice drafts and full draft JSON payloads owned by eRačunko.
- UserSettings: user/app settings that should follow the user across browsers.
- LocalSentInvoice: local record of invoices created/sent from eRačunko, including local JSON payload and optional bizBox document id.

## Stays In localStorage For Now

- Existing draft, settings, active company and local sent invoice data can remain in localStorage until explicit migration tasks move them.
- Temporary UI state, selected tabs, form-in-progress values and short-lived dashboard UI state can remain local.
- No automatic data migration is performed in this foundation step.

## bizBox Remains Source Of Truth

- Received documents from bizBox inbox.
- Real sent document list/status from bizBox.
- Acknowledgements and delivery/fiscalization/reporting statuses.
- Raw bizBox document metadata and downloaded document content.

The local database may store app-created references to bizBox documents, but the canonical document state should still be fetched or verified from bizBox.

## Later Cache / Index Candidates

- Dashboard aggregate snapshots per user/company.
- Lightweight indexes of bizBox document ids, document numbers, status categories and last-seen timestamps.
- Failed acknowledgement summaries for faster dashboard alerts.
- Search-friendly metadata extracted from bizBox responses, if it does not include sensitive payload content.

Cached/indexed data must have refresh and invalidation behavior, and the app must tolerate cache misses.

## Must Never Be Stored In localStorage

- `DATABASE_URL` or any database credentials.
- bizBox login credentials, API secrets or long-lived tokens.
- Raw personal or financial document payloads that are not needed for current UI.
- Sensitive environment variables.
- Server-only integration secrets.

Prisma must only be imported from server-side code, route handlers, server actions or backend utilities. Client components must never import `lib/db/prisma.ts`.
