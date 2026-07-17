'use strict';

const Alexa = require('ask-sdk-core');

const {
  answerWithTrustedTools,
  askGemini,
  getConfig,
  localToolAnswer,
} = require('./agent');

/**
 * Alexa لا ترسل الكلمة الثابتة الموجودة قبل SearchQuery
 * ضمن قيمة Slot.
 *
 * مثال:
 * المستخدم يقول: متى شروق الشمس؟
 * قيمة query ستكون: شروق الشمس
 *
 * لذلك نعيد إضافة «متى» قبل إرسال السؤال إلى الأدوات.
 */
const QUESTION_INTENT_PREFIXES = Object.freeze({
  WhatQuestionIntent: 'ما',
  HowQuestionIntent: 'كيف',
  WhyQuestionIntent: 'لماذا',
  WhenQuestionIntent: 'متى',
  WhereQuestionIntent: 'أين',
  WhoQuestionIntent: 'من',
  HowMuchQuestionIntent: 'كم',
  YesNoQuestionIntent: 'هل',
  RequestIntent: 'أريد',
  ImperativeQuestionIntent: 'أعطني',
  PossibilityQuestionIntent: 'هل يمكن',
  DifferenceQuestionIntent: 'ما الفرق بين',
  MeaningQuestionIntent: 'ما معنى',
  ReasonQuestionIntent: 'ما سبب',
});

const FREE_FORM_INTENTS = new Set([
  'AskAgentIntent',
  ...Object.keys(QUESTION_INTENT_PREFIXES),
]);

function getSlotValue(handlerInput, slotName) {
  const slots =
    handlerInput.requestEnvelope
      ?.request
      ?.intent
      ?.slots || {};

  return String(
    slots[slotName]?.value || '',
  ).trim();
}

/**
 * إعادة بناء السؤال الكامل.
 */
function getNaturalQuery(handlerInput) {
  const intentName = Alexa.getIntentName(
    handlerInput.requestEnvelope,
  );

  const slotValue = getSlotValue(
    handlerInput,
    'query',
  );

  if (!slotValue) {
    return '';
  }

  const prefix =
    QUESTION_INTENT_PREFIXES[intentName];

  return prefix
    ? `${prefix} ${slotValue}`
        .replace(/\s+/g, ' ')
        .trim()
    : slotValue;
}

function getHistory(handlerInput) {
  const attrs =
    handlerInput.attributesManager
      .getSessionAttributes();

  return Array.isArray(attrs.history)
    ? attrs.history.slice(-4)
    : [];
}

function saveHistory(
  handlerInput,
  history,
  userText,
  modelText,
) {
  const attrs =
    handlerInput.attributesManager
      .getSessionAttributes();

  attrs.history = [
    ...history,
    {
      role: 'user',
      text: userText.slice(0, 700),
    },
    {
      role: 'model',
      text: modelText.slice(0, 1000),
    },
  ].slice(-4);

  handlerInput.attributesManager
    .setSessionAttributes(attrs);
}

/**
 * إبقاء الجلسة مفتوحة دون Reprompt.
 *
 * Alexa تفتح الميكروفون لعدة ثوانٍ.
 * إذا لم يتكلم المستخدم تُغلق الجلسة تلقائياً.
 */
function keepConversationOpen(
  responseBuilder,
) {
  return responseBuilder
    .withShouldEndSession(false)
    .getResponse();
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(
      handlerInput.requestEnvelope,
    ) === 'LaunchRequest';
  },

  handle(handlerInput) {
    const { agentName } = getConfig();

    return keepConversationOpen(
      handlerInput.responseBuilder
        .speak(
          `مرحباً، أنا ${agentName}. تفضل بسؤالك.`,
        ),
    );
  },
};

const NaturalQuestionIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope,
      ) === 'IntentRequest'
      &&
      FREE_FORM_INTENTS.has(
        Alexa.getIntentName(
          handlerInput.requestEnvelope,
        ),
      )
    );
  },

  async handle(handlerInput) {
    const query =
      getNaturalQuery(handlerInput);

    if (!query) {
      return keepConversationOpen(
        handlerInput.responseBuilder
          .speak(
            'لم أسمع السؤال بوضوح. أعده من فضلك.',
          ),
      );
    }

    try {
      const config = getConfig();
      const history =
        getHistory(handlerInput);

      const localAnswer =
        localToolAnswer(
          query,
          config.defaultTimeZone,
        );

      let answer = localAnswer;

      let source = localAnswer
        ? {
            provider: 'system-clock',
            type: 'local-time-or-date',
          }
        : null;

      if (!answer) {
        const trustedResult =
          await answerWithTrustedTools(
            query,
            config,
          );

        if (trustedResult?.handled) {
          answer = trustedResult.answer;
          source =
            trustedResult.source || null;
        }
      }

      if (!answer) {
        answer = await askGemini({
          userText: query,
          history,
          channel: 'alexa',
        });

        source = {
          provider: 'Google Gemini',
          type: 'general-knowledge',
        };
      }

      if (source) {
        console.info(
          'Answer source metadata:',
          {
            ...source,
            spokenToUser: false,
          },
        );
      }

      saveHistory(
        handlerInput,
        history,
        query,
        answer,
      );

      return keepConversationOpen(
        handlerInput.responseBuilder
          .speak(answer),
      );
    } catch (error) {
      console.error(
        'NaturalQuestionIntent error:',
        error,
      );

      const fallback =
        error?.name === 'AbortError'
          ? 'تأخرت خدمة البيانات في الرد. أعد السؤال بعد قليل.'
          : 'تعذر الوصول إلى الخدمة المطلوبة حالياً.';

      return keepConversationOpen(
        handlerInput.responseBuilder
          .speak(fallback),
      );
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope,
      ) === 'IntentRequest'
      &&
      Alexa.getIntentName(
        handlerInput.requestEnvelope,
      ) === 'AMAZON.HelpIntent'
    );
  },

  handle(handlerInput) {
    return keepConversationOpen(
      handlerInput.responseBuilder
        .speak(
          'تحدث معي بصورة طبيعية. يمكنك أن تقول: متى شروق الشمس في المدينة المنورة اليوم، أو كيف يعمل الراوتر.',
        ),
    );
  },
};

const EndConversationIntentHandler = {
  canHandle(handlerInput) {
    if (
      Alexa.getRequestType(
        handlerInput.requestEnvelope,
      ) !== 'IntentRequest'
    ) {
      return false;
    }

    const intentName =
      Alexa.getIntentName(
        handlerInput.requestEnvelope,
      );

    return (
      intentName ===
        'EndConversationIntent'
      ||
      intentName ===
        'AMAZON.CancelIntent'
      ||
      intentName ===
        'AMAZON.StopIntent'
    );
  },

  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('مع السلامة.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope,
      ) === 'IntentRequest'
      &&
      Alexa.getIntentName(
        handlerInput.requestEnvelope,
      ) === 'AMAZON.FallbackIntent'
    );
  },

  handle(handlerInput) {
    return keepConversationOpen(
      handlerInput.responseBuilder
        .speak(
          'لم أفهم السؤال بوضوح. أعد صياغته من فضلك.',
        ),
    );
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope,
      ) === 'SessionEndedRequest'
    );
  },

  handle(handlerInput) {
    const request =
      handlerInput.requestEnvelope
        ?.request || {};

    console.info(
      'Alexa session ended:',
      {
        reason:
          request.reason || 'UNKNOWN',
        error:
          request.error || null,
      },
    );

    return handlerInput.responseBuilder
      .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },

  handle(handlerInput, error) {
    console.error(
      'Alexa skill error:',
      error,
    );

    return handlerInput.responseBuilder
      .speak(
        'حدث خطأ غير متوقع في المهارة.',
      )
      .withShouldEndSession(true)
      .getResponse();
  },
};

function createAlexaSkill() {
  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      NaturalQuestionIntentHandler,
      HelpIntentHandler,
      EndConversationIntentHandler,
      FallbackIntentHandler,
      SessionEndedRequestHandler,
    )
    .addErrorHandlers(
      ErrorHandler,
    )
    .create();
}

module.exports = {
  createAlexaSkill,
  getNaturalQuery,
};
