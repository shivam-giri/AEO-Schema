/**
 * htmlParser.js
 * DOM-based HTML parsing utilities for extracting AEO-relevant content.
 * Works in a browser environment by parsing the HTML string into a DOM tree.
 */

/**
 * Parse an HTML string into a DOM document.
 * @param {string} html
 * @returns {Document}
 */
export function parseHTML(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/** Get text content of first matching selector */
export function getText(doc, selector) {
  const el = doc.querySelector(selector);
  return el ? el.textContent?.trim() || el.getAttribute('content')?.trim() || '' : '';
}

/** Get attribute value of first matching selector */
export function getAttr(doc, selector, attr) {
  const el = doc.querySelector(selector);
  return el ? el.getAttribute(attr)?.trim() || '' : '';
}

/** Get all text content matching a selector */
export function getAllText(doc, selector) {
  return Array.from(doc.querySelectorAll(selector))
    .map(el => el.textContent?.trim())
    .filter(Boolean);
}

/**
 * Extract page metadata (title, description, OG, etc.)
 */
export function extractMeta(doc, pageUrl) {
  const title =
    getText(doc, 'meta[property="og:title"]') ||
    getText(doc, 'meta[name="twitter:title"]') ||
    doc.title?.trim() ||
    getText(doc, 'h1') ||
    '';

  const description =
    getAttr(doc, 'meta[name="description"]', 'content') ||
    getAttr(doc, 'meta[property="og:description"]', 'content') ||
    getAttr(doc, 'meta[name="twitter:description"]', 'content') ||
    '';

  const image =
    getAttr(doc, 'meta[property="og:image"]', 'content') ||
    getAttr(doc, 'meta[name="twitter:image"]', 'content') ||
    '';

  const canonicalUrl =
    getAttr(doc, 'link[rel="canonical"]', 'href') ||
    getAttr(doc, 'meta[property="og:url"]', 'content') ||
    pageUrl ||
    '';

  const siteName =
    getAttr(doc, 'meta[property="og:site_name"]', 'content') ||
    '';

  const type =
    getAttr(doc, 'meta[property="og:type"]', 'content') ||
    '';

  const author =
    getAttr(doc, 'meta[name="author"]', 'content') ||
    getText(doc, '[rel="author"]') ||
    getText(doc, '.author') ||
    getText(doc, '[itemprop="author"]') ||
    '';

  const datePublished =
    getAttr(doc, 'meta[property="article:published_time"]', 'content') ||
    getAttr(doc, 'time[datetime]', 'datetime') ||
    getAttr(doc, '[itemprop="datePublished"]', 'content') ||
    '';

  const dateModified =
    getAttr(doc, 'meta[property="article:modified_time"]', 'content') ||
    getAttr(doc, '[itemprop="dateModified"]', 'content') ||
    datePublished ||
    '';

  const robots = getAttr(doc, 'meta[name="robots"]', 'content') || '';

  // Existing schema
  const existingSchemas = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map(s => {
      try { return JSON.parse(s.textContent); } catch { return null; }
    })
    .filter(Boolean);

  return {
    title, description, image, canonicalUrl, siteName,
    type, author, datePublished, dateModified, robots,
    existingSchemas,
    hasMeta: {
      title: !!title,
      description: !!description,
      ogTags: !!(getAttr(doc, 'meta[property="og:title"]', 'content')),
      canonical: !!(getAttr(doc, 'link[rel="canonical"]', 'href')),
      robots: !!robots,
      author: !!author,
      publishedDate: !!datePublished,
    },
  };
}

/**
 * Detect the primary content type of the page.
 * Returns: 'article' | 'faq' | 'howto' | 'homepage' | 'product' | 'generic'
 */
export function detectPageType(doc, meta) {
  const ogType = meta.type.toLowerCase();

  // Check og:type
  if (ogType === 'article') return 'article';
  if (ogType === 'product') return 'product';

  // Check URL structure
  const url = meta.canonicalUrl.toLowerCase();
  const isHomepage = url.endsWith('/') || /\.(com|org|net|io|co)$/.test(url.replace(/https?:\/\//, '').split('/')[0]);

  // Check content signals
  const body = doc.body?.textContent?.toLowerCase() || '';
  const headings = getAllText(doc, 'h1,h2,h3');

  const hasFAQPatterns = checkFAQPatterns(doc);
  const hasHowToPatterns = checkHowToPatterns(doc);
  const hasSteps = hasHowToPatterns;

  const hasArticleSignals = !!(
    doc.querySelector('article') ||
    doc.querySelector('[itemprop="articleBody"]') ||
    doc.querySelector('.post-content, .entry-content, .article-body') ||
    meta.datePublished ||
    meta.author
  );

  const hasProductSignals = !!(
    doc.querySelector('[itemprop="Product"]') ||
    doc.querySelector('[typeof="Product"]') ||
    doc.querySelector('.price, .product-price, [class*="price"]') ||
    body.includes('add to cart') ||
    body.includes('buy now')
  );

  if (hasFAQPatterns.found) return 'faq';
  if (hasSteps) return 'howto';
  if (hasArticleSignals) return 'article';
  if (hasProductSignals) return 'product';

  const path = url.split('//')[1]?.split('/').slice(1).join('/') || '';
  if (!path || path === '' || path === 'index.html') return 'homepage';

  return 'generic';
}

/**
 * Extract FAQ pairs from the document.
 * Detects: <details>/<summary>, <dl>/<dt>/<dd>, heading+paragraph Q&A patterns.
 */
export function checkFAQPatterns(doc) {
  const pairs = [];

  // Pattern 1: <details><summary>Q</summary>A</details>
  doc.querySelectorAll('details').forEach(el => {
    const q = el.querySelector('summary')?.textContent?.trim();
    const a = Array.from(el.childNodes)
      .filter(n => n.nodeName !== 'SUMMARY')
      .map(n => n.textContent?.trim())
      .join(' ')
      .trim();
    if (q && a && a.length > 20) pairs.push({ question: q, answer: a.slice(0, 500) });
  });

  // Pattern 2: <dl><dt>Q</dt><dd>A</dd></dl>
  if (pairs.length < 3) {
    const dts = doc.querySelectorAll('dt');
    dts.forEach(dt => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') {
        const q = dt.textContent?.trim();
        const a = dd.textContent?.trim();
        if (q && a && a.length > 20) pairs.push({ question: q, answer: a.slice(0, 500) });
      }
    });
  }

  // Pattern 3: Heading patterns containing "?" or "how/what/why/when/where/can/does/is/are"
  if (pairs.length < 3) {
    const qHeadings = Array.from(doc.querySelectorAll('h2,h3,h4')).filter(h => {
      const text = h.textContent?.trim() || '';
      return text.endsWith('?') ||
        /^(how|what|why|when|where|who|can|does|is|are|will|should|which|do)\b/i.test(text);
    });

    qHeadings.slice(0, 10).forEach(h => {
      const q = h.textContent?.trim();
      let answer = '';
      let sibling = h.nextElementSibling;
      while (sibling && !['H1','H2','H3','H4'].includes(sibling.tagName) && answer.length < 400) {
        answer += ' ' + (sibling.textContent?.trim() || '');
        sibling = sibling.nextElementSibling;
      }
      answer = answer.trim();
      if (q && answer && answer.length > 30) {
        pairs.push({ question: q, answer: answer.slice(0, 500) });
      }
    });
  }

  // Deduplicate
  const seen = new Set();
  const unique = pairs.filter(p => {
    if (seen.has(p.question)) return false;
    seen.add(p.question);
    return true;
  });

  return { found: unique.length > 0, pairs: unique.slice(0, 12) };
}

/**
 * Extract HowTo steps from the document.
 */
export function checkHowToPatterns(doc) {
  const steps = [];

  // Pattern 1: <ol> with substantial list items
  const ols = doc.querySelectorAll('ol');
  ols.forEach(ol => {
    const items = Array.from(ol.querySelectorAll('li'));
    if (items.length >= 3) {
      items.slice(0, 15).forEach((li, i) => {
        const text = li.textContent?.trim();
        if (text && text.length > 15) {
          const heading = li.querySelector('strong, b, h3, h4');
          steps.push({
            name: heading?.textContent?.trim() || `Step ${i + 1}`,
            text: text.slice(0, 300),
          });
        }
      });
    }
  });

  // Pattern 2: Headings that suggest steps
  if (steps.length < 3) {
    const stepHeadings = Array.from(doc.querySelectorAll('h2,h3,h4')).filter(h => {
      const text = h.textContent?.trim() || '';
      return /^step\s*\d+/i.test(text) ||
        /^\d+[\.\)]\s/.test(text) ||
        /^(first|second|third|fourth|fifth|finally|next|then)\b/i.test(text);
    });

    stepHeadings.slice(0, 10).forEach((h, i) => {
      let text = '';
      let sibling = h.nextElementSibling;
      while (sibling && !['H1','H2','H3','H4'].includes(sibling.tagName) && text.length < 300) {
        text += ' ' + (sibling.textContent?.trim() || '');
        sibling = sibling.nextElementSibling;
      }
      text = text.trim();
      if (h.textContent?.trim() && text) {
        steps.push({ name: h.textContent.trim(), text: text.slice(0, 300) });
      }
    });
  }

  return steps.length >= 2 ? steps.slice(0, 10) : [];
}

