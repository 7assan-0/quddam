"use client";
import { useEffect, useRef, useState } from "react";

const format = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-latn").format(value);

/** Presentation only: the server-provided score remains the source of truth. */
export function AnimatedScore({ value, as: Tag = "strong" }: { value: number; as?: "strong" | "b" }) {
  const [shown, setShown] = useState(value);
  const [delta, setDelta] = useState<number | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current) return;
    const from = previous.current;
    previous.current = value;
    const change = value - from;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / 480);
      setShown(Math.round(from + change * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame((now) => {
      if (reduced) { setShown(value); setDelta(null); }
      else { setDelta(change); tick(now); }
    });
    const hide = reduced ? null : window.setTimeout(() => setDelta(null), 850);
    return () => { cancelAnimationFrame(frame); if (hide) window.clearTimeout(hide); };
  }, [value]);

  return <><Tag className="score-number" aria-hidden="true">{format(shown)}</Tag>
    <span className="visually-hidden" aria-live="polite">{format(value)}</span>
    {delta !== null && <span className={`score-feedback ${delta > 0 ? "score-feedback--gain" : "score-feedback--loss"}`} aria-hidden="true">{delta > 0 ? "+" : "−"}{format(Math.abs(delta))}</span>}</>;
}
