import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LAUNCH_GAMES, LAUNCH_GAME_SLUGS } from "@/lib/games/launch-policy";
import { featuredGames } from "@/lib/brand/games";
const m = vi.hoisted(() => ({ user: vi.fn(), wallet: vi.fn(), games: vi.fn(), categories: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.user }));
vi.mock("@/lib/billing/credits", () => ({ walletForAccount: m.wallet }));
vi.mock("@/lib/db", () => ({ db: () => ({ gameType: { findMany: m.games }, category: { findMany: m.categories } }) }));
import GamesPage from "./page";
import Home from "../page";
describe("launch-only customer catalog preserves Quddam presentation", () => {
  beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ id: "host", name: "المضيف", role: "USER" }); m.wallet.mockResolvedValue({ balance: 23 }); m.categories.mockResolvedValue([]);
    const rows = [...featuredGames.map(game => ({ ...game, id: game.slug, enabled: true })), ...["letter-battle", "fastest-mind", "party-court"].map(slug => ({ id: slug, slug, title: slug, description: "Legacy", enabled: true }))];
    m.games.mockImplementation(async ({ where }: { where: { slug: { in: string[] } } }) => rows.filter(game => where.slug.in.includes(game.slug)));
  });
  it("renders exactly ten approved cards even when legacy database rows are enabled", async () => {
    const html = renderToStaticMarkup(await GamesPage());
    expect(m.games).toHaveBeenCalledWith({ where: { slug: { in: LAUNCH_GAME_SLUGS } }, orderBy: { createdAt: "asc" } });
    expect(html.match(/<article /g)).toHaveLength(10); expect(html).toContain("رصيدك: 23 ألعاب");
    for (const game of LAUNCH_GAMES) expect(html).toContain(`href="${game.newHref}"`);
    for (const slug of ["letter-battle", "fastest-mind", "party-court"]) expect(html).not.toContain(slug);
  });
  it("preserves disabled official cards and their unavailable state", async () => {
    m.games.mockResolvedValue(featuredGames.map(game => ({ ...game, id: game.slug, enabled: game.slug !== "the-court" })));
    const html = renderToStaticMarkup(await GamesPage());
    expect(html.match(/<article /g)).toHaveLength(10); expect(html).toContain("غير متاحة حاليًا"); expect(html).not.toContain('href="/court/new"');
  });
  it("keeps the public showcase at exactly ten official games", () => {
    const html = renderToStaticMarkup(Home()); expect(html.match(/<article /g)).toHaveLength(10);
    for (const game of featuredGames) { expect(html).toContain(game.title); expect(html).toContain(`data-game="${game.slug}"`); }
    for (const title of ["حرب الحروف", "خاطف", "محكمة الطاولة"]) expect(html).not.toContain(title);
  });
});
