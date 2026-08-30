import { recordVisit, recordEvent, recordTransaction } from './store.js';

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.writeHead(200);
    return res.end();
  }

  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const { type = 'pageview', data = {} } = req.body || {};

    if (type === 'pageview') {
      const visit = await recordVisit({ ip, userAgent, path: data.path || '/' });
      return sendJson(res, 200, { success: true, visit });
    }

    if (type === 'payment_success') {
      const tx = await recordTransaction({
        invoice_id: data.invoice_id || `TX-${Date.now()}`,
        amount: data.amount || 9900,
        status: 'PAID',
        profile: data.profile || {},
        isMock: data.isMock || false
      });
      return sendJson(res, 200, { success: true, transaction: tx });
    }

    const event = await recordEvent(type, { ...data, ip, userAgent });
    return sendJson(res, 200, { success: true, event });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return sendJson(res, 500, { error: 'Failed to record tracking event', message: error.message });
  }
}