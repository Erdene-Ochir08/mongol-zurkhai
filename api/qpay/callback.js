export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // QPay triggers callback upon successful payment
  console.log('QPay Callback received:', {
    query: req.query,
    body: req.body,
    headers: req.headers
  });

  // Always return 200 SUCCESS so QPay marks webhook delivered
  return res.status(200).send('SUCCESS');
}