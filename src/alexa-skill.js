'use strict';

const Alexa = require('ask-sdk-core');
const {
  answerWithTrustedTools,
  askGemini,
  getConfig,
  localToolAnswer,
} = require('./agent');

function getSlotValue(handlerInput, slotName) {
  const slots = handlerInput.requestEnvelope?.request?.intent?.slots || {};
  return String(slots[slotName]?.value || '').trim();
}

function getHistory(handlerInput) {
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  return Array.isArray(attrs.history) ? attrs.history.slice(-4) : [];
}

function saveHistory(handlerInput, history, userText, modelText) {
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  attrs.history = [
    ...history,
    { role: 'user', text: userText.slice(0, 700) },
    { role: 'model', text: modelText.slice(0, 1000) },
  ].slice(-4);
  handlerInput.attributesManager.setSessionAttributes(attrs);
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const { agentName } = getConfig();
    return handlerInput.responseBuilder
      .speak(`مرحباً، أنا ${agentName}. قل: اسأل، ثم اذكر سؤالك.`)
      .reprompt('ما سؤالك؟')
      .getResponse();
  },
};

const AskAgentIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskAgentIntent';
  },
  async handle(handlerInput) {
    const query = getSlotValue(handlerInput, 'query');
    if (!query) {
      return handlerInput.responseBuilder
        .speak('لم أسمع السؤال بوضوح. قل: اسأل، ثم اذكر سؤالك.')
        .reprompt('ما سؤالك؟')
        .getResponse();
    }

    try {
      const config = getConfig();
      const history = getHistory(handlerInput);

      const localAnswer = localToolAnswer(query, config.defaultTimeZone);
      let answer = localAnswer;
      let source = localAnswer
        ? { provider: 'system-clock', type: 'local-time-or-date' }
        : null;

      if (!answer) {
        const trustedResult = await answerWithTrustedTools(query, config);
        if (trustedResult?.handled) {
          answer = trustedResult.answer;
          source = trustedResult.source || null;
        }
      }

      if (!answer) {
        answer = await askGemini({
          userText: query,
          history,
          channel: 'alexa',
        });
        source = { provider: 'Google Gemini', type: 'general-knowledge' };
      }

      if (source) {
        console.info('Answer source metadata:', {
          ...source,
          spokenToUser: false,
        });
      }

      saveHistory(handlerInput, history, query, answer);

      return handlerInput.responseBuilder
        .speak(answer)
        .reprompt('هل لديك سؤال آخر؟')
        .getResponse();
    } catch (error) {
      console.error('AskAgentIntent error:', error);
      const fallback = error?.name === 'AbortError'
        ? 'تأخرت خدمة البيانات في الرد. أعد السؤال بعد قليل.'
        : 'تعذر الوصول إلى الخدمة المطلوبة. تحقق من إعدادات المشروع وسجل التشغيل.';

      return handlerInput.responseBuilder
        .speak(fallback)
        .reprompt('يمكنك إعادة السؤال.')
        .getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('قل: اسأل، ثم اذكر أي سؤال. مثال: اسأل متى شروق الشمس في المدينة المنورة اليوم.')
      .reprompt('ما سؤالك؟')
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    if (Alexa.getRequestType(handlerInput.requestEnvelope) !== 'IntentRequest') {
      return false;
    }
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    return intentName === 'AMAZON.CancelIntent'
      || intentName === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('تم.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('لم أفهم الطلب. قل: اسأل، ثم اذكر سؤالك.')
      .reprompt('ما سؤالك؟')
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Alexa skill error:', error);
    return handlerInput.responseBuilder
      .speak('حدث خطأ غير متوقع في المهارة.')
      .getResponse();
  },
};

function createAlexaSkill() {
  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      AskAgentIntentHandler,
      HelpIntentHandler,
      CancelAndStopIntentHandler,
      FallbackIntentHandler,
      SessionEndedRequestHandler,
    )
    .addErrorHandlers(ErrorHandler)
    .create();
}

module.exports = { createAlexaSkill };
