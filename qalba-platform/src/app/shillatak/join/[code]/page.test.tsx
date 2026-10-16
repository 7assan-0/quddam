import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ user: vi.fn(), require: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: m.user, requireUser: m.require }));
vi.mock("@/lib/shillatak/service", () => ({ previewShillaInvite: m.preview }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
import Page from "./page";
const code = "a".repeat(64), id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ENABLE_NIGHT_OF_QUDDAM", "true"); vi.stubEnv("ENABLE_SHILLATAK", "true");
  m.user.mockResolvedValue(null);
  m.require.mockImplementation(async () => { throw new Error("REDIRECT_LOGIN"); });
  m.preview.mockResolvedValue({ name: "الشلّة الاصطناعية", open: true, alreadyMember: false });
});
afterEach(() => vi.unstubAllEnvs());
describe("Shillatak bearer-page login and lost-response recovery", () => {
  it("keeps a signed-out visitor on the protected invitation page without putting its token in an auth URL", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ code }) }));
    expect(html).toContain('data-testid="shillatak-join-auth"');
    expect(html).toContain("تسجيل الدخول");
    expect(html).not.toContain("next="); expect(html).not.toContain(code);
    expect(m.preview).not.toHaveBeenCalled();
  });
  it("offers an authenticated existing member a direct group link after an acceptance response was lost", async () => {
    m.user.mockResolvedValue({ id: "synthetic-member" });
    m.require.mockResolvedValue({ id: "synthetic-member" });
    m.preview.mockResolvedValue({ name: "الشلّة الاصطناعية", open: false, alreadyMember: true, shillaId: id });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ code }) }));
    expect(html).toContain(`href="/shillatak/${id}"`);
    expect(html).not.toContain("قبول الدعوة</button>");
  });
  it("rejects malformed bearer paths before authentication or database lookup", async () => {
    await expect(Page({ params: Promise.resolve({ code: "invalid" }) })).rejects.toThrow("NOT_FOUND");
    expect(m.user).not.toHaveBeenCalled(); expect(m.require).not.toHaveBeenCalled(); expect(m.preview).not.toHaveBeenCalled();
  });
  it("stops disabled pages before authentication or database reads", async () => {
    vi.stubEnv("ENABLE_SHILLATAK", "false");
    await expect(Page({ params: Promise.resolve({ code }) })).rejects.toThrow("NOT_FOUND");
    expect(m.user).not.toHaveBeenCalled(); expect(m.require).not.toHaveBeenCalled(); expect(m.preview).not.toHaveBeenCalled();
  });
});
