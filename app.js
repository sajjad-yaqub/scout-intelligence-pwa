// Scout Intelligence PWA - Core Logic (v16.15)

// State Management
let elements = {};
let views = {};
let currentReport = null;
let deferredPrompt = null;

// Design Tokens (Sync with style.css)
const VERDICT_COLORS = {
  'PASS': 'negative',
  'WATCH': 'warning',
  'INVEST': 'positive',
  'CONVICTION': 'positive',
  'SKEPTICAL': 'negative',
  'NEUTRAL': 'warning'
};

// --- SYSTEM PROMPT (Company Research Skill) ---
const SYSTEM_PROMPT = `
You are a high-conviction business analyst. Your job is to perform a 13-step teardown of a company.
CRITICAL: You MUST provide source references (URLs) for your key findings.
Follow the structure defined in company-research.md.

Output format: JSON object with the following structure:
{
  "company": "Name",
  "tagline": "One line essence",
  "overall_verdict_short": "INVEST/WATCH/PASS",
  "data_quality_score": 0-100,
  "memo": {
    "what_they_do": "...",
    "claimed_problem": "...",
    "the_user": "...",
    "real_problem_stack": ["...", "..."],
    "user_problem_fit_verdict": { "verdict": "...", "reason": "..." },
    "fit_gap_analysis": "...",
    "current_solutions": { "verdict": "...", "alternatives": "..." },
    "monetisation_logic": { "verdict": "...", "upside": "..." },
    "market_size_bottom_up": "...",
    "unit_economics_read": { "verdict": "...", "logic": "..." },
    "defensibility_stack": { "verdict": "...", "moat_details": "..." },
    "gaps_table": [ { "gap": "...", "fix": "..." } ],
    "final_verdict": "...",
    "references": ["url1", "url2"]
  }
}
`;

