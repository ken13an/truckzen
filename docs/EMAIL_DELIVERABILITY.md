# Email Deliverability Checklist

TruckZen sends transactional email (invitations, password resets, receipts) via
Resend from the `EMAIL_FROM` / `RESEND_FROM_EMAIL` address configured in env.
Inbox placement depends on DNS authentication for that sending domain.

## Required DNS records

Configure all of the following on the DNS for the sending domain (not invented
here — copy the exact values from Resend's dashboard and your DNS provider):

- **SPF** — TXT record authorizing Resend to send on behalf of the domain.
  Copy the exact `v=spf1 include:... -all` string from Resend → Domains.
- **DKIM** — CNAME records provided by Resend for the specific sending domain.
  Copy the exact host + target values from Resend → Domains → DKIM.
- **DMARC** — TXT record at `_dmarc.<domain>`. Start with
  `v=DMARC1; p=none; rua=mailto:<your-reports-mailbox>` and tighten later.
- **Return-Path / MAIL FROM alignment** — if Resend offers a custom return-path,
  add the CNAME it specifies.

## Resend dashboard steps

1. Resend → Domains → add the sending domain (matching `EMAIL_FROM`).
2. Copy each record Resend shows and paste into the DNS provider verbatim.
3. Wait for Resend to report "Verified" (propagation is usually minutes).
4. Send from the verified domain only — do not send from unverified or shared
   test subdomains for production traffic.

## Testing after propagation

- Send one invite to a **Gmail** inbox. Check inbox placement; if it lands in
  Spam, open the headers and confirm `SPF=pass`, `DKIM=pass`, `DMARC=pass`.
- Send one invite to an **Outlook / Microsoft 365** inbox. Same header checks.
- If either fails, resolve the specific failing record before iterating on
  email copy.

## What this project already does in code

- Invite subject and body avoid reset-password / urgent phrasing
  (`src/lib/integrations/resend.ts` → `sendWelcomeEmail`).
- Invite and password-reset templates are sent by distinct helpers so a spam
  complaint on one does not poison the other.

## What code cannot fix

- Recipient-side blocklists and reputation. Encourage users to check Spam/Junk
  and mark "Not spam" — this trains their filter for future messages.
- Low domain reputation from a brand-new sending domain. Consistent, low-volume,
  low-complaint sending builds reputation over weeks.
