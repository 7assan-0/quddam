import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth/session";
import { nightEnabled } from "@/lib/night/catalog";
import { getNightView } from "@/lib/night/service";
import { deriveNightHighlights } from "@/lib/night/highlights";
import { nightDenied, nightErrorResponse, nightIdSchema, nightPrivateHeaders } from "@/lib/night/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
    const font = await readFile(path.join(process.cwd(), "public/fonts/NotoSansArabic-Bold.ttf"));
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
        padding: 58, background: "#0A2B22", color: "#FFFDF5", fontFamily: "Noto Arabic",
        direction: "rtl", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 30, color: "#FFD21F" }}>قدّام · ليلة تستاهل تنعاد</div>
          <div style={{ fontSize: 53 }}>بطل الليلة</div>
          <div style={{ fontSize: 40, color: "#FFD21F" }}>{recap.championNames.join(" و ")}</div>
          <div style={{ fontSize: 21, color: "#C7D8D0" }}>النتيجة النهائية بعد {recap.played} ألعاب مكتملة</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {recap.ranking.map((team, index) =>
            <div key={team.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#153E32", borderRadius: 12, padding: "13px 22px", fontSize: 27 }}>
              <span>{index + 1 + recap.ranking.slice(0, index).filter(other => other.points > team.points).length - index}. {team.name}</span>
              <span style={{ color: "#FFD21F" }}>{team.points} نقاط</span>
            </div>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#D5E9DF", fontSize: 18 }}>
          <span>نتائج ألعاب معتمدة من سهرة قدّام</span>
          <span>شاركوا الفوز، وخلّوا التحدي يتجدد</span>
        </div>
      </div>,
      { width: 1200, height: 630, fonts: [{ name: "Noto Arabic", data: font, weight: 700, style: "normal" }],
        headers: { ...nightPrivateHeaders, "Content-Disposition": 'attachment; filename="quddam-night.png"' } },
    );
  } catch (error) { return nightErrorResponse(error); }
}