const OUTREACH_PROMPT = `
You are a elite operator. Write a high-conviction outreach message based on the company intelligence provided.
Structure:
1. The Hook: A non-generic observation about their specific mechanism.
2. The Message: The actual outreach text. Concise, operator-to-operator.
3. The Why: Why this specific angle works for this ICP.

JSON output: { "hook": "...", "message": "...", "why": "..." }
`;

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
      let errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || \`Error \${response.status}\`);
      if (response.status === 0 || errorMsg.includes('fetch')) {
        errorMsg = "CORS / File Protocol Error: This app must be run from a local server (http://), not by opening the file directly (file://).";
      }
      throw new Error(errorMsg);
    }
    
    if (action === 'analyse' && data.error) {
      throw new Error(JSON.stringify(data.error));
    }

    return data;
  } catch (error) {
    console.error(\`Proxy error (\${action}):\`, error);
    throw error;
  }
}

// Initialization
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
    reportHeader: document.getElementById('report-title-header'),
    reportContainer: document.getElementById('report-container'),
    backBtn: document.getElementById('back-to-home'),
    loadingCompanyName: document.getElementById('loading-company-name'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    
    // Outreach elements
    backToReport: document.getElementById('back-to-report'),
    resumeText: document.getElementById('resume-text'),
    generateOutreachBtn: document.getElementById('generate-outreach-btn'),
    outreachResult: document.getElementById('outreach-result'),
    
    // Install
    installBanner: document.getElementById('install-banner'),
    installBtn: document.getElementById('install-btn'),
    
    // Disambiguation container
    disambiguation: views.disambiguation
  };

  try {
    renderRecentSearches();
  } catch (e) {
    console.error("Failed to render recent searches", e);
  }
  setupEventListeners();
  console.log("Scout Initialized (v16)");
}

function setupEventListeners() {
  // Home: Context Toggle
  if (elements.contextToggle) {
    elements.contextToggle.addEventListener('click', () => {
      elements.extraContext.classList.toggle('hidden');
      elements.contextToggle.textContent = elements.extraContext.classList.contains('hidden') ? '+ Add context' : '- Hide context';
    });
  }

  // Home: Analyse
  if (elements.analyseBtn) {
    elements.analyseBtn.addEventListener('click', () => {
      const company = elements.companyInput.value.trim();
      const context = elements.extraContext.value.trim();
      if (company) startResearchFlow(company, context);
    });
  }

  // Report: Back
  if (elements.backBtn) elements.backBtn.addEventListener('click', () => showView('home'));
  
  if (elements.downloadPdfBtn) elements.downloadPdfBtn.addEventListener('click', handleDownloadPDF);

  // Error: Retry
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener('click', () => showView('home'));
  }

  // Outreach: Back
  if (elements.backToReport) {
    elements.backToReport.addEventListener('click', () => showView('report'));
  }

  // Outreach: Generate
  if (elements.generateOutreachBtn) {
    elements.generateOutreachBtn.addEventListener('click', handleGenerateOutreach);
  }

  // PWA: Install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elements.installBanner.classList.remove('hidden');
  });

  if (elements.installBtn) {
    elements.installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          elements.installBanner.classList.add('hidden');
        }
        deferredPrompt = null;
      }
    });
  }
}

// --- APP LOGIC ---

function showView(viewName) {
  if (!views[viewName]) return;
  [...Object.values(views)].forEach(v => {
    if (v) v.classList.add('hidden');
  });
  views[viewName].classList.remove('hidden');
  window.scrollTo(0, 0);
}

function updateLoadingStep(step) {
  const stepEl = document.createElement('div');
  stepEl.className = 'loading-step';
  stepEl.textContent = \`> \${step}\`;
  
  const container = document.querySelector('.skeleton-grid');
  if (container) {
    container.insertBefore(stepEl, container.firstChild);
    if (container.children.length > 5) container.lastChild.remove();
  }
}

async function startResearchFlow(company, context) {
  showView('loading');
  updateLoadingStep('Scanning market landscape...');
  
  try {
    const searchData = await callProxy('search', { 
      query: \`\${company} company official website and business profile\`, 
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
    console.error("Research flow failed", err);
    elements.errorMessage.textContent = err.message;
    showView('error');
  }
}

function renderDisambiguation(query, results, originalContext) {
  elements.disambiguation.innerHTML = \`
    <div style="margin-bottom: 3rem;">
      <h2 style="font-family: var(--serif); font-size: 3rem; margin-bottom: 0.5rem;">Which company?</h2>
      <p style="color: var(--text-dim);">Select the closest match to begin the teardown.</p>
    </div>
    <div class="disambiguation-list">
      \${results.map((res, i) => \`
        <div class="disambiguation-item \${i === 0 ? 'priority' : ''}" data-index="\${i}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4>\${res.title || 'Unknown'}</h4>
              <p style="color: var(--text-dim); font-size: 0.9rem; margin-top: 0.5rem; line-height: 1.4;">
                \${res.content ? res.content.substring(0, 160) + '...' : 'No description available'}
              </p>
              <div style="margin-top: 1rem; font-family: var(--mono); font-size: 0.65rem; color: var(--accent);">
                SOURCE: \${new URL(res.url).hostname}
              </div>
            </div>
            \${i === 0 ? '<div class="pill positive" style="font-size:0.6rem;">BEST MATCH</div>' : ''}
          </div>
        </div>
      \`).join('')}
      
      <div class="disambiguation-item" data-index="-1" style="margin-top: 2rem; border-style: dashed; opacity: 0.7;">
        <div style="text-align: center;">
          <h4 style="font-size: 1.1rem; color: var(--text-dim);">None of these</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Proceed with general knowledge only</p>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 3rem; text-align: center;">
      <button id="back-from-disambiguation" class="btn-text" style="color:var(--text-muted);">← Back to search</button>
    </div>
  \`;

  // Attach listeners
  elements.disambiguation.querySelectorAll('.disambiguation-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.getAttribute('data-index'));
      startOptimizedAnalysis(query, idx, originalContext);
    });
  });

  const backBtn = document.getElementById('back-from-disambiguation');
  if (backBtn) backBtn.addEventListener('click', () => showView('home'));
}

async function startOptimizedAnalysis(query, selectedIndex, originalContext) {
  showView('loading');
  updateLoadingStep('Executing deep intelligence teardown...');
  
  try {
    // 1. Get targeted context if selected
    let baseContext = originalContext ? \`USER CONTEXT: \${originalContext}\\n\\n\` : '';
    
    if (selectedIndex !== -1) {
      const baseData = await callProxy('search', { 
        query: \`\${query} detailed business model unit economics competitors\`, 
        search_depth: "advanced" 
      });
      baseContext += (baseData.results || []).map(r => r.content).join('\\n\\n');
    }

    updateLoadingStep(\`Hunting for truth...\`);

    const finalContext = baseContext || \`Company: \${query}\`;

    // 2. Run the Analysis
    const finalResponse = await callProxy('analyse', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: \`Research Data:\\n\${finalContext}\` }
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
    console.error("Analysis failed", err);
    elements.errorMessage.textContent = err.message;
    showView('error');
  }
}

async function handleGenerateOutreach() {
  if (!currentReport) return;
  const resume = elements.resumeText.value.trim();
  
  elements.generateOutreachBtn.textContent = "Processing...";
  elements.generateOutreachBtn.disabled = true;
  
  try {
    const response = await callProxy('analyse', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: OUTREACH_PROMPT },
        { role: "user", content: \`COMPANY INTELLIGENCE: \${JSON.stringify(currentReport)}\\n\\nOPERATOR DATA (Resume): \${resume}\` }
      ],
      response_format: { type: "json_object" }
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
  elements.outreachResult.innerHTML = \`
    <div class="outreach-result-card">
      <div class="memo-label">Step 1 // THE HOOK</div>
      <div class="memo-content" style="font-weight:700; color:var(--accent); margin-bottom:2rem;">\${data.hook}</div>
      
      <div class="memo-label">Step 2 // THE MESSAGE <span class="copy-badge" onclick="copyText('outreach-msg')">COPY</span></div>
      <div id="outreach-msg" class="memo-content" style="background:rgba(255,255,255,0.03); padding:1.5rem; border-radius:8px; border:1px solid var(--border); white-space:pre-wrap;">\${data.message}</div>
      
      <div class="memo-label" style="margin-top:2rem;">Step 3 // THE BET</div>
      <div class="memo-content" style="font-style:italic; color:var(--text-dim);">\${data.why}</div>
    </div>
  \`;
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
    let recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
    recent = [report, ...recent.filter(r => r.company !== report.company)].slice(0, 10);
    localStorage.setItem('scout_reports', JSON.stringify(recent));
    renderRecentSearches();
  } catch (e) { console.error("Save failed", e); }
}

function renderRecentSearches() {
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  } catch (e) {
    console.error("Failed to parse recent searches", e);
    localStorage.setItem('scout_reports', '[]');
  }
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

function getVerdictClass(v) {
  const norm = (v || '').toUpperCase();
  for (const [key, cls] of Object.entries(VERDICT_COLORS)) {
    if (norm.includes(key)) return cls;
  }
  return 'warning';
}

function renderReport(data) {
  if (elements.reportHeader) {
    elements.reportHeader.innerHTML = \`
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <span style="font-family:var(--mono); font-size:0.6rem; color:var(--accent);">ID: SCOUT_\${Math.floor(Math.random()*10000)}</span>
        <span>\${data.company}</span>
      </div>
    \`;
  }
  const m = data.memo;
  
  if (elements.reportContainer) {
    elements.reportContainer.innerHTML = \`
      <div class="memo-header" style="margin-bottom: 4rem; animation: viewIn 0.8s ease;">
        <div style="font-family: var(--mono); font-size: 0.65rem; color: var(--accent); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 8px; height: 8px; background: var(--accent); border-radius: 50%; display: inline-block;"></span>
          CONFIDENTIAL OPERATOR INTELLIGENCE // \${new Date().toLocaleDateString()}
        </div>
        <h1>\${data.company}</h1>
        <p style="font-size: 1.5rem; color: var(--text-dim); margin-top: 1rem; font-family: var(--serif); font-style: italic;">"\${data.tagline}"</p>
        
        <div style="margin-top: 3rem; display: flex; gap: 1.5rem; align-items: center;">
          <div class="pill \${getVerdictClass(data.overall_verdict_short)}">\${data.overall_verdict_short}</div>
          <div style="font-family: var(--mono); font-size: 0.7rem; color: var(--text-muted); border-left: 1px solid var(--border); padding-left: 1.5rem;">
            CONFIDENCE: \${data.data_quality_score}%
          </div>
        </div>
      </div>

      <div class="memo-section">
        <div class="memo-label">01 // MECHANISM</div>
        <div class="memo-title">What they actually do</div>
        <div class="memo-content">\${m.what_they_do}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">02 // NARRATIVE</div>
        <div class="memo-title">Claimed Problem</div>
        <div class="memo-content">\${m.claimed_problem}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">03 // ICP</div>
        <div class="memo-title">The Target User</div>
        <div class="memo-content">\${m.the_user}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">04 // GROUND TRUTH</div>
        <div class="memo-title">Real user problem stack</div>
        <ul class="memo-list" style="counter-reset: li;">
          \${(m.real_problem_stack || []).map(p => \`<li>\${p}</li>\`).join('')}
        </ul>
      </div>

      <div class="memo-section">
        <div class="memo-label">05 & 06 // CONVICTION</div>
        <div class="memo-title">User-Problem Fit Analysis</div>
        <div class="memo-verdict \${getVerdictClass(m.user_problem_fit_verdict.verdict)}">\${m.user_problem_fit_verdict.verdict}</div>
        <div class="memo-content" style="margin-bottom: 2rem;">\${m.user_problem_fit_verdict.reason}</div>
        \${m.fit_gap_analysis ? \`
          <div style="background: rgba(255,71,87,0.05); border: 1px solid rgba(255,71,87,0.2); padding: 2rem; border-radius: 12px;">
            <div class="memo-label" style="color: var(--danger);">FIT GAP DETECTED</div>
            <div class="memo-content" style="color: #ff8a93;">\${m.fit_gap_analysis}</div>
          </div>
        \` : ''}
      </div>

      <div class="memo-section">
        <div class="memo-label">07 // LANDSCAPE</div>
        <div class="memo-title">Current Alternatives</div>
        <div class="memo-verdict \${getVerdictClass(m.current_solutions.verdict)}">\${m.current_solutions.verdict}</div>
        <div class="memo-content">\${m.current_solutions.alternatives}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">08 & 09 // UPSIDE</div>
        <div class="memo-title">Monetisation & Market Economics</div>
        <div class="memo-verdict \${getVerdictClass(m.monetisation_logic.verdict)}">\${m.monetisation_logic.verdict}</div>
        <div class="memo-content" style="margin-bottom: 1.5rem;"><strong>Value Extraction:</strong> \${m.monetisation_logic.upside}</div>
        <div class="memo-content"><strong>Market Read:</strong> \${m.market_size_bottom_up}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">10 // PROFITABILITY</div>
        <div class="memo-title">Unit Economics & CM2/CM3</div>
        <div class="memo-verdict \${getVerdictClass(m.unit_economics_read.verdict)}">\${m.unit_economics_read.verdict}</div>
        <div class="memo-content">\${m.unit_economics_read.logic}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">11 & 12 // DEFENSE</div>
        <div class="memo-title">Moat & Structural Hardness</div>
        <div class="memo-verdict \${getVerdictClass(m.defensibility_stack.verdict)}">\${m.defensibility_stack.verdict}</div>
        <div class="memo-content">\${m.defensibility_stack.moat_details}</div>
      </div>

      <div class="memo-section">
        <div class="memo-label">13 // STRATEGIC REFRAME</div>
        <div class="memo-title">Identified Gaps & Required Fixes</div>
        <table class="memo-table">
          <thead><tr><th>STRUCTURAL GAP</th><th>OPERATOR FIX</th></tr></thead>
          <tbody>
            \${(m.gaps_table || []).map(g => \`<tr><td style="color:var(--danger); font-weight:600;">\${g.gap}</td><td style="color:var(--accent);">\${g.fix}</td></tr>\`).join('')}
          </tbody>
        </table>
      </div>

      <div class="memo-section">
        <div class="memo-label">14 // SOURCES</div>
        <div class="memo-title">References & Data Points</div>
        <ul class="memo-list">
          \${(m.references || []).map(ref => \`<li><a href="\${ref}" target="_blank" style="color:var(--accent); text-decoration:none; word-break:break-all;">\${ref}</a></li>\`).join('')}
        </ul>
      </div>

      <div class="memo-section" style="background: var(--surface); padding: 3rem; border-radius: 16px; margin-top: 4rem; border: 1px solid var(--border-strong);">
        <div class="memo-label" style="color: var(--accent);">EXECUTIVE SUMMARY</div>
        <div class="memo-title">Final Verdict</div>
        <div class="memo-content" style="font-weight: 500; font-size: 1.25rem; line-height: 1.4;">\${m.final_verdict}</div>
      </div>

      <div style="margin-top: 4rem; padding-bottom: 6rem; text-align: center;">
        <button id="trigger-outreach-btn" class="btn-primary" style="background: var(--accent); color: #000; width: 100%; max-width: 400px;">
          Draft Outreach Message
        </button>
      </div>
    \`;
    
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

async function handleDownloadPDF() {
  const btn = elements.downloadPdfBtn;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span style="font-size:0.6rem;">EXPORTING...</span>';
  btn.disabled = true;

  try {
    const template = document.getElementById('pdf-export-template');
    const m = currentReport.memo;
    
    template.innerHTML = \`
      <div class="pdf-header-compact">
        <h1>\${currentReport.company}</h1>
        <div style="font-family:var(--mono); font-size:7pt;">\${new Date().toLocaleDateString()} // SCOUT-V16</div>
      </div>
      
      <div style="margin-bottom:0.5rem; font-size:9pt; font-style:italic;">"\${currentReport.tagline}"</div>
      
      <div class="pdf-grid">
        <div class="pdf-col">
          <div class="pdf-item">
            <div class="pdf-item-title">01 // MECHANISM</div>
            <div class="pdf-item-content">\${m.what_they_do}</div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">02 // NARRATIVE</div>
            <div class="pdf-item-content">\${m.claimed_problem}</div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">04 // GROUND TRUTH</div>
            <div class="pdf-item-content">
              \${(m.real_problem_stack || []).map(p => \`• \${p}\`).join('<br>')}
            </div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">07 // LANDSCAPE</div>
            <div class="pdf-item-content"><span class="pdf-verdict-inline">\${m.current_solutions.verdict}</span>\${m.current_solutions.alternatives}</div>
          </div>
        </div>
        
        <div class="pdf-col">
          <div class="pdf-item">
            <div class="pdf-item-title">05 & 06 // CONVICTION</div>
            <div class="pdf-item-content"><span class="pdf-verdict-inline">\${m.user_problem_fit_verdict.verdict}</span>\${m.user_problem_fit_verdict.reason}</div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">08 & 09 // UPSIDE</div>
            <div class="pdf-item-content"><span class="pdf-verdict-inline">\${m.monetisation_logic.verdict}</span>\${m.monetisation_logic.upside}</div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">10 // UNIT ECON</div>
            <div class="pdf-item-content"><span class="pdf-verdict-inline">\${m.unit_economics_read.verdict}</span>\${m.unit_economics_read.logic}</div>
          </div>
          <div class="pdf-item">
            <div class="pdf-item-title">11 & 12 // DEFENSE</div>
            <div class="pdf-item-content"><span class="pdf-verdict-inline">\${m.defensibility_stack.verdict}</span>\${m.defensibility_stack.moat_details}</div>
          </div>
        </div>
      </div>

      <div style="margin-top:0.5rem;">
        <div class="pdf-item-title">13 // STRATEGIC GAPS & FIXES</div>
        <table class="pdf-gaps-table">
          \${(m.gaps_table || []).map(g => \`<tr><td style="width:40%; font-weight:bold;">\${g.gap}</td><td>\${g.fix}</td></tr>\`).join('')}
        </table>
      </div>

      <div style="margin-top:0.5rem; background:#f9f9f9; padding:0.4rem;">
        <div class="pdf-item-title">FINAL VERDICT: \${currentReport.overall_verdict_short}</div>
        <div class="pdf-item-content" style="font-weight:bold;">\${m.final_verdict}</div>
      </div>

      <div style="margin-top:0.5rem; font-size:6pt; color:#666; border-top:1px solid #eee; padding-top:0.2rem;">
        CONFIDENTIAL OPERATOR INTELLIGENCE // DATA QUALITY: \${currentReport.data_quality_score}% // Generated by Scout Engine
      </div>
    \`;

    document.body.classList.add('pdf-exporting');
    
    const opt = {
      margin: 0.25,
      filename: \`Scout_Intelligence_\${currentReport.company.replace(/\\s+/g, '_')}.pdf\`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    await html2pdf().set(opt).from(template).save();
  } catch (err) {
    console.error("PDF Export failed", err);
    alert("Export failed: " + err.message);
  } finally {
    document.body.classList.remove('pdf-exporting');
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}
