/** Accessible context preserves the existing action's specific name. */
export function CreateCopy({ previous }: { previous: string }) { return <><span>يلا قدّام</span><span className="sr-only"> · {previous}</span></>; }
export function RematchCopy({ previous }: { previous: string }) { return <><span>جولة ثانية؟ قدّام!</span><span className="sr-only"> · {previous}</span></>; }
export function hostActionClass(type: string) {
  if (["ABANDON", "END_GAME", "VOID_RESULT"].includes(type)) return "btn btn-danger btn-destructive";
  if (["CORRECT", "STEAL_CORRECT", "GUESS_CORRECT"].includes(type)) return "btn btn-success";
  if (["WRONG", "STEAL_WRONG", "GUESS_WRONG"].includes(type)) return "btn btn-danger";
  if (type === "UNDO") return "btn btn-outline btn-undo";
  if (["PAUSE", "END_ROUND"].includes(type) || type.startsWith("EXPIRE_")) return "btn btn-secondary";
  return "btn btn-primary";
}
