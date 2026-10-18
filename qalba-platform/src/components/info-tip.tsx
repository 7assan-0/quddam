"use client";

import { useId, useRef } from "react";

/** Explicit tap/keyboard explanation; uses a native modal to keep mobile descriptions readable. */
export function InfoTip({ title, description, example }: { title: string; description: string; example?: string }) {
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  return <span className="info-tip">
    <button ref={trigger} type="button" className="info-tip-trigger" aria-label={`شرح ${title}`} aria-haspopup="dialog"
      onClick={() => modal.current?.showModal()}><span aria-hidden="true">!</span></button>
    <dialog ref={modal} className="info-dialog" aria-labelledby={headingId} onClose={() => trigger.current?.focus()}
      onClick={(event) => { if (event.target === event.currentTarget) modal.current?.close(); }}>
      <div className="info-dialog-surface" dir="rtl">
        <div className="info-dialog-head"><span className="eyebrow">وش السالفة؟</span>
          <button type="button" className="info-dialog-close" aria-label="إغلاق الشرح" onClick={() => modal.current?.close()}>×</button></div>
        <h2 id={headingId}>{title}</h2><p>{description}</p>
        {example && <p className="info-dialog-example"><strong>مثلًا:</strong> {example}</p>}
        <button type="button" className="btn btn-secondary info-dialog-done" onClick={() => modal.current?.close()}>فهمت!</button>
      </div>
    </dialog>
  </span>;
}
