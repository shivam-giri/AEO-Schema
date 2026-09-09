/**
 * schemaGenerator.js
 * Signal-driven AEO schema generation.
 *
 * Instead of a fixed page-type → schema matrix, this module:
 *   1. Calls detectAllContentSignals() to scan every content type on the page.
 *   2. Accumulates schemas for EVERY signal found (FAQ, BOD, Events, Article, etc.)
 *   3. Always includes Organization + WebSite as the brand foundation.
 *
 * This means a homepage with a FAQ section and a BOD listing will correctly get
 * Organization + WebSite + FAQPage + ItemList — not just the homepage defaults.
 */

import {
  parseHTML,
  extractMeta,
  detectAllContentSignals,
} from '../utils/htmlParser.js';
import { generateQAPairsForSchemas } from './geminiService.js';

/**
 * Main entry point: analyze HTML and generate AEO schemas for ALL content found,
 * embedding conversational Q&A content inside every schema for AI search engines.
 *
 * @param {string} html        - Raw HTML string
 * @param {string} pageUrl     - The URL of the page
 * @param {string} [userApiKey] - Optional Gemini API key
 * @returns {Promise<{ schemas: SchemaResult[], score: AEOScore, meta: PageMeta, pageType: string, signals: ContentSignals, qaSource: string }>}
 */
export async function generateAEOSchemas(html, pageUrl, userApiKey = '') {
  const doc  = parseHTML(html);
  const meta = extractMeta(doc, pageUrl);

  // Single source of truth — all content signals
  const signals = detectAllContentSignals(doc, meta, pageUrl);
  const { pageType, isHomepage, faqData, howtoSteps, org, breadcrumbs, articleBody, productData } = signals;

  const schemas = [];

  // ── Foundation: always present on every page ───────────────────────────────
  schemas.push(generateOrganizationSchema(org, meta, pageUrl));
  schemas.push(generateWebSiteSchema(meta, pageUrl, org));

  // ── BreadcrumbList: every non-homepage page ────────────────────────────────
  if (!isHomepage) {
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));
  }

  // ── Content-signal-driven schemas ─────────────────────────────────────────

  // BOD / Leadership — checked before Article because a BOD page may also
  // have article-like meta tags; BOD is the more specific signal
  if (signals.hasBOD) {
    schemas.push(generateBODSchema(doc, org, pageUrl));
  }

  // News / Press Release — checked before generic Article
  if (signals.hasNews) {
    schemas.push(generateNewsArticleSchema(meta, articleBody, pageUrl, doc, isHomepage));
  }

  // Article / editorial content (skip if already added NewsArticle)
  if (signals.hasArticle && !signals.hasNews) {
    schemas.push(generateArticleSchema(meta, articleBody, pageUrl));
  }

  // FAQ / Q&A
  if (signals.hasFAQ) {
    schemas.push(generateFAQSchema(faqData, doc, meta));
  }

  // HowTo / step-by-step guide
  if (signals.hasHowTo) {
    schemas.push(generateHowToSchema(meta, howtoSteps));
  }

  // Events / Calendar
  if (signals.hasEvents) {
    schemas.push(generateEventSchema(doc, org, meta, pageUrl, isHomepage));
  }

  // Product / e-commerce
  if (signals.hasProduct) {
    schemas.push(generateProductSchema(productData, pageUrl, meta, doc, isHomepage));
  }

  // Contact page (only on dedicated contact pages, not every page with a footer email)
  if (signals.hasContactInfo && pageType === 'contact-us') {
    schemas.push(generateContactPageSchema(meta, org, pageUrl));
  }

  // ── Enrich every schema with Q&A content (Gemini AI or Heuristic) ──────────
  let qaSource = 'heuristic';
  try {
    const qaResult = await generateQAPairsForSchemas(schemas, doc, meta, signals, pageUrl, userApiKey);
    qaSource = qaResult.source;
    const qnaMap = qaResult.qna || {};

    for (const item of schemas) {
      if (item.type === 'BreadcrumbList') continue;
      const pairs = qnaMap[item.type] || [];
      item.qaPairs = pairs;
      item.qaSource = qaSource;

      if (pairs.length > 0) {
        if (item.type === 'FAQPage') {
          // FAQPage uses standard mainEntity
          item.schema.mainEntity = pairs.map(p => ({
            '@type': 'Question',
            name: p.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: p.answer,
            },
          }));
        } else {
          // Entity schemas (Organization, Article, Product, Event, etc.) embed Q&A via hasPart
          item.schema.hasPart = pairs.map(p => ({
            '@type': 'Question',
            name: p.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: p.answer,
            },
          }));
        }
      }
    }
  } catch (qaErr) {
    console.warn('[schemaGenerator] Error attaching Q&A pairs:', qaErr);
  }

  return { schemas, score: null, meta, pageType, signals, qaSource };
}

