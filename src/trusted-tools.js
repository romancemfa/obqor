'use strict';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * أسماء بديلة للمدن العربية.
 *
 * المفاتيح مكتوبة بعد تطبيق normalizeArabic:
 * - ة تتحول إلى ه
 * - أ، إ، آ تتحول إلى ا
 *
 * query:
 * الاسم الذي يرسل إلى Geocoding API.
 *
 * displayName:
 * الاسم العربي الذي يقال للمستخدم.
 */
const LOCATION_ALIASES = {
  'المدينه المنوره': {
    query: 'Medina',
    countryCode: 'SA',
    displayName: 'المدينة المنورة',
  },

  'مدينه المنوره': {
    query: 'Medina',
    countryCode: 'SA',
    displayName: 'المدينة المنورة',
  },

  'المدينه': {
    query: 'Medina',
    countryCode: 'SA',
    displayName: 'المدينة المنورة',
  },

  'مكه المكرمه': {
    query: 'Mecca',
    countryCode: 'SA',
    displayName: 'مكة المكرمة',
  },

  'مكه': {
    query: 'Mecca',
    countryCode: 'SA',
    displayName: 'مكة المكرمة',
  },

  'جده': {
    query: 'Jeddah',
    countryCode: 'SA',
    displayName: 'جدة',
  },

  'الرياض': {
    query: 'Riyadh',
    countryCode: 'SA',
    displayName: 'الرياض',
  },

  'الدمام': {
    query: 'Dammam',
    countryCode: 'SA',
    displayName: 'الدمام',
  },

  'الخبر': {
    query: 'Khobar',
    countryCode: 'SA',
    displayName: 'الخبر',
  },

  'الطائف': {
    query: 'Taif',
    countryCode: 'SA',
    displayName: 'الطائف',
  },

  'تبوك': {
    query: 'Tabuk',
    countryCode: 'SA',
    displayName: 'تبوك',
  },

  'ابها': {
    query: 'Abha',
    countryCode: 'SA',
    displayName: 'أبها',
  },

  'خميس مشيط': {
    query: 'Khamis Mushait',
    countryCode: 'SA',
    displayName: 'خميس مشيط',
  },

  'ينبع': {
    query: 'Yanbu',
    countryCode: 'SA',
    displayName: 'ينبع',
  },

  'العلا': {
    query: 'Al Ula',
    countryCode: 'SA',
    displayName: 'العلا',
  },

  'حائل': {
    query: 'Hail',
    countryCode: 'SA',
    displayName: 'حائل',
  },

  'القصيم': {
    query: 'Buraydah',
    countryCode: 'SA',
    displayName: 'القصيم',
  },

  'بريده': {
    query: 'Buraydah',
    countryCode: 'SA',
    displayName: 'بريدة',
  },

  'نجران': {
    query: 'Najran',
    countryCode: 'SA',
    displayName: 'نجران',
  },

  'جازان': {
    query: 'Jazan',
    countryCode: 'SA',
    displayName: 'جازان',
  },

  'لندن': {
    query: 'London',
    countryCode: 'GB',
    displayName: 'لندن',
  },

  'باريس': {
    query: 'Paris',
    countryCode: 'FR',
    displayName: 'باريس',
  },

  'القاهره': {
    query: 'Cairo',
    countryCode: 'EG',
    displayName: 'القاهرة',
  },

  'دبي': {
    query: 'Dubai',
    countryCode: 'AE',
    displayName: 'دبي',
  },

  'اسطنبول': {
    query: 'Istanbul',
    countryCode: 'TR',
    displayName: 'إسطنبول',
  },
};

