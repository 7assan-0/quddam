const symbols: Record<string, React.ReactNode> = {
  board: <><rect x="9" y="9" width="14" height="14" rx="3"/><rect x="29" y="9" width="14" height="14" rx="3"/><rect x="9" y="29" width="14" height="14" rx="3"/><path d="M30 36h12m-6-6v12"/></>,
  social: <><circle cx="18" cy="17" r="7"/><circle cx="36" cy="17" r="7"/><path d="M7 42v-5a11 11 0 0 1 22 0v5m4-16a11 11 0 0 1 12 11v5"/></>,
  letters: <><path d="M10 12h32M10 26h32M10 40h32M12 10v32M26 10v32M40 10v32"/><path d="m12 40 14-14 14-14" strokeWidth="5"/></>,
  survey: <path d="M10 42h32M14 34V23h6v11m5 0V12h6v22m5 0V18h6v16"/>,
  word: <><path d="M9 12h34v24H27l-9 7v-7H9Z"/><path d="m18 19 15 10m0-10L18 29"/></>,
  bluff: <><rect x="9" y="9" width="22" height="30" rx="4"/><rect x="21" y="15" width="22" height="30" rx="4"/><path d="m26 32 6-7 6 7-6 7Z"/></>,
  ranked: <path d="M18 11h24M18 26h18M18 41h12M9 9v6m-2 9h4l-4 6h4m-4 9h4l-4 3h4"/>,
  lightning: <path d="M29 6 12 29h13l-3 17 19-24H28Z"/>,
  ordering: <path d="M18 12h24M18 26h18M18 40h12M9 9v34m-4-5 4 5 4-5"/>,
  court: <path d="m14 12 9-6 13 18-9 6Zm8 17L10 43M26 43h18M31 37h8v6"/>,
};
export function GameEmblem({ name = "board" }: { name?: string }) {
  return <svg viewBox="0 0 52 52" className={`game-emblem game-emblem--${name}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{symbols[name] ?? symbols.board}</svg>;
}
