---
name: company-research
description: >
  Run a structured, opinionated company research and investment analysis using a 13-step
  framework that evaluates problem-solution fit, user-problem fit, monetisation logic,
  unit economics, market size, and defensibility. Use this skill whenever the user asks
  to "research a company", "analyse a startup", "evaluate a pitch", "do a teardown",
  "assess a business", or shares a company name and wants strategic or investment-style
  commentary. Also trigger when the user pastes a pitch deck, a funding announcement,
  or asks "should I invest in / partner with / join X". This skill requires web search
  to be useful — always search before reasoning.
---

A structured 13-step framework to research and critique any company from first principles.
The output should read like a sharp, senior investor/operator memo — not a consultant deck.
**All key claims must be backed by references to search results.**

---

## How to run the analysis

Work through the 13 steps in order. For each step, **search first, then reason**.
State your finding clearly, then state your verdict. Be blunt.

---

### Step 1 — What does the company actually do?

Search: `[company name] what does it do`, `[company name] product`, `[company name] about`

- Summarise the business in 2–3 sentences in plain language.
- Avoid their own marketing language. Translate it.
- Note: B2B / B2C / marketplace / SaaS / infra / etc.

---

### Step 2 — What problem do they claim to solve?

Search: `[company name] problem they solve`, `[company name] why we built this`, `[company name] founder story`

- State the problem as *they* frame it.
- Note how specific or vague their framing is. Vague = red flag.

---

### Step 3 — Who is the user they are solving for?

Search: `[company name] target customer`, `[company name] who uses it`, `[company name] case studies`

- Be precise. Not "SMBs" — which SMBs, in which function, with which workflow.
- If they can't tell you who the user is, note that.

---

### Step 4 — What is the most important problem this user actually faces in this category?

This step requires your own reasoning + search for validation.

Search: `[user type] biggest challenges [category]`, `[user type] pain points [category]`

- Rank the top 3–5 problems this user faces in this category (not just what the company says).
- Be specific. Use your knowledge of the domain.

---

### Step 5 — User-problem fit: does the company's problem rank high enough?

