import {contentKey} from "@/lib/content/rules";
import { z } from "zod";
import { questionSchema } from "@/lib/questions/validation";

export const columns = ["gameSlug", "categorySlug", "question", "answer", "alternativeAnswers", "explanation", "difficulty", "pointValue", "type", "options", "source", "status", "language", "country", "subcategory", "imageUrl"] as const;
export type ImportRow = z.infer<typeof questionSchema>;

/** Quoted UTF-8 CSV with CRLF, embedded newlines and escaped double quotes. */
export function parseCsv(value: string): string[][] {
  const input = value.replace(/^\uFEFF/, "");
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false; let afterQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else field += char;
    } else if (afterQuote) {
      if (char === "," || char === "\n" || char === "\r") { afterQuote = false; i--; }
      else throw new Error("نص CSV غير صحيح بعد علامة الاقتباس");
    } else if (char === '"') {
      if (field) throw new Error("علامة اقتباس داخل حقل غير محاط باقتباس");
      quoted = true;
    } else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field); if (row.some(cell => cell.trim())) rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("علامة اقتباس غير مغلقة في CSV");
  if (afterQuote || field || row.length) { row.push(field); if (row.some(cell => cell.trim())) rows.push(row); }
  return rows;
}

export function validateImport(csv: string, games: Map<string, string>, categories: Map<string, string>) {
  const rows = parseCsv(csv);
  if (rows.length === 0 || rows[0].length !== columns.length || columns.some((column, index) => rows[0][index]?.trim() !== column)) {
    throw new Error(`أعمدة CSV مطلوبة بهذا الترتيب: ${columns.join(", ")}`);
  }
  if (rows.length > 251) throw new Error("الحد الأقصى للاستيراد ٢٥٠ سؤالًا في الدفعة");
  const errors: { row: number; message: string }[] = [];
  const parsed: ImportRow[] = [];
  const seen = new Set<string>();
  for (const [index, cells] of rows.slice(1).entries()) {
    const line = index + 2;
    if (cells.length !== columns.length) { errors.push({ row: line, message: "عدد الأعمدة غير صحيح" }); continue; }
    const item = Object.fromEntries(columns.map((key, position) => [key, cells[position].trim()]));
    const gameTypeId = games.get(item.gameSlug); const categoryId = categories.get(item.categorySlug);
    if (!gameTypeId || !categoryId) { errors.push({ row: line, message: "اللعبة أو الفئة غير موجودة" }); continue; }
    const result = questionSchema.safeParse({ gameTypeId, categoryId, question: item.question, answer: item.answer,
      alternativeAnswers: item.alternativeAnswers ? item.alternativeAnswers.split("|").map(s => s.trim()) : [],
      explanation: item.explanation || null, difficulty: item.difficulty, pointValue: Number(item.pointValue), type: item.type,
      options: item.options ? item.options.split("|").map(s => s.trim()) : null, source: item.source || null,
      status: item.status, language: item.language || "ar", country: item.country || null,
      subcategory: item.subcategory || null, imageUrl: item.imageUrl || null });
    if (!result.success) { errors.push({ row: line, message: result.error.issues[0]?.message ?? "سؤال غير صالح" }); continue; }
    const duplicateKey = `${gameTypeId}:${categoryId}:${contentKey(result.data.question)}`;
    if (seen.has(duplicateKey)) { errors.push({ row: line, message: "سؤال مكرر في الملف" }); continue; }
    seen.add(duplicateKey); parsed.push(result.data);
  }
  return { parsed, errors, total: Math.max(0, rows.length - 1) };
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  const cell = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return `\uFEFF${rows.map(row => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
