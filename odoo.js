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

  console.log('Odoo attempt:', { url, db, username, type, email });

  try {
    // Step 1: authenticate via XML-RPC
    const authRes = await fetch(`${url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><string>${username}</string></value></param>
    <param><value><string>${apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`
    });

    const authText = await authRes.text();
    console.log('Auth response:', authText.substring(0, 300));

    // Parse uid from XML response
    const uidMatch = authText.match(/<int>(\d+)<\/int>/);
    const uid = uidMatch ? parseInt(uidMatch[1]) : null;
    console.log('UID:', uid);

    if (!uid) throw new Error('Auth failed — no UID. Response: ' + authText.substring(0, 200));

    // Step 2: create lead via XML-RPC
    const createRes = await fetch(`${url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${apiKey}</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>
        <member><name>name</name><value><string>[PULSE OF WAR] ${type} — ${email}</string></value></member>
        <member><name>contact_name</name><value><string>${name || email}</string></value></member>
        <member><name>email_from</name><value><string>${email}</string></value></member>
        <member><name>description</name><value><string>Type: ${type} | Amount: $${amount} | Date: ${new Date().toISOString()}</string></value></member>
        <member><name>priority</name><value><string>${type === 'INVESTOR' ? '2' : '1'}</string></value></member>
      </struct></value>
    </data></array></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`
    });

    const createText = await createRes.text();
    console.log('Create response:', createText.substring(0, 300));

    const idMatch = createText.match(/<int>(\d+)<\/int>/);
    const leadId = idMatch ? parseInt(idMatch[1]) : null;

    if (!leadId) throw new Error('Lead creation failed. Response: ' + createText.substring(0, 200));

    res.status(200).json({ success: true, id: leadId });

  } catch(e) {
    console.error('Odoo error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
