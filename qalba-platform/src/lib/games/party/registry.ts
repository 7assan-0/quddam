import { letterBattle } from "./letter-battle";
import { bluff } from "./bluff";
import { fastestMind } from "./fastest-mind";
import { topList } from "./top-list";
import { secretWord } from "./secret-word";
import { surveyShow } from "./survey-show";
import { partyCourt } from "./party-court";
import type { PartySlug, PartyModule } from "./types";
export const modules: Record<PartySlug, PartyModule> = { "letter-battle": letterBattle, bluff, "fastest-mind": fastestMind,
  "top-list": topList, "secret-word": secretWord, "survey-show": surveyShow, "party-court": partyCourt };
