# قالوا الناس — independent human review and spoken playtest protocol (NOT RUN)

Date of protocol: 17 Oct 2026. Applies to the proposed review-only CSV in PR #30, not the live original 65-seed. **No fabricated human signoffs; all existing ledger fields stay PENDING / NOT_RUN.** Curated points are authored game scores, **not measured poll shares**. Disclose this distinction to the host/players.

## Editorial gate — exactly 91 rows
Prepare two reviewers who did not write the candidate. For each stable ID in `Survey_91_Item_Editorial_Gate.csv`, show the prompt and six ordered answers independently (without the other reviewer's decisions). Each reviewer marks clear Saudi spoken wording, one coherent scene, six meaningfully distinct concepts, a reasonable authored rank/point order (sum 100), factual plausibility where applicable, obvious unsafe/stereotyped assumptions, and category accuracy. Preserve proposed text versus accepted text. Require explicit reviewer name/date and recorded rejection/revision for any disputed row. A machine-verified 91×6, normalized uniqueness and total 100 **does not** set editorial_status to PASS.

Coverage ledger: daily 7; saudi 7; family 7; food 7; travel 7; school 7; tech 7; games 7; sport 7; cars 7; work 7; occasions 7; light 7. Exactly 91 question records, 546 answer slots and 117 authored aliases in the current proposal. The original live 65-seed must remain unchanged until approval and separate import proof.

## Spoken-guess gate (blind first, answer reveal later)
Use two independent Saudi Arabic-speaking groups with one host each. Read each question aloud **without displaying the six candidate answers**; record the first natural responses and how hosts would judge them. Then reveal the draft slots and individually test all 117 aliases for one-to-one meaning. Record exact utterance (privately), matched slot, whether the host accepted/rejected/requested clarification, and conflicting slots. Do not infer that a rule-based string match constitutes semantic accuracy. Any ambiguity stays a blocker until text/alias revisions are repeated blind. Avoid collecting personally identifying participants' information or publishing raw voice recordings.

### Required high-risk adversarial utterances
| Candidate ID | Blind utterance/example | Expected human review question; do not auto-approve |
| --- | --- | --- |
| survey-seed-26 | «قلم» vs «قلم حبر» / «قلم تلوين» | Bare generic pen must trigger host clarification, not a guessed award |
| survey-seed-49 | «الجوال مو ثابت» | Ask whether shake or fall actually occurred; do not award both |
| survey-seed-58 and supplement-occasions-01 | «الوقت، المكان، الدعوة» | Sending an invite and attending a graduation are distinct scenes; do they elicit genuinely different spontaneous answers? |
| survey-seed-61 and seed-65 | «وين جوالي؟» vs «الألعاب مبعثرة» | Lost item vs children's post-play living room mess must remain distinguishable |
| survey-supplement-tech-01 | «الجوال معلّق» | Clarify freeze vs failed touch; identical generic wording must not hit two slots |
| supplement-occasions-01 | «وقت الانطلاق» vs «وسيلة الوصول» | Validate these represent separately likely actions; if not, rewrite |

## Honest outcomes and release boundary
For every item, retain a traceable three-way record: independent editorial decision, alias/speech decision, and witnessed real group playtest; use `REJECTED` or `NEEDS_REVISION` when appropriate, never an automatic blanket PASS. Only after every accepted row, each alias, and true group playtest are documented can the owner authorize a **separate, isolated revised-91 import and Chrome seed proof**. A clean original-65 browser test certifies only the unmodified baseline. If the human playtest is not held, status remains `NOT_RUN`; no publication, merge, live-bank replacement or Beta signoff.
