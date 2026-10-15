# Confirmed same-fact repetition: nine Board and two Lightning review-bank replacements

Date: 2026-10-15. Scope: **editorial CSVs only**; not an approved import or production fix. Stable IDs, categories, and Board/Lightning bank sizes are preserved. The source links below are preliminary fact evidence, not an independent human signoff. Original rows remain in Git history. **NO-GO** until the content-quality gate is met.

## Board replacements

| ID replaced | Conflicting earlier ID / fact | Distinct new test | New primary answer | Preliminary source |
|---|---|---|---|---|
| 1233 | 325 / which sea borders Jeddah | first Saudi UNESCO World Heritage site in 2008 | الحِجر | https://saudipedia.com/en/what-is-the-first-saudi-site-registered-on-the-world-heritage-list |
| 1236 | 482 / National Day date | city of annual al-Qassim date festival | بريدة | https://saudipedia.com/en/buraydah-city |
| 1270 | 332 / Saudi first VAT implementation year | rock-art site in Najran inscribed in 2021 | منطقة حمى الثقافية | https://saudipedia.com/en/hima-cultural-area |
| 1242 | 37 / Riyadh international airport | complete name of Madinah international airport | مطار الأمير محمد بن عبدالعزيز الدولي | https://saudipedia.com/en/prince-mohammed-bin-abdulaziz-international-airport |
| 990 | 487 / UAE capital | country containing Auckland | نيوزيلندا | https://ourauckland.aucklandcouncil.govt.nz/welcome-to-auckland/ |
| 316 | 841 / liquid evaporation | gas-to-liquid water vapor change on cooling | التكاثف | https://www.noaa.gov/education/resource-collections/freshwater/water-cycle |
| 787 | 177 / original Minecraft developer | Stardew Valley neighboring community | بلدة بيلكان | https://www.stardewvalley.net/ |
| 402 | 54 / location/identity of King Abdullah Economic City | city housing Ithra cultural center | الظهران | https://www.ithra.com/ar |
| 1234 | 397 / identity of Aramco in Dhahran | Asir traditional wall-decoration heritage | القط العسيري | https://ich.unesco.org/en/RL/al-qatt-al-asiri-female-traditional-interior-wall-decoration-in-asir-saudi-arabia-01261 |

For 1234, the diacritic-only alternate was removed because it collapses to the primary after answer normalization.

## Lightning replacements

| ID replaced | Previously repeated fact | Distinct new test | Primary answer | Preliminary source |
|---|---|---|---|---|
| lightning-v600-geography-12 | Board #1013 / Black Sea between Turkey and Ukraine | strait connecting Sea of Marmara and Aegean | الدردنيل | https://en.wikipedia.org/wiki/Dardanelles |
| lightning-v600-games-07 | Board #165 / Minecraft from cubic blocks | cooperative kitchen game for 1–4 players | أوفركوكد | https://www.team17.com/games/overcooked |

Avoid accepted answers that differ only by punctuation or diacritics; aliases are review candidates and must not collide under runtime normalization.

## Evidence and limitations

- Rechecked parsed revised banks: Board 1,296, Lightning 600 and Letter V4 224. No identical normalized questions across these 2,120 after replacement.
- A same-answer similarity triage within Board still flags distinct factual tests (e.g., 1971 independence of Bahrain versus Qatar, or locations of two different al-Bahah governorates). Do not delete on shared answer alone.
- Regressions added to `tests/content-review-cross-bank.test.ts`; this covers the eleven specific replacements alongside previously corrected normalized duplicates and the catalyst overlap.
- Other questions with distinct wording can still test the same fact, and all questions remain subject to editorial semantic review. Source URLs are not evidence of a completed independent verification, difficulty playtest, or real application import.
- The separate Chromium CI smoke uses synthetic local PGlite. Its first run failed **before browser execution** because Prisma generation lacked `DATABASE_URL`; the workflow now supplies a nonfunctional placeholder for config parsing, while its E2E script overrides that variable with an ephemeral PGlite URL for all DB actions. Require a new, successful native per-case report on the **final** SHA to make browser claims.

No merge, Staging, production, billing, or publishing action is authorized by this report.
