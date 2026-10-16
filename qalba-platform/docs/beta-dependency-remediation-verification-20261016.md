# Quddam — PR #16: dependency remediation verification

**PARTIAL: تدقيق الإنتاج أُغلق في الفحص الجديد، لكن التدقيق الكامل ما زال يفشل. لا موافقة دمج أو Beta خارجية أو نشر.** هذا التصحيح للمرحلة الأولى من معالجة الاعتماديات فقط؛ لا يطبق rate limiter أو سياسة حذف أو تكامل غرف جديدًا.

## المصدر والهوية

- المستودع: `7assan-0/quddam`؛ الفرع `beta/blocker-remediation-20261016`؛ [Draft PR #16](https://github.com/7assan-0/quddam/pull/16).
- الرأس الفعلي عند البدء: `6eddd6336c9688d4df2bf493b7c973b0166ae53b`، فوق PR #13 عند `ceda2b45671db560f887df836367edcb4da2788f`.
- **SHA النهائي الحرفي، جرد المصدر ونتائج إعادة التشغيل عليه:** في [تصريح أدلة PR #16](https://github.com/7assan-0/quddam/pull/16#issuecomment-6218968011). ملف داخل commit لا يستطيع تضمين SHA ذلك commit دون تغيير بصمته؛ يحسم التصريح الخارجي هوية الرأس الذي يحتوي هذا التقرير.
- نتائج PR #13 وRC التاريخية ليست دليلًا على الاعتماديات الجديدة. الفحوص الأولى تحمل `sourceDirty: true`، ثم يعاد التحقق على رأس ملتزم نظيف باستخدام `ci/financial-review/source-binding.py` قبل التشغيل وبعده، بمقارنة Git objects والبايتات والأوضاع حرفيًا؛ لا يكفي Git status.
- السجلات الخام وملفات الاعتماد الاصطناعية خارج Git بصلاحيات مقيدة. تنشر ملخصات منقحة فقط؛ لا cookies أو raw invite URLs أو بيانات أجوبة أو database URLs في الأدلة العامة.

## التغيير المحدود وأسبابه

| الحزمة/القيد | قبل | بعد | السبب |
| --- | --- | --- | --- |
| `next`, `@next/env`, `eslint-config-next` | `16.3.6` | `16.4.2` معًا | إغلاق تنبيهات Next المحددة مع اتساق عائلة الإطار |
| `vitest` وعائلة `@vitest/*` | `4.0.4` | `4.1.12` | إغلاق تنبيه UI الحرج وتنبيه mocker؛ لم يُشغل UI/watch server |
| `source-map-js` الانتقالي | `1.2.1` | `1.2.2` | تحديث متوافق داخل نطاقات المستهلكين؛ دون إضافة اعتماد إنتاج مباشر أو override له |
| `postcss` التطويري المباشر | `8.5.6` | `8.5.30` | تصحيح patch ضمن `8.5.x` لأربعة تنبيهات قائمة، دون ترقية Tailwind |
| `overrides.vitest.vite` | غير محدد؛ الجرد السابق Vite `7.3.6` | محصور تحت Vitest إلى `7.3.6` | npm اختار Vite 8 تلقائيًا؛ يمنع القيد انتقالًا جانبيًا إلى Rolldown/LightningCSS ويحافظ على سلسلة Vite 7 المتوافقة مع Vitest الجديد |

لا تغيير في إصدارات React أو ESLint أو Tailwind أو TypeScript الرئيسية. بقي ESLint `9.38.0` وTailwind `3.4.18` وTypeScript `5.9.3`. تحديث Rollup `4.63.5 → 4.64.7` ضمن نطاق Vite المنشور، وتغييرات `es-module-lexer` و`tinyexec` و`std-env` متطلبات انتقالية معلنة لـVitest الجديد. لا `npm audit fix --force` ولا override شامل لإسكات التدقيق.

فحص مستقل من registry أكد إصدارات/integrity الحزم الثماني المستهدفة. وثائق Next المثبتة الجديدة الخاصة بـroute handlers وproxy وImageResponse لا تتطلب تعديل API هنا؛ لم يتغير مصدر التطبيق لتجاوز اختبار.

## التدقيق: ما أُغلق وما بقي

| الفحص الفعلي | قبل: Exit/العقد | بعد: Exit/العقد |
| --- | --- | --- |
| `npm audit --omit=dev --json` | **1**؛ 2 High، صفر Critical | **0**؛ صفر تنبيهات |
| `npm audit --json` | **1**؛ 14 عقدة: 1 Critical، 10 High، 3 Moderate | **1**؛ 9 عقد: 7 High، 2 Moderate، صفر Critical |

الأعداد **عقد حزم متأثرة**، وليست عدد CVEs مستقلة. تقلصت روابط GHSA المتميزة من 15 إلى 2 في جرد التدقيق: اختفت 13 وصلة تخص Next/Vitest/mocker/source maps/PostCSS. هذا يثبت الخروج من نطاقات التنبيهات التي أعادها التدقيق وقت التنفيذ، ولا يثبت غياب كل ثغرة مستقبلية أو استغلال جميع المسارات في التطبيق.

المتبقي:

1. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) عبر `braces@3.0.3`. أحدث 3.x منشور وقت الفحص ما زال متأثرًا؛ لا إصلاح متوافق منشور يمكن ادعاء تطبيقه.
2. [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) عبر `postcss-selector-parser`؛ الإصدار الآمن `7.1.6` يتجاوز نطاقات Tailwind 3 وpostcss-nested 6 الحالية.

العقد التسع: `@next/eslint-plugin-next`, `braces`, `chokidar`, `eslint-config-next`, `fast-glob`, `micromatch`, `postcss-nested`, `postcss-selector-parser`, `tailwindcss`. بقاء تنبيه في ESLint الخاص بـNext عبر glob لا يعني بقاء تنبيهات Next الإنتاجية الست نفسها. لا ترقية Tailwind رئيسية أو downgrade لـNext/ESLint ولا تعطيل audit gate ضمن هذا التصحيح. يحتاج المتبقي حلًا upstream أو معالجة/ترقية منفصلة مراجعة؛ لا يكفي وصفه بأنه اعتماد تطوير لقبول المخاطرة.

## أوامر التحديث والتحقق

الأوامر نُفذت داخل `qalba-platform`، مع تسجيل Exit مستقل لكل أمر. حفظت package.json وpackage-lock.json معًا، وأعيد تثبيت القفل من الصفر.

```sh
npm ci --no-audit --no-fund
npm audit --omit=dev --json
npm audit --json
npm install --save-exact next@16.4.2 @next/env@16.4.2 --no-audit --no-fund
npm install --save-dev --save-exact eslint-config-next@16.4.2 vitest@4.1.12 --no-audit --no-fund
npm update source-map-js --no-audit --no-fund
npm install --save-dev --save-exact postcss@8.5.30 --no-audit --no-fund
# إضافة القيد المحصور overrides.vitest.vite=7.3.6 إلى manifest، ثم تحديث الفرع نفسه:
npm install --save-dev --save-exact vitest@4.1.12 --no-audit --no-fund
npm ci --no-audit --no-fund
npm ls --all --json
npm run db:generate
npm run test -- --maxWorkers=1 --retry=0
node node_modules/next/dist/bin/next typegen
npm run typecheck
npm run lint
npm run build
```

`next typegen` يتبع تسلسل CI الموجود: نسخ `routes.d.ts` و`root-params.d.ts` المولدين إلى `.next/dev/types` اللازمة للإعلان الملتزم، واستعادة `next-env.d.ts` من التحويل المعروف لمساري import فقط. لا تغيير لإعلانات المصدر أو تعطيل فحص TypeScript. إعادة `npm ci` ضرورية: مجرد إضافة override مع تحديث lock دون إعادة حل Vitest يمكن أن يترك Vite 8 غير صالح رغم Exit 0؛ فُحصت شجرة الإصدارات الفعلية بعد ذلك.

`npm ls --all --json` يرجع **Exit 0 مع تحذيري extraneous** لـ`@img/sharp-wasm32@0.35.5` و`@emnapi/runtime@1.11.3`. أُعيد إنتاج التحذيرين على القفل الأصلي في تثبيت نظيف مع `--ignore-scripts`؛ الحزمتان موجودتان أصلًا في lockfile وبصماتهما لم تتغير. يحذف npm أغلفة المنصات غير المناسبة ويترك أبناءها الاختياريين المحوّلين إلى مستوى أعلى. لا install script في Sharp يفسر تنزيلًا جانبيًا. نجح smoke PNG أصلي على Linux دون تحميل WASM/Emnapi. لم تُخف التحذيرات أو تُحذف الحزم يدويًا، ولا يُدّعى أن الجرد خالٍ من التحذيرات.

## البيئة ونتائج التشغيل

Node `24.19.0`، npm `11.9.0`، PostgreSQL `17.11`، Chrome الحقيقي `155.0.8059.79`. قاعدة **جديدة ومعزولة** على loopback `127.0.0.1:56546`؛ تم فحص هوية الخادم والقاعدة وصفر جداول قبل أول migration، ثم تطبيق **27 migration** وزرع بيانات اصطناعية مرة واحدة فقط. لا إنتاج أو بيانات عملاء أو credentials تاجر. قاعدة الاختبار السابقة وStudio على 5555 لم يُمسّا.

| البوابة | النتيجة المثبتة في الفحص الأول | إعادة الرأس النهائي |
| --- | --- | --- |
| clean install / Prisma generate | Exit 0 /0 | يحسمها تصريح SHA |
| تدقيق الإنتاج / الكامل | Exit 0 /1؛ 0 /9 عقد | يحسمها التصريح؛ التدقيق الكامل غير ناجح |
| Full Vitest | 1480 ناجحًا، صفر فشل/تجاوز، 89 ملفًا، retries=0، كل ملفات الاختبار المتتبعة المكتشفة نُفذت | يحسمها التصريح |
| TypeScript / Lint / Build | Exit 0 لكل أمر | يحسمها التصريح |
| native Shillatak PG17 | 24/24، ثمانية حواجز تنازع فعلية | يحسمها التصريح |
| native Night invitations PG17 | 18/18، ترتيبَا START↔RSVP | يحسمها التصريح |
| Chrome Night / Shillatak / Site | **54/54، 49/49، 83/83**؛ Exit 0 لكل process، Chrome فعلي لا mocks للنتائج | تعاد على الرأس النهائي؛ النتائج في التصريح، دون وراثة PR #13 |
| restart / flags | **37/37، Exit 0**؛ خمس عمليات built Next، خمس إيقافات graceful، صفر forced | تعاد على الرأس النهائي؛ لا تُخفف حالات 404 أو شروط حفظ البيانات |

أعيد native وChrome وrestart على الالتزام النظيف `0cdc1ffac7699513caab1237287456e083980388` قبل تحديث هذا التقرير؛ لا يمثل ذلك وحده نتيجة الرأس الذي يحتوي تحديث التقرير. طابقت المقارنة الحرفية قبل/بعد كل بوابة **882 ملفًا**، ببصمة `0a11a5be6c601d5449b8b0a34fb68267da936c1ed0f48283107ddf5aa4f27b53`. تثبيت الحزم وVitest وTypeScript وLint وBuild الأولي كان على ملفات الحزم الجديدة أثناء العمل غير الملتزم؛ إعادة المجموعة النظيفة على SHA التقرير النهائي إلزامية ونتيجتها في التصريح الخارجي.

الفحصان الأصليان شاهدا 3 PostgreSQL backends مستقلة وطلبين ينتظران لكل حاجز قفل. الشلّة لا تضيف خصمًا؛ أربع سهرات أصلية في native تثبت **12 START debit فقط**. التكرار في ATTACH للمجموعة نفسها ينجح بأثر واحد؛ تنازع مجموعتين على السهرة نفسها يقبل واحدة. لا تعديل trigger أو سجلات النتائج غير القابلة للتغيير.

تُشغّل سكربتات القبول الملتزم بها بمتغيرات `NIGHT_MVP_SYNTHETIC=1`، وملف بيئة خاص 0600 خارج Git، وoutput جديد خارج checkout، وعلمي Night/Shillatak في عملية الاختبار فقط:

```sh
node --import tsx scripts/night-phase4-postgres.ts
node --import tsx scripts/beta-shillatak-postgres.ts
node scripts/night-phase4-chrome.mjs
node scripts/beta-shillatak-chrome.mjs
node scripts/beta-site-chrome.mjs
node --import tsx scripts/beta-restart.ts
```

Night Chrome يقرأ حالات native الحالية؛ Shillatak Chrome يقرأ رحلة Night ناجحة من **SHA نفسه**؛ restart يرفض مصدرًا غير مطابق أو منفذًا مشغولًا. تبقى Secure cookies وSame-Origin وخصوصية headers وstrict feature-off 404 مفعلة. اختبار فقدان الرد يحوّل POST حقيقيًا إلى الخادم ثم يقطع الرد؛ لا نتائج backend مصطنعة. روجعت بطاقتا PNG الفعليتان بصريًا: بطل 9–6 وتعادل 8–8، نص عربي مقروء بالخط المحلي وترتيب صحيح دون قص؛ وتكرر المراجعة للأثر النهائي. ليست الصور الموروثة من PR #13 دليلًا لهذا التحديث.

لا يُدّعى خلو browser logs من كل رسالة: رُصدت ردود الرفض المقصودة 400/403/404/409، وconnection reset الخاص باختبار فقدان الرد، وطلبات RSC/event-stream/API أُلغيت عند التنقل. حُفظت فئاتها وأعدادها في الإيصالات الخاصة؛ صفر page exceptions أو hydration errors أو أخطاء غير مصنفة أو طلبات خارج origin في هذه الرحلات. restart شاهد 71 رسالة 404 متوقعة و122 ERR_ABORTED؛ ليس ذلك قياسًا لشبكات LAN/NAT أو للأداء. بقي snapshot قاعدة البيانات ثابتًا، دون POST ناجح خلال restart.

## CI والحدود المتبقية

بوابة `.github/workflows/beta-dependency-security.yml` بقيت دون تخفيف: `npm audit --audit-level=moderate` ما زال يفشل عند بقاء عقد التطوير التسع، وتتوقف الخطوات التابعة بعده. لا continue-on-error أو تغيير threshold أو استثناء حزمة. checkout الافتراضي فيها هو سياق merge الخاص بالـPR؛ لا ننسب ذلك تلقائيًا إلى literal PR head.

الـworkflow المالي المستقل يفحص PR head الحرفي ويصدر جرد مصدر؛ نتيجته المستضافة وأكواد الخروج تُسجل في التصريح عند اكتمالها، مع مطابقة جرد الملفات المحلي حرفيًا. PostgreSQL المالي المستضاف 16.15 مستقل عن قبول ميزات PostgreSQL 17.11 المحلي. يعاد كذلك db:migrate بصورة idempotent بعد التحقق من هوية قاعدة الاختبار، وتطابق checksums جميع ملفات migration مع الصفوف الـ27؛ لا تغيير schema أو إعادة seed. فحوص PG17 وChrome المذكورة محلية؛ نجاح CI المالي لا يغلق بوابة التدقيق الكامل أو يكمل اعتماد Beta/Release.

NOT RUN: استغلال أمني لكل تنبيه، LAN/NAT مختلفان، مصدر غرف/Night مدمج، ساعة اتصال حقيقية، ARM64 فعلي، ست ألعاب أخرى كاملة، نشر/HTTPS/launcher إنتاج وload/recovery وبيانات/تاجر حقيقي. لا يتوسع هذا التصحيح إلى phases التالية. اتجاه المشاركة المعتمد في وثيقة PR #16 يبقى قرار منتج لم يُنفذ هنا.

المتبقي قبل Beta خارجية: تنبيهات التطوير، تطبيق حدود طلبات زمنية ذرية بعد اعتماد ميزانياتها، سياسات الاحتفاظ/الحذف/التصدير/نقل الملكية وتنقيح logs، تكامل الغرف وفق العقد المعتمد واختبارات الشبكات، وآلية PENDING-hold مدققة ومراقبة/تنبيه وتحقق تاجر وبوابات successor release. لا تصف إغلاق تدقيق الإنتاج بإغلاق هذه المتطلبات.

## الملفات والنطاق

- `package.json`: الإصدارات الخمسة والقيد المحصور لـVite؛ دون اعتماد إنتاج إضافي.
- `package-lock.json`: الإصدارات المحلولة وintegrity والشجرة الانتقالية المتوافقة.
- هذا التقرير: النتائج والمخاطر وسبب كل تغيير ومكان الإيصال النهائي.

مصدر التطبيق والدفع والأسعار ومحركات الألعاب وschema وmigrations وCI security gates وأدلة RC التاريخية لم تتغير في هذا التصحيح. الفرع وPR #16 فقط؛ لا دمج أو نشر أو موارد سحابية أو دفع حي. **التكلفة الخارجية الجديدة $0.**
