/**
 * Scout PWA - app.js
 * Handles API interaction, state, rendering, and PWA logic.
 * Switched to Groq (Llama 3.1 70B) for better reliability and speed.
 */

const API_KEY = 'YOUR_GROQ_API_KEY'; // Replace with your Groq API Key

const SYSTEM_PROMPT = `You are a senior operator/investor who has seen 500 pitches. You run structured, blunt, first-principles company analysis. No hedging. No consultant speak. Short sentences. Direct verdicts.

ALWAYS respond with valid JSON only. No markdown. No preamble. No explanation outside the JSON.`;

const USER_PROMPT_TEMPLATE = (company, context) => `Research this company and return ONLY a JSON object matching this exact schema:

{
  "company": "string",
  "tagline": "one sentence, plain language, no marketing",
  "tldr": {
    "verdict": "Back | Pass | Interesting but...",
    "verdict_reason": "one sentence",
    "strengths": ["string", "string", "string"],
    "risks": ["string", "string", "string"]
  },
  "sections": [
    {
      "id": "what_they_do",
      "title": "What They Do",
      "finding": "2-3 sentences",
      "status": null
    },
    {
      "id": "claimed_problem",
      "title": "Claimed Problem",
      "finding": "their framing + your translation",
      "status": null
    },
    {
      "id": "user",
      "title": "The User",
      "finding": "precise user definition, not vague",
      "status": null
    },
    {
      "id": "real_problem_stack",
      "title": "Real Problem Stack",
      "finding": "top 3-5 actual problems this user faces in this category",
      "problems": ["string", "string", "string"],
      "status": null
    },
    {
      "id": "user_problem_fit",
      "title": "User–Problem Fit",
      "finding": "does their claimed problem rank #1 or #2 in the real stack?",
      "status": "strong | weak | wrong"
    },
    {
      "id": "current_solutions",
      "title": "How They Solve It Today",
      "finding": "existing alternatives and switching motivation",
      "status": "strong | weak | wrong"
    },
    {
      "id": "monetisation",
      "title": "Monetisation Logic",
      "finding": "value captured, business model",
      "status": "strong | weak | wrong"
    },
    {
      "id": "market_size",
      "title": "Market Size",
      "finding": "bottom-up: exact user count × willingness to pay. No top-down TAM.",
      "number": "string",
      "number_note": "basis for the estimate",
      "status": null
    },
    {
      "id": "unit_economics",
      "title": "Unit Economics",
      "finding": "CM2 and CM3 logic, payback period, CAC trajectory",
      "status": "strong | weak | wrong"
    },
    {
      "id": "defensibility",
      "title": "Defensibility",
      "finding": "overall moat assessment",
      "scorecard": [
        { "dimension": "Network Effects", "present": true, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Data Moat", "present": false, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Switching Costs", "present": true, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Brand / Trust", "present": false, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Workflow Lock-in", "present": true, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Regulatory Barriers", "present": false, "strength": "strong | moderate | weak | none", "note": "string" },
        { "dimension": "Execution Speed", "present": true, "strength": "strong | moderate | weak | none", "note": "string" }
      ],
      "status": "strong | weak | wrong"
    }
  ],
  "gaps_table": [
    { "gap": "string", "fix": "string" }
  ],
  "overall_verdict": "string",
  "overall_status": "back | pass | interesting"
}

Company to research: ${company}
Additional context: ${context || 'None'}`;

// DOM Elements
const views = {
  home: document.getElementById('home-screen'),
  report: document.getElementById('report-screen'),
  loading: document.getElementById('loading-screen'),
  error: document.getElementById('error-screen')
};

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
  retryBtn: document.getElementById('retry-btn'),
  apiWarning: document.getElementById('api-warning'),
  installBanner: document.getElementById('install-banner'),
  installBtn: document.getElementById('install-btn')
};

// State
let deferredPrompt;
let currentReport = null;

// Initialize
function init() {
  if (!API_KEY || API_KEY === 'YOUR_GROQ_API_KEY') {
    elements.apiWarning.classList.remove('hidden');
  }

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.log('SW failed', err));
  }

  renderRecentSearches();
  setupEventListeners();
}

