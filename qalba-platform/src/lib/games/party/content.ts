import type { PartySlug } from "./types";

type Sample = { slug: PartySlug; category: string; question: string; answer: string; type: "LETTER" | "TEXT" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "RANKING" | "PASSWORD" | "SURVEY"; options?: unknown; value?: number };
const letters: Record<string, [string, string, string, string]> = {
  "ب": ["ما اسم المسطح المائي المالح الواسع؟", "بحر", "ما الذي نفتحه للدخول إلى الغرفة؟", "باب"],
  "ر": ["ما عاصمة المملكة العربية السعودية؟", "رياض", "ماذا نسمي حبيبات الصحراء الناعمة؟", "رمل"],
  "س": ["ما الاسم الشائع لما نراه فوقنا نهارًا وفيه الغيوم؟", "سماء", "ما المركبة التي تسير على الطريق بأربع عجلات؟", "سيارة"],
  "م": ["ما السائل الذي نشربه يوميًا؟", "ماء", "أين يذهب الطلاب للتعلم؟", "مدرسة"],
  "ع": ["ما الطعام الحلو الذي تصنعه النحلات؟", "عسل", "ما العضو الذي نرى به؟", "عين"],
  "ن": ["ما الجرم المضيء البعيد في السماء ليلًا؟", "نجم", "ما الشجرة المعروفة بإنتاج التمر؟", "نخلة"],
  "ك": ["ما الذي تقرأ صفحاته في المكتبة؟", "كتاب", "ما الإناء الصغير للشرب؟", "كوب"],
  "ق": ["ما الجرم الذي يعكس ضوء الشمس في الليل؟", "قمر", "بماذا تكتب على الورق؟", "قلم"],
};
export const letterGrid = ["ب", "ر", "س", "م", "ع", "ن", "ك", "ق", "س", "ب", "ق", "ن", "م", "ك", "ر", "ع"];
const alternates: Record<string, [string, string]> = {
  "ب": ["ما اسم اللون الواقع بين الأزرق والأحمر؟", "بنفسجي"], "ر": ["ما الحبوب البيضاء الشائعة في أطباق الغداء؟", "رز"],
  "س": ["ما الجزء العلوي الذي يغطي الغرفة؟", "سقف"], "م": ["ما الحيوان الذي يشبه الخروف وله قرنان غالبًا؟", "ماعز"],
  "ع": ["ما الطائر الصغير الذي يغرد على الأغصان؟", "عصفور"], "ن": ["ما المصدر الذي يضيء موقد الحطب؟", "نار"],
  "ك": ["ما اسم الثمرة الخضراء الطويلة التي تدخل في السلطة؟", "كوسا"], "ق": ["ما الأداة التي تمنع فتح الباب دون مفتاح؟", "قفل"],
};
export const partySamples: Sample[] = [
  ...Object.entries(letters).flatMap(([letter, [firstQuestion, firstAnswer, secondQuestion, secondAnswer]]) => [
    { slug: "letter-battle" as const, category: "arabic", question: firstQuestion, answer: firstAnswer, type: "LETTER" as const, options: { letter } },
    { slug: "letter-battle" as const, category: "arabic", question: secondQuestion, answer: secondAnswer, type: "LETTER" as const, options: { letter } },
  ]),
  ...Object.entries(alternates).map(([letter, [question, answer]]) => ({ slug: "letter-battle" as const, category: "arabic", question, answer, type: "LETTER" as const, options: { letter } })),
  { slug: "bluff", category: "riddles", question: "ما الاسم الذي أطلقناه على المدينة الخيالية في حكاية قَلْبَة الأولى؟", answer: "مدينة الموج", type: "TEXT" },
  { slug: "bluff", category: "riddles", question: "ما اسم المركبة المتخيلة التي توصل الضيوف إلى كوكب الحفلات؟", answer: "الفقاعة الطائرة", type: "TEXT" },
  { slug: "bluff", category: "riddles", question: "في قصتنا الخيالية، ما اسم مقهى البطاريق؟", answer: "ركن الجليد", type: "TEXT" },
  { slug: "fastest-mind", category: "general", question: "كم يومًا في الأسبوع؟", answer: "7", type: "MULTIPLE_CHOICE", options: ["5", "6", "7", "8"] },
  { slug: "fastest-mind", category: "science", question: "ما الكوكب الذي نعيش عليه؟", answer: "الأرض", type: "MULTIPLE_CHOICE", options: ["المريخ", "الأرض", "الزهرة", "زحل"] },
  { slug: "fastest-mind", category: "saudi", question: "هل تقع مدينة جدة على البحر الأحمر؟", answer: "صح", type: "TRUE_FALSE", options: ["صح", "خطأ"] },
  { slug: "fastest-mind", category: "general", question: "كم ثانية في دقيقة واحدة؟", answer: "60", type: "TEXT" },
  { slug: "fastest-mind", category: "science", question: "ما الغاز الذي نحتاجه للتنفس؟", answer: "الأكسجين", type: "MULTIPLE_CHOICE", options: ["النيتروجين", "الأكسجين", "الهيليوم", "الهيدروجين"] },
  { slug: "top-list", category: "food", question: "أشياء تجدها عادة على مائدة فطور خليجية", answer: "قائمة طعام خيالية للعبة", type: "RANKING", options: [{ text: "تمر", value: 80 }, { text: "خبز", value: 70 }, { text: "جبن", value: 60 }, { text: "بيض", value: 50 }, { text: "شاي", value: 40 }, { text: "عسل", value: 30 }] },
  { slug: "top-list", category: "travel", question: "أشياء قد تحملها في حقيبة رحلة قصيرة", answer: "قائمة خيالية للعبة", type: "RANKING", options: [{ text: "هاتف", value: 80 }, { text: "شاحن", value: 70 }, { text: "ملابس", value: 60 }, { text: "هوية", value: 50 }, { text: "سماعات", value: 40 }, { text: "كتاب", value: 30 }] },
  { slug: "top-list", category: "general", question: "أشياء يمكن وضعها على مكتب الدراسة", answer: "قائمة خيالية للعبة", type: "RANKING", options: [{ text: "قلم", value: 80 }, { text: "دفتر", value: 70 }, { text: "حاسوب", value: 60 }, { text: "كوب", value: 50 }, { text: "مصباح", value: 40 }, { text: "ساعة", value: 30 }] },
  { slug: "secret-word", category: "general", question: "شاي", answer: "شاي", type: "PASSWORD", options: { forbidden: ["كوب", "ساخن", "مشروب"] } },
  { slug: "secret-word", category: "general", question: "مطار", answer: "مطار", type: "PASSWORD", options: { forbidden: ["سفر", "طائرة", "رحلة"] } },
  { slug: "secret-word", category: "general", question: "كاميرا", answer: "كاميرا", type: "PASSWORD", options: { forbidden: ["صورة", "تصوير", "عدسة"] } },
  { slug: "secret-word", category: "general", question: "ملعب", answer: "ملعب", type: "PASSWORD", options: { forbidden: ["كرة", "رياضة", "جمهور"] } },
  { slug: "survey-show", category: "general", question: "اذكر شيئًا يتذكره الضيف قبل خروجه من البيت", answer: "إجابات عينة خيالية للعبة", type: "SURVEY", options: [{ text: "المفاتيح", value: 40 }, { text: "الهاتف", value: 30 }, { text: "المحفظة", value: 20 }, { text: "النظارة", value: 10 }] },
  { slug: "survey-show", category: "food", question: "ماذا قد تطلب مع وجبة فطور؟", answer: "إجابات عينة خيالية للعبة", type: "SURVEY", options: [{ text: "شاي", value: 40 }, { text: "قهوة", value: 30 }, { text: "عصير", value: 20 }, { text: "ماء", value: 10 }] },
  { slug: "survey-show", category: "travel", question: "ما شيء قد تنساه في حقيبة السفر؟", answer: "إجابات عينة خيالية للعبة", type: "SURVEY", options: [{ text: "شاحن", value: 40 }, { text: "فرشاة", value: 30 }, { text: "جواز", value: 20 }, { text: "سماعة", value: 10 }] },
  { slug: "party-court", category: "riddles", question: "أنت متهم بأنك تقترح لعبة جديدة قبل انتهاء اللعبة الحالية.", answer: "حكم الجمهور", type: "TEXT", options: { prosecution: "اشرح كيف تغيّر الخطة كل دقيقة", defense: "اشرح لماذا التنويع يزيد حماس السهرة" } },
  { slug: "party-court", category: "riddles", question: "أنت متهم بأنك تسأل عن الوجبات قبل بدء السهرة.", answer: "حكم الجمهور", type: "TEXT", options: { prosecution: "اذكر توقيت أول سؤال عن الطعام", defense: "اشرح أهمية التخطيط للضيافة" } },
  { slug: "party-court", category: "riddles", question: "أنت متهم بأنك تحتفل بنقاط فريقك حتى قبل إعلان النتيجة.", answer: "حكم الجمهور", type: "TEXT", options: { prosecution: "صف لحظة الاحتفال المبكر", defense: "اشرح كيف تشجع الجميع" } },
];