// ============================================================
// Schema Generators
// ============================================================

function generateWebSiteSchema(meta, pageUrl, org) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();
  let siteName = org?.name || meta.siteName || '';
  if (!siteName || /^(home|welcome)$/i.test(siteName.trim())) {
    try {
      const full = meta.title || '';
      const parts = full.split(/\s*\|\s*|\s*[—•]\s*|\s*::\s*|\s+[-–]\s+/).map(p => p.trim()).filter(Boolean);
      const nonGeneric = parts.filter(p => !/^(home|welcome)$/i.test(p));
      siteName = nonGeneric[nonGeneric.length - 1] || nonGeneric[0] || 'Website';
    } catch {
      siteName = 'Website';
    }
  }

  return {
    type: 'WebSite',
    label: 'WebSite',
    description: 'Declares the website identity and enables sitelinks search box in Google',
    impact: 3,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: origin,
      description: meta.description || '',
      ...(meta.image ? { image: meta.image } : {}),
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${origin}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  };
}

function generateFAQSchema(faqData, doc, meta) {
  let pairs = (faqData?.found && faqData.pairs?.length >= 1) ? faqData.pairs : [];

  if (pairs.length === 0 && doc) {
    const headings = Array.from(doc.querySelectorAll('h2, h3')).slice(0, 5);
    for (const h of headings) {
      const text = h.textContent?.trim();
      if (!text || text.length < 5) continue;
      const nextEl = h.nextElementSibling;
      const answer = nextEl?.textContent?.trim() || `See the section "${text}" on this page for details.`;
      pairs.push({ question: text.endsWith('?') ? text : `${text}?`, answer });
    }
  }

  if (pairs.length === 0) {
    const q = meta?.title ? `What is ${meta.title}?` : 'What does this page cover?';
    const a = meta?.description || 'Please visit this page for full details.';
    pairs = [{ question: q, answer: a }];
  }

  return {
    type: 'FAQPage',
    label: 'FAQ Page',
    description: 'Enables rich FAQ results in Google Search and surfaces answers directly in AI answer engines',
    impact: 5,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: pairs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
        },
      })),
    },
  };
}

function generateHowToSchema(meta, steps) {
  const stepItems = (steps && steps.length >= 1)
    ? steps
    : [
        { name: 'Overview', text: meta.description || 'Follow the on-page guide for complete instructions.' },
        { name: 'Implementation', text: 'Apply the steps outlined in the main content section.' },
      ];

  return {
    type: 'HowTo',
    label: 'HowTo',
    description: 'Highlights step-by-step guides in search results and AI engines',
    impact: 4,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: meta.title || 'How To Guide',
      description: meta.description || '',
      ...(meta.image ? { image: meta.image } : {}),
      step: stepItems.map(({ name, text }, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name,
        text,
      })),
    },
  };
}

function generateArticleSchema(meta, body, pageUrl) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();

  return {
    type: 'Article',
    label: 'Article',
    description: 'Enables article rich results and signals credibility to AI answer engines',
    impact: 4,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: meta.title || '',
      description: meta.description || '',
      ...(meta.image ? { image: meta.image } : {}),
      url: meta.canonicalUrl || pageUrl,
      ...(meta.author ? {
        author: {
          '@type': 'Person',
          name: meta.author,
        },
      } : {
        author: {
          '@type': 'Organization',
          name: meta.siteName || '',
          url: origin,
        },
      }),
      publisher: {
        '@type': 'Organization',
        name: meta.siteName || '',
        url: origin,
        ...(meta.image ? { logo: { '@type': 'ImageObject', url: meta.image } } : {}),
      },
      ...(meta.datePublished ? { datePublished: meta.datePublished } : {}),
      ...(meta.dateModified ? { dateModified: meta.dateModified } : {}),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': meta.canonicalUrl || pageUrl,
      },
    },
  };
}

