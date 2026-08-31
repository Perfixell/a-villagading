# Villa Gading

Public villa website and booking flow for Villa Gading. The frontend is a static Vite/React site. Bookings, availability, admin access, payments, and confirmation email are handled by Supabase.

## Local development

Requirements: Node.js 24 and a Supabase project for development.

```bash
npm ci
npm run dev
```

Create `.env.local` locally. Never commit it.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY
```

Only public browser keys may use the `VITE_` prefix. Service-role, payment, email, Turnstile secret, and calendar-feed credentials belong in Supabase Edge Function secrets.

## Production secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets** or with `supabase secrets set`:

- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_IS_PRODUCTION`
- `BOOKING_ICAL_VILLA_1`
- `BOOKING_ICAL_VILLA_2`
- `BOOKING_ICAL_EXPORT_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`

Use a separate, randomly generated value of at least 32 bytes for `BOOKING_ICAL_EXPORT_TOKEN`. Do not paste any secret or private calendar URL into issues, documentation, source code, or chat.

Supabase automatically provides its server-side project URL and secret/service-role credentials to Edge Functions. Never copy those credentials into the frontend.

## Database and Edge Functions

Link the intended project, review the target, then deploy migrations and functions:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy booking-calendar
supabase functions deploy booking-create
supabase functions deploy booking-ical-export
supabase functions deploy midtrans-create-transaction
supabase functions deploy midtrans-webhook
```

The private website-to-Booking.com availability feed has this shape:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/booking-ical-export?villa=1&token=YOUR_PRIVATE_EXPORT_TOKEN
```

Use the matching `villa=2` URL for the second villa. Treat the complete URL as a credential because it contains the feed token.

## Admin access

The admin interface uses Supabase email/password authentication. Database RLS separately requires the signed-in user to exist in `public.admin_users`; hiding the route is not treated as security.

Create the user in Supabase Authentication, then add that exact user ID to `public.admin_users` through the SQL editor. Public sign-up should remain disabled.

## Deployment

The public site deploys through `.github/workflows/deploy.yml` to GitHub Pages. Configure only public build values there. Keep all server secrets in Supabase.

After deployment, verify:

```bash
npm run typecheck
npm run lint
npm run build
```

Then test one real booking in sandbox mode, confirm the Turnstile challenge is enforced, verify that the private iCalendar feed rejects a missing or incorrect token, and confirm that a signed-out browser cannot read booking rows.

## Security notes

- Guest price is recalculated inside `booking-create`; the browser total is not trusted.
- A private payment capability is required in addition to the booking reference.
- Midtrans is the source of truth for paid status. Client redirects do not confirm payment.
- The database exclusion constraint prevents overlapping non-cancelled bookings under concurrent requests.
- Turnstile fails closed if its server secret is missing.
- Exported calendars contain blocked dates only—never guest names, contact details, or booking references.

See [SECURITY.md](SECURITY.md) for reporting and credential-rotation guidance.

## Required credential rotation

Older revisions of this repository exposed two Booking.com native calendar-feed URLs. Removing them from the current README does not invalidate them. Regenerate both export links in Booking.com, update `BOOKING_ICAL_VILLA_1` and `BOOKING_ICAL_VILLA_2` in Supabase, and stop using the old links.
