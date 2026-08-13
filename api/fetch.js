/**
 * api/fetch.js — Vercel Serverless Function
 *
 * Proxies URL fetch requests server-side to avoid CORS issues.
 * Deployed on Vercel at: GET /api/fetch?url=<encoded-url>
 *
 * Local dev: Express server (server/server.js) handles this same route
 * via the Vite proxy configured in vite.config.js.
 */

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // CORS headers (allow the Vercel deployment + localhost dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  // Validate URL
  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported.' });
  }

  try {
    // Use native fetch (Node 18+, available on Vercel by default)
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AEO-Schema-Generator/1.0; +https://aeo-tool.vercel.app)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Target URL responded with HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (
      !contentType.includes('html') &&
      !contentType.includes('xml') &&
      !contentType.includes('text')
    ) {
      return res.status(415).json({
        error: `Unsupported content type: ${contentType}. Only HTML pages are supported.`,
      });
    }

    const html = await response.text();
    const finalUrl = response.url; // may differ after redirects

    return res.status(200).json({
      html,
      finalUrl,
      statusCode: response.status,
      contentType,
    });
  } catch (err) {
    console.error('[AEO Serverless] Fetch error:', err.message);

    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timed out. The target URL did not respond in 15 seconds.',
      });
    }

    if (err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'EAI_AGAIN') {
      return res.status(502).json({
        error: 'Could not resolve host. Please check the URL and try again.',
      });
    }

    if (err.cause?.code === 'ECONNREFUSED') {
      return res.status(502).json({
        error: 'Connection refused by the target server.',
      });
    }

    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
