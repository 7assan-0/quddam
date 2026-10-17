# Category Board content review — 2026-10-16

This is an editorial review of the 36 authored Category Board definitions in
`prisma/core-content.ts`, not proof that every future imported question is correct.
It complements the database-backed `content:validate` result in the Category Board
Beta readiness report. No customer database, historic match snapshot, answer
matcher, score, game price or credit rule is changed.

## Reviewed scope and distribution

The authored bank contains six categories: general knowledge, Saudi Arabia,
football, science, technology and cybersecurity. Each has two distinct questions
at each of 200, 400 and 600 points: 36 questions, 18 value buckets. A board selects
one question per bucket, yielding 18 distinct question IDs. The second question
provides a fresh alternative in each bucket; unlimited repetition-free rematches
are not promised. A unit regression checks the complete distribution, distinct
normalized prompts and clean Category Board validator result.

The review checked all 36 question/answer pairs for factual consistency, spelling,
ambiguous wording, duplicate prompts, conflicting answers and placeholders. The
ordinary arithmetic, geometry and vocabulary items were checked directly. The
technical and specialist factual groups were compared with the primary references
below. No confirmed incorrect answer or blocking duplicate was found. The one
confirmed football ambiguity and the misleading ransomware wording were corrected as follows.

## Source-backed correction

| Field | Before | After |
|---|---|---|
| Stable seed ID | `seed-category-7` | unchanged |
| Category / value | football / 200 | unchanged |
| Question | كم لاعبًا من كل فريق يبدأون مباراة كرة القدم داخل الملعب؟ | ما الحد الأقصى لعدد لاعبي الفريق الواحد داخل الملعب في مباراة كرة القدم؟ |
| Canonical answer | `11` | unchanged |

The previous wording treated eleven as the required starting count. IFAB Law 3.1
permits a match to start with fewer than eleven players, provided a team has at
least seven. Asking for the maximum removes that ambiguity while preserving the
answer and scoring difficulty.

Primary source, retrieved and read on 2026-10-16:
<https://www.theifab.com/laws/latest/the-players/>. Its Law 3.1 states: “A match is
played by two teams, each with a maximum of eleven players; one must be the
goalkeeper.” It also states that a match may not start or continue with fewer
than seven players, subject to the specified temporary-absence exceptions.

The retrieved page returned HTTP 200; its body SHA-256 was
`2900e52b6ccd9e05294c0e0d7d7d57e675d7a8be0da27364c891e9e590e60082`.
The hash records the page reviewed, not a permanent guarantee about a mutable
`latest` URL. The fresh isolated test bank receives the corrected definition.
Existing bank rows are preserved by the seed's `update: {}` behavior; this task
does not apply an existing-database content remediation or rewrite prior games.

The second editorial correction is `seed-category-35` (cybersecurity / 400).
Before: «ما اسم البرنامج الذي يحمي الملفات بحجب الوصول إليها ويطلب فدية؟».
After: «ما اسم البرمجيات التي تشفّر الملفات أو تحجب الوصول إليها وتطلب فدية؟».
The answer «برمجيات الفدية» is unchanged. Calling ransomware protection
(«يحمي») was misleading. CISA's retrieved and read primary page
<https://www.cisa.gov/stopransomware/ransomware-101> states: “Ransomware is an
ever-evolving form of malware designed to encrypt files on a device, rendering
any files and the systems that rely on them unusable. Malicious actors then
demand ransom in exchange for decryption.” The final acceptance uses another
brand-new isolated fixture seeded from the final source; preliminary fixture
rows and all prior match snapshots remain preserved.

## Other primary references actually retrieved and read

- Football field, normal halves, extra-time bounds and penalty sequence:
  <https://www.theifab.com/laws/latest/the-field-of-play/>,
  <https://www.theifab.com/laws/latest/the-duration-of-the-match/> and
  <https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/>.
  “Sudden death” is the familiar name used by the quiz; Law 10 describes the
  continuing equal-kicks procedure. The thirty-minute answer describes the
  ordinary two fifteen-minute extra-time periods, without added time.
- URL expansion: <https://www.rfc-editor.org/rfc/rfc1738.txt>.
- HTTPS port 443: the IANA service registry,
  <https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.csv>.
- PNG as an image format: <https://www.w3.org/TR/png/>.
- Electric-current unit: <https://www.bipm.org/en/si-base-units/ampere>.
- Mercury and photosynthesis:
  <https://science.nasa.gov/mercury/> and
  <https://science.nasa.gov/earth/earth-observatory/the-carbon-cycle/>.
- Volatile-memory behavior:
  <https://csrc.nist.gov/glossary/term/volatile_memory>.
- Password salts and additional authentication factors:
  <https://pages.nist.gov/800-63-4/sp800-63b.html>.
- Authentication and integrity:
  <https://csrc.nist.gov/glossary/term/authentication> and
  <https://csrc.nist.gov/glossary/term/integrity>.
- Phishing and ransomware:
  <https://www.cisa.gov/secure-our-world/recognize-and-report-phishing> and
  <https://www.cisa.gov/stopransomware/ransomware-101>.

## Limits and evidence handling

Schema/duplicate checks cannot establish arbitrary real-world truth. Specialist
references above support their stated groups only; no source is presented as
evidence for unrelated questions. Some initially attempted Saudi/IUPAC reference
URLs returned an access block, a landing page or not-found content and are not
counted as independently verified references. The ordinary Saudi geographic
items received editorial review; no unsupported factual alteration was made.
RAM and football questions use the ordinary introductory quiz context, rather
than claiming that all memory architectures or competition formats are identical.

Detailed retrieval receipts and database audit output remain in the private
synthetic test evidence directory. Published readiness evidence contains only
counts, stable content IDs and aggregate validation outcomes; no participant
secrets, database connection strings or private match answer snapshots are needed.