function generateNewsArticleSchema(meta, body, pageUrl, doc, isHomepage = false) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();

  let headline = meta.title || '';
  let description = meta.description || '';

  // If this is a homepage or generic title, extract specific featured news headline
  if (isHomepage || /^(home|welcome)$/i.test(headline.trim())) {
    const newsCard = doc?.querySelector(
      '.press-release, .news-item, .media-release, [class*="press-release"], [class*="news-card"], [class*="latest-update"], article'
    );
    const specificHeading =
      newsCard?.querySelector('h1, h2, h3, h4, .title, [class*="title"], [class*="heading"]')?.textContent?.trim() ||
      doc?.querySelector('.press-release h2, .press-release h3, .news-item h2, .news-item h3, article h2, [class*="latest"] h2')?.textContent?.trim();

    if (specificHeading && specificHeading.length > 5) {
      headline = specificHeading;
    }
    const specificDesc = newsCard?.querySelector('p')?.textContent?.trim();
    if (specificDesc && specificDesc.length > 20) {
      description = specificDesc;
    }
  }

  return {
    type: 'NewsArticle',
    label: 'News & Media Article',
    description: 'Enables News rich snippets, press release indexing, and instant Google News/AI coverage',
    impact: 5,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline,
      description,
      ...(meta.image ? { image: meta.image } : {}),
      url: meta.canonicalUrl || pageUrl,
      ...(meta.author ? {
        author: {
          '@type': 'Person',
          name: meta.author,
        },
      } : {
        author: {
          '@type': 'Organization',
          name: meta.siteName || 'Newsroom',
          url: origin,
        },
      }),
      publisher: {
        '@type': 'Organization',
        name: meta.siteName || '',
        url: origin,
        ...(meta.image ? { logo: { '@type': 'ImageObject', url: meta.image } } : {}),
      },
      ...(meta.datePublished ? { datePublished: meta.datePublished } : { datePublished: new Date().toISOString().split('T')[0] }),
      ...(meta.dateModified ? { dateModified: meta.dateModified } : {}),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': meta.canonicalUrl || pageUrl,
      },
    },
  };
}

function generateContactPageSchema(meta, org, pageUrl) {
  return {
    type: 'ContactPage',
    label: 'Contact Us Page',
    description: 'Establishes verified corporate contact channels and geographic address for AI trust',
    impact: 4,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: meta.title || 'Contact Us',
      description: meta.description || '',
      url: meta.canonicalUrl || pageUrl,
      mainEntity: {
        '@type': 'Organization',
        name: org.name || meta.siteName || '',
        url: org.url || pageUrl,
        ...(org.logo ? { logo: org.logo } : {}),
        ...(org.phone ? { telephone: org.phone } : {}),
        ...(org.email ? { email: org.email } : {}),
        ...(org.address ? { address: org.address } : {}),
        ...(org.socials?.length > 0 ? { sameAs: org.socials } : {}),
      },
    },
  };
}

function generateBODSchema(doc, org, pageUrl) {
  const personEls = Array.from(doc.querySelectorAll(
    '.bod-item, .bod-inner, [class*="bod-"], .director, .board, .leadership, .member, .profile, ' +
    '[class*="director"], [class*="leadership"], [class*="board-member"], [class*="governance"]'
  ));

  let rawPersons = personEls.map(el => {
    const name = el.querySelector('.bod-name, [class*="bod-name"], h2, h3, h4, .name, [class*="name"]')?.textContent?.trim();
    const title = el.querySelector('.bod-position, [class*="bod-position"], .title, .role, [class*="title"], [class*="role"], [class*="position"]')?.textContent?.trim();
    return name && name.length >= 3 && name.length <= 60 ? { name, title: title || 'Member of the Board' } : null;
  }).filter(Boolean);

  // Deduplicate by name
  const seen = new Set();
  const persons = rawPersons.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const finalPersons = persons.length > 0 ? persons : [
    { name: 'Executive Leadership', title: 'Board of Directors' },
  ];

  return {
    type: 'ItemList',
    label: 'Board of Directors (BOD)',
    description: 'Structured leadership and governance profile establishing high E-E-A-T corporate authority',
    impact: 5,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Board of Directors & Executive Leadership',
      description: `Leadership roster for ${org.name || 'Organization'}`,
      itemListElement: finalPersons.slice(0, 25).map((p, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Person',
          name: p.name,
          jobTitle: p.title,
          worksFor: {
            '@type': 'Organization',
            name: org.name || '',
            url: org.url || pageUrl,
          },
        },
      })),
    },
  };
}

