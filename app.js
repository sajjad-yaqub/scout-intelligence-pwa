/**
 * Scout PWA - app.js
 * Handles API interaction, state, rendering, and PWA logic.
 * Integrated Tavily for real-time search to eliminate hallucinations.
 * Added Disambiguation step for multiple company names.
 */

const GROQ_KEY = 'YOUR_GROQ_API_KEY';
const TAVILY_KEY = 'YOUR_TAVILY_API_KEY';

const SYSTEM_PROMPT = `You are a senior operator/investor who has seen 500 pitches. You run structured, blunt, first-principles company analysis. 

RULES:
1. NO HALLUCINATIONS. If the provided context doesn't contain a fact, state "DATA_GAP" or infer logically from context.
2. Be skeptical. If a company claims a market size that seems impossible, flag it.
3. Output ONLY valid JSON.

JSON Schema:
{
  "company": "string",
  "tagline": "string",
  "data_quality_score": 0-100,
  "missing_info_warning": "string | null",
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
    .disambiguation-item { background: var(--panel); border: 1px solid var(--border); padding: 1rem; cursor: pointer; text-align: left; transition: 0.2s; }
    .disambiguation-item:hover { border-color: var(--text); }
    .disambiguation-item h4 { margin-bottom: 0.25rem; font-family: var(--sans); font-weight: 600; }
    .disambiguation-item p { font-size: 0.85rem; color: var(--text-dim); }
    .warning-banner { background: #332200; color: #ffaa00; padding: 0.75rem; font-size: 0.85rem; margin-bottom: 1.5rem; border: 1px solid #ffaa00; font-family: var(--mono); }
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
}

function showView(viewName) {
  [...Object.values(views)].forEach(v => v.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
  window.scrollTo(0, 0);
}

async function startResearchFlow(company, context) {
  if (GROQ_KEY.includes('YOUR_') || TAVILY_KEY.includes('YOUR_')) {
    alert("API Keys are missing. Please add your Groq and Tavily keys to app.js");
    showView('home');
    return;
  }

  elements.loadingCompanyName.textContent = `Searching for ${company}...`;
  showView('loading');

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: `${company} company product business model`,
        search_depth: "advanced",
        max_results: 5
      })
    });
    
    const searchResults = await response.json();
    const results = searchResults.results || [];
    lastSearchResults = results;
    
    renderDisambiguation(company, results, context);
    showView('disambiguation');

  } catch (err) {
    console.error(err);
    elements.errorMessage.textContent = `Search Error: ${err.message}`;
    showView('error');
  }
}

function renderDisambiguation(query, results, originalContext) {
  views.disambiguation.innerHTML = `
    <header class="home-header">
      <h1>Which ${query}?</h1>
      <p>Select the correct company to start analysis</p>
    </header>
    <div class="disambiguation-list">
      ${results.map((r, i) => `
        <div class="disambiguation-item" onclick="performDeepAnalysis('${query}', ${i}, '${originalContext}')">
          <h4>${r.title}</h4>
          <p>${r.url}</p>
          <p>${r.content.substring(0, 150)}...</p>
        </div>
      `).join('')}
      <div class="disambiguation-item" onclick="performDeepAnalysis('${query}', -1, '${originalContext}')">
        <h4>None of these / General Research</h4>
        <p>Use all search results for a general teardown</p>
      </div>
    </div>
    <button class="btn-text" style="margin-top: 2rem" onclick="showView('home')">← Back to search</button>
  `;
}

async function performDeepAnalysis(query, selectedIndex, originalContext) {
  const results = lastSearchResults;
  let contextText = originalContext ? `User Context: ${originalContext}\n\n` : '';
  
  if (selectedIndex === -1) {
    contextText += results.map(r => `Source: ${r.url}\nContent: ${r.content}`).join('\n\n');
  } else {
    const r = results[selectedIndex];
    contextText += `Target: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n\n`;
    contextText += "Secondary Context:\n" + results.filter((_, i) => i !== selectedIndex).map(r => r.content).join('\n');
  }

  elements.loadingCompanyName.textContent = `Analysing ${query}...`;
  showView('loading');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Company: ${query}\n\nResearch Context:\n${contextText}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    const data = await response.json();
    const reportData = JSON.parse(data.choices[0].message.content);

    saveReport(reportData);
    renderReport(reportData);
    showView('report');

  } catch (err) {
    console.error(err);
    elements.errorMessage.textContent = `Analysis Error: ${err.message}`;
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

  if (data.missing_info_warning) {
    const warning = document.createElement('div');
    warning.className = 'warning-banner';
    warning.textContent = `⚠️ ATTENTION: ${data.missing_info_warning}`;
    elements.reportContainer.appendChild(warning);
  }

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
        <div style="font-family: var(--mono); font-size: 0.65rem; color: var(--text-dim); margin-top: 0.5rem">Data Quality: ${data.data_quality_score}/100</div>
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
      <h2>Gaps & Fixes</h2>
      <table class="gaps-table">
        <thead><tr><th>Gap</th><th>Fix</th></tr></thead>
        <tbody>${data.gaps_table.map(g => `<tr><td>${g.gap}</td><td>${g.fix}</td></tr>`).join('')}</tbody>
      </table>
    `;
    elements.reportContainer.appendChild(gaps);
  }
}

window.performDeepAnalysis = performDeepAnalysis;
window.showView = showView;

init();