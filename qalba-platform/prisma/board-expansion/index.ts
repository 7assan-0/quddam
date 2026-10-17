import { generalBoardExpansion } from "./general";
import { saudiBoardExpansion } from "./saudi";
import { footballBoardExpansion } from "./football";
import { scienceBoardExpansion } from "./science";
import { technologyBoardExpansion } from "./technology";
import { cybersecurityBoardExpansion } from "./cybersecurity";

/** Stable authoring order. All entries are original Quddam questions, not show transcripts. */
const banks: ReadonlyArray<{
  slug: string;
  tiers: Record<200 | 400 | 600, ReadonlyArray<readonly [string, string]>>;
}> = [
  { slug: "general", tiers: generalBoardExpansion },
  { slug: "saudi", tiers: saudiBoardExpansion },
  { slug: "football", tiers: footballBoardExpansion },
  { slug: "science", tiers: scienceBoardExpansion },
  { slug: "technology", tiers: technologyBoardExpansion },
  { slug: "cybersecurity", tiers: cybersecurityBoardExpansion },
];

const points = [200, 400, 600] as const;
const labels = { 200: "EASY", 400: "MEDIUM", 600: "HARD" } as const;
export const boardExpansionSamples = banks.flatMap(({ slug, tiers }) =>
  points.flatMap((pointValue) => tiers[pointValue].map(([question, answer]) =>
    [slug, question, answer, labels[pointValue], pointValue] as const)));