function generateOrganizationSchema(org, meta, pageUrl) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();
  let name = org?.name || meta?.siteName || '';
  if (!name || /^(home|welcome)$/i.test(name.trim())) {
    try {
      const full = meta?.title || '';
      const parts = full.split(/\s*\|\s*|\s*[—•]\s*|\s*::\s*|\s+[-–]\s+/).map(p => p.trim()).filter(Boolean);
      const nonGeneric = parts.filter(p => !/^(home|welcome)$/i.test(p));
      name = nonGeneric[nonGeneric.length - 1] || nonGeneric[0] || new URL(pageUrl).hostname;
    } catch {
      name = new URL(pageUrl).hostname;
    }
  }
  const url = org?.url || origin;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
  };

  if (org?.logo)            schema.logo      = { '@type': 'ImageObject', url: org.logo };
  else if (meta?.image)     schema.logo      = { '@type': 'ImageObject', url: meta.image };
  if (org?.phone)           schema.telephone = org.phone;
  if (org?.email)           schema.email     = org.email;
  if (org?.address)         schema.address   = { '@type': 'PostalAddress', streetAddress: org.address };
  if (org?.socials?.length) schema.sameAs    = org.socials;

  return {
    type: 'Organization',
    label: 'Organization',
    description: 'Establishes brand identity and links social profiles for knowledge panel eligibility',
    impact: 3,
    schema,
  };
}

function generateBreadcrumbSchema(items, pageUrl, meta) {
  let listItems = (items && items.length >= 1) ? items : [];

  if (listItems.length === 0 && pageUrl) {
    try {
      const url    = new URL(pageUrl);
      const parts  = url.pathname.split('/').filter(Boolean);
      const origin = url.origin;
      listItems = [{ position: 1, name: 'Home', item: origin }];
      let accumulated = origin;
      for (let i = 0; i < parts.length; i++) {
        accumulated += '/' + parts[i];
        const label = decodeURIComponent(parts[i])
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        listItems.push({ position: i + 2, name: label, item: accumulated });
      }
      if (listItems.length === 1 && meta?.title) {
        listItems.push({ position: 2, name: meta.title, item: pageUrl });
      }
    } catch { /* ignore */ }
  }

  return {
    type: 'BreadcrumbList',
    label: 'Breadcrumb List',
    description: 'Shows breadcrumb navigation in search results, improving click-through rates',
    impact: 2,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: listItems.map(({ position, name, item }) => ({
        '@type': 'ListItem',
        position,
        name,
        ...(item ? { item } : {}),
      })),
    },
  };
}

function generateProductSchema(product, pageUrl, meta, doc, isHomepage = false) {
  let productName = product?.name || '';
  if (!productName || (isHomepage && /^(home|welcome)$/i.test(productName.trim()))) {
    const productEl = doc?.querySelector('[itemtype*="Product"], .product-item, .product-card, [class*="product-card"]');
    productName =
      productEl?.querySelector('h1, h2, h3, .product-title, [class*="title"]')?.textContent?.trim() ||
      (!/^(home|welcome)$/i.test((meta?.title || '').trim()) ? meta.title : 'Featured Product');
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: product?.description || meta?.description || '',
    url: pageUrl,
  };

  if (product?.image || meta?.image) schema.image = product?.image || meta?.image;
  if (product?.brand || meta?.siteName) schema.brand = { '@type': 'Brand', name: product?.brand || meta?.siteName };

  if (product?.price) {
    schema.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'USD',
      availability: `https://schema.org/${product.availability || 'InStock'}`,
      url: pageUrl,
    };
  }

  return {
    type: 'Product',
    label: 'Product',
    description: 'Enables product rich results with pricing in Google Shopping and AI engines',
    impact: 4,
    schema,
  };
}

