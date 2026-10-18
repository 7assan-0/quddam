/** Pure presentation copy. Never changes category identity, published content, or game rules. */
export function categoryExplanation(title: string) {
  if (/تاريخ|تاريخية/.test(title)) return { description: "أسئلة عن الأحداث والشخصيات والمحطات التاريخية.", example: "تواريخ مهمة، حضارات وشخصيات صنعت فرقًا." };
  if (/رياض|كرة|ملاعب/.test(title)) return { description: "تحديات عن الرياضات والفرق والبطولات واللاعبين.", example: "بطولات عالمية، قوانين اللعب وأرقام اللاعبين." };
  if (/جغراف|دول|عواصم|العالم/.test(title)) return { description: "اكتشفوا الأماكن والعواصم والمعالم حول العالم.", example: "حدّد الدولة أو المعلم من معلوماته." };
  if (/علوم|طبيعة|فضاء/.test(title)) return { description: "أسئلة علمية متنوعة عن الطبيعة والاختراعات والكون.", example: "ظواهر طبيعية ومعلومات عن جسم الإنسان." };
  if (/تقني|تكنولوجيا|حاسب/.test(title)) return { description: "أسئلة عن التقنية والأجهزة والإنترنت والابتكارات.", example: "مصطلحات رقمية واختراعات غيّرت حياتنا." };
  if (/فن|سينما|أفلام|مسلسل/.test(title)) return { description: "تحديات عن الأعمال والشخصيات والفنون والترفيه.", example: "التعرّف على عمل أو شخصية من وصف قصير." };
  if (/ألعاب|قيم/.test(title)) return { description: "أسئلة عن الألعاب وشخصياتها وعوالمها.", example: "التعرّف على لعبة أو شخصية من تلميحات." };
  if (/سعود|المملكة/.test(title)) return { description: "معلومات عن المملكة، مدنها ومعالمها وإنجازاتها.", example: "معالم ومدن ومعلومات من تاريخ المملكة." };
  return { description: `تحديات معلومات متنوعة في فئة «${title}».`, example: "اختاروا قيمة السؤال، ثم جاوبوا قبل معرفة الحل." };
}
export function gameExplanation(slug: string, fallback: string, players: string) {
  const examples: Record<string, string> = {
    "category-board": "اختاروا 6 فئات، وتنافس فريقان على 36 سؤالًا وجمع النقاط. المضيف يدير الأسئلة.",
    "out-of-the-loop": "الجميع يعرف الموضوع ما عدا لاعبًا واحدًا؛ حاولوا تكتشفونه من الكلام.",
    "letter-network": "جاوبوا بحسب الحروف، ووصلوا مسار فريقكم قبل الفريق الثاني.",
    "survey-show": "توقعوا الإجابات الشائعة وجمّعوا نقاط الفريق.",
    "secret-word": "وصفوا الكلمة لفريقكم من دون استخدام الكلمات الممنوعة.",
    "bluff": "ميّزوا الإجابة الصحيحة بين إجابات كتبها المشاركون.",
    "top-list": "استخرجوا عناصر القائمة، اسمًا وراء اسم.",
    "lightning-quiz": "اسمعوا السؤال وتنافسوا على الجرس والإجابة الأسرع.",
    "ordering-challenge": "رتّبوا العناصر سرًا ثم اكشفوا الترتيب الصحيح.",
    "the-court": "قدّموا حججكم أمام المحلفين وخلّوا التصويت يحسم الجولة.",
    "night-of-quddam": "سهرة تربط ثلاث ألعاب معتمدة بالفرق نفسها ومجموع نقاط نهائي موحّد."
  };
  return { description: examples[slug] ?? fallback, example: `نوع اللعب: ${players}. ابدأوا من شاشة المضيف.` };
}
