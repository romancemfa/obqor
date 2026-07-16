'use strict';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_TIMEOUT_MS = 6200;
const DEFAULT_MAX_SPEECH_CHARS = 850;

function getConfig() {
  return {
    apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
    model: String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
    agentName: String(process.env.AGENT_NAME || 'عبقور').trim(),
    agentContext: String(process.env.AGENT_CONTEXT || '').trim(),
    timeZone: String(process.env.TIME_ZONE || 'Asia/Riyadh').trim(),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxSpeechChars: Number(process.env.MAX_SPEECH_CHARS || DEFAULT_MAX_SPEECH_CHARS),
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
  const normalized = String(query || '').replace(/[؟?]/g, '').trim();

  if (/(كم الساعة|الوقت الآن|ما الوقت|الساعة الآن)/.test(normalized)) {
    return new Intl.DateTimeFormat('ar-SA', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  }

  if (/(ما التاريخ|تاريخ اليوم|ما هو اليوم|أي يوم اليوم)/.test(normalized)) {
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
    : 'اجعل الإجابة مناسبة للاستماع: مباشرة، دقيقة، بلا Markdown، وغالباً في ثلاث جمل قصيرة كحد أقصى.';

  return [
    `أنت وكيل ذكاء اصطناعي عربي اسمه ${config.agentName}.`,
    'أجب باللغة العربية الفصحى فقط.',
    channelRules,
    'لا تدّع تنفيذ إجراء لم تنفذه.',
    'إذا لم تكن متأكداً فقل بوضوح إنك لا تعرف.',
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
      temperature: 0.35,
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
  askGemini,
  cleanForSpeech,
  getConfig,
  localToolAnswer,
};