function generateEventSchema(doc, org, meta, pageUrl, isHomepage = false) {
  // Extract event element from DOM
  const eventEl = doc.querySelector('.event-item, .event-card, [class*="event-item"], [class*="event-card"], [class*="event-listing"], [itemtype*="Event"]');
  let eventName =
    eventEl?.querySelector('h1, h2, h3, h4, .event-title, [class*="event-title"], .title')?.textContent?.trim() ||
    (!/^(home|welcome)$/i.test((meta.title || '').trim()) ? meta.title : 'Featured Event');

  const startDate =
    eventEl?.querySelector('time[datetime]')?.getAttribute('datetime') ||
    doc.querySelector('.event-date time[datetime], time[datetime]')?.getAttribute('datetime') ||
    new Date().toISOString().split('T')[0];

  const location =
    eventEl?.querySelector('.venue, .location, [class*="venue"], [class*="location"]')?.textContent?.trim() ||
    org.address ||
    '';

  return {
    type: 'Event',
    label: 'Event',
    description: 'Enables rich event results in Google Search and AI engines, including date, venue, and registration',
    impact: 4,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: eventName,
      description: meta.description || '',
      startDate,
      ...(meta.image ? { image: meta.image } : {}),
      organizer: {
        '@type': 'Organization',
        name: org.name || meta.siteName || '',
        url: org.url || pageUrl,
      },
      ...(location ? {
        location: {
          '@type': 'Place',
          name: location,
          address: { '@type': 'PostalAddress', streetAddress: location },
        },
      } : {}),
      url: meta.canonicalUrl || pageUrl,
    },
  };
}

// ============================================================
// AEO Score Calculator (Signal-Driven)
// ============================================================

/**
 * Calculates a fair, signal-driven AEO Readiness Score (0–100).
 * Metrics are only included when relevant to detected content signals.
 * @param {Object} meta
 * @param {ContentSignals} signals
 * @param {SchemaResult[]} schemas
 * @param {Document} doc
 */
