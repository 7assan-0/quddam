import { TeamMarker } from "@/components/team-marker";
import { HeaderSurfaceSync } from "@/components/header-surface-sync";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { GameEmblem } from "@/components/game-emblem";
import { featuredGames } from "@/lib/brand/games";

const arabicIndex = (index: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(index + 1);

export default function Home() {
  return <>
    <HeaderSurfaceSync />
    <section className="quddam-sun-hero">
      <svg className="sun-chevron-pattern" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="sun-hero-chevron" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M36 8L16 28L36 48" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#sun-hero-chevron)" />
      </svg>
      <div className="shell hero quddam-hero">
        <div className="hero-copy">
          <span className="eyebrow">اللعب يبدأ من هنا</span>
          <h1>جمعتكم جاهزة.<br/><span className="hero-headline-highlight">باقي التحدّي.</span></h1>
          <p>ألعاب جماعية عربية للأهل والأصحاب. اختاروا لعبتكم، جهّزوا جماعتكم، وخلو المنافسة تبدأ.</p>
          <div className="hero-actions"><Link className="btn btn-on-sun btn-game" href="/games">يلا قدّام <span aria-hidden="true">←</span></Link><Link className="btn btn-on-sun-outline" href="#games">تصفّح الألعاب</Link></div>
          <div className="hero-notes"><span>١٠ ألعاب مكتملة</span><span>جوال + شاشة</span><span>المضيف يدير اللعب</span></div>
        </div>
        <div className="quddam-preview" role="img" aria-label="معاينة توضيحية للعبة: فريق البرق ٦٠٠ نقطة ضد فريق الموج ٤٠٠ نقطة">
          <div className="preview-heading"><span className="pill">معاينة التحدّي</span><BrandMark /></div>
          <div className="preview-scoreboard">
            <div className="preview-team team-a"><span><TeamMarker position={0} />فريق البرق</span><strong>٦٠٠</strong></div>
            <span className="preview-vs">ضد</span>
            <div className="preview-team team-b"><span><TeamMarker position={1} />فريق الموج</span><strong>٤٠٠</strong></div>
          </div>
          <div className="preview-question"><span>المعلومات العامة · ٤٠٠</span><strong>سؤال واحد يغيّر ترتيب الفرق.</strong><div className="preview-answer"><span>جاهزين؟</span><span aria-hidden="true">←</span></div></div>
          <div className="preview-bottom"><span>معرفة. سرعة. وحجة تقنع الجماعة.</span></div>
        </div>
      </div>
    </section>
    <section id="games" className="quddam-game-section section"><div className="shell">
      <div className="section-head"><div><span className="eyebrow">مكتبة التحديات</span><h2>اختاروا جوّكم</h2></div><p>أسئلة، تمويه، ترتيب ومرافعات. لكل جمعة لعبة.</p></div>
      <div className="quddam-home-games">{featuredGames.map((game, i) => <article className="quddam-home-game" key={game.slug} data-game={game.slug} data-color={i % 4}><Link href="/games" className="quddam-home-game-link" aria-label={`تعرّف على لعبة ${game.title}: ${game.description}`}>
        <span className={`quddam-game-number quddam-game-number--${i % 4}`} aria-hidden="true">{arabicIndex(i)}</span>
        <span className="quddam-home-game-copy"><strong>{game.title}</strong><small>{game.description}</small></span>
        <span className="game-icon-chip"><GameEmblem name={game.icon} /></span>
      </Link></article>)}</div>
      <div className="home-games-action"><Link className="btn btn-primary" href="/games">تصفّح مكتبة الألعاب <span aria-hidden="true">←</span></Link></div>
    </div></section>
    <section id="how" className="shell section"><div className="section-head"><div><span className="eyebrow">ثلاث خطوات</span><h2>من «وش نلعب؟» إلى قدّام</h2></div></div><div className="steps"><div className="step"><span>٠١</span><h3>اختاروا اللعبة</h3><p>المضيف يدخل حسابه ويختار التحدّي من المكتبة.</p></div><div className="step"><span>٠٢</span><h3>جهّزوا الجماعة</h3><p>سمّوا الفرق، أو شاركوا رمز الغرفة للألعاب التي تحتاج جوالات.</p></div><div className="step"><span>٠٣</span><h3>يلا قدّام</h3><p>المضيف يدير المباراة، وشاشة العرض تجمعكم على النتيجة.</p></div></div></section>
    <section className="shell section"><div className="quddam-party"><div><span className="eyebrow">من الجوال إلى المجلس</span><h2>شاشة تجمعكم.<br/>وتحدّي يحمّسكم.</h2><p>التحكم عند المضيف، والتفاصيل المهمة واضحة للجماعة. افتحوا شاشة العرض وخلّوا المنافسة قدّام الكل.</p><Link className="btn btn-primary" href="/games">اختاروا لعبتكم</Link></div><BrandMark /></div></section>
    <section id="faq" className="shell section faq"><div className="section-head"><div><span className="eyebrow">قبل البداية</span><h2>أسئلة سريعة</h2></div></div><details><summary>هل أحتاج تطبيقًا؟</summary><p>لا. اللعب من المتصفح على الجوال أو الكمبيوتر، مع شاشة عرض للألعاب التي تدعمها.</p></details><details><summary>هل كل لاعب يحتاج حسابًا؟</summary><p>المضيف يحتاج حسابًا. اللاعبون ينضمون برمز أو رابط في الألعاب التي تدعم الجوالات.</p></details><details><summary>كيف أتابع رصيد الألعاب؟</summary><p>رصيدك ظاهر في مكتبتك وملفك الشخصي. كل لعبة توضّح متى يبدأ الخصم قبل المباراة.</p><Link className="subtle-link" href="/pricing">استعرض الباقات</Link></details></section>
  </>;
}
