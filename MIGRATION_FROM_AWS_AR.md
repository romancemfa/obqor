# الترحيل من نسخة AWS إلى Vercel

## احذف من خطواتك السابقة

لا تنفذ أيّاً مما يلي:

- إنشاء AWS Lambda.
- رفع ملف Lambda ZIP.
- إضافة Alexa Skills Kit Trigger.
- استخدام Lambda ARN.
- إضافة متغيرات البيئة في AWS.
- فتح CloudWatch.

## البديل

| الإعداد السابق | الإعداد الجديد |
|---|---|
| AWS Lambda | Vercel Express Function |
| Lambda ARN | رابط HTTPS ينتهي بـ `/alexa` |
| Lambda Environment Variables | Vercel Environment Variables |
| CloudWatch Logs | Vercel Runtime Logs |
| Alexa Skills Kit Trigger | التحقق من توقيع Alexa داخل `ask-sdk-express-adapter` |
| تقييد Lambda بواسطة Skill ID | متغير `ALEXA_SKILL_ID` والتحقق من `applicationId` |

## نقطة Alexa الجديدة

```text
https://اسم-المشروع.vercel.app/alexa
```

داخل Alexa Developer Console اختر HTTPS، ولا تختَر AWS Lambda ARN.
