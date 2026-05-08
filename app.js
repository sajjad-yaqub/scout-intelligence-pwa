/**
 * Scout PWA - app.js
 * v11: Brand-First Sorting & Disambiguation Logic.
 */

const SYSTEM_PROMPT = `You are a senior operator and cynical venture investor. You provide blunt, deep, high-conviction teardowns using a first-principles mechanism.

ANALYTIC MECHANISM:
- HUMAN NATURE: Deconstruct functional, emotional, and social needs.
- THE ENGINE: Analyse the "product that makes the product" (Ops/Distribution).
- FLYWHEEL: Identify the growth loops and self-reinforcing moats.
- MESSAGE/CHANNEL: Evaluate the acquisition hack vs brand authority.

RULES:
1. TOTAL CONVICTION. No hedging. No "needs more data". 
2. If info is missing, INFER IT from category norms and psychological first principles.
3. BE ROBOTICALLY ANALYTICAL.

JSON Schema:
{
  "company": "string",
  "tagline": "string",
  "data_quality_score": 0-100,
  "tldr": {
    "verdict": "Back | Pass | Watch",
    "verdict_reason": "string",
    "strengths": ["string"],
    "risks": ["string"]
  },
  "sections": [
    { "id": "what_they_do", "title": "What They Do", "finding": "string", "status": null },
    { "id": "claimed_problem", "title": "Claimed Problem", "finding": "string", "status": null },
    { "id": "user", "title": "The User", "finding": "string", "status": null },
    { "id": "real_problem_stack", "title": "Real Problem Stack", "problems": ["string"], "status": null },
    { "id": "user_problem_fit", "title": "User–Problem Fit", "finding": "string", "status": "strong | weak | wrong" },
    { "id": "current_solutions", "title": "Current Solutions", "finding": "string", "status": "strong | weak | wrong" },
    { "id": "monetisation", "title": "Monetisation", "finding": "string", "status": "strong | weak | wrong" },
    { "id": "market_size", "title": "Market Size", "number": "string", "finding": "string", "status": null },
    { "id": "unit_economics", "title": "Unit Economics", "finding": "string", "status": "strong | weak | wrong" },
    { "id": "defensibility", "title": "Defensibility", "finding": "string", "scorecard": [], "status": "strong | weak | wrong" }
  ],
  "gaps_table": [{ "gap": "string", "fix": "string" }],
  "overall_verdict": "string"
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

// DOM Elements
const views = {
  home: document.getElementById('home-screen'),
  report: document.getElementById('report-screen'),
  loading: document.getElementById('loading-screen'),
  error: document.getElementById('error-screen'),
  disambiguation: document.createElement('section')
};
views.disambiguation.id = 'disambiguation-screen';
views.disambiguation.className = 'view hidden';
document.getElementById('app').appendChild(views.disambiguation);

const elements = {
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
  retryBtn: document.getElementById('retry-btn')
};

// Global State
let lastSearchResults = [];

// Initialize
function init() {
  renderRecentSearches();
  setupEventListeners();
  
  const style = document.createElement('style');
  style.textContent = `
    .disambiguation-list { display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem; }
    .disambiguation-item { background: var(--panel); border: 1px solid var(--border); padding: 1rem; cursor: pointer; text-align: left; transition: 0.2s; position: relative; overflow: hidden; }
    .disambiguation-item.priority { border-color: var(--accent); background: rgba(255,255,255,0.03); }
    .disambiguation-item.priority::after { content: 'PRIMARY'; position: absolute; top: 0; right: 0; background: var(--accent); color: #000; font-size: 0.6rem; padding: 2px 6px; font-weight: bold; font-family: var(--mono); }
    .disambiguation-item:hover { border-color: var(--text); }
    .disambiguation-item h4 { margin-bottom: 0.25rem; font-family: var(--sans); font-weight: 600; }
    .disambiguation-item p { font-size: 0.85rem; color: var(--text-dim); }
    .loading-step { font-size: 0.85rem; color: var(--text-dim); margin-top: 0.5rem; font-family: var(--mono); }
  `;
  document.head.appendChild(style);
}

function setupEventListeners() {
  elements.contextToggle.addEventListener('click', () => {
    elements.extraContext.classList.toggle('hidden');
    elements.contextToggle.textContent = elements.extraContext.classList.contains('hidden') ? '+ Add context' : '- Remove context';
  });

  elements.analyseBtn.addEventListener('click', () => {
    const company = elements.companyInput.value.trim();
    const context = elements.extraContext.value.trim();
    if (company) startResearchFlow(company, context);
  });

  elements.backBtn.addEventListener('click', () => showView('home'));
  elements.retryBtn.addEventListener('click', () => showView('home'));
}

function showView(viewName) {
  [...Object.values(views)].forEach(v => v.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
  window.scrollTo(0, 0);
}

function updateLoadingStep(step) {
  let stepEl = document.querySelector('.loading-step');
  if (!stepEl) {
    stepEl = document.createElement('div');
    stepEl.className = 'loading-step';
    elements.loadingCompanyName.parentElement.appendChild(stepEl);
  }
  stepEl.textContent = `> ${step}`;
}

async function startResearchFlow(company, context) {
  updateLoadingStep('Broad search initiated...');
  showView('loading');

  try {
    const searchData = await callProxy('search', {
      query: `${company} company official website details`,
      search_depth: "basic",
      max_results: 6
    });
    
    let results = searchData.results || [];
    
    // Brand-First Sorting Logic
    const companyClean = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    results.sort((a, b) => {
      const aUrl = a.url.toLowerCase();
      const bUrl = b.url.toLowerCase();
      const aMatches = aUrl.includes(companyClean);
      const bMatches = bUrl.includes(companyClean);
      
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

    lastSearchResults = results;
    renderDisambiguation(company, lastSearchResults, context);
    showView('disambiguation');

  } catch (err) {
    console.error(err);
    elements.errorMessage.textContent = `Search Error: ${err.message}`;
    showView('error');
  }
}

function renderDisambiguation(query, results, originalContext) {
  const companyClean = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  views.disambiguation.innerHTML = `
    <header class="home-header">
      <h1>Which ${query}?</h1>
      <p>Select source to start Deep Research</p>
    </header>
    <div class="disambiguation-list">
      ${results.length === 0 ? '<p>No results found. Try a different name.</p>' : results.map((r, i) => {
        const isPriority = r.url.toLowerCase().includes(companyClean);
        return `
          <div class="disambiguation-item ${isPriority ? 'priority' : ''}" onclick="startOptimizedAnalysis('${query}', ${i}, '${originalContext}')">
            <h4>${r.title}</h4>
            <p>${r.url}</p>
            <p>${r.content.substring(0, 150)}...</p>
          </div>
        `;
      }).join('')}
      <div class="disambiguation-item" onclick="startOptimizedAnalysis('${query}', -1, '${originalContext}')">
        <h4>General/Multi-Source Research</h4>
        <p>Aggregate from all sources</p>
      </div>
    </div>
    <button class="btn-text" style="margin-top: 2rem" onclick="showView('home')">← Back to search</button>
  `;
}

async function startOptimizedAnalysis(query, selectedIndex, originalContext) {
  showView('loading');
  elements.loadingCompanyName.textContent = query;
  
  try {
    // Stage 1: Build Base Context
    updateLoadingStep('Expanding base context (Token-Saver Active)...');
    let baseContext = originalContext ? `User Context: ${originalContext}\n\n` : '';
    if (selectedIndex !== -1 && lastSearchResults[selectedIndex]) {
      baseContext += `Main Selection: ${lastSearchResults[selectedIndex].content}\n`;
    }
    
    const baseData = await callProxy('search', {
      query: `${query} company business model product features operations`,
      search_depth: "basic",
      max_results: 4
    });
    baseContext += (baseData.results || []).map(r => r.content).join('\n\n');

    // Stage 2: Unified Deep Hunt (Using 8B model for token efficiency)
    updateLoadingStep('Consolidating deep-hunt queries...');
    const huntResponse = await callProxy('analyse', {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a senior analyst. Based on this context, generate ONE highly targeted search query to find the 'Missing Deep Pillars': Unit Economics specifics, evidence of Flywheels, and the Psychological Hook. Output ONLY the query string." },
        { role: "user", content: baseContext.substring(0, 5000) }
      ]
    });
    
    if (!huntResponse.choices || !huntResponse.choices[0]) {
      throw new Error("AI failed to generate a hunt query.");
    }
    
    const targetedQuery = huntResponse.choices[0].message.content.trim().replace(/^"|"$/g, '');

    updateLoadingStep(`Hunting for: ${targetedQuery.toLowerCase().substring(0, 30)}...`);
    const huntData = await callProxy('search', {
      query: `${query} ${targetedQuery}`,
      search_depth: "basic",
      max_results: 5
    });
    
    let finalContext = "DEEP HUNT EVIDENCE:\n" + (huntData.results || []).map(r => r.content).join('\n') + 
                       "\n\nBASE COMPANY CONTEXT:\n" + baseContext;
    
    finalContext = finalContext.substring(0, 12000); 

    // Stage 3: Final First-Principles Teardown
    updateLoadingStep('Executing high-conviction teardown...');
    const finalResponse = await callProxy('analyse', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Full Research Data:\n${finalContext}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.0
    });

    if (!finalResponse.choices || !finalResponse.choices[0]) {
      throw new Error("AI failed to generate final teardown.");
    }

    const reportData = JSON.parse(finalResponse.choices[0].message.content);

    saveReport(reportData);
    renderReport(reportData);
    showView('report');

  } catch (err) {
    console.error(err);
    elements.errorMessage.textContent = `Analysis Failed: ${err.message}`;
    showView('error');
  }
}

function saveReport(report) {
  const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  const filtered = recent.filter(r => r.company.toLowerCase() !== report.company.toLowerCase());
  filtered.unshift({ ...report, timestamp: Date.now() });
  localStorage.setItem('scout_reports', JSON.stringify(filtered.slice(0, 5)));
  renderRecentSearches();
}

function renderRecentSearches() {
  const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  const chips = document.getElementById('recent-chips');
  if (!chips) return;
  chips.innerHTML = '';
  recent.forEach(report => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = report.company;
    chip.addEventListener('click', () => {
      renderReport(report);
      showView('report');
    });
    chips.appendChild(chip);
  });
}

function renderReport(data) {
  elements.reportHeader.textContent = data.company;
  elements.reportContainer.innerHTML = '';

  const tldr = data.tldr;
  const verdictClass = tldr.verdict.toLowerCase().includes('back') ? 'back' : 
                       tldr.verdict.toLowerCase().includes('pass') ? 'pass' : 'interesting';
  
  const tldrEl = document.createElement('div');
  tldrEl.className = `card tldr-card ${verdictClass}`;
  tldrEl.innerHTML = `
    <div class="tldr-header">
      <div class="tldr-title">
        <h2>${data.company}</h2>
        <p>${data.tagline}</p>
        <div style="font-family: var(--mono); font-size: 0.65rem; color: var(--text-dim); margin-top: 0.5rem">Intelligence Quality: ${data.data_quality_score}/100</div>
      </div>
      <div class="pill ${verdictClass}">${tldr.verdict}</div>
    </div>
    <div class="verdict-reason">${tldr.verdict_reason}</div>
    <div class="columns">
      <div class="col">
        <h4>Strengths</h4>
        <ul>${tldr.strengths.map(s => `<li><span class="icon-check">✓</span> ${s}</li>`).join('')}</ul>
      </div>
      <div class="col">
        <h4>Risks</h4>
        <ul>${tldr.risks.map(r => `<li><span class="icon-risk">!</span> ${r}</li>`).join('')}</ul>
      </div>
    </div>
  `;
  elements.reportContainer.appendChild(tldrEl);

  const grid = document.createElement('div');
  grid.className = 'report-grid';
  
  data.sections.forEach(section => {
    const card = document.createElement('div');
    card.className = 'card section-card';
    
    let badge = '—';
    if (section.status === 'strong') badge = '✅ Strong';
    if (section.status === 'weak') badge = '⚠️ Weak';
    if (section.status === 'wrong') badge = '❌ Problem';

    let contentHTML = `<p class="finding">${section.finding}</p>`;
    if (section.problems) {
      contentHTML += `<ol class="problems-list">${section.problems.map(p => `<li>${p}</li>`).join('')}</ol>`;
    }
    if (section.id === 'market_size' && section.number) {
      contentHTML = `<div class="number-callout">${section.number}</div>` + contentHTML;
    }

    card.innerHTML = `
      <div class="card-header">
        <h3>${section.title}</h3>
        <span class="status-badge">${badge}</span>
      </div>
      ${contentHTML}
    `;
    grid.appendChild(card);
  });
  elements.reportContainer.appendChild(grid);

  if (data.gaps_table) {
    const gaps = document.createElement('div');
    gaps.className = 'gaps-section';
    gaps.innerHTML = `
      <h2>Strategic Gaps</h2>
      <table class="gaps-table">
        <thead><tr><th>Gap</th><th>Fix</th></tr></thead>
        <tbody>${data.gaps_table.map(g => `<tr><td>${g.gap}</td><td>${g.fix}</td></tr>`).join('')}</tbody>
      </table>
    `;
    elements.reportContainer.appendChild(gaps);
  }
}

window.startOptimizedAnalysis = startOptimizedAnalysis;
window.showView = showView;

init();