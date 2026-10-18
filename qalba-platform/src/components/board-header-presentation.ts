import { formatNumber } from "@/lib/format-number";

type Team = { id: string; name: string; score: number; color: string };
type Input = {
  status: string;
  round: number;
  turnTeamId: string | null;
  active: { phase: string; answeringTeamId?: string | null } | null;
  teams: readonly Team[];
  cells: readonly { completed: boolean }[];
};

/** Display labels are derived from authoritative session state; no additional game state. */
export function boardHeaderPresentation(view: Input) {
  const completed = view.cells.filter(cell => cell.completed).length;
  const total = view.cells.length;
  const leadingScore = view.teams.length ? Math.max(...view.teams.map(team => team.score)) : 0;
  const leaders = view.teams.filter(team => team.score === leadingScore);
  const soleLeader = leaders.length === 1 ? leaders[0] : null;
  const actingTeam = view.teams.find(team => team.id === view.active?.answeringTeamId)
    ?? view.teams.find(team => team.id === view.turnTeamId);
  const roundLabel = view.status === "COMPLETED" ? "النتيجة النهائية"
    : view.round > 0 ? `الجولة ${formatNumber(view.round)}` : "قبل الجولة الأولى";
  let phaseLabel: string;
  if (view.status === "COMPLETED") phaseLabel = "انتهت المباراة";
  else if (view.status === "PAUSED") phaseLabel = "المباراة متوقفة مؤقتًا";
  else if (view.status === "LOBBY") phaseLabel = "بانتظار بداية المباراة";
  else if (view.active?.phase === "STEAL") phaseLabel = actingTeam ? `فرصة السرقة · ${actingTeam.name}` : "فرصة السرقة";
  else if (view.active?.phase === "CHALLENGE") phaseLabel = "اعتراض على الحكم";
  else if (view.active) phaseLabel = actingTeam ? `السؤال المفتوح · ${actingTeam.name}` : "السؤال مفتوح";
  else phaseLabel = actingTeam ? `دور الاختيار · ${actingTeam.name}` : "اختاروا السؤال التالي";
  const leaderLabel = !leaders.length ? "بانتظار الفرق"
    : soleLeader ? soleLeader.name : leaders.map(team => team.name).join(" و ");
  return {
    completed, total, roundLabel, phaseLabel, soleLeader,
    leaderLabel, isTie: leaders.length > 1, leadingScore,
    progressPercent: total ? Math.round(completed / total * 100) : 0,
  };
}
