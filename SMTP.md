# Toni Ribeiro booking email

The permanent sender and reply address is `toni101ribeiro@gmail.com`, served by
`smtp.gmail.com:465` using implicit TLS and authenticated SMTP with a Google app password. Certificate
verification remains enabled. No password is stored in source control.

## Runtime settings

Set these environment variables on every backend deployment:

| Name | Value |
| --- | --- |
| `RIBEIRO_SMTP_HOST` | `smtp.gmail.com` |
| `RIBEIRO_SMTP_PORT` | `465` |
| `RIBEIRO_SMTP_USER` | `toni101ribeiro@gmail.com` |
| `RIBEIRO_SMTP_PASSWORD` | Google app password, stored as a secret |
| `RIBEIRO_EMAIL_FROM` | `toni101ribeiro@gmail.com` |
| `RIBEIRO_EMAIL_REPLY_TO` | `toni101ribeiro@gmail.com` |

Local development loads the ignored repository-root `.env` independently of the
shell's working directory. Environment variables supplied by a hosting platform
take precedence. `backend/app.js`, the normal server and the in-memory development
server all load the same settings. Dedicated `RIBEIRO_SMTP_*` settings keep this
mailbox separate from other applications sharing the backend; a partially configured
dedicated mailbox never inherits another application's password.

Legacy `SMTP_*` variables remain supported when no dedicated settings are supplied.
Only server-side code reads credentials. Frontend development, preview and production
builds all send booking requests to their configured API; email is sent by that API.

## Cloudflare

The live Worker is `digiterra-backend`, at
`https://digiterra-backend.toni101ribeiro.workers.dev`. The settings above are
configured as encrypted Worker secrets. Its live health check reports SMTP configured
and verified. Configure any future separate preview/backend environment with the same
mail settings in **Settings → Variables and Secrets** as appropriate for that project.
The local `.env` is intentionally not deployed. Existing passwords must be entered
through the dashboard or supplied to `wrangler secret put RIBEIRO_SMTP_PASSWORD`;
they must not be added to Wrangler configuration or committed to Git.

The backend includes a Cloudflare-compatible Express entry and reuses the existing
Durable Object namespace. Persistent alarms run five-minute confirmations; a minute
cron recovers pending work after outages. SMTP authentication is verified once per
deployed version, without sending another test message. The Node server retains its
polling worker. Both runtimes use the same MongoDB due dates, revisions and leases.

Keep the mail hostname DNS-only at the email provider's server. The migration guide's
`api.toniribeiro.com` is a proposed, unresolved address; the frontend production API
configuration now uses the confirmed workers.dev URL instead of Heroku.

No Git deployment pipeline is connected to this Worker. Run `npm run deploy:cloudflare`
to deploy directly. It uses immediate Durable Object code updates, preserving the
existing SQLite namespace and v1 migration. See `CLOUDFLARE-RELEASE.md` for rollback.

## Verification

Run `npm run smtp:verify` from the backend checkout. This verifies DNS, TCP, TLS and
SMTP authentication without sending email. To intentionally submit a one-off test
to the configured mailbox itself:

```sh
node backend/scripts/verify-smtp.js --send
```

Logs report status and error codes without printing passwords, transport options or
SMTP authentication responses. A successful SMTP submission establishes provider
acceptance; inbox delivery and spam filtering are controlled by the mail provider.

On 3 November 2026, Gmail SMTP authentication succeeded locally and on Cloudflare.
The configuration test sent to `toni101ribeiro@gmail.com` was accepted with no rejected
recipients and was found in the Gmail account. Gmail is the permanent provider for
registration, password recovery and booking confirmation emails.

For future credential rotations, put the new app password in `GMAIL_APP_PASSWORD`
in the ignored `.env`, then run:

```sh
npm run smtp:configure:gmail -- --user toni101ribeiro@gmail.com --deploy
```

This verifies authentication before updating the ignored local settings and encrypted
Cloudflare secrets, then deploys immediately so running Durable Objects load them.
The previous Afrihost settings remain in `AFRIHOST_*` entries in the same ignored
file for reference. Restart an already-running Node server after changing settings.
