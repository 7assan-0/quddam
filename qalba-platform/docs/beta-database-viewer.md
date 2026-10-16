# عارض قاعدة بيانات Beta المحلي

هذا العارض مخصص لبيانات اختبار اصطناعية داخل بيئة التطوير الحالية. لم يتصل بقاعدة إنتاج، ولم يُعدّل أي سجل حقيقي أو قاعدة اختبار سابقة.

## الفتح والعزل

الرابط المحلي: **http://localhost:5555**، ويعمل أيضًا **http://127.0.0.1:5555** داخل بيئة التطوير السحابية الحالية. لا يشير `localhost` هنا إلى جهاز صاحب المشروع، ولم نفتح نفقًا عامًا أو مستمعًا على واجهة الشبكة. فتحه من جهاز آخر يحتاج مسار وصول مستقلًا يراجعه المالك.

- PostgreSQL **17.11** في الحاوية المحلية المخصصة `quddam-beta-t7ffn653`.
- الاتصال بقاعدة الاختبار الجديدة `night_mvp_beta_t7ffn653` على `127.0.0.1:56545` فقط.
- أُعيد فحص اسم القاعدة، وإصدار الخادم، وخلو المخطط العام من الجداول مباشرة قبل تنفيذ `npm run db:migrate`؛ نجح تطبيق **27 migration** ثم إنشاء fixtures اصطناعية مرة واحدة.
- Prisma CLI **7.10.0** يستخدم إعداد المشروع `prisma.config.ts`. خيار Studio الفعلي هو `studio --port 5555 --browser none`؛ هذه النسخة لا تعرض خيار `--hostname`. فُحص تنفيذها وتحقق المستمع الفعلي من الربط بـ`127.0.0.1` فقط.
- عنوان قاعدة البيانات وكلمات المرور خارج Git، في ملفات خاصة بصلاحية `0600` داخل مجلد أدلة بصلاحية `0700`. لا تُنسخ قيمها إلى الأوامر أو التقرير.

## صلاحيات القراءة الفعلية

واجهة Prisma Studio العامة تسمح بالتحرير، وقد يظهر زر **Insert row**. إخفاء هذا الزر ليس وسيلة الحماية هنا: يستخدم Studio دور PostgreSQL مستقلًا اسمه `quddam_beta_viewer`، بصلاحية `SELECT` فقط على جداول قاعدة الاختبار، دون `INSERT/UPDATE/DELETE` أو إنشاء مخططات/جداول أو جداول مؤقتة أو تولي دور التطبيق. يستخدم التطبيق حساب الاختبار الخاص به بصورة منفصلة.

أُضيف `default_transaction_read_only=on` كحاجز إضافي، ثم اختُبرت صلاحيات الدور **بعد تعطيل هذا الإعداد داخل جلسة الاختبار**: رُفضت أوامر `INSERT/UPDATE/DELETE` ومحاولات إنشاء الجداول وتولي دور المالك، جميعها بـ`SQLSTATE 42501`. استُخدمت شروط `WHERE false` حتى لا تغيّر محاولات الاختبار أي سجل. ليس لهذا الدور صلاحيات superuser أو إنشاء قواعد/أدوار أو replication أو تجاوز RLS. لا توجد دوال `SECURITY DEFINER` في مخطط التطبيق العام.

لا تضبط Studio على عنوان اتصال التطبيق الواسع، ولا تستخدم معه عنوان قاعدة إنتاج. Studio نفسه ليس صفحة من التطبيق ولا يطلب تسجيل الدخول بحساب قدّام؛ يظل محليًا، ويجب ألا يُنشر أو يُتاح للعامة.

## نتائج التحقق المنفذة

- **10/10** تحققات PostgreSQL مباشرة: هوية القاعدة والدور، قراءة الجداول، غياب صلاحيات الكتابة، ورفض الكتابة/DDL/تصعيد الدور فعليًا.
- **10/10** تحققات HTTP حقيقية، تشمل ترويسة CSP المخصصة: تحميل HTML وJS وCSS، تنفيذ `SELECT` من BFF بهوية الدور المحدود، قراءة جدول شلّتك، رفض `UPDATE`، رفض الكتابة بعد تعطيل read-only داخل transaction، ورفض `Origin` خارجي في GET وPOST.
- **7/7** تحققات Chrome **155.0.8059.79** حقيقية: فتح Studio، قراءة قائمة الجداول، فتح جدول `Product` الفارغ، ظهور زر `Insert row` مع بقاء المنع من PostgreSQL، فرض CSP على محاولة telemetry، فحص الحمولة المحظورة دون نشر قيمها، وصفر أخطاء JavaScript من نوع `pageerror`.
- روجعت لقطة جدول المنتجات الفارغ بصريًا؛ تحتوي أسماء الأعمدة وقائمة الجداول فقط، ولا تحتوي صفوف حسابات أو كلمات مرور أو tokens.

## خصوصية أداة Studio

