/**
 * Source-only rollout registry for Board36.
 *
 * Defining a category here does not create questions, run a database seed or make
 * it playable. The Board setup still requires 6 independent eligible categories.
 * Do NOT use this authoring manifest as a substitute for human editorial approval.
 */
export const boardCatalog = [
  ["general", "معلومات عامة"],
  ["saudi", "السعودية"],
  ["football", "كرة القدم"],
  ["sports", "رياضة"],
  ["history", "تاريخ"],
  ["geography", "جغرافيا"],
  ["science", "علوم"],
  ["technology", "تقنية"],
  ["cybersecurity", "أمن سيبراني"],
  ["movies", "أفلام"],
  ["series", "مسلسلات"],
  ["anime", "أنمي"],
  ["games", "ألعاب"],
  ["cars", "سيارات"],
  ["logos", "شعارات"],
  ["people", "مشاهير"],
  ["arabic", "لغة عربية"],
  ["riddles", "ألغاز"],
  ["who-am-i", "من أنا؟"],
  ["images", "صور"],
  ["culture", "ثقافة"],
  ["food", "طعام"],
  ["travel", "سفر"],
  ["places", "أماكن"],
  ["animals", "حيوانات"],
  ["jobs", "وظائف"],
  ["objects", "أشياء"],
] as const;

export const boardFirstSix = [
  "general", "saudi", "football", "science", "technology", "cybersecurity",
] as const;

export const questionsPerGrade = 32;
export const pointGrades = [200, 400, 600] as const;
export const questionsPerCategory = questionsPerGrade * pointGrades.length;
export const boardCategoryGoal = boardCatalog.length;
export const boardQuestionGoal = boardCategoryGoal * questionsPerCategory;

/** Pure check for authored source packs, never a live database eligibility decision. */
export type BoardAuthoredRow = readonly [
  slug: string, question: string, answer: string,
  difficulty: string, points: number
];

export function boardSourceReadiness(rows: readonly BoardAuthoredRow[]) {
  const groups = boardCatalog.map(([slug, title]) => {
    const inCategory = rows.filter(row => row[0] === slug);
    const perGrade = pointGrades.map(point => ({
      points: point,
      authored: inCategory.filter(row => row[4] === point).length,
      needed: Math.max(0, questionsPerGrade - inCategory.filter(row => row[4] === point).length),
    }));
    return {
      slug, title,
      authored: inCategory.length,
      missing: perGrade.reduce((sum, tier) => sum + tier.needed, 0),
      complete: perGrade.every(tier => tier.authored === questionsPerGrade) &&
        inCategory.length === questionsPerCategory,
      perGrade,
    };
  });
  return {
    categories: groups,
    completeCount: groups.filter(category => category.complete).length,
    incompleteCount: groups.filter(category => !category.complete).length,
    totalAuthored: rows.length,
    goal: boardQuestionGoal,
    unknownSlugs: [...new Set(rows.filter(row => !boardCatalog.some(([slug]) => slug === row[0])).map(row => row[0]))],
  };
}
