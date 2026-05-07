export default async function handler(req, res) {
  const { action, body } = req.body;
  
  // SECURE: These are read from Vercel Environment Variables
  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!TAVILY_KEY || !GROQ_KEY) {
    return res.status(500).json({ error: 'API Keys are missing in Vercel Environment Variables.' });
  }

  try {
    if (action === 'search') {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, api_key: TAVILY_KEY })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (action === 'analyse') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
