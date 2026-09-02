# Villa Gading Admin

This repository deploys the protected admin build for `admin.villagading.com`. The workflow sets `VITE_ADMIN_ONLY=true`; authorization is enforced by Supabase Authentication and database RLS, not by the hostname.

## Local checks

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm audit
```

## Supabase rollout

Link the project and configure server-side Edge Function secrets without placing secret values in source, frontend environment files, issues, screenshots, or chat.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set MIDTRANS_SERVER_KEY="YOUR_MIDTRANS_SERVER_KEY"
supabase secrets set MIDTRANS_IS_PRODUCTION="false"
supabase secrets set BOOKING_ICAL_VILLA_1="YOUR_BOOKING_COM_ICAL_URL_1"
supabase secrets set BOOKING_ICAL_VILLA_2="YOUR_BOOKING_COM_ICAL_URL_2"
supabase secrets set BOOKING_ICAL_EXPORT_TOKEN="YOUR_RANDOM_EXPORT_TOKEN"
supabase secrets set TURNSTILE_SECRET_KEY="YOUR_TURNSTILE_SECRET_KEY"
supabase secrets set RESEND_API_KEY="YOUR_RESEND_API_KEY"
supabase secrets set RESEND_FROM_EMAIL="Bookings <noreply@yourdomain.com>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are reserved in Supabase Edge Functions and should not be set manually.

The payment capability migration, `booking-create`, `midtrans-create-transaction`, and the public frontend are version-coupled. This repository deploys only the admin build, so its workflow cannot complete that rollout by itself. Do not deploy any item below until the matching public-site release is built and ready.

Use a maintenance window with public booking temporarily unavailable: resolve every legacy `pending_payment` booking that lacks a capability hash, apply the migration, deploy all functions, immediately deploy the matching public frontend from the public-site repository, run the security smoke tests, and only then reopen booking. The migration intentionally stops rather than silently modifying a possibly real reservation.

With public booking already in maintenance mode, deploy the database and functions:

```bash
supabase db push
supabase functions deploy booking-calendar
supabase functions deploy booking-create
supabase functions deploy booking-ical-export
supabase functions deploy midtrans-create-transaction
supabase functions deploy midtrans-webhook
```

Then deploy the matching public frontend with its public Turnstile site key configured. Until that frontend is live and verified, keep public booking in maintenance mode because the fail-closed function correctly rejects old clients.

## Calendar feeds

The website-to-Booking.com import URLs require the private export token:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/booking-ical-export?villa=1&token=YOUR_RANDOM_EXPORT_TOKEN
https://YOUR_PROJECT_REF.functions.supabase.co/booking-ical-export?villa=2&token=YOUR_RANDOM_EXPORT_TOKEN
```

Store Booking.com's native feed URLs only as Edge Function secrets. Never commit them. If a feed URL appears in source or history, rotate it in Booking.com; deleting the text does not invalidate the old URL.

The protected export contains blocked dates only. It must not include guest identity, contact details, or booking references.

## Midtrans and email

Configure the Midtrans notification URL to point to the deployed `midtrans-webhook` Edge Function. The webhook verifies the signature and amount, preserves paid state against stale notifications, and handles refunds and chargebacks explicitly.

Payment confirmation email is sent through Resend after a valid paid notification. Use a verified sender and keep `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Edge Function secrets.

## Admin access

Create administrators in Supabase Authentication, then add their user IDs to `public.admin_users` through a trusted operator workflow. Do not add public signup to the site. Database RLS independently checks administrator membership for booking and pricing access.

For local development, open `http://localhost:5173/?admin=1`. Production is built with `VITE_ADMIN_ONLY=true` and served at `admin.villagading.com`.

## Security rules

- Frontend code may contain only public Supabase and Turnstile identifiers.
- Service-role, Midtrans, Resend, Turnstile, calendar, and feed credentials stay in Edge Function secrets.
- Booking prices are calculated server-side.
- A booking reference alone never authorizes payment; the browser must also present the private payment capability.
- Guest records remain protected by RLS and are readable only by authorized administrators.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reporting and credential response.
