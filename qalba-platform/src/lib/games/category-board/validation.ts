import { z } from "zod";

export const createBoardSchema = z.object({
  categoryIds: z.array(z.string().min(1).max(100)).length(6),
  teamNames: z.tuple([z.string().trim().min(2).max(60), z.string().trim().min(2).max(60)]),
  timerSeconds: z.number().int().min(10).max(120).default(30),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("PAUSE_GAME") }),
  z.object({ type: z.literal("RESUME_GAME") }),
  z.object({ type: z.literal("END_GAME") }),
  z.object({ type: z.literal("EDIT_SCORE"), teamId: z.string().min(1).max(100),
    delta: z.number().int().min(-10000).max(10000).refine((value) => value !== 0) }),
  z.object({ type: z.literal("OPEN"), cellKey: z.string().min(1).max(220).optional(), categoryId: z.string().min(1).max(100).optional(), value: z.union([z.literal(200), z.literal(400), z.literal(600)]).optional() }),
  z.object({ type: z.literal("REVEAL") }),
  z.object({ type: z.literal("TIMER_START") }),
  z.object({ type: z.literal("TIMER_PAUSE") }),
  z.object({ type: z.literal("TIMER_RESET") }),
  z.object({ type: z.literal("CORRECT") }),
  z.object({ type: z.literal("WRONG") }),
  z.object({ type: z.literal("SKIP") }),
  z.object({ type: z.literal("UNDO") }),
  z.object({ type: z.literal("USE_POWERUP"), slug: z.enum(["double", "shield", "remove-two", "extra-time", "challenge"]) }),
  z.object({ type: z.literal("RESOLVE_CHALLENGE"), accepted: z.boolean() }),
]);

export const boardCommandSchema = z.object({
  key: z.uuid(), expectedVersion: z.number().int().nonnegative(), action: actionSchema,
}).refine(input => input.action.type !== "OPEN" ||
  (Boolean(input.action.cellKey) !== Boolean(input.action.categoryId && input.action.value)),
  { path: ["action"], message: "حدد مفتاح خانة واحدًا، أو الفئة والقيمة للمباراة القديمة" });
