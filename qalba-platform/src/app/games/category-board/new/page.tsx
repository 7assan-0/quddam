import Link from "next/link";
import { BoardSetup } from "@/components/board-setup";
import { requireUser } from "@/lib/auth/session";
import { eligibleBoardCategories, getBoardSession } from "@/lib/games/category-board/service";

export default async function NewBoardPage({ searchParams }: { searchParams: Promise<{ rematch?: string }> }) {
  const user = await requireUser();
  const categories = await eligibleBoardCategories();
  const { rematch } = await searchParams;
  let defaults: { categoryIds: string[]; teamNames: string[] } | undefined;
  if (rematch) {
    try {
      const prior = await getBoardSession(user.id, rematch);
      defaults = { categoryIds: prior.categories.map((category) => category.id).filter((id) => categories.some((category) => category.id === id)),
        teamNames: prior.teams.map((team) => team.name) };
    } catch { /* Invalid or inaccessible rematches start from the default setup. */ }
  }
  return <div className="shell"><div className="page-title"><span className="eyebrow">لوحة التحدي</span><h1>جهّزوا جمعتكم</h1><p>اختاروا الفئات والفرق. الأسئلة لا تتكرر في المباراة، والجديد منها يأخذ الأولوية عند الإعادة.</p></div>
    <div className="utility-links"><Link className="btn btn-secondary" href="/games">العودة للمكتبة</Link></div>
    <BoardSetup categories={categories} defaults={defaults} />
  </div>;
}
