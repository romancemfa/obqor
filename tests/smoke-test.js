'use strict';

const assert = require('assert');
const { localToolAnswer, cleanForSpeech } = require('../src/agent');
const { createAlexaSkill } = require('../src/alexa-skill');

(async () => {
  assert(localToolAnswer('كم الساعة', 'Asia/Riyadh'));
  assert(localToolAnswer('ما تاريخ اليوم', 'Asia/Riyadh'));
  assert.strictEqual(localToolAnswer('ما هو الراوتر', 'Asia/Riyadh'), null);
  assert(!cleanForSpeech('**نص** https://example.com').includes('https://'));

  const skill = createAlexaSkill();
  const response = await skill.invoke({
    version: '1.0',
    session: {
      new: true,
      sessionId: 'test-session',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'test-user' },
      attributes: {},
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'test-user' },
        device: { deviceId: 'test-device', supportedInterfaces: {} },
        apiEndpoint: 'https://api.amazonalexa.com',
      },
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'test-request',
      timestamp: new Date().toISOString(),
      locale: 'ar-SA',
      shouldLinkResultBeReturned: false,
    },
  });

  assert(response?.response?.outputSpeech?.ssml?.includes('عبقور'));
  console.log('Smoke tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