/**
 * Extract organization info.
 */
export function extractOrganization(doc, meta, pageUrl) {
  // Inspect existing JSON-LD scripts for Organization/Corporation/LocalBusiness
  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  let jsonLdOrg = null;

  for (const s of jsonLdScripts) {
    try {
      const parsed = JSON.parse(s.textContent);
      if (!parsed) continue;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const entities = items.flatMap(item => (item && Array.isArray(item['@graph'])) ? item['@graph'] : (item ? [item] : []));

      jsonLdOrg = entities.find(e => {
        if (!e || !e['@type']) return false;
        const types = Array.isArray(e['@type']) ? e['@type'] : [e['@type']];
        return types.some(t => typeof t === 'string' && /organization|corporation|localbusiness|business/i.test(t));
      });

      if (jsonLdOrg) break;
    } catch { /* ignore */ }
  }

  const name =
    jsonLdOrg?.name ||
    jsonLdOrg?.legalName ||
    meta.siteName ||
    getText(doc, '[itemprop="name"]') ||
    doc.title?.split(/[-|–]/).pop()?.trim() ||
    '';

  const logo =
    (typeof jsonLdOrg?.logo === 'string' ? jsonLdOrg.logo : (jsonLdOrg?.logo?.url || jsonLdOrg?.logo?.contentUrl)) ||
    getAttr(doc, '[itemprop="logo"] img', 'src') ||
    getAttr(doc, 'img[src*="logo"]', 'src') ||
    getAttr(doc, 'img[alt*="logo" i]', 'src') ||
    '';

  const jsonLdPhone = jsonLdOrg?.telephone || (Array.isArray(jsonLdOrg?.contactPoint) ? jsonLdOrg.contactPoint.find(c => c.telephone)?.telephone : jsonLdOrg?.contactPoint?.telephone);
  const phone =
    jsonLdPhone ||
    getText(doc, '[itemprop="telephone"]') ||
    getAttr(doc, 'a[href^="tel:"]', 'href')?.replace('tel:', '') ||
    '';

  const email =
    jsonLdOrg?.email ||
    getText(doc, '[itemprop="email"]') ||
    getAttr(doc, 'a[href^="mailto:"]', 'href')?.replace('mailto:', '') ||
    '';

  const jsonLdAddr = typeof jsonLdOrg?.address === 'string'
    ? jsonLdOrg.address
    : jsonLdOrg?.address?.streetAddress
      ? `${jsonLdOrg.address.streetAddress}${jsonLdOrg.address.addressLocality ? ', ' + jsonLdOrg.address.addressLocality : ''}`
      : '';

  const address =
    jsonLdAddr ||
    getText(doc, '[itemprop="address"]') ||
    getText(doc, '.address, [class*="address"]') ||
    '';

  // Social links
  const domSocials = Array.from(doc.querySelectorAll('a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="facebook.com"], a[href*="instagram.com"], a[href*="youtube.com"]'))
    .map(a => a.getAttribute('href'))
    .filter(href => href && href.startsWith('http'));

  const jsonLdSameAs = Array.isArray(jsonLdOrg?.sameAs) ? jsonLdOrg.sameAs : (jsonLdOrg?.sameAs ? [jsonLdOrg.sameAs] : []);
  const socials = Array.from(new Set([...jsonLdSameAs, ...domSocials]));

  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();
  const url = jsonLdOrg?.url || origin;

  return { name, logo, phone, email, address, socials, url };
}

