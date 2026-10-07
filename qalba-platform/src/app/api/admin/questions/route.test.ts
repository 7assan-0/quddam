import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: () => ({ question: { create: mocks.create } }) }));
import { POST } from "./route";

function request() {
  return new NextRequest("http://localhost:3000/api/admin/questions", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ gameTypeId: "game", categoryId: "category", question: "كم عدد أضلاع المربع؟", answer: "أربعة", type: "TEXT", difficulty: "EASY", pointValue: 200, status: "DRAFT" }),
  });
}

describe("admin question writes", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: "question-1" }); });

  it("forbids ordinary users before writing", async () => {
    mocks.user.mockResolvedValue({ id: "player", role: "USER" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows admins to create a validated draft", async () => {
    mocks.user.mockResolvedValue({ id: "admin", role: "ADMIN" });
    expect((await POST(request())).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", language: "ar" }) }));
  });
});
