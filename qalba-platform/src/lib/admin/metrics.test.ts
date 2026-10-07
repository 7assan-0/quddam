import { expect, it } from "vitest";
import { saudiDayStart } from "./metrics";

it("groups games at Saudi midnight rather than UTC midnight", () => {
  expect(saudiDayStart(new Date("2026-09-29T20:59:59Z")).toISOString()).toBe("2026-09-28T21:00:00.000Z");
  expect(saudiDayStart(new Date("2026-09-29T21:00:00Z")).toISOString()).toBe("2026-09-29T21:00:00.000Z");
});