/**
 * Extract breadcrumb data from the document.
 */
export function extractBreadcrumbs(doc, pageUrl) {
  const items = [];

  // Pattern 1: <nav aria-label="breadcrumb"> or [class*="breadcrumb"]
  const nav = doc.querySelector('[aria-label*="breadcrumb" i], [class*="breadcrumb"], nav ol, [itemtype*="BreadcrumbList"]');
  if (nav) {
    const links = Array.from(nav.querySelectorAll('a, [itemprop="item"]'));
    links.forEach((a, i) => {
      const href = a.getAttribute('href') || '';
      const name = a.textContent?.trim() || a.getAttribute('content') || '';
      if (name) {
        items.push({
          position: i + 1,
          name,
          item: href && href.startsWith('http') ? href : (href ? `${new URL(pageUrl).origin}${href}` : ''),
        });
      }
    });
  }

  // Pattern 2: Build from URL path if no breadcrumb found
  if (items.length < 2) {
    try {
      const url = new URL(pageUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      items.push({ position: 1, name: 'Home', item: url.origin });
      segments.forEach((seg, i) => {
        const name = decodeURIComponent(seg)
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        const item = `${url.origin}/${segments.slice(0, i + 1).join('/')}`;
        items.push({ position: i + 2, name, item });
      });
    } catch { /* ignore */ }
  }

  return items.slice(0, 8);
}

/**
 * Extract article body text (first ~1000 chars).
 */
export function extractArticleBody(doc) {
  const selectors = [
    'article',
    '[itemprop="articleBody"]',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.content-body',
    'main',
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim();
      if (text && text.length > 200) return text.slice(0, 1000);
    }
  }

  return doc.body?.textContent?.trim().slice(0, 1000) || '';
}

/**
 * Extract product info.
 */
export function extractProduct(doc, meta) {
  const name =
    getText(doc, '[itemprop="name"]') ||
    getText(doc, 'h1') ||
    meta.title ||
    '';

  const price =
    getText(doc, '[itemprop="price"]') ||
    getAttr(doc, '[itemprop="price"]', 'content') ||
    getText(doc, '.price, [class*="price"]')?.replace(/[^\d.,]/g, '') ||
    '';

  const currency =
    getAttr(doc, '[itemprop="priceCurrency"]', 'content') ||
    'USD';

  const availability =
    getText(doc, '[itemprop="availability"]') ||
    (doc.querySelector('[class*="in-stock"], [class*="instock"]') ? 'InStock' : '') ||
    'InStock';

  const brand = getText(doc, '[itemprop="brand"]') || meta.siteName || '';

  const description =
    getText(doc, '[itemprop="description"]') ||
    meta.description ||
    '';

  return { name, price, currency, availability, brand, description, image: meta.image };
}