function setupEventListeners() {
  elements.contextToggle.addEventListener('click', () => {
    elements.extraContext.classList.toggle('hidden');
    elements.contextToggle.textContent = elements.extraContext.classList.contains('hidden') ? '+ Add context' : '- Remove context';
  });

  elements.analyseBtn.addEventListener('click', () => {
    const company = elements.companyInput.value.trim();
    const context = elements.extraContext.value.trim();
    if (company) performAnalysis(company, context);
  });

  elements.backBtn.addEventListener('click', () => showView('home'));
  elements.retryBtn.addEventListener('click', () => {
    const company = elements.companyInput.value.trim();
    const context = elements.extraContext.value.trim();
    performAnalysis(company, context);
  });

  // PWA Install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

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

function showView(viewName) {
  Object.keys(views).forEach(v => {
    views[v].classList.add('hidden');
  });
  views[viewName].classList.remove('hidden');
  window.scrollTo(0, 0);
}

async function performAnalysis(company, context) {
  if (!API_KEY || API_KEY === 'YOUR_GROQ_API_KEY') {
    alert("API_KEY is missing. Add it to app.js to use this tool.");
    return;
  }

  elements.loadingCompanyName.textContent = `Researching ${company}...`;
  showView('loading');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PROMPT_TEMPLATE(company, context) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Groq API Error: ${response.status} ${errData.error?.message || ''}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    const reportData = JSON.parse(resultText);

    saveReport(reportData);
    renderReport(reportData);
    showView('report');
    
    // Show install banner after first success if prompt exists
    if (deferredPrompt) {
      elements.installBanner.classList.remove('hidden');
    }

  } catch (err) {
    console.error(err);
    elements.errorMessage.textContent = err.message;
    showView('error');
  }
}

function saveReport(report) {
  const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  // Remove existing entry for same company if it exists
  const filtered = recent.filter(r => r.company.toLowerCase() !== report.company.toLowerCase());
  filtered.unshift({ ...report, timestamp: Date.now() });
  localStorage.setItem('scout_reports', JSON.stringify(filtered.slice(0, 5)));
  renderRecentSearches();
}

function renderRecentSearches() {
  const recent = JSON.parse(localStorage.getItem('scout_reports') || '[]');
  elements.recentChips.innerHTML = '';
  recent.forEach(report => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = report.company;
    chip.addEventListener('click', () => {
      renderReport(report);
      showView('report');
    });
    elements.recentChips.appendChild(chip);
  });
}

function renderReport(data) {
  elements.reportHeader.textContent = data.company;
  elements.reportContainer.innerHTML = '';

  // 1. TLDR Card
  const tldr = data.tldr;
  const tldrEl = document.createElement('div');
  const verdictClass = tldr.verdict.toLowerCase().includes('back') ? 'back' : 
                       tldr.verdict.toLowerCase().includes('pass') ? 'pass' : 'interesting';
  
  tldrEl.className = `card tldr-card ${verdictClass}`;
  tldrEl.innerHTML = `
    <div class="tldr-header">
      <div class="tldr-title">
        <h2>${data.company}</h2>
        <p>${data.tagline}</p>
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

  // 2. Section Cards Grid
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

    if (section.id === 'real_problem_stack' && section.problems) {
      contentHTML += `<ol class="problems-list">${section.problems.map(p => `<li>${p}</li>`).join('')}</ol>`;
    }

    if (section.id === 'market_size') {
      contentHTML = `
        <div class="number-callout">${data.sections.find(s => s.id === 'market_size').number || '—'}</div>
        <p class="number-note">${data.sections.find(s => s.id === 'market_size').number_note || ''}</p>
        ${contentHTML}
      `;
    }

    if (section.id === 'defensibility' && section.scorecard) {
      contentHTML += `
        <table class="scorecard-table">
          <thead><tr><th>Dimension</th><th>Strength</th></tr></thead>
          <tbody>
            ${section.scorecard.map(row => `
              <tr>
                <td>${row.dimension}</td>
                <td><span class="dot ${row.strength}"></span> ${row.strength}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
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

  // 3. Gaps Table
  if (data.gaps_table && data.gaps_table.length > 0) {
    const gapsEl = document.createElement('div');
    gapsEl.className = 'gaps-section';
    gapsEl.innerHTML = `
      <h2>Gaps & Fixes</h2>
      <table class="gaps-table">
        <thead><tr><th>Gap</th><th>Right Fix</th></tr></thead>
        <tbody>
          ${data.gaps_table.map(row => `
            <tr>
              <td>${row.gap}</td>
              <td>${row.fix}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    elements.reportContainer.appendChild(gapsEl);
  }

  // 4. Overall Verdict
  const overallEl = document.createElement('div');
  overallEl.className = 'overall-section';
  overallEl.innerHTML = `
    <div class="overall-text">${data.overall_verdict}</div>
  `;
  elements.reportContainer.appendChild(overallEl);
  
  // Stagger animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 100);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.card').forEach(card => observer.observe(card));
}

init();