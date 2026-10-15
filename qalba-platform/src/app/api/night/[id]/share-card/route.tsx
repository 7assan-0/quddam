import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth/session";
import { nightEnabled } from "@/lib/night/catalog";
import { getNightView } from "@/lib/night/service";
import { deriveNightHighlights } from "@/lib/night/highlights";
import type { CSSProperties } from "react";
import { cardTextRuns, localCardName } from "@/lib/night/card-text";
import { nightDenied, nightErrorResponse, nightIdSchema, nightPrivateHeaders } from "@/lib/night/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Arabic word order must be explicit: Satori ignores direction:rtl for text. */
function CardText({ text, style }: { text: string; style?: CSSProperties }) {
  return <div lang="ar" data-card-rtl="true" style={{ display: "flex", flexDirection: "row-reverse",
    flexWrap: "wrap", alignItems: "center", alignContent: "flex-start", columnGap: 7,
    width: "100%", lineHeight: 1.35, ...style }}>
    {cardTextRuns(text).map((run, index) => <span key={index} style={{ maxWidth: "100%", wordBreak: "break-all" }}>{run}</span>)}
  </div>;
}
/** PNG is owner-only, deliberately excludes links, private answers and credentials. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!nightEnabled()) return nightDenied(404);
  try {
    const user = await currentUser();
    if (!user) return nightDenied(401);
    const view = await getNightView(user.id, nightIdSchema.parse((await params).id));
    if (view.phase !== "completed") return NextResponse.json({ error: "البطاقة متاحة بعد اكتمال كل الألعاب" },
      { status: 409, headers: nightPrivateHeaders });
    const recap = deriveNightHighlights(view);
    if (!recap) throw new Error("Expected final Night highlights");
    const font = await readFile(path.join(process.cwd(), "public/fonts/lalezar/Lalezar-Regular.ttf"));
    const championNames = recap.championNames.map(localCardName);
    const fallbackUsed = recap.ranking.some(team => localCardName(team.name) !== team.name);
    const championLength = championNames.join(" و ").length;
    const maxNameLength = Math.max(...recap.ranking.map(team => localCardName(team.name).length));
    const championFontSize = championLength > 240 ? 12 : championLength > 120 ? 22 : 30;
    const rowFontSize = maxNameLength > 240 ? 12 : maxNameLength > 120 ? 18 : 25;
    const image = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
        padding: 48, background: "#0A2B22", color: "#FFFDF5", fontFamily: "Local Lalezar",
        direction: "rtl", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CardText text="قدّام · ليلة تستاهل تنعاد" style={{ fontSize: 30, color: "#FFD21F" }}/>
          <CardText text={recap.championNames.length > 1 ? "أبطال الليلة" : "بطل الليلة"} style={{ fontSize: 46 }}/>
          <CardText text={championNames.join(" و ")} style={{ fontSize: championFontSize, color: "#FFD21F" }}/>
          <CardText text={`النتيجة النهائية بعد ${recap.played} ألعاب مكتملة`} style={{ fontSize: 21, color: "#C7D8D0" }}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {recap.ranking.map(team =>
            <div key={team.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: "row-reverse",
              background: "#153E32", borderRadius: 12, padding: "10px 18px", fontSize: rowFontSize, gap: 18 }}>
              <CardText text={`${1 + recap.ranking.filter(other => other.points > team.points).length}. ${localCardName(team.name)}`} style={{ maxWidth: 850, lineHeight: 1.3 }}/>
              <CardText text={`${team.points} نقاط`} style={{ color: "#FFD21F", width: 100, flexShrink: 0 }}/>
            </div>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#D5E9DF", fontSize: 18 }}>
          <CardText text="نتائج ألعاب معتمدة من سهرة قدّام" style={{ width: "48%" }}/>
          <CardText text={fallbackUsed ? "رموز الأسماء غير المدعومة معروضة بصيغة Unicode" : "شاركوا الفوز وخلّوا التحدي يتجدد"} style={{ width: "48%" }}/>
        </div>
      </div>,
      { width: 1200, height: 630, fonts: [{ name: "Local Lalezar", data: Uint8Array.from(font).buffer, weight: 400, style: "normal" }],
        headers: { ...nightPrivateHeaders, "Content-Disposition": 'attachment; filename="quddam-night.png"' } },
    );
    // ImageResponse renders asynchronously. Materialize inside this error boundary
    // so a font/layout failure returns a sanitized failure, never a broken 200 PNG.
    return new Response(await image.arrayBuffer(), { status: image.status, headers: image.headers });
  } catch (error) { return nightErrorResponse(error); }
}
