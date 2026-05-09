/**
 * Scout PWA - app.js
 * v16.6: JSON Hardening & Validation Fix.
 * Ensuring valid JSON output while maintaining paragraph flow and zero AI signatures.
 */

const SYSTEM_PROMPT = `You are a sharp operator and investor who has seen hundreds of pitches. 
You think from first principles. You are blunt. You do not hedge.

FRAMEWORK:
Execute this exact 13-step framework. For each step, use the provided research data to reason. State findings and verdicts clearly.

1. What they actually do (plain sentences, translate marketing fluff).
2. Claimed problem (how they frame it).
3. The exact user (precision over generalisation).
4. Real problem stack (rank top 3-5 real problems).
5. User-problem fit (Verdict: ✅ Strong / ⚠️ Weak / ❌ Wrong).
6. Fit Gap (If weak/wrong, specify X vs Y).
7. Current solutions (manual, Excel, incumbents). Verdict: ✅ Broken / ⚠️ Imperfect / ❌ Good enough.
8. Monetary upside (Value vs Cost). Verdict: ✅ Clear / ⚠️ Hard to monetise / ❌ Nice-to-have.
9. Market size (Bottom-up calculation).
10. CM2/CM3 logic (Unit profitability & CAC). Verdict: ✅ Positive / ⚠️ Ugly / ❌ Structural problem.
11. Defensibility (Network effects, data moat, switching costs, brand, workflow lock-in).
12. Moat Reality (Plain assessment of structural hardness).
13. Gaps table (❌/⚠️ findings re-framed).

OUTPUT JSON:
{
  "company": "string",
  "tagline": "string",
  "data_quality_score": 0-100,
  "overall_verdict_short": "Back | Pass | Watch",
  "memo": {
    "what_they_do": "string",
    "claimed_problem": "string",
    "the_user": "string",
    "real_problem_stack": ["string"],
    "user_problem_fit_verdict": { "verdict": "string", "reason": "string" },
    "fit_gap_analysis": "string",
    "current_solutions": { "verdict": "string", "alternatives": "string" },
    "monetisation_logic": { "verdict": "string", "upside": "string" },
    "market_size_bottom_up": "string",
    "unit_economics_read": { "verdict": "string", "logic": "string" },
    "defensibility_stack": { "verdict": "string", "moat_details": "string" },
    "whats_working": "string",
    "gaps_table": [{ "gap": "string", "fix": "string" }],
    "final_verdict": "string"
  }
}

TONE: Short sentences. Direct verdicts. Praise where real. Critique where needed. No balance for the sake of balance.`;

const OUTREACH_PROMPT = `You have been given:
1. A company research memo
2. A resume

Your job is to write a high-conviction "Operator Thought" FROM the person in the resume TO a key stakeholder at the company.

CORE INSTRUCTIONS:
- NO AI SIGNATURES: No hedging, no formal greetings (Dear, Hi), no formal closings (Best, Regards). 
- DIRECT ENTRY: Start directly with the human truth or the research signal.
- PARAGRAPH SPACING: Use proper paragraph breaks with escaped double-newlines (\\n\\n) between distinct thoughts.
- OPERATOR PROSE: Use plain, heavy words. High conviction, low arrogance.
- STRICT JSON: Your entire response must be ONLY a valid JSON object. No preamble. No post-amble. Escape all quotes and newlines within the strings.

STRUCTURE:
- Paragraph 1: The Human Truth discovery.
- Paragraph 2: The Alignment (Proof of work from resume).
- Paragraph 3: The Hard Problem (The specific defect in the memo) + The Ask.

OUTPUT JSON:
{
  "hook": "The core human truth used in the intro",
  "message": "The final Operator Thought. Use \\n\\n for paragraph breaks.",
  "why": "Why this specific direct approach will land."
}`;

