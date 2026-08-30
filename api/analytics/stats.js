import { getStats, recordTransaction, recordVisit } from './store.js';
import { getQPayToken, getQPayBaseUrl } from '../qpay/utils.js';

const DEFAULT_ADMIN_PASSWORD = 'zurkhai2026!';

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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.writeHead(200);
    return res.end();
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const queryKey = req.query?.key || (req.body && req.body.key);
  const providedPassword = token || queryKey;

  const validPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  if (providedPassword !== validPassword) {
    return sendJson(res, 401, {
      error: 'Unauthorized',
      message: 'Админ нууц үг буруу байна.'
    });
  }

  try {
    const raw = getStats();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let visits = [...(raw.visits || [])];
    let transactions = [...(raw.transactions || [])];

    // Query real QPay bank server if live merchant credentials are set
    let isQPayLive = false;
    if (process.env.QPAY_PASSWORD) {
      try {
        const qToken = await getQPayToken();
        const baseUrl = getQPayBaseUrl();
        const qRes = await fetch(`${baseUrl}/v2/payment/list`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${qToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            object_type: 'INVOICE',
            offset: { page_number: 1, page_limit: 100 }
          })
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          isQPayLive = true;
          if (qData.rows && Array.isArray(qData.rows)) {
            qData.rows.forEach(row => {
              if (!transactions.some(t => t.invoice_id === row.invoice_id || t.invoice_id === row.payment_id)) {
                transactions.push({
                  invoice_id: row.invoice_id || row.payment_id,
                  amount: row.payment_amount || 9900,
                  status: row.payment_status === 'PAID' ? 'PAID' : 'PENDING',
                  paidAt: row.payment_date || row.created_date,
                  createdAt: row.created_date || row.payment_date,
                  date: (row.payment_date || row.created_date || todayStr).split('T')[0],
                  profile: { name: row.customer_name || 'QPay Хэрэглэгч', worry: 'wealth' }
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch live QPay payment list:', err.message);
      }
    }

    // Filter real paid transactions
    const paidTransactions = transactions.filter(t => t.status === 'PAID');
    const todayPaidTransactions = paidTransactions.filter(t => t.date === todayStr || (t.paidAt && t.paidAt.startsWith(todayStr)));

    const totalRevenue = paidTransactions.reduce((sum, t) => sum + (t.amount || 9900), 0);
    const todayRevenue = todayPaidTransactions.reduce((sum, t) => sum + (t.amount || 9900), 0);

    const totalVisitors = Math.max(visits.length, paidTransactions.length);
    const todayVisitors = visits.filter(v => v.date === todayStr).length;

    const conversionRate = totalVisitors > 0 ? ((paidTransactions.length / totalVisitors) * 100).toFixed(1) : (paidTransactions.length > 0 ? '100.0' : '0.0');

    // Daily chart for last 14 days
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().split('T')[0];
      dailyMap[ds] = { date: ds, visits: 0, revenue: 0, payments: 0 };
    }

    visits.forEach(v => {
      if (dailyMap[v.date]) {
        dailyMap[v.date].visits += 1;
      }
    });

    paidTransactions.forEach(t => {
      const d = t.date || (t.paidAt && t.paidAt.split('T')[0]);
      if (d && dailyMap[d]) {
        dailyMap[d].revenue += (t.amount || 9900);
        dailyMap[d].payments += 1;
      }
    });

    const dailyChart = Object.values(dailyMap);

    const worryMap = {
      wealth: { label: 'Эд хөрөнгө & Алтан үе', count: 0 },
      love: { label: 'Хайр дурлал & Ивээл хань', count: 0 },
      career: { label: 'Ажил, Алба & Амжилт', count: 0 },
      protection: { label: 'Далд дайсан & Хамгаалалт', count: 0 }
    };

    transactions.forEach(t => {
      const w = t.profile?.worry || 'wealth';
      if (worryMap[w]) {
        worryMap[w].count += 1;
      } else {
        worryMap.wealth.count += 1;
      }
    });

    let mobileCount = 0;
    let desktopCount = 0;
    visits.forEach(v => {
      const ua = (v.userAgent || '').toLowerCase();
      if (/iphone|android|mobile|ipad|tablet/.test(ua)) {
        mobileCount++;
      } else {
        desktopCount++;
      }
    });

    return sendJson(res, 200, {
      success: true,
      isQPayLive: Boolean(process.env.QPAY_PASSWORD),
      metrics: {
        totalRevenue,
        todayRevenue,
        totalVisitors,
        todayVisitors,
        paidCount: paidTransactions.length,
        pendingInvoices: transactions.filter(t => t.status === 'PENDING').length,
        conversionRate: `${conversionRate}%`,
        mobilePercent: totalVisitors > 0 ? Math.round((mobileCount / totalVisitors) * 100) : 100
      },
      dailyChart,
      worryDistribution: Object.entries(worryMap).map(([key, val]) => ({
        key,
        name: val.label,
        count: val.count
      })),
      deviceDistribution: [
        { name: 'Гар утас (Mobile)', count: mobileCount },
        { name: 'Компьютер (Desktop)', count: desktopCount }
      ],
      recentTransactions: transactions.slice(-100).reverse()
    });
  } catch (error) {
    console.error('Error generating stats:', error);
    return sendJson(res, 500, { error: 'Failed to generate stats', message: error.message });
  }
}