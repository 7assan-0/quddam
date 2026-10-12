/** Non-color team identity. Keep each team's position consistent across Host, phone and TV. */
export function TeamMarker({ position, color }: { position: number; color?: string }) {
  const shape = ((position % 4) + 4) % 4;
  return <svg className="team-marker" viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={color ? { color } : undefined} fill="currentColor">
    {shape === 0 ? <circle cx="10" cy="10" r="7" /> : shape === 1 ? <path d="M10 2 19 18H1Z" /> : shape === 2 ? <rect x="3" y="3" width="14" height="14" /> : <path d="M10 1 19 10 10 19 1 10Z" />}
  </svg>;
}
