'use strict';

const { answerWithTrustedTools } = require('./trusted-tools');

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_TIMEOUT_MS = 6200;
const DEFAULT_MAX_SPEECH_CHARS = 850;
const DEFAULT_LIVE_DATA_TIMEOUT_MS = 5000;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getConfig() {
  return {
    apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
    model: String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
    agentName: String(process.env.AGENT_NAME || 'عبقور').trim(),
    agentContext: String(process.env.AGENT_CONTEXT || '').trim(),
    timeZone: String(process.env.TIME_ZONE || 'Asia/Riyadh').trim(),
    defaultTimeZone: String(
      process.env.DEFAULT_TIME_ZONE || process.env.TIME_ZONE || 'Asia/Riyadh',
    ).trim(),
    defaultLocation: String(process.env.DEFAULT_LOCATION || 'المدينة المنورة').trim(),
    defaultCountryCode: String(process.env.DEFAULT_COUNTRY_CODE || 'SA').trim(),
    requireCurrentDataVerification: parseBoolean(
      process.env.REQUIRE_CURRENT_DATA_VERIFICATION,
      true,
    ),
    speakSources: parseBoolean(process.env.SPEAK_SOURCES, false),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    liveDataTimeoutMs: Number(
      process.env.LIVE_DATA_TIMEOUT_MS || DEFAULT_LIVE_DATA_TIMEOUT_MS,
    ),
    maxSpeechChars: Number(
      process.env.MAX_SPEECH_CHARS || DEFAULT_MAX_SPEECH_CHARS,
    ),
  };
}

function cleanForSpeech(value, maxChars = DEFAULT_MAX_SPEECH_CHARS) {
  let text = String(value || '')
    .replace(/```[\s\S]*?```/g, ' تم حذف مقطع برمجي طويل. ')
    .replace(/https?:\/\/\S+/gi, ' رابط إلكتروني ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[*_#`>|~]/g, ' ')
    .replace(/[<>&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    text = 'لم أتمكن من صياغة إجابة واضحة.';
  }

  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars).replace(/\s+\S*$/, '')}...`;
  }

  return text;
}

function localToolAnswer(query, timeZone = 'Asia/Riyadh') {
  const normalized = String(query || '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[؟?]/g, '')
    .trim();

  if (/(كم الساعه|الوقت الان|ما الوقت|الساعه الان)/.test(normalized)) {
    return new Intl.DateTimeFormat('ar-SA', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  }

  if (/(ما التاريخ|تاريخ اليوم|ما هو اليوم|اي يوم اليوم)/.test(normalized)) {
    return new Intl.DateTimeFormat('ar-SA', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }

  return null;
}

function buildSystemPrompt(config, channel) {
  const channelRules = channel === 'whatsapp'
    ? 'اجعل الإجابة مناسبة لرسالة واتساب قصيرة، ويمكن استخدام أسطر بسيطة دون جداول.'
    : 'اجعل الإجابة مناسبة للاستماع: ابدأ بالجواب المباشر، بلا Markdown، وغالباً في جملة إلى ثلاث جمل قصيرة.';

  return [
    `أنت وكيل ذكاء اصطناعي عربي اسمه ${config.agentName}.`,
    'هويتك التقنية ثابتة: أنت عبقور، وكيل مخصص يعمل من خلال مهارة أليكسا.',
    'تستخدم حالياً نموذج جيميناي من جوجل لتوليد الإجابات.',
    'أليكسا هي الواجهة الصوتية وليست النموذج الذي يولد إجاباتك.',
    'لست شات جي بي تي ولست منتجاً من أوبن أيه آي، ولا تنسب نفسك إلى أوبن أيه آي.',
    'لا تقل إن جوجل أو أمازون طورت عبقور؛ جوجل توفر النموذج وأمازون توفر واجهة أليكسا فقط.',
    'عبقور هو مشروع ربط الذكاء الاصطناعي بأمازون أليكسا تم إنشاء وتطوير المشروع بواسطة محمد عجمي وهو مالك المشروع.',
    'افهم العربية الفصحى واللهجات العربية الشائعة، وخصوصاً اللهجة السعودية واللهجة السورية.',
    'فسر الكلمات العامية من سياقها، مثل: وش، إيش، ليش، وين، أبغى، أبي، بدي، شو، شلون، قديش، فيك، وبتقدر.',
    'حتى عندما يتحدث المستخدم بالعامية، أجب باللغة العربية الفصحى الواضحة والطبيعية.',
    'لا تصحح لهجة المستخدم ولا تطلب منه إعادة السؤال بالفصحى إلا إذا كان المعنى غامضاً فعلاً.',
    channelRules,
    'الدقة أهم من إكمال الإجابة. لا تخترع رقماً أو وقتاً أو تاريخاً أو اسماً أو مصدراً.',
    'إذا ذكر المستخدم مدينة أو دولة، استخدم الموقع المذكور ولا تطلب موقع الجهاز.',
    'لا تقل إنك تحتاج إلى صلاحية الموقع إذا كان المكان مذكوراً في السؤال.',
    'المعلومات اليومية أو الحالية أو القابلة للتغير يجب أن تأتي من أداة تحقق، لا من الذاكرة.',
    'إذا لم تتوفر أداة تحقق مناسبة، قل إنك لم تتمكن من التحقق ولا تخمّن.',
    'استخدم مصادر رسمية أو متخصصة وموثوقة عند توفرها.',
    'لا تذكر أسماء المصادر أو الروابط في الإجابة الصوتية إلا إذا طلب المستخدم ذلك صراحة.',
    'لا تدّع تنفيذ إجراء لم تنفذه فعلياً.',
    'إذا لم تكن متأكداً فقل بوضوح إنك لا تعرف أو لم تتمكن من التحقق.',
    'لا تعرض مفاتيح أو كلمات مرور أو بيانات شخصية حساسة.',
    config.agentContext ? `السياق الخاص بالمالك: ${config.agentContext}` : '',
  ].filter(Boolean).join('\n');
}

async function askGemini({ userText, history = [], channel = 'alexa' }) {
  const config = getConfig();
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const contents = history
    .filter(item => item && typeof item.text === 'string')
    .slice(-4)
    .map(item => ({
      role: item.role === 'model' ? 'model' : 'user',
      parts: [{ text: item.text.slice(0, 1200) }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: String(userText || '').slice(0, 3000) }],
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(config, channel) }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: channel === 'whatsapp' ? 420 : 240,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = data?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API error: ${apiMessage}`);
    }

    const answer = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part?.text || '')
      .join(' ')
      .trim();

    if (!answer) {
      throw new Error('Gemini returned an empty answer');
    }

    return channel === 'alexa'
      ? cleanForSpeech(answer, config.maxSpeechChars)
      : String(answer).trim().slice(0, 3500);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  answerWithTrustedTools,
  askGemini,
  buildSystemPrompt,
  cleanForSpeech,
  getConfig,
  localToolAnswer,
};
