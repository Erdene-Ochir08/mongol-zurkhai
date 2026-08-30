const CLOUD_DB_URL = 'https://api.restful-api.dev/objects/ff808181a04ccf2d01a051b66386153c';

let cache = {
  visits: [],
  events: [],
  transactions: []
};
let lastFetchTime = 0;

export async function fetchCloudData() {
  // If cache is fresh (< 2 seconds), return cache
  if (Date.now() - lastFetchTime < 2000 && cache.visits.length > 0) {
    return cache;
  }

  try {
    const res = await fetch(CLOUD_DB_URL, { timeout: 4000 });
    if (res.ok) {
      const body = await res.json();
      if (body && body.data) {
        cache = {
          visits: Array.isArray(body.data.visits) ? body.data.visits : [],
          events: Array.isArray(body.data.events) ? body.data.events : [],
          transactions: Array.isArray(body.data.transactions) ? body.data.transactions : []
        };
        lastFetchTime = Date.now();
      }
    }
  } catch (err) {
    console.warn('Could not fetch cloud analytics:', err.message);
  }
  return cache;
}

export async function saveCloudData(data) {
  cache = data;
  lastFetchTime = Date.now();

  try {
    await fetch(CLOUD_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'mongol_zurkhai_analytics_prod',
        data: {
          visits: data.visits.slice(-3000),
          events: data.events.slice(-3000),
          transactions: data.transactions.slice(-1000)
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

export async function recordTransaction({ invoice_id, amount = 9900, status = 'PENDING', profile = {}, isMock = false }) {
  const current = await fetchCloudData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  let tx = current.transactions.find(t => t.invoice_id === invoice_id);
  if (tx) {
    tx.status = status;
    if (status === 'PAID' && !tx.paidAt) {
      tx.paidAt = now.toISOString();
    }
    if (profile && Object.keys(profile).length > 0) {
      tx.profile = { ...tx.profile, ...profile };
    }
  } else {
    tx = {
      invoice_id,
      amount: Number(amount),
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