// Helper: Call Vercel Proxy
async function callProxy(action, body) {
  try {
    const response = await fetch('/api/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, body })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || `Error ${response.status}`);
      throw new Error(errorMsg);
    }
    
    if (action === 'analyse' && data.error) {
      throw new Error(JSON.stringify(data.error));
    }

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Global State
let views = {};
let elements = {};
let lastSearchResults = [];
let currentReport = null;

// Initialize
function init() {
  // Capture DOM Elements
  views = {
    home: document.getElementById('home-screen'),
    report: document.getElementById('report-screen'),
    loading: document.getElementById('loading-screen'),
    error: document.getElementById('error-screen'),
    outreach: document.getElementById('outreach-screen'),
    disambiguation: document.createElement('section')
  };
  
  views.disambiguation.id = 'disambiguation-screen';
  views.disambiguation.className = 'view hidden';
  const appContainer = document.getElementById('app');
  if (appContainer) appContainer.appendChild(views.disambiguation);

  elements = {
    companyInput: document.getElementById('company-name'),
    contextToggle: document.getElementById('toggle-context'),
    extraContext: document.getElementById('extra-context'),
    analyseBtn: document.getElementById('analyse-btn'),
    recentChips: document.getElementById('recent-chips'),
    reportContainer: document.getElementById('report-container'),
    reportHeader: document.getElementById('report-title-header'),
    backBtn: document.getElementById('back-to-home'),
    loadingCompanyName: document.getElementById('loading-company-name'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    
    // Outreach Elements
    backToReport: document.getElementById('back-to-report'),
    resumeText: document.getElementById('resume-text'),
    generateOutreachBtn: document.getElementById('generate-outreach-btn'),
    outreachResult: document.getElementById('outreach-result')
  };

  renderRecentSearches();
  setupEventListeners();
  console.log("Scout Initialized (v16)");
}

function setupEventListeners() {
  if (elements.contextToggle) {
    elements.contextToggle.addEventListener('click', () => {
      elements.extraContext.classList.toggle('hidden');
      elements.contextToggle.textContent = elements.extraContext.classList.contains('hidden') ? '+ Add context' : '- Remove context';
    });
  }

  if (elements.analyseBtn) {
    elements.analyseBtn.addEventListener('click', () => {
      const company = elements.companyInput.value.trim();
      const context = elements.extraContext.value.trim();
      if (company) startResearchFlow(company, context);
    });
  }

  if (elements.backBtn) elements.backBtn.addEventListener('click', () => showView('home'));
  if (elements.retryBtn) elements.retryBtn.addEventListener('click', () => showView('home'));
  
  if (elements.backToReport) elements.backToReport.addEventListener('click', () => showView('report'));
  if (elements.generateOutreachBtn) elements.generateOutreachBtn.addEventListener('click', handleGenerateOutreach);
}

function showView(viewName) {
  if (!views[viewName]) return;
  [...Object.values(views)].forEach(v => {
    if (v) v.classList.add('hidden');
  });
  views[viewName].classList.remove('hidden');
  window.scrollTo(0, 0);
}

function updateLoadingStep(step) {
  let stepEl = document.querySelector('.loading-step');
  if (!stepEl && elements.loadingCompanyName) {
    stepEl = document.createElement('div');
    stepEl.className = 'loading-step';
    stepEl.style.cssText = "font-family:var(--mono); font-size:0.7rem; color:var(--accent); margin-top:1rem; letter-spacing:0.1em;";
    elements.loadingCompanyName.parentElement.appendChild(stepEl);
  }
  if (stepEl) stepEl.textContent = `> ${step}`;
}

async function startResearchFlow(company, context) {
  showView('loading');
  updateLoadingStep('Scanning market landscape...');

  try {
    const searchData = await callProxy('search', {
      query: `${company} company official website and business profile`,
      search_depth: "basic",
      max_results: 6
    });
    
    let results = searchData.results || [];
    const companyClean = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    results.sort((a, b) => {
      const aMatches = a.url.toLowerCase().includes(companyClean);
      const bMatches = b.url.toLowerCase().includes(companyClean);
      return bMatches - aMatches;
    });

    lastSearchResults = results;
    renderDisambiguation(company, lastSearchResults, context);
    showView('disambiguation');

  } catch (err) {
    console.error(err);
    if (elements.errorMessage) elements.errorMessage.textContent = `Search Error: ${err.message}`;
    showView('error');
  }
}

function renderDisambiguation(query, results, originalContext) {
  const companyClean = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  views.disambiguation.innerHTML = `
    <header class="home-header">
      <h1>Which ${query}?</h1>
      <p>Target identification required for Operator Memo</p>
    </header>
    <div class="disambiguation-list" style="display:flex; flex-direction:column; gap:1rem;">
      ${results.length === 0 ? '<p>No results found.</p>' : results.map((r, i) => `
        <div class="disambiguation-item ${r.url.toLowerCase().includes(companyClean) ? 'priority' : ''}" onclick="startOptimizedAnalysis('${query}', ${i}, '${originalContext}')">
          <h4 style="font-family:var(--serif); font-size:1.5rem;">${r.title}</h4>
          <p style="font-family:var(--mono); font-size:0.75rem; color:var(--accent); margin:0.5rem 0;">${r.url}</p>
          <p style="font-size:0.85rem; color:var(--text-dim);">${r.content.substring(0, 150)}...</p>
        </div>
      `).join('')}
      <div class="disambiguation-item" onclick="startOptimizedAnalysis('${query}', -1, '${originalContext}')">
        <h4>General Aggregated Research</h4>
        <p>No specific source target</p>
      </div>
    </div>
    <button class="btn-text" style="margin-top: 2rem; color:var(--text-muted);" onclick="showView('home')">← Back to search</button>
  `;
}

async function startOptimizedAnalysis(query, selectedIndex, originalContext) {
  showView('loading');
  if (elements.loadingCompanyName) elements.loadingCompanyName.textContent = query;
  
  try {
    updateLoadingStep('Executing Two-Stage Agentic Hunt...');
    let baseContext = originalContext ? `User Context: ${originalContext}\n\n` : '';
    if (selectedIndex !== -1 && lastSearchResults[selectedIndex]) {
      baseContext += `Main Selection: ${lastSearchResults[selectedIndex].content}\n`;
    }
    
    const baseData = await callProxy('search', {
      query: `${query} business model operations product features target customers`,
      search_depth: "basic",
      max_results: 5
    });
    baseContext += (baseData.results || []).map(r => r.content).join('\n\n');

    updateLoadingStep('Generating deep-pillar hunt query...');
    const huntResponse = await callProxy('analyse', {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a sharp analyst. Generate ONE search query to uncover: 1. Specific Unit Economics/Pricing 2. Flywheel evidence 3. Real switching costs/lock-in. Output ONLY the query." },
        { role: "user", content: baseContext.substring(0, 5000) }
      ]
    });
    const targetedQuery = huntResponse.choices[0].message.content.trim().replace(/^"|"$/g, '');

    updateLoadingStep(`Hunting for truth: ${targetedQuery.toLowerCase().substring(0, 30)}...`);
    const huntData = await callProxy('search', {
      query: `${query} ${targetedQuery}`,
      search_depth: "basic",
      max_results: 5
    });
    
    let finalContext = "DEEP PILLAR EVIDENCE:\n" + (huntData.results || []).map(r => r.content).join('\n') + 
                       "\n\nBASE CONTEXT:\n" + baseContext;
    finalContext = finalContext.substring(0, 15000); 

    updateLoadingStep('Writing Operator Memo (13-step framework)...');
    const finalResponse = await callProxy('analyse', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Research Data:\n${finalContext}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.0
    });

    const reportData = JSON.parse(finalResponse.choices[0].message.content);
    currentReport = reportData;
    saveReport(reportData);
    renderReport(reportData);
    showView('report');

  } catch (err) {
    console.error(err);
    if (elements.errorMessage) elements.errorMessage.textContent = `Analysis Failed: ${err.message}`;
    showView('error');
  }
}

async function handleGenerateOutreach() {
  const resume = elements.resumeText.value.trim();
  const format = document.querySelector('input[name="format"]:checked').value;
  
  if (!resume) return alert("Please paste a resume first.");
  if (!currentReport) return alert("No company data found.");

  elements.generateOutreachBtn.textContent = "Processing Intelligence...";
  elements.generateOutreachBtn.disabled = true;

  try {
    const response = await callProxy('analyse', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: OUTREACH_PROMPT },
        { role: "user", content: `COMPANY MEMO:\n${JSON.stringify(currentReport)}\n\nRESUME:\n${resume}\n\nFORMAT: ${format}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.0
    });

    const result = JSON.parse(response.choices[0].message.content);
    renderOutreachResult(result);
  } catch (err) {
    alert("Outreach generation failed: " + err.message);
  } finally {
    elements.generateOutreachBtn.textContent = "Generate Mission Message";
    elements.generateOutreachBtn.disabled = false;
  }
}

function renderOutreachResult(data) {
  elements.outreachResult.classList.remove('hidden');
  elements.outreachResult.innerHTML = `
    <div class="outreach-result-card">
      <div class="memo-label">INTELLIGENCE HOOK</div>
      <div class="memo-content" style="font-weight:700; color:var(--accent); margin-bottom:2rem;">${data.hook}</div>
      
      <div class="memo-label">MISSION MESSAGE <span class="copy-badge" onclick="copyText('outreach-msg')">COPY</span></div>
      <div id="outreach-msg" class="memo-content" style="background:rgba(255,255,255,0.03); padding:1.5rem; border-radius:8px; border:1px solid var(--border); white-space:pre-wrap; line-height:1.8;">${data.message}</div>
      
      <div class="memo-label" style="margin-top:2rem;">THE BET</div>
      <div class="memo-content" style="font-style:italic; color:var(--text-dim);">${data.why}</div>
    </div>
  `;
  window.scrollTo({ top: elements.outreachResult.offsetTop - 100, behavior: 'smooth' });
}

function copyText(id) {
  const text = document.getElementById(id).innerText;
  navigator.clipboard.writeText(text);
  const badge = document.querySelector('.copy-badge');
  badge.textContent = "COPIED!";
  setTimeout(() => badge.textContent = "COPY", 2000);
}

function saveReport(report) {
  try {
    const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
    const filtered = recent.filter(r => r.company && r.company.toLowerCase() !== report.company.toLowerCase());
    filtered.unshift({ ...report, timestamp: Date.now() });
    localStorage.setItem('scout_reports', JSON.stringify(filtered.slice(0, 5)));
    renderRecentSearches();
  } catch (e) { console.error("Save failed", e); }
}

function renderRecentSearches() {
  const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  if (!elements.recentChips) return;
  elements.recentChips.innerHTML = '';
  recent.forEach(report => {
    if (!report.company) return;
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = report.company;
    chip.addEventListener('click', () => {
      currentReport = report;
      renderReport(report);
      showView('report');
    });
    elements.recentChips.appendChild(chip);
  });
}

function getVerdictClass(verdict) {
  if (!verdict) return '';
  const v = verdict.toLowerCase();
  if (v.includes('✅') || v.includes('strong') || v.includes('positive') || v.includes('broken') || v.includes('back')) return 'positive';
  if (v.includes('⚠️') || v.includes('weak') || v.includes('ugly') || v.includes('imperfect') || v.includes('watch')) return 'warning';
  if (v.includes('❌') || v.includes('wrong') || v.includes('negative') || v.includes('enough') || v.includes('pass')) return 'negative';
  return '';
}

function renderReport(data) {
  if (elements.reportHeader) {
    elements.reportHeader.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <span style="font-family:var(--mono); font-size:0.6rem; color:var(--accent);">ID: SCOUT_${Math.floor(Math.random()*10000)}</span>
        <span>${data.company}</span>
      </div>
    `;
  }
  const m = data.memo;
  
  if (elements.reportContainer) {
    elements.reportContainer.innerHTML = `
      <div class="memo-header" style="margin-bottom: 4rem; animation: viewIn 0.8s ease;">
        <div style="font-family: var(--mono); font-size: 0.65rem; color: var(--accent); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 8px; height: 8px; background: var(--accent); border-radius: 50%; display: inline-block;"></span>
          CONFIDENTIAL OPERATOR INTELLIGENCE // ${new Date().toLocaleDateString()}
        </div>
        <h1>${data.company}</h1>
        <p style="font-size: 1.5rem; color: var(--text-dim); margin-top: 1rem; font-family: var(--serif); font-style: italic;">"${data.tagline}"</p>
        
        <div style="margin-top: 3rem; display: flex; gap: 1.5rem; align-items: center;">
          <div class="pill ${getVerdictClass(data.overall_verdict_short)}">${data.overall_verdict_short}</div>
          <div style="font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted); border-left: 1px solid var(--border); padding-left: 1.5rem;">
            CONFIDENCE: ${data.data_quality_score}%
          </div>
        </div>
      </div>

      <div class="memo-section">
        <div class="memo-label">01 // MECHANISM</div>
        <div class="memo-title">What they actually do</div>
        <div class="memo-content">${m.what_they_do}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">02 // NARRATIVE</div>
        <div class="memo-title">Claimed Problem</div>
        <div class="memo-content">${m.claimed_problem}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">03 // ICP</div>
        <div class="memo-title">The Target User</div>
        <div class="memo-content">${m.the_user}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">04 // GROUND TRUTH</div>
        <div class="memo-title">Real user problem stack</div>
        <ul class="memo-list" style="counter-reset: li;">
          ${m.real_problem_stack.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>

      <div class="memo-section">
        <div class="memo-label">05 & 06 // CONVICTION</div>
        <div class="memo-title">User-Problem Fit Analysis</div>
        <div class="memo-verdict ${getVerdictClass(m.user_problem_fit_verdict.verdict)}">${m.user_problem_fit_verdict.verdict}</div>
        <div class="memo-content" style="margin-bottom: 2rem;">${m.user_problem_fit_verdict.reason}</div>
        ${m.fit_gap_analysis ? `
          <div style="background: rgba(255,71,87,0.05); border: 1px solid rgba(255,71,87,0.2); padding: 2rem; border-radius: 12px;">
            <div class="memo-label" style="color: var(--danger);">FIT GAP DETECTED</div>
            <div class="memo-content" style="color: #ff8a93;">${m.fit_gap_analysis}</div>
          </div>
        ` : ''}
      </div>

      <div class="memo-section">
        <div class="memo-label">07 // LANDSCAPE</div>
        <div class="memo-title">Current Alternatives</div>
        <div class="memo-verdict ${getVerdictClass(m.current_solutions.verdict)}">${m.current_solutions.verdict}</div>
        <div class="memo-content">${m.current_solutions.alternatives}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">08 & 09 // UPSIDE</div>
        <div class="memo-title">Monetisation & Market Economics</div>
        <div class="memo-verdict ${getVerdictClass(m.monetisation_logic.verdict)}">${m.monetisation_logic.verdict}</div>
        <div class="memo-content" style="margin-bottom: 1.5rem;"><strong>Value Extraction:</strong> ${m.monetisation_logic.upside}</div>
        <div class="memo-content"><strong>Market Read:</strong> ${m.market_size_bottom_up}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">10 // PROFITABILITY</div>
        <div class="memo-title">Unit Economics & CM2/CM3</div>
        <div class="memo-verdict ${getVerdictClass(m.unit_economics_read.verdict)}">${m.unit_economics_read.verdict}</div>
        <div class="memo-content">${m.unit_economics_read.logic}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">11 & 12 // DEFENSE</div>
        <div class="memo-title">Moat & Structural Hardness</div>
        <div class="memo-verdict ${getVerdictClass(m.defensibility_stack.verdict)}">${m.defensibility_stack.verdict}</div>
        <div class="memo-content">${m.defensibility_stack.moat_details}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">13 // STRATEGIC REFRAME</div>
        <div class="memo-title">Identified Gaps & Required Fixes</div>
        <table class="memo-table">
          <thead><tr><th>STRUCTURAL GAP</th><th>OPERATOR FIX</th></tr></thead>
          <tbody>
            ${m.gaps_table.map(g => `<tr><td style="color:var(--danger); font-weight:600;">${g.gap}</td><td style="color:var(--accent);">${g.fix}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="memo-section" style="background: var(--surface); padding: 3rem; border-radius: 16px; margin-top: 4rem; border: 1px solid var(--border-strong);">
        <div class="memo-label" style="color: var(--accent);">EXECUTIVE SUMMARY</div>
        <div class="memo-title">Final Verdict</div>
        <div class="memo-content" style="font-weight: 500; font-size: 1.25rem; line-height: 1.4;">${m.final_verdict}</div>
      </div>

      <div style="margin-top: 4rem; padding-bottom: 6rem; text-align: center;">
        <button id="trigger-outreach-btn" class="btn-primary" style="background: var(--accent); color: #000; width: 100%; max-width: 400px;">
          Draft Outreach Message
        </button>
      </div>
    `;
    
    // Add event listener to the dynamically rendered button
    document.getElementById('trigger-outreach-btn').addEventListener('click', () => {
      showView('outreach');
    });
  }
}

// Global exposure
window.startOptimizedAnalysis = startOptimizedAnalysis;
window.showView = showView;
window.copyText = copyText;

// Run Init when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
