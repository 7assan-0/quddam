/**
 * Original, isolated eight-item visual rebus PILOT. This is not a 96-item bank.
 * No seed, runtime importer, selector or public asset path references this file.
 * Mechanical concatenation is checked; every editorial / human gate is pending.
 * SVG artwork was drawn from scratch for this pilot; no web or video frames used.
 */
export type RebusPicture = {
  kind: "picture";
  artwork: string;
  reviewerReading: string;
  fragment: string;
  visibleHelper?: string;
  deleteFinal?: string;
};

export type RebusText = {
  kind: "text";
  text: string;
  fragment: string;
};

export type VisualRebusPilotItem = {
  id: string;
  categorySlug: "guess-picture";
  prompt: string;
  answer: string;
  suggestedPoints: 200 | 400 | 600;
  tierRationale: string;
  pieces: readonly (RebusPicture | RebusText)[];
  explanation: string;
  ambiguityToReview: string;
  alternatives: readonly string[];
  review: {
    factual: "PENDING";
    alternatives: "PENDING";
    ambiguity: "PENDING";
    visualApproval: "PENDING";
    rightsApproval: "PENDING";
    humanPlaytest: "NOT_RUN";
    difficultyCalibration: "NOT_RUN";
  };
};

export const rebusPilotArtworkRoot = "docs/evidence/rebus-pilot-20261020/icons";
export const rebusPilotProvenance = {
  method: "ORIGINAL_CODE_DRAWN_SVG",
  authoredOn: "2026-10-20",
  externalAssets: 0,
  publicActivation: false,
  approval: "PENDING",
} as const;

const pendingReview = {
  factual: "PENDING",
  alternatives: "PENDING",
  ambiguity: "PENDING",
  visualApproval: "PENDING",
  rightsApproval: "PENDING",
  humanPlaytest: "NOT_RUN",
  difficultyCalibration: "NOT_RUN",
} as const;

