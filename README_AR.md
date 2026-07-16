# وكيل عبقور AI على Alexa دون AWS

## البنية الجديدة

```text
Echo Dot
   ↓
Alexa Custom Skill
   ↓ HTTPS
Vercel Function / Express
   ↓
Gemini API
```

لا يحتاج المشروع إلى حساب AWS أو Lambda. تستخدم المهارة نقطة نهاية HTTPS عادية مستضافة على Vercel.

> تنبيه ترخيصي: خطة Vercel Hobby المجانية مخصصة للاستخدام الشخصي وغير التجاري. استخدمها لتطوير مهارتك الشخصية واختبارها. إذا تحولت المهارة أو ربط WhatsApp إلى خدمة تجارية للفندق، انقلها إلى خطة تسمح بالاستخدام التجاري أو إلى استضافتك الخاصة.

## الروابط بعد النشر

إذا كان رابط مشروع Vercel هو:

```text
https://obqor-ai-agent.vercel.app
```

فتكون نقطة Alexa:

```text
https://obqor-ai-agent.vercel.app/alexa
```

ونقطة WhatsApp المستقبلية:

```text
https://obqor-ai-agent.vercel.app/whatsapp
```

## ملفات المشروع

- `index.js`: تطبيق Express ومسارات Alexa وWhatsApp.
- `src/alexa-skill.js`: Intents ومنطق مهارة Alexa.
- `src/agent.js`: منطق Gemini وتنظيف الإجابات والأدوات المحلية.
- `src/whatsapp.js`: موصل WhatsApp المستقبلي.
- `alexa-skill-model/ar-SA.json`: نموذج اللغة العربي الجاهز للاستيراد.
- `.env.example`: أسماء متغيرات البيئة.

# الطريقة الأسهل للنشر دون npm على جهازك

هذه الطريقة مناسبة إذا ظهر لك سابقاً الخطأ `npm is not recognized`.

## 1. ارفع المشروع إلى GitHub من المتصفح

1. فك ضغط الملف.
2. أنشئ مستودع GitHub جديداً.
3. افتح المستودع واختر `Add file > Upload files`.
4. ارفع محتويات مجلد المشروع نفسه، لا ترفع المجلد الخارجي كملف ZIP.
5. يجب أن يظهر `package.json` و`index.js` في جذر المستودع.
6. لا ترفع أي ملف يحتوي مفاتيح فعلية.

## 2. أنشئ مشروع Vercel

1. سجل الدخول إلى Vercel باستخدام GitHub أو Google.
2. اختر `Add New > Project`.
3. استورد مستودع GitHub.
4. اترك `Root Directory` على جذر المشروع.
5. اختر `Framework Preset: Other` إذا لم يتعرف Vercel على Express تلقائياً.
6. قبل الضغط على Deploy أضف متغيرات البيئة التالية.

## 3. متغيرات البيئة المطلوبة

```text
ALEXA_SKILL_ID
GEMINI_API_KEY
GEMINI_MODEL
AGENT_NAME
AGENT_CONTEXT
TIME_ZONE
GEMINI_TIMEOUT_MS
MAX_SPEECH_CHARS
```

القيم المقترحة:

```text
GEMINI_MODEL=gemini-2.5-flash-lite
AGENT_NAME=عبقور
TIME_ZONE=Asia/Riyadh
GEMINI_TIMEOUT_MS=6200
MAX_SPEECH_CHARS=850
```

`ALEXA_SKILL_ID` يجب أن يكون Skill ID الفعلي من Alexa Developer Console.

## 4. انشر المشروع

اضغط Deploy. Vercel ينفذ `npm install` على خوادمه تلقائياً؛ لا تحتاج Node.js أو npm على جهازك لهذه الطريقة.

بعد النشر افتح رابط المشروع. يجب أن يظهر JSON يتضمن:

```json
{
  "service": "Obqor AI Agent",
  "status": "online",
  "alexaEndpoint": "/alexa",
  "awsRequired": false
}
```

واختبر:

```text
https://اسم-المشروع.vercel.app/health
```

# إعداد Alexa Developer Console

## 1. نموذج التفاعل

1. أنشئ Custom Skill باللغة `Arabic (SA)`.
2. اختر `Provision your own` أو خيار نقطة نهاية خارجية.
3. افتح `Build > Interaction Model > JSON Editor`.
4. الصق محتوى `alexa-skill-model/ar-SA.json`.
5. اضغط Save Model ثم Build Model.
6. انسخ Skill ID وضعه في متغير Vercel `ALEXA_SKILL_ID`.
7. أعد Deploy بعد إضافة المتغير إذا لزم.

