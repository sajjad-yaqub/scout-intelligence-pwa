import os
import json
import time
from flask import Flask, request, Response
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
from tavily import TavilyClient

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure APIs
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# The 13-step framework prompt
SYSTEM_PROMPT = """You are a senior investment operator. Your job is to conduct a brutal, first-principles teardown of a company using a 13-step framework.
For each step, you will be provided with search results. Analyze them and provide a sharp, blunt verdict.

FRAMEWORK STEPS:
1. What does the company actually do? (2-3 sentences, plain language)
2. What problem do they claim to solve? (Their framing vs reality)
3. Who is the user? (Be precise)
4. Real user problem stack (Top 3-5 problems)
5. User-problem fit (Verdict: ✅/⚠️/❌)
6. Flag weak fit if applicable
7. Current solutions & switching cost
8. Monetisation upside (Verdict: ✅/⚠️/❌)
9. PnL & Market Size (Bottom-up calculation)
10. CM2 and CM3 logic (Verdict: ✅/⚠️/❌)
11. Defensibility (Moat assessment)
12. Flag strong defensibility
13. Gaps and fixes

Output each step as a JSON object within a stream, with 'step', 'title', 'content', 'scorecard', 'verdict', and 'references' fields if applicable. Always include source URLs in the references field for key claims. """

@app.route('/teardown', methods=['POST'])
def teardown():
    data = request.json
    company_name = data.get('company')
    
    if not company_name:
        return {"error": "No company name provided"}, 400

    def generate():
        # Step 0: Initial Research
        yield f"data: {json.dumps({'status': 'Searching...', 'step': 0})}\n\n"
        search_query = f"{company_name} product business model revenue funding unit economics"
        search_results = tavily.search(query=search_query, search_depth="advanced")
        urls = [r['url'] for r in search_results['results']]
        context = "\n".join([f"Source: {r['url']}\nContent: {r['content']}" for r in search_results['results']])

        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # We'll ask Gemini to process the steps one by one to simulate the "Live Tracker"
        # In a real production app, we'd do this more efficiently, but for this demo, 
        # we'll loop to ensure the frontend updates perfectly.
        
        steps = [
            {"id": 1, "title": "What does the company actually do?", "prompt": "Describe what {company} actually does in 2-3 sentences of plain language. Avoid marketing speak."},
            {"id": 2, "title": "What problem do they claim to solve?", "prompt": "Identify the problem {company} claims to solve. Compare their framing with reality."},
            {"id": 3, "title": "Who is the user they are solving for?", "prompt": "Identify the precise target user for {company}. Avoid vague terms like 'SMBs'."},
            {"id": 4, "title": "Real user problem stack", "prompt": "Rank the top 3-5 problems this user actually faces in this category."},
            {"id": 5, "title": "User-problem fit", "prompt": "Evaluate the User-problem fit. Is this problem in the top 2? Verdict: ✅/⚠️/❌.", "scorecard": "fit"},
            {"id": 6, "title": "Fit Flag", "prompt": "If fit is weak, flag it. If not, state N/A."},
            {"id": 7, "title": "Current solutions & switching cost", "prompt": "How do they solve it today? Is there switching motivation? Verdict: ✅/⚠️/❌."},
            {"id": 8, "title": "Monetisation upside", "prompt": "Is there real monetary upside? Does the company capture it? Verdict: ✅/⚠️/❌.", "scorecard": "monetisation"},
            {"id": 9, "title": "PnL & Market Size", "prompt": "Bottom-up market size calculation (user count x price)."},
            {"id": 10, "title": "CM2 and CM3 logic", "prompt": "Evaluate unit economics. CM2 and CM3 logic. Verdict: ✅/⚠️/❌.", "scorecard": "economics"},
            {"id": 11, "title": "Defensibility", "prompt": "Assess defensibility (Network effects, data moat, etc.). Verdict: ✅/⚠️/❌.", "scorecard": "defensibility"},
            {"id": 12, "title": "Defensibility Flag", "prompt": "Flag strong defensibility if it exists."},
            {"id": 13, "title": "Gaps and fixes", "prompt": "Identify gaps and suggest specific fixes."}
        ]

        full_analysis_context = context
        
        for step in steps:
            # Prepare specific prompt for this step
            step_prompt = f"Using this context: {full_analysis_context}\n\nTask: {step['prompt'].format(company=company_name)}\n\nFormat your response as a sharp, blunt operator verdict."
            
            response = model.generate_content(step_prompt)
            content = response.text.strip()
            
            # Determine scorecard status if applicable
            score_text = "Pending"
            score_class = "status-pending"
            verdict_text = ""
            
            if "✅" in content:
                score_text = "Strong" if step.get('scorecard') == 'fit' else "High" if step.get('scorecard') == 'monetisation' else "Healthy"
                score_class = "status-success"
                verdict_text = content
            elif "⚠️" in content:
                score_text = "Weak"
                score_class = "status-warning"
                verdict_text = content
            elif "❌" in content:
                score_text = "Poor"
                score_class = "status-danger"
                verdict_text = content
            
            yield f"data: {json.dumps({'step': step['id'], 'title': step['title'], 'content': content, 'scorecard': step.get('scorecard'), 'scoreText': score_text, 'scoreClass': score_class, 'verdict': verdict_text, 'references': urls})}\n\n"
            time.sleep(0.5) # Slight delay for UI smoothness

        # Final Verdict
        final_prompt = f"Based on the analysis above, give a final 1-paragraph blunt verdict on {company_name}. Should I invest? (INVEST/WATCH/PASS)"
        final_response = model.generate_content(final_prompt)
        final_text = final_response.text.strip()
        badge = "WATCH"
        if "INVEST" in final_text.upper(): badge = "INVEST"
        elif "PASS" in final_text.upper(): badge = "PASS"
        
        yield f"data: {json.dumps({'step': 14, 'final': True, 'content': final_text, 'badge': badge})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(port=5000)
