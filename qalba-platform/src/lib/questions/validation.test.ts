import { describe, expect, it } from "vitest";
import { questionSchema } from "./validation";

const question = { gameTypeId: "game", categoryId: "category", question: "ما الرقم التالي بعد خمسة؟", answer: "ستة", difficulty: "EASY", pointValue: 200, type: "TEXT", status: "DRAFT" };

describe("question content validation", () => {
  it("accepts a valid Arabic question and fills safe defaults", () => {
    const result = questionSchema.parse(question);
    expect(result.language).toBe("ar");
    expect(result.alternativeAnswers).toEqual([]);
  });

  it("rejects multiple choice content without the correct option", () => {
    const result = questionSchema.safeParse({ ...question, type: "MULTIPLE_CHOICE", options: ["واحد", "اثنان", "ثلاثة"] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid point values and external image schemes", () => {
    expect(questionSchema.safeParse({ ...question, pointValue: -200 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, imageUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});
