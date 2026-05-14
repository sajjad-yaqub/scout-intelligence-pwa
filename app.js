// PROMPTS
const RESEARCH_PROMPT = `You are an elite business analyst and investor. Your job is to conduct deep research on the target company and provide a brutal, high-conviction analysis.
Focus on first principles. Disregard corporate marketing. Identify the real human frictions.

OUTPUT STRUCTURE:
You must return a valid JSON object with the following fields:
1. "company": Official name
2. "tagline": A crisp, one-sentence first-principles thesis of what they do.
3. "data_quality_score": (0-100) based on how much verifiable data you found.
4. "overall_verdict_short": "Back | Pass | Watch"
5. "memo": A nested object containing:
   - "what_they_do": Mechanism of value creation.
   - "claimed_problem": What they say they solve.
   - "the_user": Precise persona.
   - "real_problem_stack": (Array of 3 strings) The deepest human/business frictions they actually hit.
   - "user_problem_fit_verdict": { "verdict": "Strong | Weak | Broken", "reason": "Blunt logic" }
   - "fit_gap_analysis": (Optional) Naming a specific misalignment if fit is not Strong.
   - "current_solutions": { "verdict": "Negative | Imperfect | Crowded", "alternatives": "Specific names/status quo" }
   - "monetisation_logic": { "verdict": "Clean | Messy | Broken", "upside": "How they scale" }
   - "market_size_bottom_up": Estimation logic.
   - "unit_economics_read": { "verdict": "Healthy | Ugly | Uncertain", "logic": "CM2/CM3 read" }
   - "defensibility_stack": { "verdict": "Moat | No Moat", "moat_details": "Network effects, switching costs, etc" }
   - "whats_working": One specific proof point.
   - "gaps_table": (Array of 2 objects: { "gap": "...", "fix": "..." }) Critical defects and how to fix them.
   - "final_verdict": 2-3 sentences of pure conviction.

STRICT JSON MODE: No preamble. No markdown. No conversational filler. Just the JSON object. Escape all newlines.`;

const OUTREACH_PROMPT = `You are writing as the person described in the provided Resume.
You are addressing a founder/executive at the Company based on the Research Memo.

MISSION: Write a crisp, high-conviction "Operator Thought" (Mission Message).
NO corporate jargon. NO formal greetings like "I hope this finds you well". 
Start with a punchy, declarative sentence that signals deep research or a unique insight.

STRUCTURE:
1. The Hook: A research-led observation that shows you've spent time with their product/market.
2. The Problem: Name the single most urgent hard problem they have (from the memo).
3. The Alignment: Why YOU (based on resume) are the specific operator to solve this.
4. The Ask: A clear, low-friction next step.

TONE: Brutal honesty + High agency. 

OUTPUT:
Return ONLY a JSON object:
{
  "hook": "The punchy opening thought",
  "message": "The full outreach message. Use \\n\\n for paragraphs.",
  "why": "Brief logic on why this specific angle lands."
}`;

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
    outreach: document.getElementById('outreach-screen')
  };

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
    
    // PDF Export
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    
    // Outreach Elements
    backToReport: document.getElementById('back-to-report'),
    resumeText: document.getElementById('resume-text'),
    generateOutreachBtn: document.getElementById('generate-outreach-btn'),
    outreachResult: document.getElementById('outreach-result')
  };

  renderRecentSearches();
  setupEventListeners();
  console.log("Scout Initialized (v16.14)");
}

