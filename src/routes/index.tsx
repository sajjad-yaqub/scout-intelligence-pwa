import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { findCompaniesFn, researchCompanyFn, draftOutreachFn } from "@/lib/scout.functions";
import { reportSchema, recentReports, verdictClass, type Candidate, type ScoutReport, type SavedReport, type Outreach } from "@/lib/scout-schema";
import { readResumePDF } from "@/lib/resume-pdf";
import { downloadReportPDF } from "@/lib/scout-pdf";
import capturedCSS from "../styles/site.css?raw";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Scout // Operator Intelligence" },
    { name: "description", content: "Scout company intelligence, operator research, investment reports, and mission messages." },
    { property: "og:title", content: "Scout // Operator Intelligence" },
    { property: "og:description", content: "Company intelligence and high-conviction operator research with Scout." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  staticData: { importedDocument: { html: { lang: "en" }, body: {} } },
  component: Index,
});

type View = "home" | "loading" | "disambiguation" | "report" | "outreach" | "error";
function Index() {
  const [view, setView] = useState<View>("home");
  const [company, setCompany] = useState("");
  const [context, setContext] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");
  const [resume, setResume] = useState("");
  const [outreach, setOutreach] = useState<Outreach | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachError, setOutreachError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const findCompanies = useServerFn(findCompaniesFn);
  const researchCompany = useServerFn(researchCompanyFn);
  const draftOutreach = useServerFn(draftOutreachFn);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("scout_reports") ?? "[]");
      if (Array.isArray(stored)) {
        const reports = stored.flatMap(item => {
          const parsed = reportSchema.safeParse(item);
          return parsed.success ? [{ ...parsed.data, timestamp: typeof item.timestamp === "number" ? item.timestamp : 0 }] : [];
        });
        setHistory(reports.slice(0, 5));
      }
    } catch { /* Corrupt local history does not block a new search. */ }
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  function show(next: View) { setError(""); setView(next); }
  async function search() {
    if (!company.trim()) return;
    setStep("Scanning market landscape..."); setView("loading"); setError(""); setOutreach(null);
    try { setResults(await findCompanies({ data: { company, context } })); setView("disambiguation"); }
    catch (err) { setError(err instanceof Error ? err.message : "Search could not be completed."); setView("error"); }
  }
  async function analyse(selected: Candidate | null) {
    setStep("Executing Two-Stage Agentic Hunt..."); setView("loading");
    const steps = ["Mapping business model and users...", "Hunting pricing and unit economics...", "Stress-testing moat and alternatives...", "Writing the operator memo..."];
    let i = 0;
    const ticker = window.setInterval(() => { setStep(steps[Math.min(i++, steps.length - 1)]!); }, 15000);
    let timer = 0;
    try {
      const data = await Promise.race([
        researchCompany({ data: { company, context, selected } }),
        new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("The research took too long. Please try again.")), 180000); }),
      ]);
      setReport(data); setOutreach(null);
      const saved = recentReports(history, { ...data, timestamp: Date.now() });
      setHistory(saved);
      try { localStorage.setItem("scout_reports", JSON.stringify(saved)); } catch { /* Report remains usable when browser storage is full. */ }
      setView("report");
    } catch (err) { setError(err instanceof Error ? err.message : "Analysis could not be completed."); setView("error"); }
    finally { window.clearInterval(ticker); window.clearTimeout(timer); }
  }
  async function generateOutreach() {
    if (!resume.trim()) { setOutreachError("Please paste a resume first."); return; }
    if (!report) return;
    setOutreachBusy(true); setOutreachError(""); setCopied(false);
    try { setOutreach(await draftOutreach({ data: { report, resume } })); }
    catch (err) { setOutreachError(err instanceof Error ? err.message : "Outreach generation failed."); }
    finally { setOutreachBusy(false); }
  }
  async function exportPDF() {
    if (!report) return;
    setPdfBusy(true); setError("");
    try { await downloadReportPDF(report); } catch { setError("The PDF could not be downloaded. Please try again."); }
    finally { setPdfBusy(false); }
  }
  async function copyMessage() {
    if (!outreach) return;
    try { await navigator.clipboard.writeText(outreach.message); setCopied(true); }
    catch { setOutreachError("Copy was unavailable. Select the message to copy it."); }
  }
  const viewClass = (name: View, extra = "") => `view ${view === name ? "" : "hidden"} ${extra}`;
  function cite(text: string): ReactNode {
    return text.split(/(\[\d+\])/g).map((part, index) => {
      const match = /^\[(\d+)\]$/.exec(part);
      const source = match ? report?.sources_used.find(s => s.id === Number(match[1])) : null;
      return source ? <a className="citation" key={index} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>{part}</a> : part;
    });
  }
  function section(label: string, title: string, text: string, verdict = "") {
    return <div className="memo-section"><div className="memo-label">{label}</div><div className="memo-title">{title}</div>{verdict && <div className={`memo-verdict ${verdictClass(verdict)}`}>{verdict}</div>}<div className="memo-content">{cite(text)}</div></div>;
  }
  const m = report?.memo;
  return <>
    <style>{capturedCSS}</style>
    <div className="max-w-[800px]" id="app">
      <section className={viewClass("home", "items-center text-center")} id="home-screen">
        <header className="home-header"><h1>Scout</h1><p>Company Intelligence Engine</p></header>
        <form className="search-box" onSubmit={event => { event.preventDefault(); void search(); }}>
          <div className="input-group"><input type="text" id="company-name" aria-label="Target Company" placeholder="Target Company" autoComplete="off" maxLength={200} value={company} onChange={event => setCompany(event.target.value)} /></div>
          <div className="search-actions">
            <Button type="button" variant="scoutText" size="source" id="toggle-context" aria-expanded={contextOpen} aria-controls="extra-context" onClick={() => setContextOpen(open => !open)}>{contextOpen ? "- Remove context" : "+ Add context"}</Button>
            <textarea className={`scout-context ${contextOpen ? "" : "hidden"}`} id="extra-context" aria-label="Research context" placeholder="Add specific industry or research goals..." maxLength={4000} value={context} onChange={event => setContext(event.target.value)} />
            <Button variant="scout" size="source" id="analyse-btn" type="submit">Analyse</Button>
          </div>
        </form>
        <div className="recent-container"><h3 className="uppercase [font-family:var(--mono)] [font-size:0.55rem] [letter-spacing:0.3em]">Recent Intelligence</h3><div className="chips" id="recent-chips">{history.map(item => <Button variant="scoutChip" size="source" key={item.company} onClick={() => { setReport(item); setOutreach(null); show("report"); }}>{item.company}</Button>)}</div></div>
      </section>
      <section className={viewClass("disambiguation")} id="disambiguation-screen">
        <header className="home-header"><p>Target Identification</p><h1>Which {company}?</h1></header>
        <div className="disambiguation-list">{results.length === 0 && <p>No results found.</p>}{results.map((result, index) => <Button key={`${result.url}-${index}`} variant="scoutTarget" size="source" onClick={() => void analyse(result)}><span className="target-text"><h4>{result.title}</h4><p className="target-domain">{new URL(result.url).hostname}</p><p className="target-description">{result.content.substring(0, 140)}...</p></span></Button>)}
          <Button variant="scoutTarget" size="source" className="target-general" onClick={() => void analyse(null)}>None of these // General Research</Button>
        </div><div className="search-back"><Button variant="scoutText" size="source" onClick={() => show("home")}>← Back to search</Button></div>
      </section>
      <section className={viewClass("loading", "loading-view")} id="loading-screen" aria-live="polite" aria-busy={view === "loading"}>
        <div><div className="loading-label">AGENTIC HUNT IN PROGRESS</div><h2 id="loading-company-name">{company || "Searching..."}</h2><div className="loading-step">&gt; {step}</div></div>
        <div className="skeleton-grid"><div className="shimmer" /><div className="shimmer" /><div className="shimmer" /></div>
      </section>
      <section className={viewClass("report")} id="report-screen">
        <nav className="report-nav"><Button variant="scoutIcon" size="source" id="back-to-home" onClick={() => show("home")}>← BACK</Button><div className="report-title" id="report-title-header">{report?.company ?? "Report Summary"}</div><Button variant="scoutIcon" size="source" id="download-pdf-btn" onClick={() => void exportPDF()} disabled={pdfBusy}>{pdfBusy ? "Saving..." : "PDF ↓"}</Button></nav>
        {error && <p className="scout-error" role="alert">{error}</p>}
        <div id="report-container">{report && m && <>
          <div className="memo-header report-header"><div className="confidential-label">CONFIDENTIAL OPERATOR INTELLIGENCE</div><h1>{report.company}</h1><p className="report-tagline">“{report.tagline}”</p><div className="report-confidence"><div className={`pill ${verdictClass(report.overall_verdict_short)}`}>{report.overall_verdict_short}</div><div className="confidence">CONFIDENCE: {report.data_quality_score}%</div></div></div>
          {section("01 // MECHANISM", "What they actually do", m.what_they_do)}
          {section("02 // NARRATIVE", "Claimed Problem", m.claimed_problem)}
          {section("03 // ICP", "The Target User", m.the_user)}
          <div className="memo-section"><div className="memo-label">04 // GROUND TRUTH</div><div className="memo-title">Real user problem stack</div><ul className="memo-list">{m.real_problem_stack.map((text, index) => <li key={index}>{cite(text)}</li>)}</ul></div>
          {section("05 & 06 // CONVICTION", "User-Problem Fit Analysis", m.user_problem_fit_verdict.reason, m.user_problem_fit_verdict.verdict)}
          {m.fit_gap_analysis && section("FIT GAP DETECTED", "Fit gap", m.fit_gap_analysis)}
          {section("07 // LANDSCAPE", "Current Alternatives", m.current_solutions.alternatives, m.current_solutions.verdict)}
          {section("08 & 09 // UPSIDE", "Monetisation & Market Economics", `${m.monetisation_logic.upside}\n\nMarket Read: ${m.market_size_bottom_up}`, m.monetisation_logic.verdict)}
          {section("10 // PROFITABILITY", "Unit Economics & CM2/CM3", m.unit_economics_read.logic, m.unit_economics_read.verdict)}
          {section("11 & 12 // DEFENSE", "Moat & Structural Hardness", m.defensibility_stack.moat_details, m.defensibility_stack.verdict)}
          <div className="memo-section"><div className="memo-label">13 // STRATEGIC REFRAME</div><div className="memo-title">Identified Gaps & Required Fixes</div><table className="memo-table"><thead><tr><th>STRUCTURAL GAP</th><th>OPERATOR FIX</th></tr></thead><tbody>{m.gaps_table.map((gap, index) => <tr key={index}><td className="negative">{cite(gap.gap)}</td><td className="positive">{cite(gap.fix)}</td></tr>)}</tbody></table></div>
          {section("EXECUTIVE SUMMARY", "Final Verdict", m.final_verdict)}
          <div className="memo-section"><div className="memo-label">INTELLIGENCE SOURCES</div><div className="sources-list">{report.sources_used.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span>[{source.id}]</span> {source.title}</a>)}</div></div>
          <div className="outreach-action"><Button variant="scout" size="source" id="trigger-outreach-btn" onClick={() => show("outreach")}>Draft Outreach Message</Button></div>
        </>}</div>
      </section>
      <section className={viewClass("outreach")} id="outreach-screen">
        <nav className="report-nav"><Button variant="scoutIcon" size="source" id="back-to-report" onClick={() => show("report")}>← BACK</Button><div className="report-title">Mission Message</div><div /></nav>
        <div className="memo-header"><h1>Draft Outreach</h1><p className="memo-content">Constructing a high-conviction pattern-interrupt message.</p></div>
        <div className="memo-section"><div className="memo-label">USER INPUT</div><label className="resume-upload"><input type="file" accept="application/pdf" aria-label="Upload resume PDF" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setOutreachError(""); readResumePDF(file).then(text => { if (!text) setOutreachError("No text found in that PDF. Please paste your resume instead."); else setResume(text); }).catch(() => setOutreachError("That PDF could not be read. Please paste your resume instead.")); }} /><span>Upload resume PDF</span></label><textarea className="resume-input" id="resume-text" aria-label="Resume or bio" placeholder="Paste your resume or bio here, or upload a PDF above..." maxLength={30000} value={resume} onChange={event => setResume(event.target.value)} /><Button variant="scout" size="source" className="outreach-submit" id="generate-outreach-btn" onClick={() => void generateOutreach()} disabled={outreachBusy}>{outreachBusy ? "Processing Intelligence..." : "Generate Mission Message"}</Button>{outreachError && <p role="alert" className="scout-error">{outreachError}</p>}</div>
        <div className={outreach ? "" : "hidden"} id="outreach-result">{outreach && <div className="outreach-result-card"><div className="memo-label">INTELLIGENCE HOOK</div><div className="memo-content outreach-hook">{outreach.hook}</div><div className="memo-label">MISSION MESSAGE <Button variant="scoutText" size="source" className="copy-badge" onClick={() => void copyMessage()}>{copied ? "COPIED!" : "COPY"}</Button></div><div id="outreach-msg" className="memo-content outreach-message">{outreach.message}</div><div className="memo-label outreach-bet">THE BET</div><div className="memo-content">{outreach.why}</div></div>}</div>
      </section>
      <section className={viewClass("error", "error-view")} id="error-screen" role={view === "error" ? "alert" : undefined}><h2>Mission Aborted</h2><p className="memo-content" id="error-message">{error}</p><Button variant="scout" size="source" id="retry-btn" onClick={() => show("home")}>Retry Search</Button></section>
    </div>
  </>;
}
