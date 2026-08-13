const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
}));

app.use(express.json());

/**
 * GET /api/fetch?url=<encoded-url>
 * Fetches the HTML content of the given URL and returns it.
 */
app.get('/api/fetch', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported.' });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AEO-Schema-Generator/1.0; +https://aeo-tool.dev)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      timeout: 15000,
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Target URL responded with HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text')) {
      return res.status(415).json({
        error: `Unsupported content type: ${contentType}. Only HTML pages are supported.`,
      });
    }

    const html = await response.text();
    const finalUrl = response.url; // may differ if redirected

    return res.json({
      html,
      finalUrl,
      statusCode: response.status,
      contentType,
    });
  } catch (err) {
    console.error('[AEO Server] Fetch error:', err.message);

    if (err.type === 'request-timeout' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Request timed out. The target URL did not respond in time.' });
    }

    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      return res.status(502).json({ error: 'Could not resolve host. Check the URL and try again.' });
    }

    if (err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Connection refused by the target server.' });
    }

    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AEO Proxy Server running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Usage: GET http://localhost:${PORT}/api/fetch?url=<encoded-url>\n`);
});
