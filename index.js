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
 * مسار فحص الصحة.
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
 * Custom Verifier للتحقق من أن الطلب يخص مهارة Alexa الحالية.
 *
 * محول Alexa يمرر جسم الطلب إلى verify كنص JSON خام.
 */
class AlexaSkillIdVerifier {
  async verify(requestEnvelope) {
    const expectedSkillId = String(
      process.env.ALEXA_SKILL_ID || '',
    ).trim();

    if (!expectedSkillId) {
      console.error(
        'Alexa request rejected: ALEXA_SKILL_ID is not configured',
      );

      throw new Error(
        'ALEXA_SKILL_ID is not configured',
      );
    }

    if (
      typeof requestEnvelope !== 'string'
      || !requestEnvelope.trim()
    ) {
      console.error(
        'Alexa request rejected: raw request body is missing',
      );

      throw new Error(
        'Alexa raw request body is missing',
      );
    }

    let envelope;

    try {
      envelope = JSON.parse(requestEnvelope);
    } catch (error) {
      console.error(
        'Alexa request rejected: request body is not valid JSON',
      );

      throw new Error(
        'Alexa request body is not valid JSON',
      );
    }

    const actualSkillId =
      envelope?.context?.System?.application?.applicationId
      || envelope?.session?.application?.applicationId
      || '';

    if (!actualSkillId) {
      console.error(
        'Alexa request rejected: applicationId is missing',
      );

      throw new Error(
        'Alexa applicationId is missing',
      );
    }

    if (actualSkillId !== expectedSkillId) {
      console.error(
        'Alexa applicationId mismatch',
        {
          expectedSkillId,
          actualSkillId,
        },
      );

      throw new Error(
        'Alexa applicationId mismatch',
      );
    }
  }
}

/**
 * إنشاء مهارة Alexa.
 */
const alexaSkill = createAlexaSkill();

/**
 * إنشاء محول Alexa الرسمي.
 *
 * المعامل الثاني true:
 * التحقق من توقيع Alexa.
 *
 * المعامل الثالث true:
 * التحقق من توقيت الطلب.
 *
 * المعامل الرابع:
 * Custom Verifiers.
 */
const alexaAdapter = new ExpressAdapter(
  alexaSkill,
  true,
  true,
  [
    new AlexaSkillIdVerifier(),
  ],
);

/**
 * نقطة استقبال Alexa.
 *
 * لا تضع express.json أو express.text أو bodyParser
 * قبل هذا المسار؛ محول Alexa يعالج الجسم بنفسه.
 */
app.post(
  '/alexa',
  alexaAdapter.getRequestHandlers(),
);

/**
 * المتصفح يرسل GET بينما Alexa ترسل POST.
 */
app.all('/alexa', (req, res) => {
  res.status(405).json({
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
 * المسارات غير الموجودة.
 */
app.use((req, res) => {
  res.status(404).json({
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

  return res.status(500).json({
    error: 'Internal server error',
  });
});

/**
 * التشغيل المحلي فقط.
 * Vercel تستخدم التطبيق المصدّر.
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
