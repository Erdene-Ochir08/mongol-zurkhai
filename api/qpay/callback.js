import { recordTransaction } from '../analytics/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const body = req.body || {};

  const id = query.invoice_id || body.invoice_id || query.invoice_no || body.invoice_no || query.sender_invoice_no || body.sender_invoice_no || query.payment_id || body.payment_id || query.qpay_payment_id || body.qpay_payment_id;
  const paidAmount = Number(body.paid_amount || query.paid_amount || body.amount || query.amount || 9900);

  if (id) {
    try {
      await recordTransaction({
        invoice_id: id,
        sender_invoice_no: query.invoice_no || body.invoice_no || query.sender_invoice_no,
        payment_id: query.payment_id || body.payment_id || query.qpay_payment_id,
        amount: paidAmount,
        status: 'PAID'
      });
    } catch (e) {
      console.warn('Could not record callback transaction:', e.message);
    }
  }

  return res.status(200).send('SUCCESS');
}