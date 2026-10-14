/** Presentational timer: supply the real remaining and original duration from game state. */
export function TimerRing({ remainingMs, durationMs }: { remainingMs: number; durationMs: number }) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(remainingMs)) return null;
  const remaining = Math.max(0, remainingMs);
  const progress = Math.min(1, remaining / durationMs);
  const seconds = Math.ceil(remaining / 1000);
  const circumference = 2 * Math.PI * 35;
  return <span className={`timer-ring${seconds <= 5 ? " timer-ring--urgent" : ""}`} role="img" aria-label={`الوقت المتبقي ${new Intl.NumberFormat("ar-SA-u-nu-arab").format(seconds)} ثانية`}>
    <svg viewBox="0 0 84 84" aria-hidden="true" focusable="false">
      <circle className="timer-ring-track" cx="42" cy="42" r="35" fill="none" strokeWidth="8" />
      <circle className="timer-ring-progress" cx="42" cy="42" r="35" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 42 42)" />
    </svg>
    <strong aria-hidden="true">{new Intl.NumberFormat("ar-SA-u-nu-arab").format(seconds)}</strong>
  </span>;
}
