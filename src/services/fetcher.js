/**
 * fetcher.js
 * Calls the local Express proxy to fetch a URL's HTML content.
 */

const PROXY_BASE = '/api';

/**
 * Fetches the HTML of a given URL via the Express proxy server.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<{ html: string, finalUrl: string, statusCode: number, contentType: string }>}
 */
export async function fetchPageHTML(url) {
  const encodedUrl = encodeURIComponent(url);
  const response = await fetch(`${PROXY_BASE}/fetch?url=${encodedUrl}`);

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error || errorMsg;
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data;
}

/**
 * Validates that a string is a well-formed HTTP/HTTPS URL.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUrl(url) {
  if (!url || !url.trim()) {
    return { valid: false, error: 'Please enter a URL.' };
  }

  let parsed;
  try {
    // Add protocol if missing
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please include a valid domain.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  return { valid: true, normalized: parsed.toString() };
}
