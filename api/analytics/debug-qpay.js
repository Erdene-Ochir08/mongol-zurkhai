import { getQPayToken, getQPayBaseUrl, getInvoiceCode } from '../qpay/utils.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const token = await getQPayToken();
    const baseUrl = getQPayBaseUrl();
    const invoiceCode = getInvoiceCode();

    const results = {};

    // 1. Test /v2/payment/list
    try {
      const r1 = await fetch(`${baseUrl}/v2/payment/list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_type: 'INVOICE', offset: { page_number: 1, page_limit: 10 } })
      });
      results.paymentListStatus = r1.status;
      results.paymentListBody = await r1.text();
    } catch (e) {
      results.paymentListError = e.message;
    }

    // 2. Test /v2/invoice/list
    try {
      const r2 = await fetch(`${baseUrl}/v2/invoice/list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_code: invoiceCode, offset: { page_number: 1, page_limit: 10 } })
      });
      results.invoiceListStatus = r2.status;
      results.invoiceListBody = await r2.text();
    } catch (e) {
      results.invoiceListError = e.message;
    }

    // 3. Test /v2/payment/check with invoice_code
    try {
      const r3 = await fetch(`${baseUrl}/v2/payment/check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_type: 'INVOICE', object_id: invoiceCode, offset: { page_number: 1, page_limit: 10 } })
      });
      results.paymentCheckStatus = r3.status;
      results.paymentCheckBody = await r3.text();
    } catch (e) {
      results.paymentCheckError = e.message;
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}