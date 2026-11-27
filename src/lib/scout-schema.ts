import { z } from "zod";

export const sourceSchema = z.object({ id: z.number().int(), url: z.string().url().refine(url => /^https?:\/\//.test(url)), title: z.string() });
export const candidateSchema = z.object({ title: z.string(), url: z.string().url().refine(url => /^https?:\/\//.test(url)), content: z.string() });
export const searchSchema = z.object({ results: z.array(candidateSchema) });
export const reportSchema = z.object({
  company: z.string(), tagline: z.string(), data_quality_score: z.number().min(0).max(100), overall_verdict_short: z.enum(["Back", "Pass", "Watch"]), sources_used: z.array(sourceSchema),
  memo: z.object({
    what_they_do: z.string(), claimed_problem: z.string(), the_user: z.string(), real_problem_stack: z.array(z.string()),
    user_problem_fit_verdict: z.object({ verdict: z.string(), reason: z.string() }), fit_gap_analysis: z.string(),
    current_solutions: z.object({ verdict: z.string(), alternatives: z.string() }), monetisation_logic: z.object({ verdict: z.string(), upside: z.string() }),
    market_size_bottom_up: z.string(), unit_economics_read: z.object({ verdict: z.string(), logic: z.string() }),
    defensibility_stack: z.object({ verdict: z.string(), moat_details: z.string() }), whats_working: z.string(),
    gaps_table: z.array(z.object({ gap: z.string(), fix: z.string() })), final_verdict: z.string(),
  }),
});
export const outreachSchema = z.object({ hook: z.string(), message: z.string(), why: z.string() });
export const researchInputSchema = z.object({ company: z.string().trim().min(1).max(200), context: z.string().max(4000), selected: candidateSchema.nullable() });
export type ScoutReport = z.infer<typeof reportSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Outreach = z.infer<typeof outreachSchema>;

export function verdictClass(verdict: string) {
  const value = verdict.toLowerCase();
  if (/✅|strong|positive|broken|back/.test(value)) return "positive";
  if (/⚠|weak|ugly|imperfect|watch/.test(value)) return "warning";
  if (/❌|wrong|negative|enough|pass/.test(value)) return "negative";
  return "";
}

export type SavedReport = ScoutReport & { timestamp: number };
export function recentReports(reports: SavedReport[], incoming: SavedReport): SavedReport[] {
  return [incoming, ...reports.filter(report => report.company.toLowerCase() !== incoming.company.toLowerCase())].slice(0, 5);
}