## 2. Endpoint

في `Build > Endpoint`:

1. اختر `HTTPS` بدلاً من AWS Lambda ARN.
2. ضع الرابط:

```text
https://اسم-المشروع.vercel.app/alexa
```

3. مع رابط `*.vercel.app` اختر:

```text
My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority
```

Vercel يستخدم شهادة wildcard لنطاق `.vercel.app` ويجددها تلقائياً.

4. احفظ الإعداد.

## 3. الاختبار

1. افتح تبويب Test.
2. فعّل Development Testing.
3. استخدم حساب Amazon نفسه على جهاز Echo Dot.
4. اضبط لغة الجهاز على العربية السعودية.
5. قل:

```text
أليكسا، افتح عبقور الذكي
```

ثم:

```text
اسأل ما الفرق بين الراوتر والسويتش
```

# الأمان المطبق

- محول Alexa الرسمي يتحقق من توقيع الطلب.
- يتحقق من حداثة Timestamp لمنع إعادة إرسال طلب قديم.
- يتحقق المشروع من تطابق `applicationId` مع `ALEXA_SKILL_ID`.
- لا توجد مفاتيح داخل الكود.
- نقطة Alexa تقبل POST فقط.
- مسار WhatsApp يتحقق من توقيع Meta قبل معالجة الرسالة.

لا تعطل التحقق من التوقيع بهدف تجاوز أخطاء الاختبار.

# الذاكرة

النسخة الحالية تحفظ سياقاً قصيراً في `sessionAttributes` داخل جلسة Alexa الحالية فقط. لا توجد قاعدة بيانات ولا ذاكرة دائمة بين الجلسات.

هذا مناسب للبداية المجانية. الذاكرة الدائمة مستقبلاً تحتاج مخزناً خارجياً مثل Supabase أو Neon أو Upstash، وليست مطلوبة للتشغيل الأساسي.

# ربط WhatsApp مستقبلاً على Vercel

المسار موجود داخل المشروع:

```text
GET  /whatsapp
POST /whatsapp
```

المتغيرات المطلوبة:

```text
WHATSAPP_VERIFY_TOKEN
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_APP_SECRET
META_GRAPH_API_VERSION
```

خطوات الربط:

1. إنشاء تطبيق Meta وإضافة منتج WhatsApp.
2. ضبط Callback URL على رابط `/whatsapp`.
3. وضع نفس Verify Token في Meta وVercel.
4. الاشتراك في Webhook الخاص بالرسائل.
5. إضافة بقية المتغيرات وإعادة النشر.
6. البدء برقم الاختبار الذي توفره Meta.

التنفيذ الحالي مناسب للتجربة. للإنتاج يجب إضافة قاعدة بيانات لمنع تكرار `message_id`، وذاكرة لكل رقم، وQueue أو آلية معالجة موثوقة.

# التشغيل المحلي الاختياري

يحتاج Node.js 20 أو أحدث:

```bash
npm install
npm test
npm start
```

ثم افتح:

```text
http://localhost:3000/health
```

لا يمكن اختبار توقيع Alexa الحقيقي بمتصفح عادي؛ الاختبار الحقيقي يتم من Alexa Developer Console.

# الأعطال الشائعة

## Vercel يعرض 500 على `/alexa`

- تحقق من وجود `ALEXA_SKILL_ID` و`GEMINI_API_KEY`.
- تأكد أن Skill ID مطابق تماماً.
- راجع Runtime Logs داخل Vercel.

## Alexa تعرض مشكلة في استجابة المهارة

- تأكد أن Endpoint ينتهي بـ `/alexa`.
- استخدم HTTPS لا HTTP.
- اختر خيار شهادة wildcard لنطاق Vercel.
- أعد Build Model.
- تحقق من أن لغة المهارة والجهاز `Arabic (SA)`.

## Gemini يعرض 429

تم تجاوز حصة الطبقة المجانية أو معدل الطلبات. راجع الحصة في Google AI Studio.

## npm غير معروف على Windows

لا تحتاج npm عند استخدام طريقة GitHub ثم Vercel. Vercel يثبت الحزم تلقائياً أثناء النشر.
