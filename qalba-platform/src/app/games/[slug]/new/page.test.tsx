import { beforeEach, describe, expect, it, vi } from "vitest";
import { partySlugs } from "@/lib/games/party/types";
const m = vi.hoisted(() => ({ user: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.user }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); }, useRouter: vi.fn() }));
import Page from "./page";
describe("generic new page cannot revive a legacy engine", () => {
  beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ id: "host" }); });
  it.each([...partySlugs, "unknown-game"])("rejects the generic %s flow before loading a setup", async slug => {
    await expect(Page({ params: Promise.resolve({ slug }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(m.user).toHaveBeenCalledTimes(1); expect(m.db).not.toHaveBeenCalled();
  });
});
