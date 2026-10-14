export function BrandMark({ className = "" }: { className?: string }) {
  return <svg className={`quddam-mark ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="18" className="quddam-mark-tile"/><path d="M45 20H30L16 34L30 48H45L31 34Z" className="quddam-mark-chevron"/><path d="M34 10H40V16H34ZM44 10H50V16H44Z" className="quddam-mark-spark"/></svg>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="quddam-brand"><BrandMark />{!compact && <span>قدّام</span>}</span>;
}
