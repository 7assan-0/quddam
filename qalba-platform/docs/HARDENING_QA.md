# Qalba Design System Hardening QA

## Files changed

- `public/fonts/NotoSansArabic-Regular.ttf`, `NotoSansArabic-Bold.ttf`, `OFL.txt`: bundled Arabic font and license.
- `src/styles/tokens.css`: local font faces, semantic derived colors, removal of unused theme API.
- `src/app/globals.css`, `src/styles/components.css`: tokenized palette, contrast, Arabic tracking, TV layout, active team and motion.
- `src/components/animated-score.tsx`: presentation-only score count and delta feedback.
- `src/components/board-host.tsx`, `src/components/board-display.tsx`: host judgment feedback, active TV team label, score presentation.
- `src/styles/tokens.test.ts`, `tests/e2e/design-accessibility.spec.ts`, `tests/e2e/category-board.spec.ts`: contrast/token, WCAG, viewport, and one-checkmark coverage.
- `package.json`, `package-lock.json`: direct `axe-core` test dependency.
- `docs/DESIGN_SYSTEM.md`, `docs/design-system-preview.html`, `docs/HARDENING_QA.md`, `docs/qa/*.png`: revised guide, standalone preview, QA report, screenshots.

## Visual fixes

Noto Sans Arabic is served locally for every Arabic screen. App CSS has no literal hex palette values; hover derivatives and translucent layers are centralized in `tokens.css`. The completed board cell renders one ✓ from React. TV active team has a gold outline and «الدور الآن». At 1920×1080, a long Arabic question, long names, and board fit through a compact TV layout. Score counts and delta, correct/wrong decisions, turn changes, and victory use short motion with a reduced-motion fallback. Arabic headings use zero/default tracking; only the Latin room code has deliberate tracking.

## Accessibility fixes

Normal text on Coral uses Neutral 900 (`#0D1613`), measured at about 5.31:1. Semantic foreground/background pairs are unit-tested at ≥4.5:1. Focus indicators remain visible; the TV team state includes text. Axe WCAG 2/2.1 A/AA checks cover landing, login, registration, games library, Category Board host, TV display, room join, and admin. The 360×800, 390×844, 768×1024, 1440×900, 1920×1080, and 3840×2160 viewports were checked for document overflow, long content, and the TV board. Mobile boards intentionally scroll inside the board region.

## Test commands and results

| Command | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 40/40 passed across 13 files |
| `npm run build` | Passed |
| `npm run test:e2e:db` | 13/13 passed, including accessibility and six viewport checks |

Screenshots from the layout stress test are in `docs/qa/`. Tests use a temporary seeded PostgreSQL-compatible PGlite service. No migrations or game rules changed.

## Remaining issues

- The bundled TTF faces total about 500 KB. WOFF2 conversion/subsetting can reduce transfer size later; current fonts are self-hosted and functional.
- Four team colors are distinct and tested as tokens. Category Board gameplay remains configured for two teams; this pass does not extend its rules.
- Automated axe and viewport checks do not replace manual assistive-technology and device testing. A final human pass with Arabic screen readers and a physical TV is still recommended before launch.
