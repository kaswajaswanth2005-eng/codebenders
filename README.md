# CashPilot AI

CashPilot AI is a local-first invoice, cash and receivables app for a one-to-five-person graphic design studio. It runs on your own machine with a local SQLite database.

## Overview

CashPilot AI helps a small studio see what it has billed, what has been paid, who still owes money, and how much cash is likely to arrive over the next 30, 60 and 90 days. It keeps all data local. Optional AI help is available through Groq, but only with explicit consent (see below).

## PS1 requirements

| Requirement | Where to find it |
| --- | --- |
| Invoices and payments, with copy-only reminder drafts | `/invoices` |
| Dashboard showing who owes money and since when | `/dashboard` |
| 30/60/90-day cash forecast | `/forecast` |
| What-if payment delay simulator | `/forecast` |
| Action Center alerts | `/dashboard` |

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   DATABASE_URL="file:./dev.db"
   # Optional: external AI assistant (Groq)
   GROQ_API_KEY=
   GROQ_MODEL=
   ```

3. Create the database schema:

   ```bash
   npx prisma migrate dev
   ```

4. Load the demo data:

   ```bash
   npm run seed:demo
   ```

   Warning: this **deletes all local data** in the database and replaces it with demo data. The `--confirm` flag is already part of the script.

5. Start the app:

   ```bash
   npm run dev
   ```

   Then open http://localhost:3000.

6. Run the tests:

   ```bash
   npm test
   ```

To reset the demo data at any time, run `npm run seed:demo` again.

## AI disclosure

Groq is optional and external. With no API key, or without consent, nothing is sent to Groq. With consent enabled, only the minimum facts needed for each question are sent.

## Known limitations

- No bank sync. Payments are entered manually.
- No GST compliance.
- PDFs show "Rs." instead of the rupee symbol, because the built-in PDF font lacks the rupee glyph.
- Bills are full-payment only; partial payments are not supported.
- Reminders are copy-only and are never sent by the app.
- Vitest is pinned to 3.2.x for Node 22.11.
- Node 22.13 or later is recommended.
