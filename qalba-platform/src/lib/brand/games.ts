/** Presentation only. Availability, routes and game rules remain in their existing owners. */
export const featuredGames = [
  { slug: "category-board", title: "لوحة التحدي", description: "اختاروا الفئة، راهنوا على معرفتكم، واقلبوا النتيجة.", players: "فريقان", duration: "٢٠–٤٠ دقيقة", icon: "board" },
  { slug: "out-of-the-loop", title: "خارج الجو", description: "الكل يعرف الكلمة… إلا واحد. مين خارج الجو؟", players: "٣–١٢ لاعبًا · جوالات", duration: "١٠–٢٠ دقيقة", icon: "social" },
  { slug: "letter-network", title: "شبكة الحروف", description: "حرف وإجابة، ومسار يوصلكم للفوز.", players: "فريقان", duration: "٢٠–٣٥ دقيقة", icon: "letters" },
  { slug: "survey-show", title: "قالوا الناس", description: "توقعوا الإجابات واختطفوا نقاط الجولة.", players: "فريقان", duration: "٢٠–٣٥ دقيقة", icon: "survey" },
  { slug: "secret-word", title: "الكلمة الممنوعة", description: "وصف سريع، وكلمات ممنوع تقولها.", players: "فريقان", duration: "١٠–١٥ دقيقة", icon: "word" },
  { slug: "bluff", title: "صدّقني", description: "حقيقة واحدة. والباقي من تأليف جماعتكم.", players: "٣–١٢ لاعبًا · جوالات", duration: "١٠–١٥ دقيقة", icon: "bluff" },
  { slug: "top-list", title: "توب 100", description: "اكتشفوا القائمة، اسمًا وراء اسم.", players: "فريقان", duration: "٢٠–٣٠ دقيقة", icon: "ranked" },
  { slug: "lightning-quiz", title: "البرق", description: "اسمع السؤال واضغط الجرس قبل منافسك.", players: "فريقان · جرس لكل فريق", duration: "١٠–١٥ دقيقة", icon: "lightning" },
  { slug: "ordering-challenge", title: "رتّبها", description: "رتبوا سرًا، ثم شوفوا مين ضبطها.", players: "فريقان · جوال لكل فريق", duration: "١٠–١٥ دقيقة", icon: "ordering" },
  { slug: "the-court", title: "المحكمة", description: "حجة قوية، رد أقوى، والحكم للمحلفين.", players: "فريقان · ٣–١٢ محلفًا", duration: "٢٠–٣٠ دقيقة", icon: "court" },
] as const;
export function gamePresentation(slug: string) { return featuredGames.find(game => game.slug === slug); }
