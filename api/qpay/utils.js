// QPay v2 API Utilities for Vercel Serverless Functions

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getQPayToken() {
  const username = process.env.QPAY_USERNAME || 'MONGOL_ZURKHAI';
  const password = process.env.QPAY_PASSWORD || '';
  const baseUrl = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn';

  // Return cached token if valid with 60s buffer
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  if (!password) {
    throw new Error('QPAY_PASSWORD is not configured in environment variables.');
  }

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const response = await fetch(`${baseUrl}/v2/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QPay Auth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Token expires_in is usually in seconds (e.g., 86400)
  const expiresInMs = (data.expires_in || 3600) * 1000;
  tokenExpiresAt = Date.now() + expiresInMs;

  return cachedToken;
}

export function getQPayBaseUrl() {
  return process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn';
}

export function getInvoiceCode() {
  return process.env.QPAY_INVOICE_CODE || 'MONGOL_ZURKHAI_INVOICE';
}