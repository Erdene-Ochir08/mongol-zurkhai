import fs from 'fs';
import path from 'path';

const TMP_FILE = path.join('/tmp', 'zurkhai_analytics.json');

// In-memory fallback
let memoryData = {
  visits: [],
  events: [],
  transactions: []
};

// Initialize from file if exists
function loadData() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf8');
      const parsed = JSON.parse(content);
      memoryData = {
        visits: parsed.visits || [],
        events: parsed.events || [],
        transactions: parsed.transactions || []
      };
    }
  } catch (err) {
    // Ignore and use memoryData
  }
  return memoryData;
}

function saveData() {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(memoryData, null, 2), 'utf8');
  } catch (err) {
    // Ignore file write errors in strict environments
  }
}

export function recordVisit({ ip, userAgent, path: reqPath }) {
  loadData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  const visit = {
    id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now.toISOString(),
    date: dateStr,
    userAgent: userAgent || 'Unknown',
    path: reqPath || '/'
  };

  memoryData.visits.push(visit);
  if (memoryData.visits.length > 5000) {
    memoryData.visits = memoryData.visits.slice(-5000);
  }
  saveData();
  return visit;
}

export function recordEvent(type, data = {}) {
  loadData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const event = {
    id: `e_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    data,
    timestamp: now.toISOString(),
    date: dateStr
  };

  memoryData.events.push(event);
  if (memoryData.events.length > 5000) {
    memoryData.events = memoryData.events.slice(-5000);
  }
  saveData();
  return event;
}

export function recordTransaction({ invoice_id, amount = 9900, status = 'PENDING', profile = {}, isMock = false }) {
  loadData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  let tx = memoryData.transactions.find(t => t.invoice_id === invoice_id);
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
    memoryData.transactions.push(tx);
  }

  if (memoryData.transactions.length > 2000) {
    memoryData.transactions = memoryData.transactions.slice(-2000);
  }
  saveData();
  return tx;
}

export function getStats() {
  loadData();
  return memoryData;
}