import Link from "next/link";
import { GameEmblem } from "@/components/game-emblem";
import { gamePresentation } from "@/lib/brand/games";
import { requireUser } from "@/lib/auth/session";
import { walletForAccount } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { LAUNCH_GAME_SLUGS, launchGame } from "@/lib/games/launch-policy";

export default async function GamesPage() {
  const user = await requireUser();
  const wallet = await walletForAccount(user.id);
  const [games, categories] = await Promise.all([
    db().gameType.findMany({ where: { slug: { in: LAUNCH_GAME_SLUGS } }, orderBy: { createdAt: "asc" } }),
    db().category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, take: 12 }),
  ]);
  return <div className="shell"><div className="page-title"><span className="eyebrow">مكتبة الألعاب</span><h1>حيّاك يا {user.name}</h1><p>اختاروا اللعبة المناسبة لجمعتكم، وجهزوا الفرق أو اللاعبين، وابدؤوا اللعب من شاشة المضيف.</p></div>
    <div className="utility-links library-balance"><Link className="btn btn-outline" href="/profile">رصيدك: {wallet.balance} ألعاب · ملفي الشخصي</Link><Link className="btn btn-secondary" href="/pricing">شراء ألعاب</Link>{process.env.ENABLE_NIGHT_OF_QUDDAM === "true" && <Link className="btn btn-primary" href="/night">ليلة قدّام</Link>}{process.env.ENABLE_NIGHT_OF_QUDDAM === "true" && process.env.ENABLE_SHILLATAK === "true" && <Link className="btn btn-secondary" href="/shillatak">شلّتك</Link>}{user.role === "ADMIN" && <Link className="btn btn-secondary" href="/admin">لوحة الإدارة</Link>}</div>
    <div className="games-grid quddam-games">{games.map((game, i) => { const info = gamePresentation(game.slug), launch = launchGame(game.slug); return <article key={game.id} className="game-card"><div className="game-card-top"><GameEmblem name={info?.icon}/><span className="game-index">{String(i + 1).padStart(2, "0")}</span></div><div className="game-card-copy"><h2>{game.title}</h2><p>{info?.description ?? game.description}</p></div><div className="game-facts"><span>{info?.players ?? "لعب جماعي"}</span><span>{info ? `حوالي ${info.duration}` : "المدة حسب الجولة"}</span></div><span className={`game-availability ${game.enabled ? "" : "game-availability--off"}`}>{game.enabled ? "متاحة الآن" : "غير متاحة حاليًا"}</span>{game.enabled && launch ? <Link className="btn btn-secondary" href={launch.newHref}>{game.slug === "category-board" ? "ابدأ لوحة التحدي" : "ابدأ اللعبة"}</Link> : <span className="status">غير متاحة حاليًا</span>}</article>; })}</div>
    {games.length === 0 && <div className="empty">لا توجد ألعاب بعد. المكتبة تتجهز. جرّب مرة ثانية قريبًا.</div>}
    <section className="section"><div className="section-head"><div><span className="eyebrow">الفئات</span><h2>موضوعات جاهزة للتحدي</h2></div></div><div className="category-list">{categories.map((category) => <span className="category-chip" key={category.id}>{category.title}</span>)}</div>{categories.length === 0 && <div className="empty">لم تُضف فئات بعد.</div>}</section>
  </div>;
}
