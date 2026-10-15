import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { NightView } from "@/lib/night/types";
import { NIGHT_GAMES } from "@/lib/night/catalog";

const mocks = vi.hoisted(() => ({ push: vi.fn(), find: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/night/service", () => ({ findNightForSource: mocks.find }));

import { NightOfQuddam } from "./night-of-quddam";
import { NightOfQuddamSetup } from "./night-of-quddam-setup";
import { NightReturnLink } from "./night-return-link";

function fixture(phase: NightView["phase"], completed: number, tied = false): NightView {
  const teams = [{ id: "team-a", name: "الأفق" }, { id: "team-b", name: "القمم" }];
  const results = NIGHT_GAMES.slice(0, completed).map((game, index) => ({ game: game.game, sourceSessionId: `source-${index}`, placements: tied ? [{ teamIds: ["team-a", "team-b"] }] : [{ teamIds: ["team-a"] }, { teamIds: ["team-b"] }], points: { "team-a": 3, "team-b": tied ? 3 : 2 } }));
  const totals = { "team-a": completed * 3, "team-b": completed * (tied ? 3 : 2) };
  return { id: "night-1", phase, version: completed + 1, teams, games: NIGHT_GAMES.map((game, index) => ({ ...game, position: index, hostHref: index === 0 ? "/ranked/host/source-0" : null, sourceStatus: index < completed ? "COMPLETED" : null, imported: index < completed })), currentIndex: Math.max(0, completed - 1), current: null, importReady: false, blockedReason: null, canNext: phase === "playing" && completed > 0, results, totals, ranking: teams.map(team => ({ ...team, points: totals[team.id as keyof typeof totals] })), winnerIds: phase === "completed" ? tied ? ["team-a", "team-b"] : ["team-a"] : [] };
}

describe("Night owner interface preserves completion and authority boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("does not announce a champion between games or after early termination", () => {
    for (const phase of ["preparing", "playing", "ended"] as const) {
      const view = fixture(phase, phase === "preparing" ? 0 : 1);
      // Even a stale winner list cannot turn an incomplete view into a champion screen.
      view.winnerIds = ["team-a"];
      const html = renderToStaticMarkup(<NightOfQuddam initial={view}/>);
      expect(html).not.toContain('data-testid="night-champion"');
      if (phase === "ended") { expect(html).toContain('data-testid="night-ended"'); expect(html).not.toContain('data-testid="night-next"'); }
    }
  });

  it("shows both final champions when all three results end in a tie", () => {
    const html = renderToStaticMarkup(<NightOfQuddam initial={fixture("completed", 3, true)}/>);
    expect(html).toContain('data-testid="night-champion"');
    expect(html).toContain("أبطال الليلة"); expect(html).toContain("الأفق و القمم");
    expect(html.match(/data-testid="night-total">9/g)).toHaveLength(2);
    expect(html).not.toContain('data-testid="night-next"');
    expect(html).not.toContain('data-testid="night-end"');
  });

  it("shows an imported transition and keeps score entry out of the Night interface", () => {
    const html = renderToStaticMarkup(<NightOfQuddam initial={fixture("playing", 1)}/>);
    expect(html).toContain('data-testid="night-transition"');
    expect(html).toContain('data-testid="night-next"');
    expect(html).toContain("الانتقال يجهّز المباراة التالية دون خصم");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("source-0");
  });

  it("explains the bounded three-game selection, complete rounds and existing credit behavior", () => {
    const html = renderToStaticMarkup(<NightOfQuddamSetup/>);
    expect(html).toContain("ثلاث ألعاب على الأقل");
    for (const game of NIGHT_GAMES) expect(html).toContain(`data-game="${game.game}"`);
    expect(html).toContain("خمس جولات كاملة"); expect(html).toContain("سبع جولات كاملة");
    expect(html).toContain("إنشاء السهرة والتنقل بين مبارياتها لا يخصمان رصيدًا");
    expect(html).toContain('data-testid="night-team-a"'); expect(html).toContain('data-testid="night-team-b"');
  });

  it("does not query Night bindings or alter standalone game pages while disabled", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "false");
    expect(await NightReturnLink({ ownerId: "owner", game: "top-list", sourceId: "source" })).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("renders a return link only from the owner-scoped persisted game relation", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    mocks.find.mockResolvedValue({ id: "bound-night" });
    const html = renderToStaticMarkup(await NightReturnLink({ ownerId: "owner", game: "ordering-challenge", sourceId: "source-7" }));
    expect(mocks.find).toHaveBeenCalledExactlyOnceWith("owner", "ordering-challenge", "source-7");
    expect(html).toContain('href="/night/bound-night"');
    expect(html).not.toContain("source-7"); expect(html).not.toContain("owner");
  });

  it("does not offer a Night return link for an unrelated source session", async () => {
    vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true");
    mocks.find.mockResolvedValue(null);
    expect(await NightReturnLink({ ownerId: "owner", game: "survey-show", sourceId: "unrelated" })).toBeNull();
  });
});
