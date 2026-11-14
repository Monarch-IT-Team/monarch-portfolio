// Cloudflare Worker: receives the "Send a signal" form and forwards it to Telegram.
//
// Deploy (free plan is enough):
//   1. Create a bot with @BotFather → copy the token.
//   2. Send any message to the bot, then open
//      https://api.telegram.org/bot<TOKEN>/getUpdates and copy "chat":{"id": …}.
//   3. Cloudflare dashboard → Workers → Create → paste this file.
//   4. Settings → Variables: BOT_TOKEN (secret), CHAT_ID, ALLOWED_ORIGINS=https://monarch-it.github.io
//   5. Put the worker URL into src/config.ts → contactEndpoint (or the PUBLIC_CONTACT_ENDPOINT variable).
//
// Request:  POST JSON { name, contact, message, lang, page, website }  ("website" is a honeypot)
// Response: { ok: boolean }

const LIMITS = { name: 100, contact: 200, message: 3000, lang: 5, page: 300 };

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const html = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://monarch-it.github.io').split(',').map((s) => s.trim());
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const reply = (ok, status = ok ? 200 : 400) =>
      new Response(JSON.stringify({ ok }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return reply(false, 405);
    if (!allowed.includes(origin)) return reply(false, 403);

    let data;
    try {
      data = await request.json();
    } catch {
      return reply(false);
    }

    // bots fill the hidden field — pretend everything went fine
    if (clean(data.website, 100)) return reply(true);

    const name = clean(data.name, LIMITS.name);
    const contact = clean(data.contact, LIMITS.contact);
    const message = clean(data.message, LIMITS.message);
    const lang = clean(data.lang, LIMITS.lang);
    if (!message) return reply(false);

    const text = [
      '<b>Новый сигнал с сайта</b>',
      '',
      `<b>Имя:</b> ${html(name) || '—'}`,
      `<b>Связь:</b> ${html(contact) || '—'}`,
      `<b>Язык:</b> ${html(lang) || '—'}`,
      '',
      html(message),
    ].join('\n');

    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return reply(res.ok, res.ok ? 200 : 502);
  },
};
