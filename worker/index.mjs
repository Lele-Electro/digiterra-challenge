import { DurableObject } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import runtime from '../dist/cloudflare/app.cjs';

const { app, processDueBookings, createMailTransport, mailSettings, nextConfirmationAt, processRecoveryEmails, nextRecoveryAt, processRegistrationEmails, nextRegistrationAt } = runtime;
app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export class DigiterraBackend extends DurableObject {
  alarmSync = Promise.resolve();
  confirmationRun = null;
  async fetch(request) {
    const response = await app.locals.requestContext.run(
      (promise) => this.ctx.waitUntil(promise),
      () => expressHandler.fetch(request, this.env, this.ctx),
    );
    const path = new URL(request.url).pathname;
    if (path === '/api/health' && request.method === 'GET') {
      const verification = await this.ctx.storage.get('smtp-verification');
      const emailService = await this.ctx.storage.get('email-service-state');
      const emailVerified = Boolean(verification?.version && verification.version === (this.env.CF_VERSION_METADATA?.id || 'local'));
      // A health check also warms delivery after a cold deployment; cron remains
      // the durable fallback. Coalescing prevents concurrent SMTP verification.
      if (!emailVerified && (!emailService || Date.now() - Date.parse(emailService.at) > 60000)) {
        this.ctx.waitUntil(this.runConfirmations());
      }
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('etag');
      return Response.json({
        ...await response.json(),
        bookingEmailVerified: emailVerified,
        bookingEmailLastVerifiedAt: verification?.at || null,
        emailService: emailService || null,
        smtpRelay: { host: mailSettings(this.env)?.host, port: mailSettings(this.env)?.port },
      }, { status: response.status, headers });
    }
    if (request.method !== 'GET' && (path.startsWith('/api/ribeiro/lift-bookings') ||
      ['/api/ribeiro/user/forgot-password', '/api/ribeiro/user/reset-password',
        '/api/ribeiro/user/signup', '/api/ribeiro/user/google'].includes(path))) {
      try { await this.syncAlarm(); }
      catch (error) { console.error('Booking alarm setup failed; cron will recover:', error.name); }
    }
    return response;
  }

  async syncAlarm() {
    this.alarmSync = this.alarmSync.catch(() => {}).then(async () => {
      await app.locals.connectToDatabase();
      const times = (await Promise.all([nextConfirmationAt(), nextRecoveryAt(), nextRegistrationAt()])).filter((time) => time !== null);
      const next = times.length ? Math.min(...times) : null;
      if (next === null) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
    });
    await this.alarmSync;
  }

  async runConfirmations() {
    if (!this.confirmationRun) {
      this.confirmationRun = this.executeConfirmations().finally(() => { this.confirmationRun = null; });
    }
    await this.confirmationRun;
  }

  async executeConfirmations() {
    let retryLater = false;
    try {
      await this.ctx.storage.put('email-service-state', { stage: 'database', at: new Date().toISOString() });
      await app.locals.connectToDatabase();
      const transport = createMailTransport(this.env);
      if (transport) {
        try {
          const version = this.env.CF_VERSION_METADATA?.id || 'local';
          const verification = await this.ctx.storage.get('smtp-verification');
          if (verification?.version !== version) {
            await this.ctx.storage.put('email-service-state', { stage: 'smtp', at: new Date().toISOString() });
            await transport.verify();
            await this.ctx.storage.put('smtp-verification', { version, at: new Date().toISOString() });
          }
          await processRecoveryEmails({ transport, from: mailSettings(this.env).from, limit: 10 });
          await processRegistrationEmails({ transport, from: mailSettings(this.env).from, limit: 10 });
          await processDueBookings({ transport, from: mailSettings(this.env).from, limit: 10 });
          await this.ctx.storage.put('email-service-state', { stage: 'ready', at: new Date().toISOString() });
        }
        finally { transport.close(); }
      } else {
        retryLater = true;
        await this.ctx.storage.put('email-service-state', { stage: 'unconfigured', at: new Date().toISOString() });
      }
    } catch (error) {
      retryLater = true;
      await this.ctx.storage.put('email-service-state', { stage: 'retrying', code: error.code || error.name, command: error.command || null, at: new Date().toISOString() });
      console.error('Confirmation service will retry:', error.code || error.name);
    } finally {
      if (retryLater) await this.ctx.storage.setAlarm(Date.now() + 60000);
      else await this.syncAlarm();
    }
  }

  async alarm() { await this.runConfirmations(); }
}

export default {
  async fetch(request, env) {
    return env.BACKEND.get(env.BACKEND.idFromName('digiterra-backend')).fetch(request);
  },
  async scheduled(controller, env, ctx) {
    // Recovers pending MongoDB work after a deployment, cancellation or outage.
    const backend = env.BACKEND.get(env.BACKEND.idFromName('digiterra-backend'));
    ctx.waitUntil(backend.runConfirmations());
  },
};
