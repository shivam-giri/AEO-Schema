/**
 * api/generate-qa.js — Vercel Serverless Function
 * Generates structured Q&A pairs for each schema using Google Gemini API.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { pageUrl, title, pageText, schemas, apiKey } = req.body || {};
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY not configured.',
      code: 'NO_API_KEY',
    });
  }

  if (!Array.isArray(schemas) || schemas.length === 0) {
    return res.status(400).json({ error: 'schemas array is required.' });
  }

  const schemaListStr = schemas
    .map(s => `- Type: "${s.type}" | Label: "${s.label || s.type}"${s.name ? ` | Target Entity Name: "${s.name}"` : ''}`)
    .join('\n');

  const prompt = `You are an Answer Engine Optimization (AEO) and Schema.org structured data expert.

Your task is to analyze the content of this webpage, extract all natural conversational Questions & Answers that can be factually answered by the page text, and categorize them by the most relevant Schema type.

Webpage Information:
- Page URL: ${pageUrl || 'N/A'}
- Page Title: ${title || 'N/A'}

Page Content (extracted text from the page):
"""
${(pageText || '').slice(0, 15000)}
"""

Available Schemas detected on this page:
${schemaListStr}

Guidelines:
1. READ THE PAGE CONTENT THOROUGHLY FIRST. Identify all meaningful, high-intent, and specific questions that users or conversational AI search engines (ChatGPT Search, Perplexity AI, Google AI Overviews) are likely to ask that are directly answered by this page.
2. GENERATE A COMPREHENSIVE SET OF QUESTIONS (aim for 4 to 8 detailed, highly specific Q&A pairs for each substantive schema whenever the content allows). Do not stop at just 1 or 2 high-level questions.
3. FOCUS ON GRANULAR, ENTITY-LEVEL SPECIFICS:
   - For leadership/board rosters (ItemList): Formulate individual questions about specific key people, their exact leadership titles, and committee appointments.
     * Example Question: "Who is the Chair of the Board at Rolls-Royce?"
       Example Answer: "Dame Anita Frew is the Chair of the Board and also serves as the Chair of the Nominations, Culture & Governance committee."
     * Example Question: "Who is the Chief Executive?"
       Example Answer: "Tufan Erginbilgic serves as the Chief Executive and Executive Director."
     * Example Question: "Who is the Senior Independent Director?"
       Example Answer: "Nick Luff serves as the Senior Independent Director and Chair of the Audit Committee."
     * Example Question: "What board committees exist at the company?"
       Example Answer: "The board maintains committees for Audit, Remuneration, Nominations, Culture & Governance, and Safety & Sustainability."
   - For corporate/organization profiles (Organization): Formulate questions covering core business divisions, sustainability & net-zero targets, corporate history, headquarters, and shareholder/financial resources.
   - For news/press releases (NewsArticle): Formulate questions covering key announcements, investment sums, strategic partnerships, dates, and executive commentary.
   - For products/technologies (Product): Formulate questions detailing engineering specifications, capabilities, applications, and performance benefits.
4. Formulate clear, natural questions and direct, factual answers (1 to 3 concise, information-dense sentences) based strictly on the page text.
5. CATEGORIZE each Q&A pair under the most relevant Schema Type from the available schemas list:
   - For leadership, board of directors, executive bios -> categorize under "ItemList"
   - For company background, mission, headquarters, corporate info -> categorize under "Organization"
   - For article subject, editorial insights, author details -> categorize under "Article" or "NewsArticle"
   - For products, pricing, specifications -> categorize under "Product"
   - For event dates, locations, agenda, registration -> categorize under "Event"
   - For general on-page FAQs -> categorize under "FAQPage"
6. CRITICAL RULE: It is NOT necessary for every schema to have a Q&A section! It strictly depends on the content of the page. Only include schemas that have substantive, meaningful answers supported by the text. If a schema (such as "WebSite") does not have dedicated Q&A from the page, DO NOT invent or force artificial questions for it. Omit it from the response.

Return ONLY a valid JSON object where keys are the schema type names that have relevant Q&A, and values are arrays of { "question": string, "answer": string } objects.
Example structure:
{
  "RelevantSchemaType": [
    { "question": "...", "answer": "..." }
  ]
}`;

  const CANDIDATE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-pro',
  ];

  let lastErr = null;
  let parsedQnA = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedErr = errText;
        try {
          const j = JSON.parse(errText);
          parsedErr = j.error?.message || errText;
        } catch { /* ignore */ }

        lastErr = parsedErr;
        if (response.status === 503 || response.status === 429 || response.status === 500 || /demand|unavailable|exhausted/i.test(parsedErr)) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        } else if (response.status === 404) {
          continue;
        } else {
          break;
        }
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) continue;

      try {
        parsedQnA = JSON.parse(rawText);
        break;
      } catch {
        continue;
      }
    } catch (err) {
      lastErr = err.message;
    }
  }

  if (parsedQnA && typeof parsedQnA === 'object' && Object.keys(parsedQnA).length > 0) {
    return res.json({ success: true, qna: parsedQnA, source: 'gemini' });
  }

  return res.status(503).json({ error: `Gemini API error: ${lastErr || 'All candidate models failed or unavailable.'}` });
}
