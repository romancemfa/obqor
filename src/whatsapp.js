'use strict';

const crypto = require('crypto');
const { askGemini } = require('./agent');

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function verifyMetaSignature(rawBody, signatureHeader) {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  if (!appSecret || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  const received = signatureHeader.slice('sha256='.length);

  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex'),
  );
}

function whatsappVerificationHandler(req, res) {
  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  const mode = String(req.query?.['hub.mode'] || '');
  const suppliedToken = String(req.query?.['hub.verify_token'] || '');
  const challenge = String(req.query?.['hub.challenge'] || '');

  if (verifyToken && mode === 'subscribe' && suppliedToken === verifyToken) {
    res.status(200).type('text/plain').send(challenge);
    return;
  }

  res.status(403).json({ error: 'Webhook verification failed' });
}

async function sendWhatsAppText(to, text) {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const graphVersion = String(process.env.META_GRAPH_API_VERSION || '').trim();

  if (!accessToken || !phoneNumberId || !graphVersion) {
    throw new Error('WhatsApp production variables are incomplete');
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `WhatsApp HTTP ${response.status}`);
  }
  return data;
}

async function whatsappMessageHandler(req, res) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const signature = getHeader(req, 'x-hub-signature-256');

  if (!verifyMetaSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid Meta signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  const from = String(message.from || '').trim();
  const text = String(message?.text?.body || '').trim();
  if (!from || !text) {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  try {
    const answer = await askGemini({ userText: text, history: [], channel: 'whatsapp' });
    await sendWhatsAppText(from, answer || 'لم أتمكن من إعداد إجابة.');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}

module.exports = {
  verifyMetaSignature,
  whatsappMessageHandler,
  whatsappVerificationHandler,
};
