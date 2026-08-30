import { recordTransaction } from '../analytics/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const invoiceId = req.query?.invoice_id || req.body?.invoice_id || req.query?.invoice_no || req.query?.payment_id;

  if (invoiceId) {
    try {
      await recordTransaction({
        invoice_id: invoiceId,
        amount: Number(req.body?.paid_amount || req.query?.paid_amount || 9900),
        status: 'PAID'
      });
    } catch (e) {
      console.warn('Could not record callback transaction:', e.message);
    }
  }

  return res.status(200).send('SUCCESS');
}