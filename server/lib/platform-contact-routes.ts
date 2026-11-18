import type { Express, RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { rateLimit } from './rate-limit';
import { platformContactDirectory, platformContactDetail, writePlatformContact, PlatformContactError } from './platform-contacts';
import { sendContactDelivery, applyWhatsAppStatuses } from './platform-contact-delivery';
import { whatsappCatalog, whatsappConfiguration, validWhatsAppSignature } from './platform-whatsapp';
import { timingSafeEqual } from 'node:crypto';

export const platformContactOrigin: RequestHandler = (req, res, next) => {
  try {
    const origin = new URL(req.get('origin') ?? '');
    if (origin.origin !== `${req.protocol}://${req.get('host')}` || req.get('sec-fetch-site') === 'cross-site') throw Error('origin');
    next();
  } catch { res.status(403).json({ message: 'CONTACT_ORIGIN_REQUIRED' }); }
};
export function registerPlatformContactRoutes(app: Express, requireAdmin: RequestHandler) {
  function handler(write: boolean, operation: (client: PoolClient, req: any) => Promise<unknown>): RequestHandler {
    return async (req: any, res) => {
      res.setHeader('Cache-Control', 'no-store');
      let client: PoolClient | undefined;
      try {
        client = await pool.connect();
        await client.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        const result = await operation(client, req);
        await client.query('COMMIT');
        res.json(result);
      } catch (error: any) {
        await client?.query('ROLLBACK').catch(() => {});
        const known = error instanceof PlatformContactError;
        res.status(known ? error.status : error?.code === '23505' ? 409 : 503).json({ message: known ? error.code : error?.code === '23505' ? 'CONTACT_REQUEST_CONFLICT' : 'CONTACT_UNAVAILABLE' });
      } finally { client?.release(); }
    };
  }
  app.get('/api/platform-admin/contacts/whatsapp', requireAdmin, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(await whatsappCatalog()); }
    catch { res.status(503).json({ message: 'CONTACT_PROVIDER_UNAVAILABLE' }); }
  });
  app.post('/api/platform-admin/contacts/:organisationId/send', requireAdmin, platformContactOrigin,
    rateLimit({ name: 'platform-contact-send', windowMs: 60 * 60 * 1000, max: 60, key: req => String(req.session?.userId ?? ''), keyOnly: true }),
    async (req: any, res) => {
      res.setHeader('Cache-Control', 'no-store');
      try {
        res.json(await sendContactDelivery(() => pool.connect(), Number(req.params.organisationId), {
          id: req.session.userId, requestId: req.requestId, ip: req.ip ?? 'unknown', userAgent: req.get('user-agent'),
        }, req.body));
      } catch (error: any) {
        res.status(error instanceof PlatformContactError ? error.status : 503).json({ message: error instanceof PlatformContactError ? error.code : 'CONTACT_UNAVAILABLE' });
      }
    });
  // Provider callbacks have no browser session; HMAC replaces browser origin/MFA authentication here only.
  app.get('/api/webhooks/platform-whatsapp', (req, res) => {
    const expected = whatsappConfiguration().verifyToken, actual = String(req.query['hub.verify_token'] ?? '');
    const challenge = String(req.query['hub.challenge'] ?? '');
    res.setHeader('Cache-Control', 'no-store');
    if (expected.length < 32 || req.query['hub.mode'] !== 'subscribe' || !/^\d{1,200}$/.test(challenge)
      || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      res.status(403).send('Forbidden'); return;
    }
    res.type('text/plain').send(challenge);
  });
  app.post('/api/webhooks/platform-whatsapp', (req, res, next) => {
    if (!validWhatsAppSignature(req.rawBody, req.get('x-hub-signature-256'))) { res.status(403).json({ message: 'INVALID_SIGNATURE' }); return; }
    next();
  }, handler(true, async (db, req) => { await applyWhatsAppStatuses(db, req.body); return { received: true }; }));
  app.get('/api/platform-admin/contacts', requireAdmin, handler(false, (db, req) => platformContactDirectory(db,
    { days: req.query.days, search: String(req.query.search ?? ''), filter: String(req.query.filter ?? 'all'), offset: Number(req.query.offset ?? 0) })));
  app.get('/api/platform-admin/contacts/:organisationId', requireAdmin, handler(false, (db, req) => platformContactDetail(db, Number(req.params.organisationId), Number(req.query.offset ?? 0))));
  app.post('/api/platform-admin/contacts/:organisationId', requireAdmin, platformContactOrigin,
    rateLimit({ name: 'platform-contact-write', windowMs: 60 * 60 * 1000, max: 180, key: req => String(req.session?.userId ?? ''), keyOnly: true }),
    handler(true, (db, req) => writePlatformContact(db, Number(req.params.organisationId),
      { id: req.session.userId, requestId: req.requestId, ip: req.ip ?? req.socket?.remoteAddress ?? 'unknown', userAgent: req.get('user-agent') }, req.body)));
}
