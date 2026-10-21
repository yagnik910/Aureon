const nodemailer = require('nodemailer');

const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}
function cleanMsg(v, max) {
  return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
}
function nl2br(v) {
  return esc(v).replace(/\n/g, '<br>');
}

function ownerHtml(d) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111;">
  <h2 style="margin:0 0 12px;">New website enquiry</h2>
  <p><b>Name:</b> ${esc(d.name)}<br><b>Email:</b> ${esc(d.email)}<br><b>Company:</b> ${esc(d.company || '-')}</p>
  <p><b>Message:</b><br>${nl2br(d.message)}</p>
  <p style="color:#666;">Reply to this email to answer them directly.</p>
</div>`;
}

function replyHtml(d) {
  const first = esc(d.name.split(/\s+/)[0] || 'there');
  return `<div style="margin:0;padding:32px 12px;background:#07080c;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#10121a;border:1px solid #3a3320;border-radius:24px;overflow:hidden;">
    <div style="padding:34px 34px 10px;text-align:center;">
      <div style="font-size:26px;font-weight:800;letter-spacing:6px;color:#e0b04f;">AUREON</div>
      <div style="margin-top:6px;font-size:12px;color:#9aa0ae;letter-spacing:1px;">Digital assets that grow your business</div>
    </div>
    <div style="padding:20px 34px 34px;color:#ece8df;font-size:16px;line-height:1.65;">
      <h2 style="margin:0 0 14px;font-size:24px;color:#ffffff;">Hi ${first}, thank you! &#10024;</h2>
      <p style="margin:0 0 14px;">Your message just landed in our inbox and the whole team is excited to read it.</p>
      <div style="margin:18px 0;padding:16px 18px;background:#171a25;border-left:3px solid #e0b04f;border-radius:10px;color:#cfd2da;font-size:14px;">
        <b style="color:#e0b04f;">What you sent us</b><br>
        Company: ${esc(d.company || '-')}<br>
        ${nl2br(d.message)}
      </div>
      <p style="margin:0 0 14px;">A real person from Aureon will reply within <b style="color:#e0b04f;">one business day</b> with next steps.</p>
      <p style="margin:0;color:#9aa0ae;">Until then, have a golden day! &#128155;</p>
      <p style="margin:22px 0 0;">Warmly,<br><b>The Aureon team</b></p>
    </div>
    <div style="padding:16px 34px;border-top:1px solid #23252f;text-align:center;font-size:12px;color:#6c7280;">
      aureonhelpcenter@gmail.com &middot; &copy; 2026 Aureon Studio
    </div>
  </div>
</div>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'x').trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_HITS) return res.status(429).json({ ok: false, error: 'rate' });
  list.push(now);
  hits.set(ip, list);

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  if (body.website) return res.status(200).json({ ok: true });

  const d = {
    name: clean(body.from_name || body.name, 100),
    email: clean(body.from_email || body.email, 200),
    company: clean(body.company, 150),
    message: cleanMsg(body.message || body.msg, 4000),
  };
  if (!d.name || !d.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(500).json({ ok: false, error: 'not_configured' });
  const owner = process.env.OWNER_EMAIL || user;

  try {
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await Promise.all([
      transport.sendMail({
        from: `"Aureon Website" <${user}>`,
        to: owner,
        replyTo: `"${d.name.replace(/["<>]/g, '')}" <${d.email}>`,
        subject: `New Aureon enquiry from ${d.name}`,
        html: ownerHtml(d),
        text: `New enquiry\n\nName: ${d.name}\nEmail: ${d.email}\nCompany: ${d.company || '-'}\n\n${d.message}`,
      }),
      transport.sendMail({
        from: `"Aureon Studio" <${user}>`,
        to: d.email,
        replyTo: owner,
        subject: `Thank you for reaching out to Aureon, ${d.name.split(/\s+/)[0]}`,
        html: replyHtml(d),
        text: `Hi ${d.name.split(/\s+/)[0]}, thank you for reaching out to Aureon! We got your message and will reply within one business day. Have a golden day!\n\n- The Aureon team`,
      }),
    ]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('mail failed:', err && err.message);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
