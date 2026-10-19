/** Rebuilds only the isolated review HTML from its typed candidate manifest. */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { visualRebusPilot } = require("../../../prisma/board-expansion/visual-rebus-pilot.ts") as typeof import("../../../prisma/board-expansion/visual-rebus-pilot");

const payload = JSON.stringify(visualRebusPilot).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>خمن الصورة · تجربة مراجعة أصلية</title>
<style>
:root{color-scheme:light;--ink:#203442;--muted:#566773;--paper:#f6f4ed;--card:#fffef9;--line:#d7dedb;--accent:#b44729;--navy:#213d49;--soft:#edf2ee}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.7}button{font:inherit;cursor:pointer;min-height:44px;min-width:44px;border-radius:10px;border:1px solid #899b9c;padding:9px 16px;background:white;color:var(--ink)}button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}button[aria-pressed=true]{background:var(--navy);color:white;border-color:var(--navy)}[hidden]{display:none!important}
.wrap{max-width:1160px;margin:auto;padding:30px 22px 64px}.mast{border-bottom:1px solid #b8c6c3;padding-bottom:24px;margin-bottom:28px}.eyebrow{font-size:13px;letter-spacing:.08em;color:var(--accent);font-weight:bold}.mast h1{font-size:clamp(30px,5vw,48px);line-height:1.3;margin:10px 0}.mast p{margin:6px 0;max-width:830px}.sub{color:var(--muted)}.controls{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 12px}.count{display:inline-flex;gap:10px;align-items:center;font-size:13px;background:#f9e9d8;border:1px solid #e7c6a7;border-radius:8px;padding:5px 10px}.instructions{font-size:14px;margin:16px 0 0;color:var(--muted)}#mode-status{font-size:14px;color:var(--muted);min-height:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.card{border:1px solid var(--line);border-radius:18px;background:var(--card);overflow:hidden;box-shadow:0 4px 12px #20344206}.card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:15px 20px;border-bottom:1px solid var(--line)}.number{font-family:Arial,sans-serif;font-size:15px;color:var(--accent);font-weight:bold}.draft{font-size:12px;color:var(--muted)}.prompt{font-size:16px;font-weight:normal;margin:18px 20px 0;min-height:56px}.puzzle{display:flex;direction:rtl;align-items:center;justify-content:center;gap:8px;padding:18px 16px 24px;min-height:215px}.piece{margin:0;min-width:0;flex:1;text-align:center;max-width:205px}.piece img{display:block;width:100%;height:145px;object-fit:contain}.helper{font-size:13px;line-height:1.45;min-height:24px;margin-top:5px;color:#3b515c}.operation{display:inline-block;color:#8b2c20;background:#fbe7df;border:1px solid #ebc3b5;border-radius:7px;font-size:13px;padding:2px 7px;margin-top:4px}.plus{font-family:Arial,sans-serif;font-size:23px;color:#8a9c9c;flex:none}.text-piece{flex:0 0 auto;min-width:36px;font-size:28px;font-weight:bold;color:#6a4d37}.review{border-top:1px dashed #b4c5bf;margin:0 20px 20px;padding-top:18px;font-size:14px}.readings{color:var(--muted);margin:0 0 10px}.tier{background:var(--soft);padding:8px 10px;border-radius:8px;margin:0 0 12px}.answer{margin-top:13px;padding:12px 14px;background:#f5e9d4;border:1px solid #ddc396;border-radius:9px}.answer strong{display:block;font-size:22px;margin-bottom:8px}.answer p{margin:6px 0}.gates{color:#6a4735;font-size:12px;margin-top:13px}.footer{margin-top:28px;padding:20px 0;border-top:1px solid #b8c6c3;font-size:13px;color:var(--muted)}.footer p{margin:6px 0}
@media(max-width:730px){.grid{grid-template-columns:1fr}.wrap{padding:22px 14px 40px}.mast{padding-bottom:20px}.controls button{flex:1}.prompt{min-height:0}.puzzle{padding:15px 8px 20px;gap:4px;min-height:190px}.piece img{height:122px}.plus{font-size:19px}.text-piece{font-size:24px;min-width:28px}.card-head{padding:12px 16px}.helper{font-size:12px}.review{margin-inline:16px}}
@media(prefers-reduced-motion:no-preference){button{transition:background-color .15s,border-color .15s}}
</style>
</head>
<body><main class="wrap">
<header class="mast">
<div class="eyebrow">قدّام / معمل المحتوى / ٢٠ أكتوبر ٢٠٢٦</div>
<h1>الصورتان تفتحان كلمة.</h1>
<p>ثمانية ألغاز صور أصلية لتجربة الآلية ومراجعة الرسوم واللغة. ابدأ من <strong>اليمين إلى اليسار</strong>، وطبّق الحذف إذا ظهر تحت الرسم، ثم صل المقاطع وأضف المسافات اللازمة.</p>
<p class="sub">هذه عينة للمراجعة: لم تُعتمد للعب العام، ولم تُجرَ تجربة لاعبين أو معايرة صعوبة.</p>
<div class="controls" role="group" aria-label="طريقة المعاينة"><button id="play-mode" type="button" aria-pressed="true">معاينة اللعب</button><button id="review-mode" type="button" aria-pressed="false">وضع المراجع</button></div>
<div class="count">٨ نماذج من أصل بنك مستهدف من ٩٦ <span aria-hidden="true">·</span> ١٦ رسمًا متجهيًا أصليًا</div>
<p class="instructions">الكلمات المساعدة داخل بعض الألغاز جزء ظاهر من الصيغة المقترحة لتثبيت قراءة الرسم. زر وضع المراجع يتيح كشف الحل وسبب التركيب عمدًا.</p>
<div id="mode-status" role="status">معاينة اللعب: الحلول وملاحظات المراجع مخفية؛ الكلمات المساعدة جزء من اللغز.</div>
</header>
<div class="grid" id="cards"></div>
<footer class="footer"><p>الرسوم مرسومة من الصفر في ملفات SVG محلية؛ لا صور من فيديوهات أو مواقع. الأوراق النقدية المرسومة خيالية.</p><p>المراجعة الواقعية واللغوية والبدائل والحقوق والاعتماد البصري: معلّقة. تجربة البشر ومعايرة الصعوبة: لم تُنفّذا. عناصر SVG محلية، ولا اتصالات خارجية أو قياس أو حفظ لإجابات اللاعبين.</p><p>المعاينة لا تصلح كاختبار مستخدم أعمى لأن وضع المراجع متاح عمدًا. لا تُسجّل أي محاولة هنا كتجربة لاعبين.</p></footer>
</main>
<script id="rebus-data" type="application/json">${payload}</script>
<script>
const items = JSON.parse(document.getElementById('rebus-data').textContent);
const cards = document.getElementById('cards');
function el(tag, text, className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
items.forEach((item,index)=>{
  const article=el('article',undefined,'card');article.dataset.id=item.id;
  const head=el('div',undefined,'card-head');head.append(el('span',String(index+1).padStart(2,'0'),'number'),el('span','مسودة أصلية · قيد المراجعة','draft'));article.append(head);
  const prompt=el('h2',item.prompt,'prompt');prompt.id='prompt-'+item.id;article.append(prompt);article.setAttribute('aria-labelledby',prompt.id);
  const puzzle=el('div',undefined,'puzzle');puzzle.setAttribute('role','group');puzzle.setAttribute('aria-label','مكونات اللغز من اليمين إلى اليسار');
  item.pieces.forEach((piece,pieceIndex)=>{
    if(pieceIndex){const plus=el('span','+','plus');plus.setAttribute('aria-hidden','true');puzzle.append(plus);}
    if(piece.kind==='text'){puzzle.append(el('span',piece.text,'text-piece'));return;}
    const figure=el('figure',undefined,'piece');const img=el('img');img.src='icons/'+piece.artwork;img.alt='الرسم '+(pieceIndex+1);img.width=240;img.height=180;figure.append(img);
    if(piece.visibleHelper)figure.append(el('figcaption',piece.visibleHelper,'helper'));else {const spacer=el('div','\u00a0','helper');spacer.setAttribute('aria-hidden','true');figure.append(spacer);}
    if(piece.deleteFinal)figure.append(el('div','احذف '+piece.deleteFinal+' الأخيرة','operation'));
    puzzle.append(figure);
  });article.append(puzzle);
  const review=el('div',undefined,'review');review.hidden=true;
  review.append(el('p','القراءة المقصودة: '+item.pieces.map(p=>p.kind==='picture'?p.reviewerReading:p.text).join(' + '),'readings'));
  review.append(el('p','اقتراح فقط: '+item.suggestedPoints+' نقطة. '+item.tierRationale,'tier'));
  const reveal=el('button','اكشف الحل للمراجعة');reveal.type='button';reveal.setAttribute('aria-expanded','false');reveal.setAttribute('aria-controls','answer-'+item.id);review.append(reveal);
  const answer=el('div',undefined,'answer');answer.id='answer-'+item.id;answer.hidden=true;answer.append(el('strong',item.answer),el('p',item.explanation),el('p','ما يحتاج مراجعة: '+item.ambiguityToReview));review.append(answer);
  reveal.addEventListener('click',()=>{answer.hidden=!answer.hidden;reveal.setAttribute('aria-expanded',String(!answer.hidden));reveal.textContent=answer.hidden?'اكشف الحل للمراجعة':'أخفِ الحل';});
  review.append(el('p','الدقة والبدائل والالتباس والاعتماد البصري والحقوق: PENDING · تجربة البشر ومعايرة الصعوبة: NOT_RUN','gates'));article.append(review);cards.append(article);
});
function setMode(isReview){
  document.getElementById('play-mode').setAttribute('aria-pressed',String(!isReview));document.getElementById('review-mode').setAttribute('aria-pressed',String(isReview));
  document.querySelectorAll('.review').forEach(node=>node.hidden=!isReview);
  if(!isReview)document.querySelectorAll('.answer').forEach(node=>{node.hidden=true;const button=node.previousElementSibling;button.textContent='اكشف الحل للمراجعة';button.setAttribute('aria-expanded','false');});
  document.getElementById('mode-status').textContent=isReview?'وضع المراجع: أسماء المقاطع ظاهرة؛ يبقى كل حل مخفيًا إلى أن تكشفه.':'معاينة اللعب: الحلول وملاحظات المراجع مخفية؛ الكلمات المساعدة جزء من اللغز.';
}
document.getElementById('play-mode').addEventListener('click',()=>setMode(false));document.getElementById('review-mode').addEventListener('click',()=>setMode(true));
</script></body></html>`;

await writeFile(new URL("index.html", import.meta.url), html, "utf8");
const reviewDir = new URL("../../../content-review/2026-10-20/", import.meta.url);
await mkdir(reviewDir, { recursive: true });
const headers = ["item_id", "category_slug", "proposed_answer", "picture_readings_and_visible_operation", "visible_helpers", "suggested_points_not_calibrated", "tier_rationale", "factual_review_status", "alternatives_review_status", "ambiguity_review_status", "visual_approval_status", "rights_approval_status", "human_playtest_status", "human_attempt_count", "difficulty_calibration_status", "accepted_alternatives", "reviewer", "reviewed_at", "artwork_provenance", "artwork_files", "review_notes"];
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const rows = visualRebusPilot.map(item => [
  item.id, item.categorySlug, item.answer,
  item.pieces.map(piece => piece.kind === "text" ? piece.text : piece.reviewerReading + (piece.deleteFinal ? ` − ${piece.deleteFinal} الأخيرة` : "")).join(" + "),
  item.pieces.flatMap(piece => piece.kind === "picture" && piece.visibleHelper ? [piece.visibleHelper] : []).join(" | "),
  item.suggestedPoints, item.tierRationale,
  item.review.factual, item.review.alternatives, item.review.ambiguity, item.review.visualApproval, item.review.rightsApproval,
  item.review.humanPlaytest, 0, item.review.difficultyCalibration, "", "", "",
  "ORIGINAL_CODE_DRAWN_SVG; NO_EXTERNAL_ASSETS; INDEPENDENT_APPROVAL_PENDING",
  item.pieces.flatMap(piece => piece.kind === "picture" ? [piece.artwork] : []).join(" | "),
  item.ambiguityToReview,
]);
await writeFile(new URL("Board_Rebus_Pilot_Review.csv", reviewDir), "\ufeff" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
console.log(`Built isolated review preview: ${visualRebusPilot.length} items; no runtime files changed.`);
