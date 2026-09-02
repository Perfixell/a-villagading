# Security policy

## Reporting a vulnerability

Do not open a public issue containing guest information, credentials, calendar URLs, payment references, or exploit details. Contact the repository owner privately and include the affected page or function, the security impact, and safe reproduction steps with all secrets redacted.

## Credential handling

- Browser-visible `VITE_` variables may contain only public Supabase and Turnstile identifiers.
- Supabase service/secret keys, Midtrans keys, Resend keys, Turnstile secrets, and full iCalendar URLs are credentials.
- Store server credentials only as Supabase Edge Function secrets.
- Rotate a credential immediately if it appears in source, an issue, a screenshot, logs, or chat. Deleting the text alone does not invalidate it.
- Use separate credentials for production and testing where the provider supports it.

## Production response

If a secret is exposed: revoke or regenerate it at the provider, update Supabase, redeploy or verify the affected function, test the flow, and review provider logs for unexpected use. Do not paste the replacement value into the repository.
