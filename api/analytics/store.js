const CLOUD_DB_URL = 'https://api.restful-api.dev/objects/ff808181a04ccf2d01a051b66386153c';

export async function fetchCloudData() {
  try {
    const res = await fetch(CLOUD_DB_URL, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    if (res.ok) {
      const body = await res.json();
      if (body && body.data) {
        return {
          visits: Array.isArray(body.data.visits) ? body.data.visits : [],
          events: Array.isArray(body.data.events) ? body.data.events : [],
          transactions: Array.isArray(body.data.transactions) ? body.data.transactions : []
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch cloud analytics:', err.message);
  }
  return { visits: [], events: [], transactions: [] };
}

export async function saveCloudData(data) {
  try {
    await fetch(CLOUD_DB_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        name: 'mongol_zurkhai_analytics_prod',
        data: {
          visits: (data.visits || []).slice(-3000),
          events: (data.events || []).slice(-3000),
          transactions: (data.transactions || []).slice(-1000)
        }
      })
    });
  } catch (err) {
    console.warn('Could not save cloud analytics:', err.message);
  }
}

export async function recordVisit({ ip, userAgent, path: reqPath }) {
  const current = await fetchCloudData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const visit = {
    id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now.toISOString(),
    date: dateStr,
    userAgent: userAgent || 'Unknown',
    path: reqPath || '/'
  };

  current.visits.push(visit);
  await saveCloudData(current);
  return visit;
}

export async function recordEvent(type, data = {}) {
  const current = await fetchCloudData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const event = {
    id: `e_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    data,
    timestamp: now.toISOString(),
    date: dateStr
  };

  current.events.push(event);
  await saveCloudData(current);
  return event;
}

export async function recordTransaction({ invoice_id, sender_invoice_no, payment_id, amount = 9900, status = 'PENDING', profile = {}, isMock = false }) {
  const current = await fetchCloudData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const targetId = invoice_id || sender_invoice_no || payment_id || `INV-${Date.now()}`;

  let tx = current.transactions.find(t => 
    (invoice_id && (t.invoice_id === invoice_id || t.sender_invoice_no === invoice_id)) ||
    (sender_invoice_no && (t.sender_invoice_no === sender_invoice_no || t.invoice_id === sender_invoice_no)) ||
    (payment_id && (t.payment_id === payment_id || t.invoice_id === payment_id))
  );

  if (tx) {
    if (status === 'PAID') {
      tx.status = 'PAID';
      if (!tx.paidAt) tx.paidAt = now.toISOString();
    } else if (tx.status !== 'PAID') {
      tx.status = status;
    }
    if (profile && Object.keys(profile).length > 0) {
      tx.profile = { ...tx.profile, ...profile };
    }
    if (sender_invoice_no && !tx.sender_invoice_no) tx.sender_invoice_no = sender_invoice_no;
    if (payment_id && !tx.payment_id) tx.payment_id = payment_id;
    if (amount) tx.amount = Number(amount);
  } else {
    tx = {
      invoice_id: targetId,
      sender_invoice_no: sender_invoice_no || null,
      payment_id: payment_id || null,
      amount: Number(amount) || 9900,
      status,
      isMock,
      profile: profile || {},
      createdAt: now.toISOString(),
      paidAt: status === 'PAID' ? now.toISOString() : null,
      date: dateStr
    };
    current.transactions.push(tx);
  }

  await saveCloudData(current);
  return tx;
}

export async function getStats() {
  return await fetchCloudData();
}