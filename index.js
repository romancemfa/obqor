'use strict';

const express = require('express');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const { createAlexaSkill } = require('./src/alexa-skill');
const {
  whatsappVerificationHandler,
  whatsappMessageHandler,
} = require('./src/whatsapp');

const app = express();
app.disable('x-powered-by');

app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Obqor AI Agent',
    status: 'online',
    alexaEndpoint: '/alexa',
    whatsappEndpoint: '/whatsapp',
    awsRequired: false,
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// لا تضع أي body parser قبل هذا المسار. المحول الرسمي يحتاج النص الخام
// للتحقق من توقيع Alexa وتاريخ الطلب.
const alexaSkill = createAlexaSkill();
const alexaAdapter = new ExpressAdapter(alexaSkill, true, true);
const [ensureRawBody, alexaTextParser, dispatchAlexa] = alexaAdapter.getRequestHandlers();

function verifyAlexaSkillId(req, res, next) {
  const expectedSkillId = String(process.env.ALEXA_SKILL_ID || '').trim();
  if (!expectedSkillId) {
    res.status(500).send('ALEXA_SKILL_ID is not configured');
    return;
  }

  try {
    const envelope = JSON.parse(req.body);
    const actualSkillId = envelope?.context?.System?.application?.applicationId
      || envelope?.session?.application?.applicationId
      || '';

    if (actualSkillId !== expectedSkillId) {
      res.status(400).send('Alexa applicationId mismatch');
      return;
    }

    next();
  } catch (error) {
    res.status(400).send('Invalid Alexa request JSON');
  }
}

app.post(
  '/alexa',
  ensureRawBody,
  alexaTextParser,
  verifyAlexaSkillId,
  dispatchAlexa,
);

app.all('/alexa', (req, res) => {
  res.status(405).json({ error: 'Alexa endpoint accepts POST only' });
});

// WhatsApp يستخدم الجسم الخام أيضاً للتحقق من توقيع Meta.
app.get('/whatsapp', whatsappVerificationHandler);
app.post('/whatsapp', express.raw({ type: 'application/json', limit: '1mb' }), whatsappMessageHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled Express error:', error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel يلتقط التطبيق المصدّر مباشرة. الاستماع محلي فقط.
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Obqor AI Agent listening on http://localhost:${port}`);
  });
}

module.exports = app;
