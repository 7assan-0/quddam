import type {Question} from "../src/lib/games/ordering/module";
export const orderingCategories = [["general", "معلومات عامة"], ["saudi", "السعودية"], ["history", "تاريخ"], ["geography", "جغرافيا"], ["science", "علوم"], ["technology", "تقنية"], ["games", "ألعاب"], ["sports", "رياضة"], ["cars", "سيارات"], ["food", "طعام"], ["travel", "سفر"], ["movies", "أفلام ومسلسلات"], ["language", "لغة"], ["numbers", "أرقام"], ["oddities", "غرائب"]] as const;
export const orderingSamples: (Omit<Question,"presentation"|"category"> & {id:string;categorySlug:string})[] = [
  {
    "id": "ordering-seed-001",
    "categorySlug": "general",
    "title": "كلمات معلومات عامة: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "باب",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "تمر",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "دفتر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ساعة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-002",
    "categorySlug": "general",
    "title": "كلمات معلومات عامة: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "دفتر",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "قلم",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "كتاب",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "كرسي",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-003",
    "categorySlug": "general",
    "title": "كلمات معلومات عامة: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "قلم",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "كتاب",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "كرسي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "لمبة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مرآة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نافذة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-004",
    "categorySlug": "general",
    "title": "كلمات معلومات عامة: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "باب",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "تمر",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "دفتر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "كتاب",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "لمبة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مرآة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نافذة",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-005",
    "categorySlug": "general",
    "title": "حساب معلومات عامة: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "2 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "4"
      },
      {
        "id": "content-1",
        "label": "2 × ٣ + ١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "7"
      },
      {
        "id": "content-2",
        "label": "2 × ٤",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "8"
      },
      {
        "id": "content-3",
        "label": "2 × ٥ + ٢",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "12"
      },
      {
        "id": "content-4",
        "label": "2 + ١١",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "13"
      }
    ]
  },
  {
    "id": "ordering-seed-006",
    "categorySlug": "general",
    "title": "كسور معلومات عامة: مجموعة 1",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-007",
    "categorySlug": "general",
    "title": "خط زمني تخيلي: معلومات عامة",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد باب: سنة 1990",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد تمر: سنة 1993",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد دفتر: سنة 1996",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد ساعة: سنة 1999",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد قلم: سنة 2002",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-008",
    "categorySlug": "general",
    "title": "وقت معلومات عامة: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "نصف ساعة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-009",
    "categorySlug": "saudi",
    "title": "كلمات السعودية: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أبها",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بريدة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تبوك",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جدة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-010",
    "categorySlug": "saudi",
    "title": "كلمات السعودية: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تبوك",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جدة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حائل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "خيبر",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "رابغ",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-011",
    "categorySlug": "saudi",
    "title": "كلمات السعودية: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حائل",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خيبر",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "رابغ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سكاكا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ضباء",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نجران",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-012",
    "categorySlug": "saudi",
    "title": "كلمات السعودية: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أبها",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بريدة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تبوك",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "رابغ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سكاكا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ضباء",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نجران",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-013",
    "categorySlug": "saudi",
    "title": "حساب السعودية: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "3 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "6"
      },
      {
        "id": "content-1",
        "label": "3²",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "9"
      },
      {
        "id": "content-2",
        "label": "3 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10"
      },
      {
        "id": "content-3",
        "label": "3 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "12"
      },
      {
        "id": "content-4",
        "label": "3 + ١١",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "14"
      }
    ]
  },
  {
    "id": "ordering-seed-014",
    "categorySlug": "saudi",
    "title": "كسور السعودية: مجموعة 2",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلث",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-015",
    "categorySlug": "saudi",
    "title": "خط زمني تخيلي: السعودية",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أبها: سنة 1992",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بريدة: سنة 1995",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تبوك: سنة 1998",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جدة: سنة 2001",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حائل: سنة 2004",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-016",
    "categorySlug": "saudi",
    "title": "وقت السعودية: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعة ونصف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعة وربع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-3",
        "label": "نصف ساعة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ثلث ساعة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-017",
    "categorySlug": "history",
    "title": "كلمات تاريخ: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرشيف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بردية",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تاج",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "حصن",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-018",
    "categorySlug": "history",
    "title": "كلمات تاريخ: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تاج",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "حصن",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "رسالة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سيف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "قصر",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-019",
    "categorySlug": "history",
    "title": "كلمات تاريخ: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "رسالة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "سيف",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "قصر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "لوح",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "متحف",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نقش",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-020",
    "categorySlug": "history",
    "title": "كلمات تاريخ: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرشيف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بردية",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تاج",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "قصر",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "لوح",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "متحف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نقش",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-021",
    "categorySlug": "history",
    "title": "حساب تاريخ: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "4 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "8"
      },
      {
        "id": "content-1",
        "label": "4 × ٣ + ١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "13"
      },
      {
        "id": "content-2",
        "label": "4 + ١١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "15"
      },
      {
        "id": "content-3",
        "label": "4 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "16"
      },
      {
        "id": "content-4",
        "label": "4 × ٥ + ٢",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "22"
      }
    ]
  },
  {
    "id": "ordering-seed-022",
    "categorySlug": "history",
    "title": "كسور تاريخ: مجموعة 3",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "خمسة أرباع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ثلاثة أنصاف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-023",
    "categorySlug": "history",
    "title": "خط زمني تخيلي: تاريخ",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أرشيف: سنة 1994",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بردية: سنة 1997",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تاج: سنة 2000",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد حصن: سنة 2003",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد رسالة: سنة 2006",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-024",
    "categorySlug": "history",
    "title": "وقت تاريخ: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "نصف ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة وربع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة ونصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ساعتان",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-025",
    "categorySlug": "geography",
    "title": "كلمات جغرافيا: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرض",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بحيرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جزيرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-026",
    "categorySlug": "geography",
    "title": "كلمات جغرافيا: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تل",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جزيرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "خليج",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "رمل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ساحل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-027",
    "categorySlug": "geography",
    "title": "كلمات جغرافيا: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "خليج",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "رمل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ساحل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "شلال",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "صحراء",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "وادي",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-028",
    "categorySlug": "geography",
    "title": "كلمات جغرافيا: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرض",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بحيرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ساحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "شلال",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "صحراء",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "وادي",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-029",
    "categorySlug": "geography",
    "title": "حساب جغرافيا: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "5 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10"
      },
      {
        "id": "content-1",
        "label": "5 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "16"
      },
      {
        "id": "content-2",
        "label": "5 × ٤",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "20"
      },
      {
        "id": "content-3",
        "label": "5²",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "25"
      },
      {
        "id": "content-4",
        "label": "5 × ٥ + ٢",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "27"
      }
    ]
  },
  {
    "id": "ordering-seed-030",
    "categorySlug": "geography",
    "title": "كسور جغرافيا: مجموعة 4",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "خُمس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-031",
    "categorySlug": "geography",
    "title": "خط زمني تخيلي: جغرافيا",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أرض: سنة 1996",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بحيرة: سنة 1999",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تل: سنة 2002",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جزيرة: سنة 2005",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد خليج: سنة 2008",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-032",
    "categorySlug": "geography",
    "title": "وقت جغرافيا: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة ونصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة وربع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ثلث ساعة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ربع ساعة",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-033",
    "categorySlug": "science",
    "title": "كلمات علوم: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أكسجين",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بذرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تربة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جاذبية",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-034",
    "categorySlug": "science",
    "title": "كلمات علوم: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تربة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جاذبية",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "خلية",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ذرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سائل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-035",
    "categorySlug": "science",
    "title": "كلمات علوم: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "خلية",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ذرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سائل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ضوء",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ماء",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نواة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-036",
    "categorySlug": "science",
    "title": "كلمات علوم: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أكسجين",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بذرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تربة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سائل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ضوء",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ماء",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نواة",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-037",
    "categorySlug": "science",
    "title": "حساب علوم: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "6 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "12"
      },
      {
        "id": "content-1",
        "label": "6 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "17"
      },
      {
        "id": "content-2",
        "label": "6 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "19"
      },
      {
        "id": "content-3",
        "label": "6 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "24"
      },
      {
        "id": "content-4",
        "label": "6²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "36"
      }
    ]
  },
  {
    "id": "ordering-seed-038",
    "categorySlug": "science",
    "title": "كسور علوم: مجموعة 5",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "خمسة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلاثة أنصاف",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-039",
    "categorySlug": "science",
    "title": "خط زمني تخيلي: علوم",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أكسجين: سنة 1998",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بذرة: سنة 2001",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تربة: سنة 2004",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جاذبية: سنة 2007",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد خلية: سنة 2010",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-040",
    "categorySlug": "science",
    "title": "وقت علوم: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "نصف ساعة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة وربع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ساعة ونصف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-7",
        "label": "ساعتان",
        "correctPosition": 8,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-041",
    "categorySlug": "technology",
    "title": "كلمات تقنية: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أيقونة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "برنامج",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تطبيق",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جهاز",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-042",
    "categorySlug": "technology",
    "title": "كلمات تقنية: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تطبيق",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جهاز",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حاسوب",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ذاكرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "شاشة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-043",
    "categorySlug": "technology",
    "title": "كلمات تقنية: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حاسوب",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ذاكرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "شاشة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "قرص",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "لوحة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "معالج",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-044",
    "categorySlug": "technology",
    "title": "كلمات تقنية: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أيقونة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "برنامج",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تطبيق",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "شاشة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "قرص",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "لوحة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "معالج",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-045",
    "categorySlug": "technology",
    "title": "حساب تقنية: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "7 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "14"
      },
      {
        "id": "content-1",
        "label": "7 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "18"
      },
      {
        "id": "content-2",
        "label": "7 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "22"
      },
      {
        "id": "content-3",
        "label": "7 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "28"
      },
      {
        "id": "content-4",
        "label": "7²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "49"
      }
    ]
  },
  {
    "id": "ordering-seed-046",
    "categorySlug": "technology",
    "title": "كسور تقنية: مجموعة 6",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلث",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "خُمس",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-047",
    "categorySlug": "technology",
    "title": "خط زمني تخيلي: تقنية",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أيقونة: سنة 2000",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد برنامج: سنة 2003",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تطبيق: سنة 2006",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جهاز: سنة 2009",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حاسوب: سنة 2012",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-048",
    "categorySlug": "technology",
    "title": "وقت تقنية: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة ونصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ربع ساعة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-049",
    "categorySlug": "games",
    "title": "كلمات ألعاب: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "ألوان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تدريب",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جولة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-050",
    "categorySlug": "games",
    "title": "كلمات ألعاب: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تدريب",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حركة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سباق",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "طاولة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-051",
    "categorySlug": "games",
    "title": "كلمات ألعاب: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حركة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "سباق",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "طاولة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "فريق",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مرحلة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نقاط",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-052",
    "categorySlug": "games",
    "title": "كلمات ألعاب: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "ألوان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تدريب",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "طاولة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "فريق",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مرحلة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نقاط",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-053",
    "categorySlug": "games",
    "title": "حساب ألعاب: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "8 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "16"
      },
      {
        "id": "content-1",
        "label": "8 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "19"
      },
      {
        "id": "content-2",
        "label": "8 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "25"
      },
      {
        "id": "content-3",
        "label": "8 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "32"
      },
      {
        "id": "content-4",
        "label": "8²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "64"
      }
    ]
  },
  {
    "id": "ordering-seed-054",
    "categorySlug": "games",
    "title": "كسور ألعاب: مجموعة 7",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-055",
    "categorySlug": "games",
    "title": "خط زمني تخيلي: ألعاب",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد ألوان: سنة 2002",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بطولة: سنة 2005",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تدريب: سنة 2008",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جولة: سنة 2011",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حركة: سنة 2014",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-056",
    "categorySlug": "games",
    "title": "وقت ألعاب: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "نصف ساعة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعتان",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-057",
    "categorySlug": "sports",
    "title": "كلمات رياضة: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أثقال",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمرين",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جري",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-058",
    "categorySlug": "sports",
    "title": "كلمات رياضة: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تمرين",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جري",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حارس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "دراجة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سباحة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-059",
    "categorySlug": "sports",
    "title": "كلمات رياضة: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حارس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "دراجة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سباحة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "صفارة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "كرة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ملعب",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-060",
    "categorySlug": "sports",
    "title": "كلمات رياضة: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أثقال",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمرين",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سباحة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "صفارة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "كرة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "ملعب",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-061",
    "categorySlug": "sports",
    "title": "حساب رياضة: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "9 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "18"
      },
      {
        "id": "content-1",
        "label": "9 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20"
      },
      {
        "id": "content-2",
        "label": "9 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "28"
      },
      {
        "id": "content-3",
        "label": "9 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "36"
      },
      {
        "id": "content-4",
        "label": "9²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "81"
      }
    ]
  },
  {
    "id": "ordering-seed-062",
    "categorySlug": "sports",
    "title": "كسور رياضة: مجموعة 8",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلث",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-063",
    "categorySlug": "sports",
    "title": "خط زمني تخيلي: رياضة",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أثقال: سنة 2004",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بطولة: سنة 2007",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تمرين: سنة 2010",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جري: سنة 2013",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حارس: سنة 2016",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-064",
    "categorySlug": "sports",
    "title": "وقت رياضة: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعة وربع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-3",
        "label": "نصف ساعة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ثلث ساعة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ربع ساعة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-065",
    "categorySlug": "cars",
    "title": "كلمات سيارات: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "إطار",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطارية",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ترس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جنط",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-066",
    "categorySlug": "cars",
    "title": "كلمات سيارات: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "ترس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جنط",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حزام",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "دواسة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "زجاج",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-067",
    "categorySlug": "cars",
    "title": "كلمات سيارات: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حزام",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "دواسة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "زجاج",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "فرامل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مقود",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ناقل",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-068",
    "categorySlug": "cars",
    "title": "كلمات سيارات: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "إطار",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطارية",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ترس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زجاج",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "فرامل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مقود",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "ناقل",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-069",
    "categorySlug": "cars",
    "title": "حساب سيارات: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "10 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "20"
      },
      {
        "id": "content-1",
        "label": "10 + ١١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "21"
      },
      {
        "id": "content-2",
        "label": "10 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "31"
      },
      {
        "id": "content-3",
        "label": "10 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "40"
      },
      {
        "id": "content-4",
        "label": "10²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "100"
      }
    ]
  },
  {
    "id": "ordering-seed-070",
    "categorySlug": "cars",
    "title": "كسور سيارات: مجموعة 9",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "خمسة أرباع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ثلاثة أنصاف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-071",
    "categorySlug": "cars",
    "title": "خط زمني تخيلي: سيارات",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد إطار: سنة 2006",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بطارية: سنة 2009",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد ترس: سنة 2012",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جنط: سنة 2015",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حزام: سنة 2018",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-072",
    "categorySlug": "cars",
    "title": "وقت سيارات: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "نصف ساعة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة وربع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ساعة ونصف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-073",
    "categorySlug": "food",
    "title": "كلمات طعام: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرز",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بصل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جبن",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-074",
    "categorySlug": "food",
    "title": "كلمات طعام: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تمر",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جبن",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "خبز",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "رمان",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سكر",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-075",
    "categorySlug": "food",
    "title": "كلمات طعام: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "خبز",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "رمان",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سكر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "عدس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "فلفل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "موز",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-076",
    "categorySlug": "food",
    "title": "كلمات طعام: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أرز",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بصل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمر",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سكر",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عدس",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "فلفل",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "موز",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-077",
    "categorySlug": "food",
    "title": "حساب طعام: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "11 × ٢",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "22"
      },
      {
        "id": "content-1",
        "label": "11 × ٣ + ١",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "34"
      },
      {
        "id": "content-2",
        "label": "11 × ٤",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "44"
      },
      {
        "id": "content-3",
        "label": "11 × ٥ + ٢",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "57"
      },
      {
        "id": "content-4",
        "label": "11²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "121"
      }
    ]
  },
  {
    "id": "ordering-seed-078",
    "categorySlug": "food",
    "title": "كسور طعام: مجموعة 10",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "خُمس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-079",
    "categorySlug": "food",
    "title": "خط زمني تخيلي: طعام",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أرز: سنة 2008",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بصل: سنة 2011",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تمر: سنة 2014",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جبن: سنة 2017",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد خبز: سنة 2020",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-080",
    "categorySlug": "food",
    "title": "وقت طعام: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة ونصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة وربع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-5",
        "label": "نصف ساعة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ثلث ساعة",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-7",
        "label": "ربع ساعة",
        "correctPosition": 8,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-081",
    "categorySlug": "travel",
    "title": "كلمات سفر: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أمتعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطاقة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تذكرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جواز",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-082",
    "categorySlug": "travel",
    "title": "كلمات سفر: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تذكرة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جواز",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حقيبة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "رحلة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سائح",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-083",
    "categorySlug": "travel",
    "title": "كلمات سفر: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حقيبة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "رحلة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سائح",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "طائرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "فندق",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مطار",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-084",
    "categorySlug": "travel",
    "title": "كلمات سفر: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أمتعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطاقة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تذكرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سائح",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "طائرة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "فندق",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "مطار",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-085",
    "categorySlug": "travel",
    "title": "حساب سفر: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "12 + ١١",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "23"
      },
      {
        "id": "content-1",
        "label": "12 × ٢",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "24"
      },
      {
        "id": "content-2",
        "label": "12 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "37"
      },
      {
        "id": "content-3",
        "label": "12 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "48"
      },
      {
        "id": "content-4",
        "label": "12²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "144"
      }
    ]
  },
  {
    "id": "ordering-seed-086",
    "categorySlug": "travel",
    "title": "كسور سفر: مجموعة 11",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "خمسة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلاثة أنصاف",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-087",
    "categorySlug": "travel",
    "title": "خط زمني تخيلي: سفر",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أمتعة: سنة 2010",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بطاقة: سنة 2013",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تذكرة: سنة 2016",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جواز: سنة 2019",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حقيبة: سنة 2022",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-088",
    "categorySlug": "travel",
    "title": "وقت سفر: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "نصف ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة وربع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة ونصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-089",
    "categorySlug": "movies",
    "title": "كلمات أفلام ومسلسلات: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أداء",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تصوير",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جمهور",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-090",
    "categorySlug": "movies",
    "title": "كلمات أفلام ومسلسلات: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تصوير",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جمهور",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حلقة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ديكور",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سيناريو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-091",
    "categorySlug": "movies",
    "title": "كلمات أفلام ومسلسلات: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حلقة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ديكور",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سيناريو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "قصة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ممثل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نهاية",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-092",
    "categorySlug": "movies",
    "title": "كلمات أفلام ومسلسلات: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أداء",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بطولة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تصوير",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سيناريو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "قصة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ممثل",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نهاية",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-093",
    "categorySlug": "movies",
    "title": "حساب أفلام ومسلسلات: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "13 + ١١",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "24"
      },
      {
        "id": "content-1",
        "label": "13 × ٢",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "26"
      },
      {
        "id": "content-2",
        "label": "13 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "40"
      },
      {
        "id": "content-3",
        "label": "13 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "52"
      },
      {
        "id": "content-4",
        "label": "13²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "169"
      }
    ]
  },
  {
    "id": "ordering-seed-094",
    "categorySlug": "movies",
    "title": "كسور أفلام ومسلسلات: مجموعة 12",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلث",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "خُمس",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-095",
    "categorySlug": "movies",
    "title": "خط زمني تخيلي: أفلام ومسلسلات",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أداء: سنة 2012",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بطولة: سنة 2015",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تصوير: سنة 2018",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جمهور: سنة 2021",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حلقة: سنة 2024",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-096",
    "categorySlug": "movies",
    "title": "وقت أفلام ومسلسلات: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة ونصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة وربع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-097",
    "categorySlug": "language",
    "title": "كلمات لغة: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "اسم",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بيت",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تاء",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جملة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-098",
    "categorySlug": "language",
    "title": "كلمات لغة: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تاء",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جملة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حرف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "رسالة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "سجع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-099",
    "categorySlug": "language",
    "title": "كلمات لغة: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حرف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "رسالة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "سجع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ضمير",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "فعل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "معنى",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-100",
    "categorySlug": "language",
    "title": "كلمات لغة: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "اسم",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بيت",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تاء",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "سجع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ضمير",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "فعل",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "معنى",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-101",
    "categorySlug": "language",
    "title": "حساب لغة: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "14 + ١١",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "25"
      },
      {
        "id": "content-1",
        "label": "14 × ٢",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "28"
      },
      {
        "id": "content-2",
        "label": "14 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "43"
      },
      {
        "id": "content-3",
        "label": "14 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "56"
      },
      {
        "id": "content-4",
        "label": "14²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "196"
      }
    ]
  },
  {
    "id": "ordering-seed-102",
    "categorySlug": "language",
    "title": "كسور لغة: مجموعة 13",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-103",
    "categorySlug": "language",
    "title": "خط زمني تخيلي: لغة",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد اسم: سنة 2014",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بيت: سنة 2017",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تاء: سنة 2020",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جملة: سنة 2023",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حرف: سنة 2026",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-104",
    "categorySlug": "language",
    "title": "وقت لغة: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة وربع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة ونصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ساعتان",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-105",
    "categorySlug": "numbers",
    "title": "كلمات أرقام: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "آحاد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بسط",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ترتيب",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جمع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-106",
    "categorySlug": "numbers",
    "title": "كلمات أرقام: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "ترتيب",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جمع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حد",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "درجة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "زوج",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-107",
    "categorySlug": "numbers",
    "title": "كلمات أرقام: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "درجة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "زوج",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "صفر",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عامل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مقام",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-108",
    "categorySlug": "numbers",
    "title": "كلمات أرقام: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "آحاد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بسط",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ترتيب",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زوج",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "صفر",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "عامل",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "مقام",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-109",
    "categorySlug": "numbers",
    "title": "حساب أرقام: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "15 + ١١",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "26"
      },
      {
        "id": "content-1",
        "label": "15 × ٢",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "30"
      },
      {
        "id": "content-2",
        "label": "15 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "46"
      },
      {
        "id": "content-3",
        "label": "15 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "60"
      },
      {
        "id": "content-4",
        "label": "15²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "225"
      }
    ]
  },
  {
    "id": "ordering-seed-110",
    "categorySlug": "numbers",
    "title": "كسور أرقام: مجموعة 14",
    "instruction": "رتب القيم الكسرية من الأكبر إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "ثلاثة أنصاف",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "خمسة أرباع",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ثلاثة أرباع",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نصف",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ثلث",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-111",
    "categorySlug": "numbers",
    "title": "خط زمني تخيلي: أرقام",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد آحاد: سنة 2016",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بسط: سنة 2019",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد ترتيب: سنة 2022",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جمع: سنة 2025",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حد: سنة 2028",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-112",
    "categorySlug": "numbers",
    "title": "وقت أرقام: المدد",
    "instruction": "رتب المدد من الأطول إلى الأقصر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ساعتان",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-2",
        "label": "ساعة ونصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-4",
        "label": "نصف ساعة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ثلث ساعة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ربع ساعة",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-113",
    "categorySlug": "oddities",
    "title": "كلمات غرائب: مجموعة 1",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أثر",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بصمة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمويه",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "جرس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-114",
    "categorySlug": "oddities",
    "title": "كلمات غرائب: مجموعة 2",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "تمويه",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "جرس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "حيلة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "دهشة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "ظل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-115",
    "categorySlug": "oddities",
    "title": "كلمات غرائب: مجموعة 3",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "حيلة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "دهشة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "ظل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "لغز",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مفاجأة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "نفق",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-116",
    "categorySlug": "oddities",
    "title": "كلمات غرائب: مجموعة 4",
    "instruction": "رتب الكلمات وفق الترتيب الهجائي العربي من الألف إلى الياء؛ الهمزة على الألف تعامل كألف.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CUSTOM",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحدي لغوي مؤلف؛ نقارن الحروف تباعًا وفق الترتيب الهجائي العربي المعلن.",
    "items": [
      {
        "id": "content-0",
        "label": "أثر",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "بصمة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "تمويه",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ظل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "لغز",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "مفاجأة",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-6",
        "label": "نفق",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-117",
    "categorySlug": "oddities",
    "title": "حساب غرائب: قيم التعبيرات",
    "instruction": "رتب قيم التعبيرات من الأصغر إلى الأكبر؛ الرمز ² يعني مربع العدد.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "مسألة حسابية مؤلفة وليست إحصائية عن الفئة.",
    "items": [
      {
        "id": "content-0",
        "label": "16 + ١١",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "27"
      },
      {
        "id": "content-1",
        "label": "16 × ٢",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "32"
      },
      {
        "id": "content-2",
        "label": "16 × ٣ + ١",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "49"
      },
      {
        "id": "content-3",
        "label": "16 × ٤",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "64"
      },
      {
        "id": "content-4",
        "label": "16²",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "256"
      }
    ]
  },
  {
    "id": "ordering-seed-118",
    "categorySlug": "oddities",
    "title": "كسور غرائب: مجموعة 15",
    "instruction": "رتب القيم الكسرية من الأصغر إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "نقارن الكسور حسابيًا؛ أسماء المجموعة لا تصف تصنيفًا واقعيًا.",
    "items": [
      {
        "id": "content-0",
        "label": "خُمس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "ثلث",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نصف",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "ثلاثة أرباع",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "خمسة أرباع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-5",
        "label": "ثلاثة أنصاف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-119",
    "categorySlug": "oddities",
    "title": "خط زمني تخيلي: غرائب",
    "instruction": "الأحداث التالية مؤلفة للتحدي. رتبها من الأقدم إلى الأحدث حسب السنوات المذكورة.",
    "difficulty": "EASY",
    "locale": "ar-SA",
    "orderingType": "CHRONOLOGICAL_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "السنوات والأحداث افتراضية معلنة وليست وقائع تاريخية.",
    "items": [
      {
        "id": "content-0",
        "label": "مشهد أثر: سنة 2018",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "مشهد بصمة: سنة 2021",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "مشهد تمويه: سنة 2024",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "مشهد جرس: سنة 2027",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "مشهد حيلة: سنة 2030",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-120",
    "categorySlug": "oddities",
    "title": "وقت غرائب: المدد",
    "instruction": "رتب المدد من الأقصر إلى الأطول.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": false,
    "sourceLabel": null,
    "sourceUrl": null,
    "sourceDate": null,
    "explanation": "تحويل الدقائق والساعات مسألة حسابية ثابتة.",
    "items": [
      {
        "id": "content-0",
        "label": "ربع ساعة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "15 دقيقة"
      },
      {
        "id": "content-1",
        "label": "ثلث ساعة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "20 دقيقة"
      },
      {
        "id": "content-2",
        "label": "نصف ساعة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "30 دقيقة"
      },
      {
        "id": "content-3",
        "label": "ساعة إلا ربعًا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "45 دقيقة"
      },
      {
        "id": "content-4",
        "label": "ساعة وربع",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "75 دقيقة"
      },
      {
        "id": "content-5",
        "label": "ساعة ونصف",
        "correctPosition": 6,
        "acceptedAliases": [],
        "displayValue": "90 دقيقة"
      },
      {
        "id": "content-6",
        "label": "ساعتان إلا ثلثًا",
        "correctPosition": 7,
        "acceptedAliases": [],
        "displayValue": "100 دقيقة"
      },
      {
        "id": "content-7",
        "label": "ساعتان",
        "correctPosition": 8,
        "acceptedAliases": [],
        "displayValue": "120 دقيقة"
      }
    ]
  },
  {
    "id": "ordering-seed-121",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 1",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-122",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 2",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-123",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 3",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المشتري",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-124",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 4",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-125",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 5",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المشتري",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-126",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 6",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-127",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 7",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-128",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 8",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "أورانوس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المشتري",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-129",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 9",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-130",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 10",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-131",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 11",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "أورانوس",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-132",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 12",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "زحل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-133",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 13",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "الزهرة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المشتري",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "أورانوس",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-134",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 14",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المريخ",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "الزهرة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-135",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 15",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "الزهرة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-136",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 16",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "أورانوس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "الزهرة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-137",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 17",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "الزهرة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "زحل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-138",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 18",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "نبتون",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "المشتري",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "الأرض",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-139",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 19",
    "instruction": "رتب الكواكب المعروضة من الأقرب إلى الشمس إلى الأبعد حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "الأرض",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المشتري",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "زحل",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-140",
    "categorySlug": "science",
    "title": "مدارات الكواكب: مقارنة 20",
    "instruction": "رتب الكواكب المعروضة من الأبعد عن الشمس إلى الأقرب حسب متوسط مسافة المدار.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "DISTANCE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "زحل",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-141",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 1",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الزهرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "نبتون",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-142",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 2",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الزهرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-143",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 3",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الزهرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نبتون",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-144",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 4",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الزهرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-145",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 5",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نبتون",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-146",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 6",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-147",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 7",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "المريخ",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-148",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 8",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "زحل",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "نبتون",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-149",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 9",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-150",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 10",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-151",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 11",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "عطارد",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "زحل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-152",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 12",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "زحل",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "أورانوس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-153",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 13",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المريخ",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "نبتون",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "زحل",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-154",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 14",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الأرض",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الزهرة",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المريخ",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-155",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 15",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المريخ",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الزهرة",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "أورانوس",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-156",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 16",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "زحل",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المريخ",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-157",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 17",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المريخ",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "أورانوس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-158",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 18",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "المشتري",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "أورانوس",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "نبتون",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "الأرض",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "الزهرة",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-159",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 19",
    "instruction": "رتب الكواكب المعروضة من الأصغر قطرًا استوائيًا إلى الأكبر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_ASC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "الزهرة",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "نبتون",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "أورانوس",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "زحل",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "المشتري",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-160",
    "categorySlug": "science",
    "title": "أقطار الكواكب: مقارنة 20",
    "instruction": "رتب الكواكب المعروضة من الأكبر قطرًا استوائيًا إلى الأصغر.",
    "difficulty": "MEDIUM",
    "locale": "ar-SA",
    "orderingType": "SIZE_DESC",
    "factual": true,
    "sourceLabel": "NASA: أحجام الكواكب ومواقعها",
    "sourceUrl": "https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/",
    "sourceDate": "2026-10-04",
    "explanation": "المعيار هو متوسط مسافة المدار أو القطر الاستوائي المحدد في التعليمات، لا الحجم الظاهري في السماء.",
    "items": [
      {
        "id": "content-0",
        "label": "أورانوس",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-1",
        "label": "الأرض",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-2",
        "label": "الزهرة",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-3",
        "label": "المريخ",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": null
      },
      {
        "id": "content-4",
        "label": "عطارد",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": null
      }
    ]
  },
  {
    "id": "ordering-seed-161",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 1",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "نانو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-2",
        "label": "ميكرو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-3",
        "label": "ملي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-4",
        "label": "سنتي",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      }
    ]
  },
  {
    "id": "ordering-seed-162",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 2",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "غيغا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-1",
        "label": "كيلو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^3"
      },
      {
        "id": "content-2",
        "label": "ميكرو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-3",
        "label": "نانو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-4",
        "label": "بيكو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      }
    ]
  },
  {
    "id": "ordering-seed-163",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 3",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "نانو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-2",
        "label": "ملي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-3",
        "label": "ميغا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^6"
      },
      {
        "id": "content-4",
        "label": "تيرا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^12"
      }
    ]
  },
  {
    "id": "ordering-seed-164",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 4",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "تيرا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^12"
      },
      {
        "id": "content-1",
        "label": "هكتو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-2",
        "label": "ديسي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-1"
      },
      {
        "id": "content-3",
        "label": "نانو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-4",
        "label": "بيكو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      }
    ]
  },
  {
    "id": "ordering-seed-165",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 5",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "ميكرو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-2",
        "label": "ملي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-3",
        "label": "سنتي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-4",
        "label": "ميغا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^6"
      }
    ]
  },
  {
    "id": "ordering-seed-166",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 6",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "كيلو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^3"
      },
      {
        "id": "content-1",
        "label": "ديكا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-2",
        "label": "سنتي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-3",
        "label": "ميكرو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-4",
        "label": "بيكو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      }
    ]
  },
  {
    "id": "ordering-seed-167",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 7",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "ميكرو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-2",
        "label": "ديكا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-3",
        "label": "هكتو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-4",
        "label": "غيغا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^9"
      }
    ]
  },
  {
    "id": "ordering-seed-168",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 8",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "غيغا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-1",
        "label": "هكتو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-2",
        "label": "سنتي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-3",
        "label": "ملي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-4",
        "label": "بيكو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      }
    ]
  },
  {
    "id": "ordering-seed-169",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 9",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "ملي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-2",
        "label": "ديكا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-3",
        "label": "ميغا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^6"
      },
      {
        "id": "content-4",
        "label": "تيرا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^12"
      }
    ]
  },
  {
    "id": "ordering-seed-170",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 10",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "ميغا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^6"
      },
      {
        "id": "content-1",
        "label": "كيلو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^3"
      },
      {
        "id": "content-2",
        "label": "ديكا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-3",
        "label": "سنتي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-4",
        "label": "بيكو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      }
    ]
  },
  {
    "id": "ordering-seed-171",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 11",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "بيكو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-12"
      },
      {
        "id": "content-1",
        "label": "ديسي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-1"
      },
      {
        "id": "content-2",
        "label": "هكتو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-3",
        "label": "غيغا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-4",
        "label": "تيرا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^12"
      }
    ]
  },
  {
    "id": "ordering-seed-172",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 12",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "غيغا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-1",
        "label": "ديسي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-1"
      },
      {
        "id": "content-2",
        "label": "ملي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-3",
        "label": "ميكرو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-4",
        "label": "نانو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      }
    ]
  },
  {
    "id": "ordering-seed-173",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 13",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "نانو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-1",
        "label": "ميكرو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-2",
        "label": "سنتي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-3",
        "label": "هكتو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-4",
        "label": "تيرا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^12"
      }
    ]
  },
  {
    "id": "ordering-seed-174",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 14",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "تيرا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^12"
      },
      {
        "id": "content-1",
        "label": "غيغا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-2",
        "label": "ديكا",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-3",
        "label": "ميكرو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-4",
        "label": "نانو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      }
    ]
  },
  {
    "id": "ordering-seed-175",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 15",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "نانو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-1",
        "label": "ملي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-2",
        "label": "سنتي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-3",
        "label": "غيغا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-4",
        "label": "تيرا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^12"
      }
    ]
  },
  {
    "id": "ordering-seed-176",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 16",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "تيرا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^12"
      },
      {
        "id": "content-1",
        "label": "غيغا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-2",
        "label": "هكتو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-3",
        "label": "ملي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-4",
        "label": "نانو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      }
    ]
  },
  {
    "id": "ordering-seed-177",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 17",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "نانو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      },
      {
        "id": "content-1",
        "label": "سنتي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-2",
        "label": "هكتو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-3",
        "label": "كيلو",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^3"
      },
      {
        "id": "content-4",
        "label": "غيغا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^9"
      }
    ]
  },
  {
    "id": "ordering-seed-178",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 18",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "تيرا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^12"
      },
      {
        "id": "content-1",
        "label": "كيلو",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^3"
      },
      {
        "id": "content-2",
        "label": "هكتو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-3",
        "label": "ديكا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^1"
      },
      {
        "id": "content-4",
        "label": "نانو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-9"
      }
    ]
  },
  {
    "id": "ordering-seed-179",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 19",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأصغر إلى الأكبر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_ASC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "ميكرو",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      },
      {
        "id": "content-1",
        "label": "ملي",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-2",
        "label": "سنتي",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^-2"
      },
      {
        "id": "content-3",
        "label": "ميغا",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^6"
      },
      {
        "id": "content-4",
        "label": "غيغا",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^9"
      }
    ]
  },
  {
    "id": "ordering-seed-180",
    "categorySlug": "technology",
    "title": "بادئات القياس العشري: مجموعة 20",
    "instruction": "رتب بادئات النظام الدولي حسب معامل الضرب من الأكبر إلى الأصغر؛ المقصود القوى العشرية لا البادئات الثنائية.",
    "difficulty": "HARD",
    "locale": "ar-SA",
    "orderingType": "NUMERIC_DESC",
    "factual": true,
    "sourceLabel": "BIPM: بادئات النظام الدولي",
    "sourceUrl": "https://www.bipm.org/en/measurement-units/si-prefixes",
    "sourceDate": "2026-10-04",
    "explanation": "كل بادئة تمثل قوة من عشرة وفق النظام الدولي للوحدات.",
    "items": [
      {
        "id": "content-0",
        "label": "غيغا",
        "correctPosition": 1,
        "acceptedAliases": [],
        "displayValue": "10^9"
      },
      {
        "id": "content-1",
        "label": "ميغا",
        "correctPosition": 2,
        "acceptedAliases": [],
        "displayValue": "10^6"
      },
      {
        "id": "content-2",
        "label": "هكتو",
        "correctPosition": 3,
        "acceptedAliases": [],
        "displayValue": "10^2"
      },
      {
        "id": "content-3",
        "label": "ملي",
        "correctPosition": 4,
        "acceptedAliases": [],
        "displayValue": "10^-3"
      },
      {
        "id": "content-4",
        "label": "ميكرو",
        "correctPosition": 5,
        "acceptedAliases": [],
        "displayValue": "10^-6"
      }
    ]
  }
];