كشف التشغيل الأول في Chrome محاولة اتصال launch telemetry من حزمة Studio إلى `checkpoint.prisma.io`. المتغير الرسمي `CHECKPOINT_DISABLE=1` يمنع checkpoint في عملية CLI، لكنه لا يكفي وحده لعميل Studio المضمّن في هذه النسخة. لا نصف الإعداد الافتراضي بأنه خالٍ من telemetry.

أُعيد تشغيل **عملية Studio المحلية المملوكة لهذه المهمة فقط** باستخدام preload خارجي خاص بالعارض، يضيف ترويسة:

```http
Content-Security-Policy: connect-src 'self'
```

هذا **إعداد خصوصية مخصص لهذه الجلسة**، وليس ميزة افتراضية في Prisma Studio. لم يُعدّل التطبيق أو `node_modules` أو إعدادات TLS أو proxy أو Firewall أو مخازن الثقة أو سياسة الشبكة. يقتصر الـpreload على عملية Studio والمنفذ `5555`. يظل `CHECKPOINT_DISABLE=1` مفعلًا لحاجز CLI أيضًا.

الملف الخارجي بصلاحية `0600`:

`/tmp/quddam-beta-t7ffn653/studio-private-connect.cjs`

SHA-256:

`16f9cd50e0a0fc4ab1067d0b5d7150189cd3a5181a3f6c155122be6d4555e37e`

محتوى الـpreload للمراجعة وإعادة إنشائه خارج Git بصلاحية `0600` عند الحاجة؛ يجب أن تطابق بايتاته البصمة أعلاه:

```javascript
"use strict";
// External, viewer-only process configuration. No application/dependency edits.
const assert = require("node:assert/strict");
const http = require("node:http");
assert.ok(process.argv.includes("studio"), "Viewer preload only supports Prisma Studio");
const portIndex = process.argv.indexOf("--port");
assert.equal(process.argv[portIndex + 1], "5555", "Viewer preload restricted to owned loopback port");
const createServer = http.createServer;
http.createServer = function (...args) {
  const server = Reflect.apply(createServer, this, args);
  server.prependListener("request", (request, response) => {
    if (request.socket.localPort === 5555) {
      response.setHeader("Content-Security-Policy", "connect-src 'self'");
    }
  });
  return server;
};
```

أثبت Chrome حدث `securitypolicyviolation` فعليًا، بالتوجيه `connect-src` والحالة `enforce` للمضيف المذكور. حُظرت محاولة telemetry **قبل أحداث طلب الشبكة في Playwright**: صفر طلبات خارجية مرصودة في أحداث الشبكة، وصفر استجابات خارجية مسموحة، وحدث حظر CSP واحد. لم يُصدر هذا التشغيل رمز `ERR_BLOCKED_BY_CSP` من `requestfailed`، لذلك لا ننسب إليه رمز خطأ لم يظهر. تحذير CSP المتوقع ليس خطأ JavaScript في التطبيق.

اقتصر فحص الحمولة المحظورة المنشور على أسماء المفاتيح: `information` يضم `eventPayload` و`variant`؛ و`eventPayload` يضم `tableCount`. قورنت الحمولة في الذاكرة مع **12** قيمة خاصة من ملفات الاختبار، ولم تطابق أيًا منها؛ لم تُطبع القيم أو الرابط الخام. لا يثبت ذلك مراجعة جميع سلوكيات كل إصدارات Studio المستقبلية. يجب إعادة التحقق عند تحديث CLI أو استخدام إعداد آخر.

## أهم الجداول والعلاقات

| المجال | الجداول | المعنى والعلاقة |
| --- | --- | --- |
| الحسابات | `User`, `AuthSession`, `ExternalAccount`, `PasswordReset` | المستخدم أصل الحساب، والجلسات تشير إليه وتخزن بصمات الرموز. لا تشارك صور صفوف كلمات المرور أو بصمات الاعتمادات. |
| كتالوج الألعاب والمحتوى | `GameType`, `Category` وجداول الأسئلة والإجابات الخاصة بكل لعبة | تحتفظ المحركات الأصلية بمحتواها وقواعدها. تحتوي هذه القاعدة على محتوى قبول اصطناعي فقط. |
| جلسة لعبة | `GameSession`, `Team`, `Player`, `GameRound`, `ScoreEvent`, `GameCommand` | جلسة يملكها منظّم، وتتبعه الفرق واللاعبون والجولات؛ مفاتيح الأوامر تمنع تكرار تنفيذ الأمر. |
| الغرف الحالية | `Room`, `RoomParticipant`, `RoomVote` | ترتبط الغرفة بالمنظّم وبجلسة لعبة اختيارية. وجود هذه الجداول لا يثبت دمج مسار WebRTC التجريبي المنفصل في PR #9. |
| الرصيد والمدفوعات | `CreditWallet`, `GameCredit`, `Product`, `Purchase`, `PaymentEvent`, `PurchaseRefund` | مُنحت fixtures أرصدة اصطناعية بأمر المنح الإداري المعتاد. فتح العارض لا يمنح إذنًا لتعديل الأسعار أو الدفع أو أرصدة العملاء. |
| ليلة قدّام | `NightSession`, `NightGame`, `NightCommand` | السهرة تضم الألعاب الثلاث؛ ترتبط `NightGame` بجلسة المحرك الأصلي وبإيصال النتيجة المعتمدة وبصمتها؛ أوامر السهرة ذات إصدار ومفاتيح تكرار. |
| دعوات السهرة | `NightInvitation`, `NightInviteGuest` | دعوة واحدة ببصمة للرابط، وصلاحية RSVP منفصلة ببصمة، واسم مطبّع وتصويت استشاري. اسم الضيف هنا ليس حساب موقع أو عضوية شلّة أو صلاحية إدارة. |
| شلّتك | `Shilla`, `ShillaMembership`, `ShillaTeam` | مالك الشلّة حساب `User`؛ العضوية مرتبطة بحساب موقع، لا باسم RSVP؛ للفرق مواضع ثابتة. الأرشفة حالة ولا تعني اعتماد سياسة حذف. |
| دعوة العضوية | `ShillaInvite` | بصمة رمز، وانتهاء، وإلغاء، واستهلاك لمرة واحدة؛ اختبار التزامن الأصلي موثق في تقرير قبول شلّتك. |
| لوحة الشرف الخاصة | `ShillaNight` | ربط فريد للسهرة مع snapshot موثق وبصمة المصدر؛ لا يجوز احتساب السهرة نفسها في أكثر من شلّة. |

