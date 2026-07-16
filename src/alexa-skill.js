'use strict';

const Alexa = require('ask-sdk-core');
const { askGemini, getConfig, localToolAnswer } = require('./agent');

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
      const answer = localToolAnswer(query, config.timeZone)
        || await askGemini({ userText: query, history, channel: 'alexa' });

      saveHistory(handlerInput, history, query, answer);

      return handlerInput.responseBuilder
        .speak(answer)
        .reprompt('هل لديك سؤال آخر؟')
        .getResponse();
    } catch (error) {
      console.error('AskAgentIntent error:', error);
      const fallback = error?.name === 'AbortError'
        ? 'تأخر مزود الذكاء الاصطناعي في الرد. أعد السؤال بصيغة أقصر.'
        : 'تعذر الوصول إلى خدمة الذكاء الاصطناعي. تحقق من إعدادات المشروع وسجل التشغيل.';

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
      .speak('قل: اسأل، ثم اذكر أي سؤال. مثال: اسأل ما الفرق بين الواي فاي والإنترنت.')
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
    return intentName === 'AMAZON.CancelIntent' || intentName === 'AMAZON.StopIntent';
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
