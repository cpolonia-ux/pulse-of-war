export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({error:'Method not allowed'}); return; }

  const ODOO = {
    url: process.env.ODOO_URL,
    db: process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    password: process.env.ODOO_PASSWORD,
  };

  const { name, email, type, amount } = req.body;

  try {
    // Authenticate
    const authRes = await fetch(ODOO.url + '/web/session/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: { db: ODOO.db, login: ODOO.username, password: ODOO.password }
      })
    });
    const authData = await authRes.json();
    const uid = authData?.result?.uid;
    if (!uid) throw new Error('Odoo auth failed');

    const cookie = authRes.headers.get('set-cookie') || '';

    // Create lead
    const leadRes = await fetch(ODOO.url + '/web/dataset/call_kw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: {
          model: 'crm.lead', method: 'create',
          args: [{
            name: `[PULSE OF WAR] ${type} — ${email}`,
            contact_name: name || email,
            email_from: email,
            description: `Type: ${type}\nAmount: $${amount}\nGame: Pulse of War\nDate: ${new Date().toISOString()}`,
            priority: type === 'INVESTOR' ? '2' : '1',
            tag_ids: []
          }],
          kwargs: {}
        }
      })
    });

    const leadData = await leadRes.json();
    if (leadData.error) throw new Error(leadData.error.message);

    res.status(200).json({ success: true, id: leadData.result });

  } catch(e) {
    console.error('Odoo error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