export const visualRebusPilot: readonly VisualRebusPilotItem[] = [
  {
    id: "rebus-pilot-001",
    categorySlug: "guess-picture",
    prompt: "كوّن كلمة تصف ظاهرة جوية. احذف الحرف المكتوب تحت الرسم الأول.",
    answer: "ضباب",
    suggestedPoints: 400,
    tierRationale: "حذف ظاهر ثم وصل؛ يحتاج اختبار التعرف إلى الضب.",
    pieces: [
      { kind: "picture", artwork: "lizard.svg", reviewerReading: "ضب", deleteFinal: "ب", fragment: "ض" },
      { kind: "picture", artwork: "door.svg", reviewerReading: "باب", fragment: "باب" },
    ],
    explanation: "ضب − ب = ض؛ ثم ض + باب = ضباب. وصل ضب وباب دون الحذف يعطي ضبباب، ولذلك الحذف جزء لازم من اللغز.",
    ambiguityToReview: "هل يتعرف اللاعب إلى ضب تحديدًا، أم يراه سحلية؟ الرسم يحتاج موافقة بصرية مستقلة.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-002",
    categorySlug: "guess-picture",
    prompt: "كوّن اسم فاكهة. احذف الحرف المكتوب تحت الرسم الثاني.",
    answer: "بطيخ",
    suggestedPoints: 400,
    tierRationale: "يتطلب قراءة بط ويخت ثم حذف ت، لا مجرد تسمية رسم.",
    pieces: [
      { kind: "picture", artwork: "duck.svg", reviewerReading: "بط", visibleHelper: "اسم الجنس، دون ة", fragment: "بط" },
      { kind: "picture", artwork: "yacht.svg", reviewerReading: "يخت", visibleHelper: "يخت", deleteFinal: "ت", fragment: "يخ" },
    ],
    explanation: "يخت − ت = يخ؛ ثم بط + يخ = بطيخ. يُطلب اسم الجنس بط صراحةً حتى لا يصبح المدخل بطة.",
    ambiguityToReview: "هل المساعدان النصيان يجعلان اللغز مباشرًا أكثر من اللازم؟ يلزم قياس أثرهما وعدم حذفهما بصمت.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-003",
    categorySlug: "guess-picture",
    prompt: "صل اسمي الرسمين لتكوّن كلمة واحدة.",
    answer: "قرنفل",
    suggestedPoints: 400,
    tierRationale: "دمج اسم جزء حيوان واسم زهرة؛ التعرف إلى القرن يحتاج اختبارًا.",
    pieces: [
      { kind: "picture", artwork: "horn.svg", reviewerReading: "قرن", fragment: "قرن" },
      { kind: "picture", artwork: "jasmine.svg", reviewerReading: "فل", visibleHelper: "فل", fragment: "فل" },
    ],
    explanation: "قرن + فل = قرنفل، دون إضافة حرف أو حذفه. بطاقة فل مقصودة لتثبيت نوع الزهرة بدل تخمين ياسمين أو ورد.",
    ambiguityToReview: "هل يُقرأ القرن قرنًا أم نابًا؟ بطاقة فل جزء ظاهر من النسخة المختبرة، وليست ملاحظة مخفية.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-004",
    categorySlug: "guess-picture",
    prompt: "صل اسمي الرسمين لتكوّن اسم رياضة من كلمتين.",
    answer: "كرة طائرة",
    suggestedPoints: 200,
    tierRationale: "تركيب شائع مع رسمين مباشرين؛ سهولته افتراض لم يختبر.",
    pieces: [
      { kind: "picture", artwork: "ball.svg", reviewerReading: "كرة", fragment: "كرة" },
      { kind: "picture", artwork: "airplane.svg", reviewerReading: "طائرة", fragment: "طائرة" },
    ],
    explanation: "كرة + طائرة = كرة طائرة؛ تضاف المسافة بين الكلمتين فقط.",
    ambiguityToReview: "يجب أن يقبل اللاعب الكرة العامة وطائرة الركاب بوصفهما مقطعين لا صورة مباشرة للرياضة.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-005",
    categorySlug: "guess-picture",
    prompt: "صل اسمي الرسمين لتكوّن تركيبًا أدبيًا من كلمتين.",
    answer: "بيت شعر",
    suggestedPoints: 200,
    tierRationale: "انتقال دلالي من البيت والشعر المرسوم إلى تركيب مألوف؛ بانتظار اللاعبين.",
    pieces: [
      { kind: "picture", artwork: "house.svg", reviewerReading: "بيت", fragment: "بيت" },
      { kind: "picture", artwork: "hair.svg", reviewerReading: "شعر", fragment: "شعر" },
    ],
    explanation: "بيت + شعر = بيت شعر؛ تضاف المسافة فقط، ويتحول معنى شعر من الشعر المرسوم إلى الأدب.",
    ambiguityToReview: "قد يُسمّى الرسم منزلًا أو ضفيرة. لا يُعتمد قبل فحص القراءة والبدائل مع مراجعين.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-006",
    categorySlug: "guess-picture",
    prompt: "صل اسمي الرسمين لتكوّن مصطلحًا من كلمتين.",
    answer: "رأس مال",
    suggestedPoints: 200,
    tierRationale: "مصطلح مألوف من رسم رأس ومال؛ اختلاف تسمية المال خطر تجريبي.",
    pieces: [
      { kind: "picture", artwork: "head.svg", reviewerReading: "رأس", fragment: "رأس" },
      { kind: "picture", artwork: "money.svg", reviewerReading: "مال", fragment: "مال" },
    ],
    explanation: "رأس + مال = رأس مال؛ تضاف المسافة فقط. الأوراق خيالية بلا عملة أو جهة إصدار.",
    ambiguityToReview: "قد تُقرأ الورقة نقودًا، وقد يُقرأ الرأس وجهًا. البدائل لا تزال معلقة.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-007",
    categorySlug: "guess-picture",
    prompt: "صل اسمي الرسمين لتكوّن اسمًا من كلمتين.",
    answer: "عين شمس",
    suggestedPoints: 400,
    tierRationale: "الصور واضحة، لكن الوصول إلى الاسم يحتاج معرفة لغوية؛ غير معاير.",
    pieces: [
      { kind: "picture", artwork: "eye.svg", reviewerReading: "عين", fragment: "عين" },
      { kind: "picture", artwork: "sun.svg", reviewerReading: "شمس", fragment: "شمس" },
    ],
    explanation: "عين + شمس = عين شمس؛ تضاف المسافة فقط، دون أل التعريف غير المرسومة.",
    ambiguityToReview: "تحتاج دلالة الاسم والقراءة عين شمس مقابل عين الشمس إلى مراجعة مستقلة. لم نسجل بديلًا معتمدًا.",
    alternatives: [],
    review: pendingReview,
  },
  {
    id: "rebus-pilot-008",
    categorySlug: "guess-picture",
    prompt: "صل الرسمين والمقطع المكتوب لتكوّن اسم كائن بحري من كلمتين.",
    answer: "قنديل البحر",
    suggestedPoints: 400,
    tierRationale: "تركيب مع أل التعريف ظاهرة؛ وضوح لفظ قنديل لا يزال بحاجة لاختبار.",
    pieces: [
      { kind: "picture", artwork: "lantern.svg", reviewerReading: "قنديل", visibleHelper: "قنديل", fragment: "قنديل" },
      { kind: "text", text: "الـ", fragment: "ال" },
      { kind: "picture", artwork: "sea.svg", reviewerReading: "بحر", fragment: "بحر" },
    ],
    explanation: "قنديل + ال + بحر = قنديل البحر؛ أل التعريف ظاهرة بين الرسمين، وتضاف مسافة بين قنديل والبحر فقط.",
    ambiguityToReview: "المصباح قد يُسمّى فانوسًا؛ لذلك قنديل مساعد ظاهر. يلزم تأكيد قراءة البحر مقابل موج.",
    alternatives: [],
    review: pendingReview,
  },
];