## التوقف وإعادة الفتح

احتُفظ بالحاوية وبياناتها وبعملية Studio لهذا العارض. إذا توقفت العملية لاحقًا، تحقق أولًا من أن المنفذ `5555` غير مستخدم وأن حاوية الاختبار نفسها ما زالت مملوكة لهذه المهمة. لا توقف عملية أخرى ولا تُعد تشغيل Docker daemon.

ملف اتصال العارض الخاص بهذه الجلسة هو:

`/tmp/quddam-beta-t7ffn653/studio-environment.private.json`

اقرأه برمجيًا دون طباعته، وتحقق قبل أي تشغيل من `postgresql` و`127.0.0.1` والمنفذ `56545` واسم قاعدة الاختبار ودور `quddam_beta_viewer`. مرّر `DATABASE_URL` في بيئة عملية Prisma فقط، لا كوسيط `--url` ظاهر في قائمة العمليات. استخدم إعداد المشروع و`--browser none` مع preload الخصوصية نفسه، وأعد فحص المستمع وترويسة CSP وصلاحيات PostgreSQL وواجهة HTTP بعد التشغيل. لا تنفذ migration أو seed لإعادة فتح العارض على القاعدة الموجودة.

مثال إعادة تشغيل في المقدمة، **بعد توقف عملية Studio الخاصة بهذه المهمة وتحرر المنفذ فقط**، ومن داخل `qalba-platform`:

```bash
python3 - <<'PY_STUDIO'
import hashlib, json, os, socket
from pathlib import Path
from urllib.parse import urlsplit

root = Path("/tmp/quddam-beta-t7ffn653")
config = root / "studio-environment.private.json"
assert config.stat().st_mode & 0o077 == 0
url = json.loads(config.read_text())["DATABASE_URL"]
u = urlsplit(url)
assert (u.scheme, u.hostname, u.port, u.path, u.username) == (
    "postgresql", "127.0.0.1", 56545,
    "/night_mvp_beta_t7ffn653", "quddam_beta_viewer",
)
helper = root / "studio-private-connect.cjs"
assert helper.stat().st_mode & 0o077 == 0
assert hashlib.sha256(helper.read_bytes()).hexdigest() == (
    "16f9cd50e0a0fc4ab1067d0b5d7150189cd3a5181a3f6c155122be6d4555e37e"
)
with socket.socket() as probe:
    probe.bind(("127.0.0.1", 5555))
env = os.environ.copy()  # Preserve configured proxy and CA trust.
env.update(DATABASE_URL=url, CHECKPOINT_DISABLE="1",
           PRISMA_HIDE_UPDATE_MESSAGE="1")
os.execvpe("node", ["node", "--require", str(helper),
    "node_modules/prisma/build/index.js", "studio", "--port", "5555",
    "--browser", "none"], env)
PY_STUDIO
```

لا يتضمن المثال كلمة مرور في argv، ويرفض هوية قاعدة أو دور أو helper مختلفة. لا توقف عملية مجهولة لتحرير المنفذ. أوقف هذا التشغيل الأمامي بـ`Ctrl+C` عند انتهاء الحاجة؛ لا تحذف قاعدة البيانات أو مجلد بياناتها.

إذا انتهت بيئة التطوير أو فُقدت الملفات الخاصة، أنشئ قاعدة اختبار جديدة ومعزولة وأعد إعداد الدور والبيانات الاصطناعية؛ لا تستخدم اتصالًا قديمًا مفترضًا ولا قاعدة موجودة لتجاوز الحارس.

سياسات الاحتفاظ والحذف النهائي ونقل ملكية الشلّة تظل قرارات وتنفيذًا منفصلين يتطلبان موافقة المالك. التكلفة الخارجية الجديدة لهذا الإعداد **$0**.
