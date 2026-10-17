import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { getShillaView } from "@/lib/shillatak/service";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
import { ShillatakGroup } from "./shillatak-group";
import { ShillatakHome } from "./shillatak-home";
import { ShillatakJoin } from "./shillatak-join";
import { ShillatakJoinAuth } from "./shillatak-join-auth";
type View = Awaited<ReturnType<typeof getShillaView>>;
afterEach(() => vi.restoreAllMocks());
function fixture(owner: boolean, status = "active"): View {
  return { id: "00000000-0000-4000-8000-000000000001", name: "الشلّة الاصطناعية", status,
    owner, myRole: owner ? "OWNER" : "MEMBER",
    teams: [{ id: "team-a", name: "الفريق الأول", position: 0 }, { id: "team-b", name: "الفريق الثاني", position: 1 }],
    members: [{ id: "membership-1", name: "اسم حساب اصطناعي", role: "OWNER" }],
    leaderboard: [
      { id: "team-a", name: "الفريق الأول", played: 2, wins: 2, points: 17, rank: 1 },
      { id: "team-b", name: "الفريق الثاني", played: 2, wins: 1, points: 16, rank: 2 },
    ], nights: [],
    activeInvites: [{ id: "synthetic-invite-record", expiresAt: "2030-01-01T12:00:00.000Z" }],
    eligibleNights: [{ id: "synthetic-private-night", createdAt: "2029-01-01T12:00:00.000Z" }],
  };
}
describe("Shillatak interface authority and private membership boundaries", () => {
  it("shows organizer tools only to an owner of an active group", () => {
    const owner = renderToStaticMarkup(<ShillatakGroup initial={fixture(true)} />);
    expect(owner).toContain('data-testid="shilla-owner-tools"');
    expect(owner).toContain("إنشاء رابط عضوية"); expect(owner).toContain("إلغاء الدعوة");
    expect(owner).not.toContain("مغادرة الشلّة");
    for (const view of [fixture(false), fixture(true, "archived")]) {
      const html = renderToStaticMarkup(<ShillatakGroup initial={view} />);
      expect(html).not.toContain('data-testid="shilla-owner-tools"');
      expect(html).not.toContain("إنشاء رابط عضوية"); expect(html).not.toContain("سجّل النتيجة");
      expect(html).not.toContain("synthetic-private-night"); expect(html).not.toContain("synthetic-invite-record");
    }
  });
  it("lets members leave an active or archived group without exposing deletion of immutable results", () => {
    for (const status of ["active", "archived"]) {
      const html = renderToStaticMarkup(<ShillatakGroup initial={fixture(false, status)} />);
      expect(html).toContain("مغادرة الشلّة"); expect(html).toContain("اسم حساب اصطناعي");
      expect(html).not.toContain("حذف السهرة");
    }
  });
  it("presents persisted team standings and labels them as team awards rather than personal wins", () => {
    const html = renderToStaticMarkup(<ShillatakGroup initial={fixture(false)} />);
    expect(html).toContain('data-testid="shilla-leaderboard"');
    expect(html).toContain("انتصارات شخصية");
    expect(html).toContain("<td>17</td>"); expect(html).toContain("<td>16</td>");
    expect(html.indexOf('scope="row">الفريق الأول')).toBeLessThan(html.indexOf('scope="row">الفريق الثاني'));
    expect(html).not.toContain("تأكيد الأرشفة");
  });
  it("provides an empty home state and labelled existing-brand creation fields", () => {
    const html = renderToStaticMarkup(<ShillatakHome initial={[]} />);
    expect(html).toContain("مكان شلّتك جاهز");
    expect(html).toContain("سمّوا شلّتكم وفريقينكم فوق");
    for (const name of ["shilla-name", "shilla-team-a", "shilla-team-b"]) {
      expect(html).toContain(`for="${name}"`); expect(html).toContain(`id="${name}"`);
    }
    expect(html).toContain('href="/night"');
  });
  it("uses the existing bounded branded input styles for all group creation controls", () => {
    const html = renderToStaticMarkup(<ShillatakHome initial={[]} />);
    expect(html.match(/class="input"/g)).toHaveLength(3);
    expect(html).not.toContain('class="form-input"');
  });
  it("offers explicit acceptance without any host or player authority in the guest interface", () => {
    const html = renderToStaticMarkup(<ShillatakJoin code={"a".repeat(64)} name="دعوة اصطناعية" open alreadyMember={false} />);
    expect(html).toContain("قبول الدعوة"); expect(html).not.toContain("shilla-owner-tools");
    expect(html).not.toContain("a".repeat(64)); expect(html).not.toContain("hostCapability");
  });
  it("keeps signed-out authentication on the invite page without rendering a token-bearing auth link", () => {
    const html = renderToStaticMarkup(<ShillatakJoinAuth code={"a".repeat(64)} />);
    expect(html).toContain("لن تُقبل العضوية تلقائيًا"); expect(html).toContain("حساب جديد</button>");
    expect(html).not.toContain('href="/register"'); expect(html).not.toContain("a".repeat(64));
  });
  it("renders a stable explicit server time zone before switching to the browser zone after hydration", () => {
    const formatter = Intl.DateTimeFormat;
    let defaultZone = "UTC";
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function(locales, options) {
      return new formatter(locales, { timeZone: defaultZone, ...options });
    } as typeof Intl.DateTimeFormat);
    const view = fixture(true);
    view.nights = [{ id: "synthetic-history", recordedAt: "2030-01-01T12:00:00.000Z",
      teams: [{ id: "team-a", name: "الفريق الأول", points: 9, champion: true },
        { id: "team-b", name: "الفريق الثاني", points: 6, champion: false }] }];
    const utcHtml = renderToStaticMarkup(<ShillatakGroup initial={view} />);
    defaultZone = "Asia/Riyadh";
    const riyadhHtml = renderToStaticMarkup(<ShillatakGroup initial={view} />);
    expect(riyadhHtml).toBe(utcHtml);
    expect(utcHtml).toContain("UTC");
  });
});
