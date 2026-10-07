# Quddam launch catalogue — Phase 5.0C-3 / M15

`src/lib/games/launch-policy.ts` is the launch eligibility authority. Eligibility is
separate from the mutable `GameType.enabled` availability flag and the retained
generic party registry. An enabled database row cannot add a launch experience.

| Launch experience | GameType slug | New flow | Creation API |
| --- | --- | --- | --- |
| لوحة التحدي / Category Board | `category-board` | `/games/category-board/new` | `/api/games/category-board` |
| خارج الجو / Out of the Loop | `out-of-the-loop` | `/games/out-of-the-loop/new` | `/api/social` |
| شبكة الحروف / Letter Network | `letter-network` | `/games/letter-network/new` | `/api/letter-network` |
| قالوا الناس / Survey Battle | `survey-show` | `/games/survey-show/new` | `/api/survey-show` |
| الكلمة الممنوعة / Forbidden Word | `secret-word` | `/games/secret-word/new` | `/api/secret-word` |
| صدّقني / Bluff Game | `bluff` | `/bluff/new` | `/api/bluff` |
| توب 100 / Ranked List | `top-list` | `/ranked/new` | `/api/ranked` |
| البرق / Lightning Quiz | `lightning-quiz` | `/lightning/new` | `/api/lightning` |
| رتّبها / Ordering Challenge | `ordering-challenge` | `/ordering/new` | `/api/ordering` |
| المحكمة / The Court | `the-court` | `/court/new` | `/api/court` |

The signed-in `/games` query selects only these ten slugs, including unavailable
official games with their existing disabled presentation. Card links come from
this same policy. The public Home already presents these exact ten games; its
brand, cards, links and styling remain unchanged. `/games` still requires login.

## Legacy inventory and creation policy

The seed retains thirteen `GameType` definitions. Three distinct non-launch slugs
are `letter-battle` (حرب الحروف), `fastest-mind` (خاطف), and `party-court`
(محكمة الطاولة). The generic party registry additionally contains older engines
under four shared slugs: `survey-show`, `secret-word`, `bluff`, and `top-list`.
These shared database identifiers also belong to the completed dedicated games;
they must not be disabled or removed globally.

All seven `/api/games/party/{slug}` NEW-creation endpoints return 404 for an
authenticated, same-origin request. The route rejects before body parsing; the
service independently rejects before a database call. This cannot create a
`GameSession`, `GameCommand`, game debit, or credit consumption. Unknown generic
slugs retain the existing enum-validation 400. Authentication/origin rejection
continues to return 403. There is no mutation redirect or replacement creation.

The generic `/games/[slug]/new` page enters `notFound()` before content/setup work. Thus
the three distinct legacy flows and stale `/games/bluff/new` and
`/games/top-list/new` links are blocked. The existing static
`/games/survey-show/new` and `/games/secret-word/new` pages take precedence and
remain the approved dedicated flows. The ten dedicated APIs have fixed approved
game identifiers and are unchanged; they do not dispatch to generic engines.

With the existing root loading boundary, Next may stream the HTML shell with HTTP
200 before rendering its noindex 404 page. The blocked flow renders no creation
form or creation CTA. This framework behavior also applies to unknown slugs and
is unchanged; the financial/mutation boundary is the explicit API 404 above.

## Seed and admin availability

Fresh seed creates ten official definitions enabled and three legacy definitions
disabled. Reseeding disables those three legacy definitions without removing
definitions, authored questions, sessions, results or histories. Existing
availability settings for official games are preserved on reseed. The authored
question/card banks and all other seed operations are unchanged.

`PATCH /api/admin/games/{id}` allows availability toggles for the ten launch slugs.
Enabling a non-launch definition returns 409 without updating it; disabling it
remains allowed. Admin catalogue/history inspection remains available. Even a
manual database `enabled=true` for a legacy/unknown row cannot bypass customer
catalogue filtering or generic creation rejection.

## Existing-session compatibility

These existing owner-authorized paths remain unchanged:

- `/profile`: existing history and result links.
- `/play/{id}`: supported legacy Host/result read and existing recovery controls.
- `/play/{id}/display`: existing owner-authorized generic display projection.
- `GET /api/games/party/sessions/{id}` and `?display=1`: existing projections.
- `POST /api/games/party/sessions/{id}/commands`: existing session recovery;
  it does not create a new `GameSession`.

`getPartySession` does not require `GameType.enabled`, so disabling a legacy type
does not invalidate an old supported session. Ownership, matching state slug and
schema-version checks remain required. Dedicated replacement states cannot be
read as a generic legacy state merely because their GameType slug is shared.
No data migration or previous migration modification is needed.

The generic changed-payload command-key behavior is a retained compatibility risk:
`applyPartyCommand` checks an existing key without a payload-hash comparison.
It is unchanged, restricted to already-existing supported owner sessions, and is
not an entry point for creating a new legacy session. Old unfinished sessions may
continue their existing recovery/START behavior; no START debit or engine rule
has changed. A legacy result's old new-game link may now lead to a 404. No old
session, score, command receipt or history is rewritten or deleted.

## Verification boundary

Focused unit tests cover the catalogue, policy, generic page/API/service rejection,
admin toggles, unchanged public Home choices, old reads and module isolation.
`tests/e2e/launch-catalog.spec.ts` uses a dedicated PostgreSQL database for the
fresh seed, ten real create flows/APIs, stale enabled rows, rejection side effects,
legacy Host/display/history reads, reseed preservation and admin enforcement.
The new catalogue cases never START a game. The two existing `party.spec.ts`
identities retain every gameplay, score, privacy, refresh and viewport assertion;
only their setup changes from public NEW creation to SQL-backed existing legacy
lobbies in the isolated test database. They still exercise existing recovery/START
and debit behavior without making a public creation exception. All other existing
regression tests are unchanged. The full 186-case regression is deferred as requested.
