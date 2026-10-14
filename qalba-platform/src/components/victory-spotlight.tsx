import { TeamMarker } from "./team-marker";

/** TV-only celebration. Names and positions originate from live game state. */
export function VictorySpotlight({ names, positions, headingLevel: Heading = "h1" }: { names: string[]; positions?: number[]; headingLevel?: "h1" | "h2" }) {
  const tie = names.length > 1;
  return <div className="victory-spotlight">
    <span className="victory-spark victory-spark--one" aria-hidden="true">✦</span>
    <span className="victory-spark victory-spark--two" aria-hidden="true">✳</span>
    <span className="victory-spark victory-spark--three" aria-hidden="true">✦</span>
    <span className="victory-spark victory-spark--four" aria-hidden="true">✳</span>
    <span className="victory-label">✦ النتيجة النهائية ✦</span>
    <span className="victory-trophy" aria-hidden="true">★</span>
    <Heading>{tie ? "تعادل!" : names.length === 1 ? `الفائز: ${names[0]}` : "انتهت المباراة"}</Heading>
    {positions && names.length > 0 && <div className="victory-team-identity">{names.map((name,index) => <span key={index}>{positions[index] !== undefined && <TeamMarker position={positions[index]} />}{name}</span>)}</div>}
    {tie && <p className="victory-tie">مبروك للجميع · {names.join(" و ")}</p>}
    <span className="victory-signature">اللعب يجمعنا · قدّام</span>
    <svg className="victory-skyline" viewBox="0 0 600 48" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 48V36h28V24h12V12h12v12h10v-7h16v19h18V8h10v-8h8v8h10v28h28V22h16v14h25V9h12v27h26V19h18v17h29V5h12v31h21V15h16v21h24V28h16v8h26V11h14v25h18V23h18v13h22V4h12v32h26V20h14v16h23V48Z"/></svg>
  </div>;
}
