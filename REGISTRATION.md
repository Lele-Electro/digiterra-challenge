Registration and navigation
===========================

The Create account form accepts an optional cellphone number. The API accepts local or international numbers containing 7–15 digits, with an optional leading `+`, and removes spaces, brackets, dots and hyphens before saving it in MongoDB. The number is included in the account's authenticated responses.

Each newly created password or Google account queues a welcome email in the same database write as the account. Returning users and duplicate registration attempts do not queue another welcome email. Account deletion also removes pending welcome mail. The queue uses the existing Ribeiro SMTP configuration, delivery leases, stable message IDs and retries after SMTP errors. No passwords are included in these emails.

The Node backend polls queued emails every 15 seconds. The Cloudflare backend uses Durable Object alarms with a once-per-minute cron fallback. Its health endpoint reports `databaseReady`, `databaseInitialization`, `bookingEmailVerified` and `emailService` to distinguish a usable database from an open connection and show email service progress. Existing backend processes started with `node server` must be restarted to load these changes.

The navbar has a visible Log in / Log out control. Inner pages use a frosted appearance; the landing page retains its existing solid navbar. Both use the same placement mixin in `src/styles/_navbar-placement.scss`, including the home page's desktop scale, horizontal position and mobile breakpoints. The inner-page header reserves room for the navbar above page content.

Validation: frontend unit tests and a production build; backend API tests cover optional phone validation, both registration providers, retries, concurrent delivery, duplicate registrations and account deletion. The Cloudflare integration check also verifies that a second reservation for the same timeslot remains blocked.

Production check on 3 November 2026: Atlas connects successfully and the live booking availability API responds with HTTP 200. SMTP authentication succeeds locally on both TLS port 465 and STARTTLS port 587. Cloudflare connections to the same relay time out (`ETIMEDOUT`, SMTP command `CONN`), including a direct native socket probe. The configured production port has been restored to the mailbox's recommended TLS port 465. Production email delivery is pending investigation of the hosting/network restrictions; emails remain queued for retry. Hosting dashboard details have been requested.