export function calculateAEOScore(meta, signals, schemas, doc) {
  const { pageType, isHomepage, hasFAQ, hasHowTo, hasBOD, hasArticle, hasNews } = signals;
  const faqData   = signals.faqData;
  const howtoSteps = signals.howtoSteps;
  const breadcrumbs = signals.breadcrumbs;

  const allMetrics = [];

  // 1. Title tag (10 pts)
  const titleScore = meta.hasMeta.title ? (meta.title.length >= 30 && meta.title.length <= 70 ? 10 : 7) : 0;
  allMetrics.push({
    id: 'title',
    name: 'Title Tag',
    score: titleScore,
    max: 10,
    status: titleScore === 10 ? 'pass' : titleScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.title ? `Found (${meta.title.length} chars)` : 'Missing — critical for AEO',
    always: true,
  });

  // 2. Meta description (10 pts)
  const descScore = meta.hasMeta.description ? (meta.description.length >= 100 && meta.description.length <= 160 ? 10 : 7) : 0;
  allMetrics.push({
    id: 'description',
    name: 'Meta Description',
    score: descScore,
    max: 10,
    status: descScore === 10 ? 'pass' : descScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.description ? `Found (${meta.description.length} chars)` : 'Missing — AI engines use for context',
    always: true,
  });

  // 3. Open Graph tags (8 pts)
  const ogScore = meta.hasMeta.ogTags ? 8 : 0;
  allMetrics.push({
    id: 'og',
    name: 'Open Graph Tags',
    score: ogScore,
    max: 8,
    status: ogScore > 0 ? 'pass' : 'fail',
    detail: ogScore > 0 ? 'OG tags present' : 'Missing og:title, og:description',
    always: true,
  });

  // 4. Canonical URL (7 pts)
  const canonScore = meta.hasMeta.canonical ? 7 : 0;
  allMetrics.push({
    id: 'canonical',
    name: 'Canonical URL',
    score: canonScore,
    max: 7,
    status: canonScore > 0 ? 'pass' : 'fail',
    detail: canonScore > 0 ? 'Canonical link found' : 'Missing — may cause duplicate content',
    always: true,
  });

  // 5. Existing schema markup (15 pts)
  const existingSchemaCount = meta.existingSchemas.length;
  const existingScore = existingSchemaCount > 0 ? Math.min(15, existingSchemaCount * 5) : 0;
  allMetrics.push({
    id: 'existing-schema',
    name: 'Existing Schema Markup',
    score: existingScore,
    max: 15,
    status: existingScore >= 10 ? 'pass' : existingScore > 0 ? 'warn' : 'fail',
    detail: existingSchemaCount > 0 ? `${existingSchemaCount} schema(s) already implemented` : 'No existing JSON-LD schema found',
    always: true,
  });

  // 6. Robots meta (7 pts)
  const robotsScore = meta.hasMeta.robots ? (meta.robots.includes('noindex') ? 0 : 7) : 4;
  allMetrics.push({
    id: 'robots',
    name: 'Robots Meta Tag',
    score: robotsScore,
    max: 7,
    status: robotsScore === 7 ? 'pass' : robotsScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.robots ? `Robots: ${meta.robots}` : 'Not set (defaults to indexable)',
    always: true,
  });

  // 7. Breadcrumbs (8 pts) — NOT applicable to Homepage
  if (!isHomepage) {
    const bcScore = breadcrumbs.length >= 2 ? 8 : breadcrumbs.length === 1 ? 4 : 0;
    allMetrics.push({
      id: 'breadcrumb',
      name: 'Breadcrumb Navigation',
      score: bcScore,
      max: 8,
      status: bcScore === 8 ? 'pass' : bcScore > 0 ? 'warn' : 'fail',
      detail: breadcrumbs.length >= 2 ? `${breadcrumbs.length} breadcrumb levels found` : 'No breadcrumb structure detected',
      always: false,
    });
  }

  // 8. Conversational Q&A (15 pts) — measures AI answer engine readability
  const totalQAPairs = schemas.reduce((acc, s) => acc + (s.qaPairs?.length || 0), 0);
  const faqScore = Math.min(15, Math.max(totalQAPairs >= 2 ? 15 : totalQAPairs * 7, faqData?.found ? faqData.pairs.length * 3 : 0));
  allMetrics.push({
    id: 'faq',
    name: 'Conversational Q&A Content',
    score: faqScore,
    max: 15,
    status: faqScore >= 12 ? 'pass' : faqScore > 0 ? 'warn' : 'fail',
    detail: totalQAPairs > 0
      ? `${totalQAPairs} Q&A pairs embedded across schemas for conversational AI answers`
      : 'No conversational Q&A pairs generated',
    always: true,
  });

  // 9. Author / Date signals (8 pts) — only for editorial content
  if (hasArticle || hasNews || hasBOD) {
    const eeatScore = (meta.hasMeta.author ? 4 : 0) + (meta.hasMeta.publishedDate ? 4 : 0);
    allMetrics.push({
      id: 'eeat',
      name: 'Author / Governance Signals',
      score: eeatScore,
      max: 8,
      status: eeatScore === 8 ? 'pass' : eeatScore > 0 ? 'warn' : 'fail',
      detail: `Author: ${meta.hasMeta.author ? '✓' : '✗'} · Date: ${meta.hasMeta.publishedDate ? '✓' : '✗'}`,
      always: false,
    });
  }

  const metrics = allMetrics;
  const total    = metrics.reduce((sum, m) => sum + m.score, 0);
  const maxTotal = metrics.reduce((sum, m) => sum + m.max, 0);
  const percentage = Math.round((total / maxTotal) * 100);

  let grade, gradeClass;
  if (percentage >= 80)      { grade = 'Excellent'; gradeClass = 'grade-excellent'; }
  else if (percentage >= 60) { grade = 'Good';      gradeClass = 'grade-good'; }
  else if (percentage >= 40) { grade = 'Fair';      gradeClass = 'grade-fair'; }
  else                       { grade = 'Poor';      gradeClass = 'grade-poor'; }

  return { total, maxTotal, percentage, grade, gradeClass, metrics };
}
