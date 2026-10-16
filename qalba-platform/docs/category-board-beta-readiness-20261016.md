# لوحة التحدي — Beta Readiness، PR #17

**GAME_READY لنطاق القبول المحلي المحدد أدناه، مشروط بتأكيد إعادة جميع البوابات على رأس التقرير في الإيصال المرتبط. لا GO لإطلاق المنصة خارجيًا ولا موافقة دمج أو نشر.** اعتماد اللعبة لا يغلق بوابات PR #16 الأمنية والتشغيلية.

## هوية المصدر والأدلة

- المستودع `7assan-0/quddam`، الفرع `test/category-board-beta-journey-20261016`، [Draft PR #17](https://github.com/7assan-0/quddam/pull/17).
- رأس البداية الذي تحقق منه GitHub فعلًا: `1db2fdd24ddd1eddf6b398d84e360bbd41c50709`؛ قاعدته PR #16 عند `11f4991062b27980d0022ba70f90aeadf10eedab`. كلاهما Draft وغير مدموج عند الفحص.
- **SHA النهائي الحرفي، جرد المصدر، أكواد الخروج، وعدد الحالات المعاد تشغيلها:** [إيصال الأدلة النهائي](https://github.com/7assan-0/quddam/pull/17#issuecomment-6225260222). لا يمكن لملف داخل commit تضمين SHA ذلك commit دون تغيير SHA؛ يحسم الإيصال الخارجي هوية الرأس الذي يحتوي هذا التقرير. لا يُعاد استخدام اعتماد RC أو CI مالي قديم بوصفه تحققًا لهذا الرأس.
- كل PASS محلي أولي في هذا المستند يصف تشغيلًا فعليًا أثناء العمل، وليس شهادة على ملف التقرير قبل تشغيله. تعاد المجموعة النهائية على commit نظيف، ويقارن `ci/financial-review/source-binding.py` المصدر الحرفي قبل كل مجموعة وبعدها: Git objects، inventory، البايتات، الأوضاع، والـSHA نفسه. لا يكفي Git status. بيانات node_modules و.next مولّدة وليست مثبتة تلقائيًا بجرد Git.
- raw logs وPlaywright JSON وQR الأصلي وCookies وبيانات الاتصال خارج Git بصلاحيات مقيدة. الإيصال العام ينشر counts/hashes/status فقط، دون room codes أو TV tokens أو إجابات سرية أو بيانات أشخاص حقيقيين.

## قرار البوابات

| البوابة | النتيجة | الدليل وحدوده |
|---|---|---|
| Five-phone journey | PASS | رحلة الاختبار الأصلية شُغلت فعلًا: مضيف وخمس Browser Contexts مستقلة بقياس390×844، جاهزية، تحديث، سؤال وإجابة، وقرار مضيف محفوظ. محاكاة عرض جوال في Chromium فعلي؛ ليست خمسة أجهزة مادية. |
| 20-player capacity | PASS | عشرون سياقًا مستقلاً، فرق وجاهزية وأسماء محفوظة، المضيف خارج المقاعد، رفض رقم21 وعدم تغيير الموجودين. الإعادة النهائية تضيف رفض21 من واجهة الجوال وإعادة طلب المقعد العشرين وهو ممتلئ. |
| Full game journey | PASS | مباراة كاملة ذات18سؤالًا مختلفًا، حتى COMPLETED دون إنهاء مبكر؛ صحيح/خطأ/سرقة، مؤقت وإيقاف واستئناف، قدرات double/extra-time، Undo، نتيجة وسجل حساب. بقية قواعد القدرات تغطيها اختبارات المحرك القائمة؛ لا ادعاء بتجربة كل توليفة UI. |
| Reconnect and persistence | PASS | انقطاع حقيقي لشبكة سياق الضيف وفشل طلب خلاله، ثم تحديث واستعادة نفس selfId/المقعد/الفريق/الجاهزية؛ تحديث المضيف وTV؛ Cookie-bound join retry لا ينشئ Player أو Participant إضافيًا. |
| Concurrent scoring | PASS |20إجابة POST متزامنة، إعادة الإجابة مرفوضة409، الضيف لا يحكم403. حاجزا PostgreSQL حقيقيان: identical-key وdifferent-key؛ كل حاجز يثبت3backends مستقلة وطلبين منتظرين، مع أثر نقاط واحد. |
| Content validation | PASS | تشغيل database-backed validator، لا source-only:36سؤالًا،6فئات، سؤالان لكل200/400/600، دون duplicate أو placeholder أو invalid structure. تعاد على القاعدة النهائية الجديدة، مع مقارنة التعريفات المزروعة بالمصدر. |
| Mobile / TV / QR | PASS | لعب مضيف عند390×844 وضيوف مستقلون، TV1920×1080 للقراءة فقط، فحص geometry/overflow، ومراجعة PNG بصريًا. فُك QR الفعلي مستقلًا بـjsQR وطابق hash رابط الانضمام. تصوير الجوال بعد scrollTop0 يمنع أثر stitching للـsticky header؛ لا تعديل للهوية/CSS. |
| Real LAN/NAT | NOT RUN | لا جهازان فعليان أو شبكتان مستقلتان متاحان لهذه المهمة؛ لا firewall أو certificates أو public listener أو P2P أُضيف. لا تُستنتج صلاحية شبكة منزلية/إنترنت من اختبارات الجهاز الواحد. |
| Typecheck / Lint / Build | PASS | builds السابقة typechecked ونجحت، وLint Exit0؛ التثبيت والتوليد والوحدة وTypeScript وLint وBuild تعاد نظيفة على SHA التقرير ويثبتها الإيصال. Build ليس نجاح production launcher أو نشرًا. |

التحكيم يدوي من المضيف وفق سياسة اللعبة؛ لا تتحول إجابات الجوال أو أصوات اللاعبين إلى نقاط تلقائية. ليست هذه آلية حكم تنافسي محايد أو إثبات هوية بشرية للضيف.

## العيوب المثبتة وتصحيحها

1. **رجوع عرض الضيف/ردهة المضيف إلى snapshot أقدم.** كان `RoomLive` يطبق رد POST وSSE دون ترتيب، و`RoomHostPanel` يقبل أي قراءة. أُضيفت أربعة اختبارات مكونات قبل التصحيح وفشلت الأربعة فعلًا؛ ثم اختبار خامس أثبت إعادة السؤال برد متأخر بعد terminal access loss. الحارس الجديد يثبت room/session/self/host ويمنع تراجع أي من عدادي room/game، مع السماح بتحديث مشروع من الإصدار نفسه. يُحدّث clock offset للسnapshot المقبول فقط؛ لا يعيد رد قديم فتح السؤال بعد انتهاء الوصول. بعد التصحيح نجحت الخمسة. اختبار المتصفح يؤخر **تسليم رد POST حقيقي ناجح** بينما يتقدم المضيف؛ لا backend response مصطنع.
2. **رجوع سؤال المضيف بعد تحكيمه.** تحديث TV-access GET كان يتداخل مع CORRECT، ويعيد السؤال/النقاط القديمة إلى `BoardHost`. أُعيد إنتاجه عبر طلب حقيقي: بعد التسليم المتأخر عاد `.question-stage` رغم إغلاقه سابقًا. فشل اختبار Regression ثم نجح بعد حارس id/version في مساري refresh وcommand response. بيانات PostgreSQL كانت صحيحة حتى قبل الإصلاح؛ العيب كان في العرض، ولم يُغير منطق التحكيم أو الخصم.
3. **إعادة الانضمام تستبدل هوية المقعد وتترك المقعد القديم.** أثبت HTTP حقيقي أن إعادة نفس الطلب أعادت409 بينما اسمًا مختلفًا مع Cookie المقعد نفسه أنشأ مقعدًا ثانيًا وأعاد201. داخل قفل Room الحالي يُربط الطلب الآن بTokenHash للمقعد الموجود: نفس الاسم/الفريق يعيد المقعد نفسه والـCookie نفسه؛ تغيير الهوية/الفريق عبر join يرفض409. يبقى المضيف مرفوضًا، والتحقق من terminal/expiry/team/rate limits قائمًا. نجح Regression بعد التصحيح، بما فيه طلبان متزامنان وParticipant/Player واحد فقط، دون تغيير الجاهزية أو منح إدارة. لا استرجاع هوية بالاسم إذا ضاع الـCookie تمامًا.
4. **حاجز إعداد لا يثبت PostgreSQL أصليًا.** `test:e2e:db` القديم ينشئ PGlite دائمًا ويتجاهل DB URL الممرر. أُضيف وضع PG17 صريح بملف synthetic خاص خارج checkout، system identifier واسم/مستخدم/منفذ محدد، وصفر public tables قبل التهيئة، marker خاص و27checksum للمigrations، وقفل يمنع تشغيلين على القاعدة نفسها. إعادة الاستخدام تتطلب READY وتطابق جميع migration SQL وتتجاوز migration/seed، فلا تمسح بيانات محاولة سابقة. الافتراضي PGlite محفوظ، ولا تنسب نتائجه إلى PG17. نجحت17حالة وحدة للحارس، مشمولة في عدد الوحدة الكامل.
5. **خطأ رصيد fixture، وليس عيب خصم.** الحسابات الجديدة تحصل افتراضيًا على صفر لأن أهلية welcome credits معطلة. ظهرت402 فعلًا في رحلة الخمسة. runner المعزول يفعّل الإعداد القائم **في عملية الاختبار فقط** لتزويد الحساب الاصطناعي بالمبلغ المزروع الأصلي3. لا تعديل للسعر أو مقدار المنحة أو production defaults أو billing code أو سجلات دفع؛ يبدأ الحساب3 وينتهي2 بعد مباراة واحدة. الخصم واحد من مسار START الأصلي، وتكرار مفتاحه لا يكرر الخصم.
6. **تحرير محتوى محدود بمصدر موثوق.** سؤلا `seed-category-7` و`seed-category-35` صُححت صياغتهما فقط، والإجابتان ثابتتان11 و«برمجيات الفدية». [مراجعة المحتوى](category-board-content-review-20261016.md) تسجل before/after وIFAB/CISA والنصوص المقروءة وحدود مراجعة36سؤالًا. إعادة التحقق النهائية تستخدم قاعدة جديدة مزروعة من التعريفين المصححين؛ لا تعديل snapshots أو تاريخ سابق، ولا تطبيق remediation على قاعدة قائمة.

## التشغيل الفعلي والإخفاقات المحفوظة

البيئة الحالية: Node24.19.0، npm11.9.0، Prisma7.10.0، Next16.4.2، **Chromium154.0.8037.57** فعلي من Debian، وPG17.11 أصلي. ليس ادعاء تشغيل Google Chrome155 المحفوظ في مهمة سابقة؛ ذلك الملف لم يوجد في هذه النسخة من البيئة.

قبل تثبيت التقرير، نجحت **13حالة Playwright مجتمعة،0failed/0skipped/0flaky،retries0** عبر الملفات الستة ذات الصلة. ونجحت حالتا Regression الإضافيتان للمضيف وإعادة الانضمام بعد إخفاقهما المثبت؛ أصبحت المجموعة النهائية **15حالة مكتشفة**. تعاد كلها على الرأس النهائي والقاعدة الجديدة، ولا تجمع نجاحات محاولات قديمة لتوحي بأن تشغيلًا نهائيًا اكتمل. المجموع الكامل للوحدة في إعادة التشخيص الصحيحة كان **1503اختبارات/91ملفًا،0فشل/0تجاوز**، ويتضمن31content و17fixture guards و5room-state tests؛ لا تُجمع هذه مرة ثانية خارج الإجمالي. تثبت إعادة الاكتشاف النهائية العدد إذا تغيّر.

حُفظت أيضًا الإخفاقات التالية، ولم تُحذف حالات لقبولها:

- أول build توقف بسبب `responses: undefined` الناقص في **بيانات اختبار** typed؛ صُحح fixture دون إضعاف TypeScript.
- تشغيل توقف لأن مسار Chrome القديم غير موجود، قبل تشغيل منطق اللعبة؛ استُخدم Chromium المثبت بعد التحقق من version.
- فشل الخمسة قبل اختيار السؤال بسبب402 الموصوفة، ثم نجحت بعد الإعداد الاصطناعي المشروع.
- تشغيل أولي للوحدة:1487passed/16failed بسبب APP_URL127.0.0.1 مقابل Origin localhost في fixtures القائمة؛ صُحح **إعداد العملية** إلى localhost، دون تغيير Same-Origin أو توقعات الاختبارات. أعيدت المجموعة ونجحت1503. تزامن تعديل Next للـdeclaration سبب خطأ إضافيًا في wrapper الخارجي؛ المرجع أصبح Git bytes الحرفية بدل ملف متحرك أثناء build.
- محدد زر جديد exact لم يراعِ الاسم المعتمد «يلا قدّام · جهّز اللوحة»؛ صحح إلى action suffix مع بقاء كل Assertions. تلك المحاولة:0passed/1failed/2skipped عند إيقاف التشخيص بعد الفشل، وليست قبولًا. أُصلح أيضًا انتظار navigation/ظهور الفئات قبل count بدل لقطة متعجلة؛ لا sleeps لإخفاء السباق أو retries.
- عيوب snapshot وإعادة الانضمام المثبتة أعلاه لها إيصالات before-fail/after-pass منفصلة. الإخفاقات الأولية لا تُمحى أو يُغيّر وصفها إلى نجاح.

كل `--retries=0`، ويمر JSON النهائي فقط إذا كانت كل نتيجة passed، وعدد results لكل test يساوي1، وskipped/flaky/errors كلها صفر. السعة تنتظر61ثانية قبل المجموعة وبعد أول12انضمام، احترامًا لحد12محاولة/room-client/minute؛ لا spoofed XFF أو تعديل ميزانية. عشرون مقعدًا لا تعني قبول عشرين محاولة في دقيقة من NAT واحد.

## إعادة التشغيل بأمان

داخل `qalba-platform`، npm ci وdb:generate لا يحتاجان DB إنتاج. للتوليد فقط يمكن استعمال placeholder غير قابل للوصول على port1؛ **لا تستعمله للمigrations**.

```sh
npm ci --no-audit --no-fund
npm run db:generate
npm run test -- --maxWorkers=1 --retry=0
node node_modules/next/dist/bin/next typegen
npm run typecheck
npm run lint
npm run build
# بعد التحقق من synthetic fixture جديدة، ومنفذ loopback، وهويةPG17 وصفرpublic tables:
E2E_NATIVE_PG17_FIXTURE=/private/outside-checkout/synthetic-environment.private.json \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
E2E_REPORT_FILE=/private/outside-checkout/playwright.json \
npm run test:e2e:db -- \
  tests/e2e/category-board-beta-journey.spec.ts \
  tests/e2e/category-board-capacity.spec.ts \
  tests/e2e/category-board-full-journey.spec.ts \
  tests/e2e/category-board.spec.ts tests/e2e/rooms.spec.ts tests/e2e/board-hardening.spec.ts \
  --retries=0 --output=/private/outside-checkout/test-results
# DATABASE_URL في عملية مستقلة يأتي فقط من fixture نفسها بعد التحقق، لا من البيئة الموروثة:
npm run content:validate -- --output /private/outside-checkout/content-audit.json
```

ملف fixture0600 داخل مجلد0700 خارج checkout. حقوله: `formatVersion:1`, `synthetic:true`, `purpose:"quddam-pr17-category-board"`, `fixtureId`48hex، `expectedDatabase` و`expectedUser` يبدأانquddam_pr17_، `expectedPort` loopback الفعلي، `expectedSystemIdentifier` منpg_control_system، و`databaseUrl` للاعتماد الاصطناعي فقط، literal127.0.0.1 مع `?sslmode=disable` دون host override. أنشئ قاعدة/مستخدمًا وحاوية PG17 **جديدة** بمعرف عشوائي، وافحص current_database/current_user/server_version/system identifier وصفر public tables قبل التهيئة؛ لا تحول قاعدة قائمة إلى fixture. لا تُنشر قيم الاعتماد. إعادة الاستخدام فقط بعد نجاح التهيئة مع `E2E_NATIVE_PG17_REUSE=1`؛ لا تعاود seed ولا reset.

خادم الاختبار يربط127.0.0.1 فقط، والمنفذ3000 يجب أن يكون فارغًا. لا يُشغّل server عام ولا يحاول تجاوز رفض سياسة تنفيذ. تستخدم جلسة الاختبار secret اصطناعيًا لميزانياتها، ولا تُمرّر merchant/mail/production credentials. PG17 pool10 في الوضع الأصلي يسمح بالتنازع الفعلي؛ PGlite يبقىpool1. المقارنة final مصدرية قبل/بعد تشمل scripts/tests نفسها. يبقى `next-env.d.ts` محفوظًا: لا يستعاد إلا التحويل المعروف لمساري .next/dev/types إلى .next/types، وتجهّز typegen declarations وفق CI دون تعطيل الفحص.

## الملفات والحدود

- `src/components/room-live.tsx`, `room-host-panel.tsx`, `room-view-order.ts`: ترتيب العرض وهوية snapshot وانتهاء الوصول؛ `room-live.test.tsx` يثبت Regression.
- `src/components/board-host.tsx`: حارس snapshot المضيف؛ Regression عبر HTTP في full-journey.
- `src/lib/rooms/service.ts`: ربط join retry بالمقعد الموجود داخل القفل، دون token rotation أو مقعد إضافي.
- `scripts/e2e-with-db.mjs`, `e2e-native-postgres.mjs`, `e2e-native-postgres.test.mjs`: PG17 آمن، isolated funding عبر السياسة القائمة، concurrency pool، وفحوص الحارس.
- `playwright.config.ts`: loopback صريح فقط.
- `tests/e2e/category-board-acceptance-helpers.ts`, `category-board-capacity.spec.ts`, `category-board-full-journey.spec.ts`: قبول أصلي، geometry، SQL read-only inspection وحواجز أقفال لا تعدل النقاط أو النتائج، وردود أصلية مؤجلة.
- `prisma/core-content.ts`, `tests/content/content-validation.test.ts`، ومراجعة المحتوى وهذا التقرير: التعريفان المصححان، تغطية المخزون، والأدلة.

لا تغيير package/lock أو prices أو billing/credit implementation أو Prisma schema أو migration قديمة أو محركات الألعاب أو CI security gates أو أدلة RG03. لا دمج PR #16/#17 أو main ولا P2P/WebRTC أو نشر أو موارد Oracle/مدفوعة أو دفع حي. كل البيانات اصطناعية. **التكلفة الخارجية الجديدة$0.**

يبقى NOT RUN: أجهزة LAN فعلية، NAT مختلف، camera scan على هاتف، ARM64 فعلي، production launcher/HTTPS/public deployment، load/soak طويل ونسخ/استرداد، ودمج PR #9. روابط الغرفة قابلة للمشاركة، والاسم/الـCookie ليسا هوية بشرية موثقة؛ فقدان الـCookie بالكامل لا يسمح باسترداد سلطة بالاسم. لا تدّعي الاختبارات حماية Sybil أو حكمًا تنافسيًا محايدًا. دعم تصوير QR مستقل هنا يفك الصورة الفعلية؛ لا يعادل اختبار كاميرا/شبكة هاتف.

تطبيق تحريري السؤالين على مخزون قاعدة قائمة يحتاج إجراء محتوى مدققًا منفصلًا؛ seed يحافظ على الصفوف والتاريخ. وتبقى تنبيهات التطوير في PR #16، وtemporal abuse budgets/قرارات الخصوصية والاحتفاظ/التكامل الشبكي وPENDING-hold disposition والمراقبة والتحقق التجاري وبوابات successor release من متطلبات المنصة المفتوحة. نتيجة CI مالي لاحق على هذا الرأس توثق نطاقه وجرد المصدر فقط، ولا تحوّل GAME_READY المحلي إلى اعتماد إطلاق خارجي.
