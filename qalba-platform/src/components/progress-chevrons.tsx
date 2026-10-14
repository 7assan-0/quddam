"use client";
import { useEffect, useRef } from "react";

const arabicNumber = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);

/** Accessible RTL progress. Animate only segments filled after the initial mount. */
export function ProgressChevrons({ current, total }: { current: number; total: number }) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const filled = Number.isFinite(current) ? Math.min(count, Math.max(0, Math.floor(current))) : 0;
  const previous = useRef(filled);
  const wrapper = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const before = previous.current;
    wrapper.current?.querySelectorAll(".is-newly-filled").forEach(element => element.classList.remove("is-newly-filled"));
    if (filled > before) {
      for (let index = before; index < filled; index++) {
        const chevron = wrapper.current?.children.item(index);
        if (chevron) chevron.classList.add("is-newly-filled");
      }
    }
    previous.current = filled;
  }, [filled]);
  if (!count) return null;
  return <span ref={wrapper} className="progress-chevrons" role="img" aria-label={`الجولة ${arabicNumber(filled)} من ${arabicNumber(count)}`} dir="rtl">
    {Array.from({ length: count }, (_, index) => <svg key={index} className={`progress-chevron${index < filled ? " is-filled" : ""}`} viewBox="0 0 44 52" aria-hidden="true" focusable="false">
      <path d="M32 6L12 26L32 46" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>)}
  </span>;
}
