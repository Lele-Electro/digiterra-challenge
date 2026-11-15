# Booking email release — 2 November 2026

Target: `digiterra-backend` in account `b8695c2cc37084b09551db6af0fc5427`.
URL: `https://digiterra-backend.toni101ribeiro.workers.dev`.

The Cloudflare dashboard has no Git repository connected and shows manual Wrangler
deployments. No GitHub push is needed or sufficient to deploy this Worker.

## Deployed changes

- `worker/app.cjs` preserves the deployed Express entry's lazy MongoDB pool, CORS,
  health route and existing API mounts, and adds the Ribeiro account and booking routes.
- `worker/index.mjs` preserves the existing `DigiterraBackend` Durable Object and
  `BACKEND` binding. MongoDB booking due dates drive persistent alarms. A minute cron
  recovers pending work after idle periods, restarts or lost alarms.
- Booking changes restart the five-minute quiet period. Database leases prevent two
  workers from emailing the same revision concurrently. Cancellation releases the
  slot and removes its queued confirmation.
- SMTP is verified once per deployed version without sending a diagnostic email.
  `/api/health` reports `bookingEmailConfigured`, `bookingEmailVerified` and the last
  verification time. Failed verification retries after one minute.
- The five `RIBEIRO_*` mail settings are already encrypted secrets in Cloudflare.
  Database and JWT secrets are preserved. Passwords are absent from source and bundles.
- `wrangler.jsonc` retains compatibility date `2026-10-22`, `nodejs_compat`, and the
  existing `v1` SQLite class migration. No namespace is deleted, recreated or renamed.
- The existing SQLite namespace remains `a5f9cee61a5840399aedbbdecab05cec`.
- The Worker build uses `bcryptjs` for native-module compatibility; the Node backend
  retains `bcrypt`. Password hashes remain compatible in both directions.
- The frontend production API now points at the confirmed Worker instead of Heroku.

## Validation

The full backend suite passed (47 API, environment and Cloudflare entry checks), plus
password-hash compatibility checks. The Angular production build passed. Local
Cloudflare-runtime checks verified the complete Durable Object/Express health entry
and successful SMTP TLS authentication without sending another email.

The authorised one-off SMTP test to `bookings@toniribeiro.co.za` was accepted by the
mail provider with zero rejected recipients. Generated frontend and Worker artifacts
were checked for the mailbox password; no match was found.

## Deploy and verify

```sh
npm run deploy:cloudflare
```

After the first scheduled invocation, check `/api/health` for
`bookingEmailVerified: true`, and check `/api/ribeiro/lift-bookings/availability`.
These checks do not create a booking or send a test email.

Deployed version: `9a992316-f660-4f6f-b82e-5029136a21a9` at 100%, with immediate
Durable Object code updates. The live health endpoint reports database connected,
SMTP configured and SMTP verified. The booking availability endpoint succeeds, and
the production CORS preflight returns HTTP 204 for `https://www.toniribeiro.com`.

Cloudflare's default deferred code-update mode initially left the active object on
the old code. Applying immediate mode to the same deployed version activated the
new API. The deploy script now includes that option for future releases.

Before this code release, the active configuration-only version was
`973b8ecb-e233-4481-9bc1-7ca588d84158`. It retains the encrypted SMTP settings and can
be restored using `wrangler rollback 973b8ecb-e233-4481-9bc1-7ca588d84158` if needed.
MongoDB reservations and the Durable Object namespace are separate from code versions.
