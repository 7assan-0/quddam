/** TV-only celebration; winner names always come from the live game view. */
export function VictorySpotlight({ names, headingLevel: Heading = "h1" }: { names: string[]; headingLevel?: "h1" | "h2" }) {
  const tie = names.length > 1;
  return <div className="victory-spotlight">
    <span className="victory-spark victory-spark--one" aria-hidden="true">✦</span>
    <span className="victory-spark victory-spark--two" aria-hidden="true">✳</span>
    <span className="victory-spark victory-spark--three" aria-hidden="true">✦</span>
    <span className="victory-label">✦ النتيجة النهائية ✦</span>
    <span className="victory-trophy" aria-hidden="true">★</span>
    <Heading>{tie ? "تعادل!" : names.length === 1 ? `الفائز: ${names[0]}` : "انتهت المباراة"}</Heading>
    {tie && <p className="victory-tie">مبروك للجميع · {names.join(" و ")}</p>}
    <span className="victory-signature">اللعب يجمعنا · قدّام</span>
  </div>;
}
