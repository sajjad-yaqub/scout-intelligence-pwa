import { verdictClass, type ScoutReport } from "./scout-schema";

type RGB = [number, number, number];
const TONE: Record<string, RGB> = { positive: [22, 163, 74], warning: [217, 119, 6], negative: [220, 38, 38], "": [100, 116, 139] };
const clean = (text: string) => text.replace(/\[\d+\]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, "-").replace(/[^\x20-\x7E\n]/g, "").replace(/\s+/g, " ").trim();

// One-page visual summary: verdict, confidence gauge, scorecard tiles, top fixes.
export async function downloadReportPDF(report: ScoutReport) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, M = 36;
  const m = report.memo;
  function text(value: string, x: number, y: number, width: number, maxLines: number, size = 9, bold = false, color: RGB = [30, 41, 59]) {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(...color);
    let lines: string[] = pdf.splitTextToSize(clean(value), width);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1]!.replace(/\s*\S*$/, "") + "..."; }
    pdf.text(lines, x, y, { lineHeightFactor: 1.3 });
    return y + lines.length * size * 1.3;
  }
  // Header band
  pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, W, 112, "F");
  text("SCOUT // OPERATOR ONE-PAGER", M, 30, 360, 1, 8, true, [148, 163, 184]);
  text(report.company, M, 60, 380, 1, 26, true, [255, 255, 255]);
  text(report.tagline, M, 82, 380, 2, 10, false, [203, 213, 225]);
  const vTone = TONE[verdictClass(report.overall_verdict_short)]!;
  pdf.setFillColor(...vTone); pdf.roundedRect(W - M - 130, 24, 130, 40, 8, 8, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.setTextColor(255, 255, 255);
  pdf.text(report.overall_verdict_short.toUpperCase(), W - M - 65, 50, { align: "center" });
  // Confidence gauge
  text(`CONFIDENCE ${Math.round(report.data_quality_score)}%`, W - M - 130, 84, 130, 1, 8, true, [203, 213, 225]);
  pdf.setFillColor(51, 65, 85); pdf.roundedRect(W - M - 130, 90, 130, 8, 4, 4, "F");
  pdf.setFillColor(...vTone); pdf.roundedRect(W - M - 130, 90, Math.max(8, 1.3 * report.data_quality_score), 8, 4, 4, "F");

  // What they do
  let y = 138;
  text("WHAT THEY ACTUALLY DO", M, y, 540, 1, 8, true, [100, 116, 139]);
  y = text(m.what_they_do, M, y + 14, W - 2 * M, 3, 10) + 10;

  // Scorecard tiles 3x2
  const tiles: [string, string, string][] = [
    ["User-Problem Fit", m.user_problem_fit_verdict.verdict, m.user_problem_fit_verdict.reason],
    ["Alternatives", m.current_solutions.verdict, m.current_solutions.alternatives],
    ["Monetisation", m.monetisation_logic.verdict, m.monetisation_logic.upside],
    ["Unit Economics", m.unit_economics_read.verdict, m.unit_economics_read.logic],
    ["Moat", m.defensibility_stack.verdict, m.defensibility_stack.moat_details],
    ["Target User", "", m.the_user],
  ];
  const tw = (W - 2 * M - 20) / 3, th = 118;
  tiles.forEach(([label, verdict, body], i) => {
    const x = M + (i % 3) * (tw + 10), ty = y + Math.floor(i / 3) * (th + 10);
    const tone = TONE[verdictClass(verdict)]!;
    pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240); pdf.roundedRect(x, ty, tw, th, 6, 6, "FD");
    pdf.setFillColor(...tone); pdf.rect(x, ty + 6, 4, th - 12, "F");
    text(label.toUpperCase(), x + 12, ty + 18, tw - 20, 1, 7.5, true, [100, 116, 139]);
    const vy = verdict ? text(verdict, x + 12, ty + 34, tw - 20, 1, 11, true, tone) : ty + 24;
    text(body, x + 12, vy + 4, tw - 20, verdict ? 6 : 7, 8, false, [51, 65, 85]);
  });
  y += 2 * (th + 10) + 8;

  // Two columns: what's working / top fixes
  const cw = (W - 2 * M - 16) / 2;
  pdf.setFillColor(240, 253, 244); pdf.roundedRect(M, y, cw, 160, 6, 6, "F");
  text("WHAT'S WORKING", M + 12, y + 18, cw - 24, 1, 8, true, TONE["positive"]!);
  text(m.whats_working, M + 12, y + 34, cw - 24, 9, 8.5);
  const fx = M + cw + 16;
  pdf.setFillColor(254, 242, 242); pdf.roundedRect(fx, y, cw, 160, 6, 6, "F");
  text("TOP GAPS -> FIXES", fx + 12, y + 18, cw - 24, 1, 8, true, TONE["negative"]!);
  let gy = y + 34;
  for (const g of m.gaps_table.slice(0, 3)) {
    gy = text(`- ${g.gap}`, fx + 12, gy, cw - 24, 2, 8.5, true) ;
    gy = text(`Fix: ${g.fix}`, fx + 20, gy, cw - 32, 2, 8, false, [71, 85, 105]) + 4;
  }
  y += 176;

  // Final verdict
  pdf.setFillColor(15, 23, 42); pdf.roundedRect(M, y, W - 2 * M, 112, 6, 6, "F");
  text("FINAL VERDICT", M + 14, y + 20, 300, 1, 8, true, [148, 163, 184]);
  text(m.final_verdict, M + 14, y + 38, W - 2 * M - 28, 6, 9.5, false, [241, 245, 249]);
  y += 128;
  text(`Sources: ${report.sources_used.slice(0, 4).map(s => s.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]).join("  |  ")}${report.sources_used.length > 4 ? `  +${report.sources_used.length - 4} more` : ""}`, M, Math.min(y, 770), W - 2 * M, 1, 7, false, [148, 163, 184]);
  pdf.save(`Scout_OnePager_${report.company.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}
