/**
 * Editorially reviewed semantic duplicates of Category Board knowledge in the
 * original Lightning bank. Retain their immutable IDs and source prompts for
 * historical sessions, but do not publish them in a fresh seed.
 *
 * Existing deployed rows are NOT rewritten by seed's empty-update upsert.
 * The cross-game audit blocks an old database while both linked rows remain
 * eligible; retirement of existing published rows requires a separate approved
 * content operation with backups and a post-change validation report.
 */
export const lightningBoardSemanticExclusions = [
 { lightningId: "lightning-sports-1", boardId: "seed-category-7" }, // football starting player count
 { lightningId: "lightning-science-16", boardId: "seed-category-12" }, // SI ampere
 { lightningId: "lightning-technology-13", boardId: "seed-category-14" }, // RAM
 { lightningId: "lightning-technology-17", boardId: "seed-category-17" }, // identity authentication
 { lightningId: "lightning-technology-9", boardId: "seed-category-33" }, // binary system
] as const;

export const archivedLightningSeedIds = new Set<string>(
 lightningBoardSemanticExclusions.map(entry => entry.lightningId),
);
