export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({error:'Method not allowed'}); return; }

  const url      = process.env.ODOO_URL;
  const db       = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const apiKey   = process.env.ODOO_API_KEY;

  const { name, email, type, amount } = req.body;

  try {
    // Use API key authentication (Basic auth with api key as password)
    const credentials = Buffer.from(`${username}:${apiKey}`).toString('base64');

    const leadRes = await fetch(`${url}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        id: 1,
        params: {
          model: 'crm.lead',
          method: 'create',
          args: [{
            name: `[PULSE OF WAR] ${type} — ${email}`,
            contact_name: name || email,
            email_from: email,
            description: `Type: ${type}\nAmount: $${amount}\nGame: Pulse of War\nDate: ${new Date().toISOString()}`,
            priority: type === 'INVESTOR' ? '2' : '1',
          }],
          kwargs: { context: { db } }
        }
      })
    });

    const data = await leadRes.json();
    console.log('Odoo response:', JSON.stringify(data));

    if (data.error) throw new Error(data.error.data?.message || data.error.message);
    res.status(200).json({ success: true, id: data.result });

  } catch(e) {
    console.error('Odoo error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