function setupEventListeners() {
  // Navigation
  if (elements.backBtn) elements.backBtn.onclick = () => showView('home');
  if (elements.retryBtn) elements.retryBtn.onclick = () => showView('home');
  
  // Context Toggle
  if (elements.contextToggle) {
    elements.contextToggle.onclick = () => {
      elements.extraContext.classList.toggle('hidden');
      elements.contextToggle.innerText = elements.extraContext.classList.contains('hidden') ? '+ Add context' : '- Remove context';
    };
  }

  // Analysis Trigger
  if (elements.analyseBtn) {
    elements.analyseBtn.onclick = async () => {
      const company = elements.companyInput.value.trim();
      const context = elements.extraContext.value.trim();
      if (!company) return;
      
      startResearchFlow(company, context);
    };
  }

  // PDF Export
  if (elements.downloadPdfBtn) {
    elements.downloadPdfBtn.onclick = handleDownloadPDF;
  }

  // Outreach Flow
  if (elements.backToReport) elements.backToReport.onclick = () => showView('report');
  
  if (elements.generateOutreachBtn) {
    elements.generateOutreachBtn.onclick = async () => {
      const resume = elements.resumeText.value.trim();
      if (!resume || !currentReport) return;
      
      elements.generateOutreachBtn.innerText = 'GENERATING...';
      elements.generateOutreachBtn.disabled = true;
      
      try {
        const result = await callProxy('analyse', {
          model: "llama-3.1-70b-versatile",
          messages: [
            { role: "system", content: OUTREACH_PROMPT },
            { role: "user", content: `RESEARCH MEMO:\n${JSON.stringify(currentReport)}\n\nCANDIDATE RESUME:\n${resume}` }
          ],
          response_format: { type: "json_object" }
        });
        
        const outreach = JSON.parse(result.choices[0].message.content);
        renderOutreach(outreach);
      } catch (err) {
        alert("Outreach generation failed: " + err.message);
      } finally {
        elements.generateOutreachBtn.innerText = 'Generate Mission Message';
        elements.generateOutreachBtn.disabled = false;
      }
    };
  }
}

// Logic: Navigation
function showView(viewName) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
  window.scrollTo(0,0);
}

// Logic: Research Flow
async function startResearchFlow(company, context) {
  showView('loading');
  if (elements.loadingCompanyName) elements.loadingCompanyName.innerText = `Scouting ${company}...`;

  try {
    // Step 1: Tavily Search for real data
    const searchData = await callProxy('search', {
      query: `${company} company business model, user problems, unit economics, and current status 2024`,
      search_depth: "advanced",
      max_results: 5
    });

    // Step 2: Groq Analysis
    const analysis = await callProxy('analyse', {
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: RESEARCH_PROMPT },
        { role: "user", content: `COMPANY: ${company}\nCONTEXT: ${context}\n\nSEARCH DATA:\n${JSON.stringify(searchData.results)}` }
      ],
      response_format: { type: "json_object" }
    });

    const report = JSON.parse(analysis.choices[0].message.content);
    currentReport = report;
    
    saveReport(report);
    renderReport(report);
    showView('report');

  } catch (err) {
    if (elements.errorMessage) elements.errorMessage.innerText = err.message;
    showView('error');
  }
}

// Helper: Call Vercel Proxy
async function callProxy(action, body) {
  const response = await fetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, body })
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Helper: Persistence
function saveReport(report) {
  try {
    const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
    const filtered = recent.filter(r => r.company !== report.company);
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

function renderOutreach(data) {
  elements.outreachResult.classList.remove('hidden');
  elements.outreachResult.innerHTML = `
    <div class="memo-section">
      <div class="memo-label">Step 2: Analysis Verdict</div>
      <div class="memo-title" style="font-size:1.4rem;">${data.hook}</div>
      <div class="memo-content" style="color:var(--accent); font-family:var(--mono); font-size:0.8rem; margin-top:0.5rem;">
        // THESIS: ${data.why}
      </div>
    </div>

    <div class="memo-section" style="background:var(--surface); padding:2rem; border-radius:12px; border:1px solid var(--border);">
      <div class="memo-label">Step 3: Final Operator Thought</div>
      <div id="copy-target" class="memo-content" style="white-space:pre-wrap; color:var(--text);">${data.message}</div>
      
      <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
        <button onclick="copyText()" class="btn-pill" style="background:var(--accent); color:#000;">Copy Message</button>
      </div>
    </div>
  `;
  window.scrollTo({ top: elements.outreachResult.offsetTop - 100, behavior: 'smooth' });
}

function copyText() {
  const text = document.getElementById('copy-target').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert("Message copied to clipboard.");
  });
}

// Global exposure
window.startResearchFlow = startResearchFlow;
window.showView = showView;
window.copyText = copyText;

// Run Init when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