Cross-reference Step 2 (company's claimed problem) against Step 4 (real user problem stack).

Ask two questions:
1. **Within category**: Is this problem in the top 1–2 for this user in this category?
2. **In user's life**: Is this category itself a high-priority area for this user?

**Verdict**: 
- ✅ Strong fit — problem is #1 or #2 in the stack
- ⚠️ Weak fit — problem exists but is not urgent or frequent
- ❌ Wrong problem — company is solving something the user doesn't prioritise

---

### Step 6 — If weak/wrong problem fit, flag it explicitly

If Step 5 verdict is ⚠️ or ❌:

> "The company is solving [X] but the user's real top problem in this category is [Y]. This is a structural risk — no amount of product polish fixes a wrong problem."

Suggest what the right problem might be.

---

### Step 7 — How does the user solve this problem today (without the company's product)?

Search: `how do [user type] solve [problem] today`, `[problem] existing solutions`, `[category] incumbent tools`

- List the current alternatives: manual process, Excel, existing SaaS, outsourcing, ignoring it.
- Assess: Is the current solution painful enough to switch? What's the switching cost?

**Verdict**: 
- ✅ Current solution is broken/expensive/manual — high switching motivation
- ⚠️ Current solution works, just imperfectly — moderate motivation
- ❌ Current solution is good enough — low motivation to switch

---

### Step 8 — Is there real monetary upside in solving this problem?

Reason through:
- What does solving this problem *save* or *earn* for the user?
- Is the value quantifiable and large enough to pay for a product?
- Is the company capturing a defensible share of that value?

**Verdict**:
- ✅ Clear monetary upside, company captures it
- ⚠️ Value exists but hard to monetise / company isn't capturing it yet
- ❌ Nice-to-have solution, no clear monetisation — product looking for a business

---

### Step 9 — If monetisation exists, examine PnL, market size, and acquisition economics

Search: `[company name] revenue`, `[company name] funding`, `[company name] ARR`, `[company name] business model`, `[category] market size`

Evaluate:
- **Market size**: How many of *this exact user* exist, and what can each pay? Bottom-up, not top-down TAM.
- **Business model**: Subscription / usage / transaction / services?
- **Unit economics claimed or implied**: Is there any signal on CAC, LTV, payback?

---

### Step 10 — CM2 and CM3 logic

This is the most important financial check.

**CM2 (Contribution Margin after variable costs)**: Is the product profitable per unit? If not, does scale help or hurt?

**CM3 (CM2 minus S&M)**: Is the payback period reasonable? Does CAC get cheaper over time (virality, brand, network effects, category creation)?

Search: `[company name] unit economics`, `[company name] gross margin`, `[category] SaaS benchmarks`

Ask:
- If CM2 is negative: Is there a credible path to positive? Or are they burning structurally?
- If CM3 is ugly: Is there a reason CAC will fall — or are they dependent on paid acquisition forever?

**Verdict**:
- ✅ CM2 positive, CM3 improving, CAC compressing
- ⚠️ CM2 positive but CM3 ugly — acquisition-dependent
- ❌ CM2 negative — structural problem, not a scale problem

---

### Step 11 — Defensibility: how easy is this to replicate?

Search: `[company name] moat`, `[company name] why hard to copy`, `[category] competitive landscape`, `[company name] vs [competitor]`

Assess against the defensibility stack (strongest to weakest):
1. **Network effects** — does the product get better as more users join?
2. **Data moat** — does usage generate proprietary data that improves the product?
3. **Switching costs** — how painful is it to leave once you're in?
4. **Brand / trust** — especially important in regulated or high-stakes categories
5. **Workflow lock-in** — is the product embedded in daily operations?
6. **Regulatory / licensing** — any structural barriers to entry?
7. **Speed / execution** — (weakest, temporary advantage only)

---

### Step 12 — If defensibility is strong, say so

If the company has built a real value chain with 2+ defensibility layers, state:

> "The company has built [X + Y] which makes replication structurally hard. No major comment here."

Don't manufacture concerns where the moat is real.

---

### Step 13 — For every gap found, suggest the right answer

For each ❌ or ⚠️ finding in Steps 5–11, provide a constructive reframe:

| Gap | Right fix |
|-----|-----------|
| Wrong problem | State the right problem to solve |
| Wrong user | State the right user to target |
| Weak monetisation | Suggest how value could be captured |
| CM2 broken | Suggest what would need to change (pricing, COGS, delivery model) |
| No moat | Suggest what moat could be built and how |

---

## Output format

Structure your output as a memo. Use this skeleton:

```
## [Company Name] — Research Memo

### What they do
[2–3 sentences]

### The problem they claim to solve
[Their framing + your translation]

### The user
[Precise definition]

### Real user problem stack in this category
1. [Problem #1]
2. [Problem #2]
3. [Problem #3]

### User-problem fit verdict
[✅/⚠️/❌ + 1 paragraph]

### How users solve it today
[Existing alternatives + switching motivation verdict]

### Monetisation logic
[Value captured + ✅/⚠️/❌]

### Market size (bottom-up)
[Specific user count × willingness to pay]

### Unit economics read
[CM2 + CM3 logic + verdict]

### Defensibility
[Stack assessment + verdict]

### What's working
[Honest strengths]

### Gaps and what to do about them
[Table or bullets: Gap → Right fix]

### References
[List of source URLs and data points used in this research]

### Overall verdict
[1 paragraph. Blunt. Would you back this? Why or why not?]
```

---

## Tone guidance

- Write like a senior operator who has seen 500 pitches, not a consultant writing a report.
- Short sentences. Direct verdicts. No hedging.
- It's fine to say "this is the wrong problem" or "this moat doesn't exist".
- Praise where it's real. Critique where it's needed. Don't balance for the sake of balance.
- The goal is to be useful to the person reading it — not to be nice to the company.
