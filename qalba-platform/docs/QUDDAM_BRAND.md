# قدّام — forward identity presentation guide

The customer name is **قدّام**. Create actions use **يلا قدّام**; same-session rematch actions use **جولة ثانية؟ قدّام!**. Specific action context remains in the accessible name. Game rules, credit rules, privacy projections and token/SSE behavior remain unchanged.

The mark is an original geometric RTL forward chevron with two dots suggesting ق. The inline component uses semantic CSS colors. Standalone SVG assets are self-contained; the horizontal wordmark uses outlines from the bundled Noto Sans Arabic font, whose existing OFL license remains in `public/fonts`.

| Asset | Use |
| --- | --- |
| `public/brand/quddam-logo-dark.svg` | Full horizontal identity on green |
| `public/brand/quddam-logo-light.svg` | Full horizontal identity on warm white |
| `public/brand/quddam-logo-mono.svg` | One-color print/export |
| `public/brand/quddam-mark.svg` | Standalone square mark |
| `public/brand/quddam-mark-mono.svg` | Standalone monochrome mark |
| `src/app/icon.svg` | Browser icon |
| `src/app/favicon.ico` | 16/32/48 px favicon, RGBA |
| `src/app/apple-icon.png` | 180 px Apple touch icon |
| `public/brand/quddam-icon-192.png`, `quddam-icon-512.png` | Reusable app-sized marks |
| `src/app/opengraph-image.png` | Arabic social share image, 1200×630 |

No manifest, service worker or installable PWA was present in the baseline. This phase adds no PWA behavior. `applicationName` and social metadata use the new name; the metadata origin uses the existing `APP_URL` setting.

The identity palette is night `#0A2B22`, forest surfaces `#14493A`, sun `#FFD21F`, spark `#FF4D7A`, and wave `#19E3D1`. Sun is reserved for the mark and primary decision. Header and repeated marketing actions remain secondary, leaving one sun action on the home page. Wave identifies information, links, focus and selected controls. Spark identifies energy/status; its lighter text token is used for small text on dark surfaces.

Lalezar is bundled locally under `public/fonts/lalezar` with its OFL license and used for headings. Existing bundled Noto Sans Arabic remains the body font. The repeated left-pointing chevrons in `quddam-chevrons.svg` follow RTL forward motion; they are static decorative masks and carry no interaction. `src/styles/quddam.css` remains a presentation layer, not a new game framework.

New session defaults are orange `#FF7A45`, sky blue `#4DB8FF`, yellow `#FFE14D`, and pink `#E58FC0`, synchronized with `src/lib/design/team-colors.ts`. Persisted sessions retain their saved colors. The shared `TeamMarker` renders circle, triangle, square, and diamond by stable team position beside team names on Host, phone and TV; names and A/B labels remain available to screen readers. No database migration is needed.

Library descriptions, approximate durations and icons live in `src/lib/brand/games.ts`. They do not determine availability or routing: the existing database flags and route predicate remain authoritative. The public preview features ten completed games. Existing legacy catalog entries remain in the signed-in library, preserving availability behavior.

The shared Category Board room QR contains the existing public join URL, rendered only for an authorized Host in the lobby. No private answer or credential is added. The Ranked presentation maps the known old editorial brand label to the new customer name without rewriting authored content or snapshots.

Intentionally retained technical names include the package/root directory, database example names, auth/participant cookies, `Qalba Arabic` font family, admin CSV download names, historical documentation and test fixtures. Do not mass-rename them. The older fictional story reference in the legacy party bank is historical authored content, not the current product identity.

Primary controls use sun with dark text; alternate actions use green or wave outline; Undo uses a wave dashed outline; financial/game commands retain their existing handlers and guards. Destructive game actions retain existing confirmation behavior and use a distinct danger treatment. Correct/wrong judgments use success/danger. All tested touch controls are at least 44×44 CSS px.

Release verification for this phase is lint, typecheck, all unit tests, production build and targeted UI/navigation/accessibility checks. The expensive full gameplay suite remains a later consolidated release gate.