function normalizeArabic(value) {
  return String(value || '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[؟?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function isIdentityQuestion(query) {
  const text = normalizeArabic(query);
  return includesAny(text, [
    /من انت/,
    /ما هويتك/,
    /من صنعك/,
    /من طورك/,
    /هل انت اليكسا/,
    /هل انت شات جي بي تي/,
    /هل انت جيميناي/,
    /هل انت من اوبن ايه اي/,
    /ما النموذج الذي تستخدمه/,
  ]);
}

function isSunQuestion(query) {
  const text = normalizeArabic(query);
  return /(شروق|طلوع الشمس|غروب|غروب الشمس)/.test(text);
}

function isWeatherQuestion(query) {
  const text = normalizeArabic(query);
  return /(الطقس|درجه الحراره|درجة الحراره|الحراره اليوم|الجو اليوم|هل تمطر|المطر اليوم|سرعه الرياح|الرطوبه)/.test(text);
}

function isCurrentSensitiveQuestion(query) {
  const text = normalizeArabic(query);
  return /(اليوم|غدا|الان|حاليا|احدث|اخر خبر|هذا الاسبوع|سعر|اسعار|نتيجه المباراه|موعد المباراه|الطقس|شروق|غروب)/.test(text);
}

function extractLocation(query, defaultLocation) {
  const original = String(query || '')
    .replace(/[؟?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /(?:^|\s)(?:في|ب)\s*([\u0600-\u06FF\p{L}\s.'-]+?)(?=\s+(?:اليوم|غدا|غداً|غدًا|الان|الآن|حاليا|حالياً|هذا|هذه|صباحا|صباحاً|مساء|مساءً)|$)/u,
    /(?:مدينه|مدينة)\s+([\u0600-\u06FF\p{L}\s.'-]+?)(?=\s+(?:اليوم|غدا|غداً|غدًا|الان|الآن|حاليا|حالياً|هذا|هذه)|$)/u,
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const location = match[1]
        .replace(/\b(?:وقت|موعد|شروق|غروب|الشمس|الطقس|الجو)\b/giu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (location.length >= 2) {
        return location;
      }
    }
  }

  return String(defaultLocation || 'المدينة المنورة').trim();
}

function getRelativeDayIndex(query) {
  const text = normalizeArabic(query);
  return /غدا/.test(text) ? 1 : 0;
}

function formatArabicTime(localIso) {
  const match = String(localIso || '').match(/T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error('Invalid local time returned by source');
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const period = hour24 < 12 ? 'صباحاً' : 'مساءً';
  const hour12 = hour24 % 12 || 12;
  const formatter = new Intl.NumberFormat('ar-SA', {
    useGrouping: false,
    minimumIntegerDigits: 2,
  });

  return `${formatter.format(hour12)}:${formatter.format(minute)} ${period}`;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Obqor-AI-Agent/2.1',
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.reason || `HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * تحويل اسم الموقع إلى إحداثيات ومنطقة زمنية.
 *
 * ترتيب البحث:
 * 1. الاسم الإنجليزي الموثوق من LOCATION_ALIASES.
 * 2. الاسم الذي قاله المستخدم كما هو.
 *
 * نرسل countryCode إلى Open-Meteo عندما يكون معروفاً،
 * بدلاً من محاولة تصفية النتائج بعد عودتها فقط.
 */
async function geocodeLocation(location, config) {
  const originalLocation = String(location || '').trim();

  if (!originalLocation) {
    throw new Error('لم يتم تحديد اسم الموقع');
  }

  const normalizedLocation = normalizeArabic(originalLocation);
  const alias = LOCATION_ALIASES[normalizedLocation] || null;

  const configuredCountryCode = String(
    config.defaultCountryCode || '',
  )
    .trim()
    .toUpperCase();

  const countryCode =
    alias?.countryCode
    || (
      /^[A-Z]{2}$/.test(configuredCountryCode)
        ? configuredCountryCode
        : ''
    );

  /**
   * نبني أكثر من محاولة بحث.
   * الاسم البديل الإنجليزي يأتي أولاً لأنه أكثر ثباتاً
   * في قواعد بيانات أسماء المواقع.
   */
  const searchNames = [];

  if (alias?.query) {
    searchNames.push(alias.query);
  }

  searchNames.push(originalLocation);

  /**
   * إزالة التكرار مع الحفاظ على ترتيب المحاولات.
   */
  const uniqueSearchNames = [
    ...new Set(
      searchNames
        .map(item => String(item || '').trim())
        .filter(Boolean),
    ),
  ];

  let results = [];
  let successfulSearchName = '';

  for (const searchName of uniqueSearchNames) {
    const params = new URLSearchParams({
      name: searchName,
      count: '10',
      language: 'ar',
      format: 'json',
    });

    /**
     * معامل رسمي في Open-Meteo لتقييد البحث بالدولة.
     */
    if (countryCode) {
      params.set('countryCode', countryCode);
    }

    const data = await fetchJson(
      `${GEOCODING_ENDPOINT}?${params.toString()}`,
      config.liveDataTimeoutMs,
    );

    const attemptResults = Array.isArray(data?.results)
      ? data.results
      : [];

    if (attemptResults.length > 0) {
      results = attemptResults;
      successfulSearchName = searchName;
      break;
    }
  }

  if (!results.length) {
    console.error(
      'Geocoding returned no results',
      {
        originalLocation,
        normalizedLocation,
        attemptedNames: uniqueSearchNames,
        countryCode,
      },
    );

    throw new Error(
      `لم يتم العثور على الموقع: ${originalLocation}`,
    );
  }

  /**
   * نفضل نتيجة الدولة المطلوبة.
   */
  const preferredCountryResult = countryCode
    ? results.find(
      item =>
        String(item?.country_code || '').toUpperCase()
        === countryCode,
    )
    : null;

  const place = preferredCountryResult || results[0];

  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);

  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
  ) {
    throw new Error(
      `إحداثيات الموقع غير صالحة: ${originalLocation}`,
    );
  }

  const timezone = String(
    place?.timezone
    || config.defaultTimeZone
    || 'Asia/Riyadh',
  ).trim();

  const displayName = String(
    alias?.displayName
    || place?.name
    || originalLocation,
  ).trim();

  console.log(
    'Geocoding location resolved',
    {
      originalLocation,
      successfulSearchName,
      displayName,
      countryCode: place?.country_code || countryCode,
      timezone,
    },
  );

  return {
    name: displayName,
    country: String(place?.country || ''),
    countryCode: String(
      place?.country_code || countryCode,
    ),
    latitude,
    longitude,
    timezone,
  };
}

async function getSunriseSunsetAnswer(query, config) {
  const locationQuery = extractLocation(query, config.defaultLocation);
  const place = await geocodeLocation(locationQuery, config);
  const dayIndex = getRelativeDayIndex(query);
  const text = normalizeArabic(query);
  const wantsSunset = /(غروب|غروب الشمس)/.test(text);

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    daily: 'sunrise,sunset',
    timezone: place.timezone || 'auto',
    forecast_days: dayIndex === 1 ? '2' : '1',
  });

  const data = await fetchJson(
    `${FORECAST_ENDPOINT}?${params.toString()}`,
    config.liveDataTimeoutMs,
  );

  const values = wantsSunset ? data?.daily?.sunset : data?.daily?.sunrise;
  const localIso = Array.isArray(values) ? values[dayIndex] : null;
  if (!localIso) {
    throw new Error('Sunrise or sunset data is unavailable');
  }

  const eventName = wantsSunset ? 'غروب الشمس' : 'شروق الشمس';
  const relativeDay = dayIndex === 1 ? 'غداً' : 'اليوم';
  const answer = `${eventName} في ${place.name} ${relativeDay} عند الساعة ${formatArabicTime(localIso)} بالتوقيت المحلي.`;

  return {
    handled: true,
    answer,
    source: {
      provider: 'Open-Meteo',
      type: wantsSunset ? 'sunset' : 'sunrise',
      location: `${place.name}${place.country ? `، ${place.country}` : ''}`,
      timezone: place.timezone,
      retrievedAt: new Date().toISOString(),
    },
  };
}

function weatherCodeToArabic(code) {
  const value = Number(code);
  if (value === 0) return 'صحو';
  if ([1, 2].includes(value)) return 'غائم جزئياً';
  if (value === 3) return 'غائم';
  if ([45, 48].includes(value)) return 'ضباب';
  if ([51, 53, 55, 56, 57].includes(value)) return 'رذاذ';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return 'أمطار';
  if ([71, 73, 75, 77, 85, 86].includes(value)) return 'ثلوج';
  if ([95, 96, 99].includes(value)) return 'عواصف رعدية';
  return 'حالة جوية متغيرة';
}

async function getWeatherAnswer(query, config) {
  const locationQuery = extractLocation(query, config.defaultLocation);
  const place = await geocodeLocation(locationQuery, config);

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    timezone: place.timezone || 'auto',
  });

  const data = await fetchJson(
    `${FORECAST_ENDPOINT}?${params.toString()}`,
    config.liveDataTimeoutMs,
  );

  const current = data?.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Current weather data is unavailable');
  }

  const roundedTemp = Math.round(current.temperature_2m);
  const roundedFeels = Math.round(current.apparent_temperature);
  const roundedWind = Math.round(current.wind_speed_10m);
  const condition = weatherCodeToArabic(current.weather_code);

  return {
    handled: true,
    answer: `الطقس الآن في ${place.name} ${condition}، ودرجة الحرارة ${roundedTemp} درجة مئوية، والمحسوسة ${roundedFeels} درجة، وسرعة الرياح نحو ${roundedWind} كيلومتراً في الساعة.`,
    source: {
      provider: 'Open-Meteo',
      type: 'current-weather',
      location: `${place.name}${place.country ? `، ${place.country}` : ''}`,
      timezone: place.timezone,
      retrievedAt: new Date().toISOString(),
    },
  };
}

async function answerWithTrustedTools(query, config) {
  if (isIdentityQuestion(query)) {
    return {
      handled: true,
      answer: 'أنا عبقور، وكيل ذكاء اصطناعي مخصص يعمل من خلال مهارة أليكسا. أستخدم حالياً نموذج جيميناي من جوجل لتوليد الإجابات، ولست أليكسا ولا شات جي بي تي.',
      source: { provider: 'local-policy', type: 'identity' },
    };
  }

  const normalized = normalizeArabic(query);

  if (/(كم الساعه|الوقت الان|ما الوقت|الساعه الان)/.test(normalized)) {
    return {
      handled: true,
      answer: new Intl.DateTimeFormat('ar-SA', {
        timeZone: config.defaultTimeZone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date()),
      source: { provider: 'system-clock', type: 'time' },
    };
  }

  if (/(ما التاريخ|تاريخ اليوم|ما هو اليوم|اي يوم اليوم)/.test(normalized)) {
    return {
      handled: true,
      answer: new Intl.DateTimeFormat('ar-SA', {
        timeZone: config.defaultTimeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
      source: { provider: 'system-clock', type: 'date' },
    };
  }

  try {
    if (isSunQuestion(query)) {
      return await getSunriseSunsetAnswer(query, config);
    }

    if (isWeatherQuestion(query)) {
      return await getWeatherAnswer(query, config);
    }
  } catch (error) {
    console.error('Trusted tool error:', error);
    return {
      handled: true,
      answer: 'لم أتمكن من التحقق من البيانات المطلوبة حالياً. أعد المحاولة بعد قليل.',
      source: { provider: 'trusted-tool', type: 'failure' },
    };
  }

  if (config.requireCurrentDataVerification && isCurrentSensitiveQuestion(query)) {
    return {
      handled: true,
      answer: 'هذا السؤال يحتاج إلى بيانات حديثة لم يتم ربط أداة تحقق مناسبة لها بعد، لذلك لن أخمّن الإجابة.',
      source: { provider: 'local-policy', type: 'unverified-current-data' },
    };
  }

  return { handled: false };
}

module.exports = {
  answerWithTrustedTools,
  extractLocation,
  normalizeArabic,
};
