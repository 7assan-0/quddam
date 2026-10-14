"use client";
import { useEffect, useRef } from "react";

const arabicNumber = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);

/** A reusable RTL round indicator. current is 1-based; the current round is filled. */
export function ProgressChevrons({ current, total }: { current: number; total: number }) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const filled = Number.isFinite(current) ? Math.min(count, Math.max(0, Math.floor(current))) : 0;
  const previous = useRef(filled);
  const advancingFrom = previous.current;
  useEffect(() => { previous.current = filled; }, [filled]);
  if (!count) return null;
  return <span className="progress-chevrons" role="img" aria-label={`الجولة ${arabicNumber(filled)} من ${arabicNumber(count)}`} dir="rtl">
    {Array.from({ length: count }, (_, index) => {
      const done = index < filled;
      const newlyFilled = done && index >= advancingFrom && filled > advancingFrom;
      return <svg key={index} className={`progress-chevron${done ? " is-filled" : ""}${newlyFilled ? " is-newly-filled" : ""}`} viewBox="0 0 44 52" aria-hidden="true" focusable="false">
        <path d="M32 6L12 26L32 46" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    })}
  </span>;
}
