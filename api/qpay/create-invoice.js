import { getQPayToken, getQPayBaseUrl, getInvoiceCode } from './utils.js';
import { recordTransaction } from '../analytics/store.js';

export default async function handler(req, res) {
  // Allow CORS for development & production
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { amount = 9900, description = 'Монгол Зурхай - 4 бүлэг нээх эрх', profile = {} } = req.body || {};
    const password = process.env.QPAY_PASSWORD;

    // If password not yet set, provide informative mock response for frontend testing
    if (!password) {
      const mockInvoiceId = `MOCK-INV-${Date.now()}`;
      try {
        recordTransaction({
          invoice_id: mockInvoiceId,
          amount: Number(amount),
          status: 'PENDING',
          profile: profile || {},
          isMock: true
        });
      } catch (e) {}

      return res.status(200).json({
        isMock: true,
        message: 'QPAY_PASSWORD тохируулагдаагүй тул Тест горим ажиллаж байна.',
        invoice_id: mockInvoiceId,
        qr_text: `qpay://mock/${mockInvoiceId}`,
        qr_image: '',
        qPay_shortUrl: 'https://qpay.mn/mock',
        urls: [
          { name: 'Хаан Банк', description: 'Khan Bank', logo: 'https://qpay.mn/qpay_v2/icons/khanbank.png', link: '#' },
          { name: 'Голомт Банк / SocialPay', description: 'SocialPay', logo: 'https://qpay.mn/qpay_v2/icons/socialpay.png', link: '#' },
          { name: 'Хас Банк', description: 'XacBank', logo: 'https://qpay.mn/qpay_v2/icons/xacbank.png', link: '#' },
          { name: 'Төрийн Банк', description: 'State Bank', logo: 'https://qpay.mn/qpay_v2/icons/statebank.png', link: '#' },
          { name: 'Худалдаа Хөгжлийн Банк', description: 'TDB', logo: 'https://qpay.mn/qpay_v2/icons/tdb.png', link: '#' },
          { name: 'Most Money', description: 'Most Money', logo: 'https://qpay.mn/qpay_v2/icons/mostmoney.png', link: '#' },
          { name: 'М Банк', description: 'M Bank', logo: 'https://qpay.mn/qpay_v2/icons/mbank.png', link: '#' }
        ]
      });
    }

    const token = await getQPayToken();
    const baseUrl = getQPayBaseUrl();
    const invoiceCode = getInvoiceCode();

    const senderInvoiceNo = `MZ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'mongol-zurkhai.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const callbackUrl = `${protocol}://${host}/api/qpay/callback?invoice_no=${senderInvoiceNo}`;

    const invoicePayload = {
      invoice_code: invoiceCode,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: 'terminal',
      invoice_description: description,
      amount: Number(amount),
      callback_url: callbackUrl
    };

    const qpayRes = await fetch(`${baseUrl}/v2/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!qpayRes.ok) {
      const errText = await qpayRes.text();
      return res.status(qpayRes.status).json({
        error: 'Failed to create QPay invoice',
        details: errText
      });
    }

    const invoiceData = await qpayRes.json();

    try {
      recordTransaction({
        invoice_id: invoiceData.invoice_id,
        amount: Number(amount),
        status: 'PENDING',
        profile: profile || {},
        isMock: false
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      invoice_id: invoiceData.invoice_id,
      qr_text: invoiceData.qr_text,
      qr_image: invoiceData.qr_image,
      qPay_shortUrl: invoiceData.qPay_shortUrl,
      urls: invoiceData.urls || []
    });
  } catch (error) {
    console.error('Error creating QPay invoice:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}