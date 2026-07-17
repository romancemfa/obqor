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

/**
 * الصفحة الأساسية لفحص الخدمة.
 */
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Obqor AI Agent',
    status: 'online',
    alexaEndpoint: '/alexa',
    whatsappEndpoint: '/whatsapp',
    awsRequired: false,
    alexaSkillIdConfigured: Boolean(
      String(process.env.ALEXA_SKILL_ID || '').trim(),
    ),
    geminiApiKeyConfigured: Boolean(
      String(process.env.GEMINI_API_KEY || '').trim(),
    ),
  });
});

/**
 * فحص صحة الخدمة.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    alexaSkillIdConfigured: Boolean(
      String(process.env.ALEXA_SKILL_ID || '').trim(),
    ),
    geminiApiKeyConfigured: Boolean(
      String(process.env.GEMINI_API_KEY || '').trim(),
    ),
  });
});

/**
 * إنشاء مهارة Alexa ومحول Express الرسمي.
 *
 * true الأولى: التحقق من توقيع Alexa.
 * true الثانية: التحقق من Timestamp.
 */
const alexaSkill = createAlexaSkill();
const alexaAdapter = new ExpressAdapter(
  alexaSkill,
  true,
  true,
);

const [
  ensureRawBody,
  alexaTextParser,
  dispatchAlexa,
] = alexaAdapter.getRequestHandlers();

/**
 * التحقق من أن الطلب يخص مهارتنا تحديداً.
 *
 * بعد alexaTextParser تكون req.body كائن JavaScript جاهزاً،
 * لذلك لا نستخدم JSON.parse مرة أخرى.
 */
function verifyAlexaSkillId(req, res, next) {
  const expectedSkillId = String(
    process.env.ALEXA_SKILL_ID || '',
  ).trim();

  if (!expectedSkillId) {
    console.error(
      'Alexa request rejected: ALEXA_SKILL_ID is not configured',
    );

    return res
      .status(500)
      .json({
        error: 'ALEXA_SKILL_ID is not configured',
      });
  }

  const envelope = req.body;

  if (
    !envelope
    || typeof envelope !== 'object'
    || Array.isArray(envelope)
  ) {
    console.error(
      'Alexa request rejected: parsed request body is invalid',
    );

    return res
      .status(400)
      .json({
        error: 'Invalid Alexa request body',
      });
  }

  const actualSkillId =
    envelope?.context?.System?.application?.applicationId
    || envelope?.session?.application?.applicationId
    || '';

  if (!actualSkillId) {
    console.error(
      'Alexa request rejected: applicationId is missing',
    );

    return res
      .status(400)
      .json({
        error: 'Alexa applicationId is missing',
      });
  }

  if (actualSkillId !== expectedSkillId) {
    console.error(
      'Alexa applicationId mismatch',
      {
        expectedSkillId,
        actualSkillId,
      },
    );

    return res
      .status(400)
      .json({
        error: 'Alexa applicationId mismatch',
      });
  }

  return next();
}

/**
 * نقطة استقبال Alexa.
 *
 * ترتيب الوسطاء مهم:
 * 1. قراءة الجسم الخام.
 * 2. تحليل JSON بواسطة محول Alexa.
 * 3. التحقق من Skill ID.
 * 4. تشغيل المهارة.
 */
app.post(
  '/alexa',
  ensureRawBody,
  alexaTextParser,
  verifyAlexaSkillId,
  dispatchAlexa,
);

/**
 * المتصفح يرسل GET، بينما Alexa ترسل POST.
 */
app.all('/alexa', (req, res) => {
  res
    .status(405)
    .json({
      error: 'Alexa endpoint accepts POST only',
    });
});

/**
 * WhatsApp مستقبلاً.
 */
app.get(
  '/whatsapp',
  whatsappVerificationHandler,
);

app.post(
  '/whatsapp',
  express.raw({
    type: 'application/json',
    limit: '1mb',
  }),
  whatsappMessageHandler,
);

/**
 * مسار غير موجود.
 */
app.use((req, res) => {
  res
    .status(404)
    .json({
      error: 'Not found',
    });
});

/**
 * معالج أخطاء Express.
 */
app.use((error, req, res, next) => {
  console.error(
    'Unhandled Express error:',
    error,
  );

  if (res.headersSent) {
    return next(error);
  }

  return res
    .status(500)
    .json({
      error: 'Internal server error',
    });
});

/**
 * تشغيل محلي فقط.
 * Vercel تستخدم التطبيق المصدّر في نهاية الملف.
 */
if (require.main === module) {
  const port = Number(
    process.env.PORT || 3000,
  );

  app.listen(port, () => {
    console.log(
      `Obqor AI Agent listening on http://localhost:${port}`,
    );
  });
}

module.exports = app;
