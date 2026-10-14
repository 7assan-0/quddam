import { teamColor } from "@/lib/design/team-colors";

/** Shape is an independent identity cue across Host, TV, phone and results. */
export function TeamMarker({ position, color: _savedColor }: { position: number; color?: string }) {
  const shape = ((position % 4) + 4) % 4;
  return <svg className="team-marker" viewBox="0 0 20 20" role="img" aria-label={shape === 0 ? "رمز البرق" : shape === 1 ? "رمز الموج" : shape === 2 ? "رمز المربع" : "رمز المعين"} style={{ color: teamColor(position) }} fill="currentColor">
    {shape === 0 ? <path d="M11.5 1 3.5 11h6L8 19l9-11h-6Z" /> :
      shape === 1 ? <path d="M1 8q2.25-5 4.5 0t4.5 0t4.5 0T19 8v3q-2.25 5-4.5 0t-4.5 0t-4.5 0T1 11Z" /> :
      shape === 2 ? <rect x="3" y="3" width="14" height="14" rx="1" /> :
      <path d="M10 1 19 10 10 19 1 10Z" />}
  </svg>;
}
