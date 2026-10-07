import { expect, it } from "vitest";
import { cleanProperties } from "./events";
it("records identifiers without personal or payment content", () => {
  expect(cleanProperties({ sessionId: "abc", questionId: "q1", playerName: "نورة", response: "إجابة خاصة", cardNumber: "4111", ip: "127.0.0.1", powerSlug: "double" }))
    .toEqual({ sessionId: "abc", questionId: "q1", powerSlug: "double" });
});
