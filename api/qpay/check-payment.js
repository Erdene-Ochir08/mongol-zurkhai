import { getQPayToken, getQPayBaseUrl } from './utils.js';
import { recordTransaction } from '../analytics/store.js';

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const invoiceId = req.query.invoice_id || (req.body && req.body.invoice_id);

  if (!invoiceId) {
    return res.status(400).json({ error: 'Missing invoice_id parameter.' });
  }

  // Handle mock mode
  if (invoiceId.startsWith('MOCK-INV-') || !process.env.QPAY_PASSWORD) {
    return res.status(200).json({
      paid: false,
      isMock: true,
      message: 'Тест горим - Бодит мерчант тохируулсны дараа автоматаар шалгагдана.'
    });
  }

  try {
    const token = await getQPayToken();
    const baseUrl = getQPayBaseUrl();

    const checkPayload = {
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: {
        page_number: 1,
        page_limit: 10
      }
    };

    const qpayRes = await fetch(`${baseUrl}/v2/payment/check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkPayload)
    });

    if (!qpayRes.ok) {
      const errText = await qpayRes.text();
      return res.status(qpayRes.status).json({
        error: 'Failed to check QPay payment',
        details: errText
      });
    }

    const checkData = await qpayRes.json();
    const isPaid = (checkData.count > 0 && checkData.paid_amount > 0) ||
                   (checkData.rows && checkData.rows.some(r => r.payment_status === 'PAID'));

    if (isPaid) {
      try {
        recordTransaction({
          invoice_id: invoiceId,
          amount: checkData.paid_amount || 9900,
          status: 'PAID'
        });
      } catch (e) {}
    }

    return res.status(200).json({
      paid: isPaid,
      count: checkData.count || 0,
      paid_amount: checkData.paid_amount || 0,
      rows: checkData.rows || []
    });
  } catch (error) {
    console.error('Error checking QPay payment:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}