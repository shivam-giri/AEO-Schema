/**
 * schemaGenerator.js
 * Orchestrates HTML parsing and generates targeted AEO-optimized JSON-LD schemas
 * based on selected/detected Page Type, with fair page-type-tailored AEO scoring.
 */

import {
  parseHTML,
  extractMeta,
  detectPageType,
  checkFAQPatterns,
  checkHowToPatterns,
  extractOrganization,
  extractBreadcrumbs,
  extractArticleBody,
  extractProduct,
} from '../utils/htmlParser.js';

/**
 * Main entry point: analyze HTML and generate targeted AEO schemas for the specified page type.
 * @param {string} html - Raw HTML string
 * @param {string} pageUrl - The URL of the page
 * @param {string} targetPageType - User-selected page type ('auto' | 'homepage' | 'article' | 'product' | 'faq' | 'howto')
 * @returns {{ schemas: SchemaResult[], score: AEOScore, meta: PageMeta, pageType: string }}
 */
export function generateAEOSchemas(html, pageUrl, targetPageType = 'auto') {
  const doc  = parseHTML(html);
  const meta = extractMeta(doc, pageUrl);

  // Determine effective page type (user selection overrides auto-detection)
  const detectedType = detectPageType(doc, meta);
  const effectivePageType = (targetPageType && targetPageType !== 'auto')
    ? targetPageType
    : detectedType;

  const schemas = [];

  // Extract shared content signals
  const org         = extractOrganization(doc, meta, pageUrl);
  const breadcrumbs = extractBreadcrumbs(doc, pageUrl);
  const faqData     = checkFAQPatterns(doc);
  const howtoSteps  = checkHowToPatterns(doc);
  const articleBody = extractArticleBody(doc);
  const productData = extractProduct(doc, meta);

  // ── TARGETED SCHEMA MATRICES BY PAGE TYPE ─────────────────────────────

  if (effectivePageType === 'homepage') {
    // Homepage: Organization + WebSite (+ optional LocalBusiness if phone/address present)
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateWebSiteSchema(meta, pageUrl));
    // NO BreadcrumbList on Homepage (home is root, has no parent breadcrumbs)

  } else if (effectivePageType === 'article') {
    // Article / Blog Post: Article + Organization + BreadcrumbList + FAQPage (if Q&A found)
    schemas.push(generateArticleSchema(meta, articleBody, pageUrl));
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));
    if (faqData.found) {
      schemas.push(generateFAQSchema(faqData, doc, meta));
    }
    schemas.push(generateWebSiteSchema(meta, pageUrl));

  } else if (effectivePageType === 'news-media') {
    // News & Media: NewsArticle + Organization + BreadcrumbList + WebSite
    schemas.push(generateNewsArticleSchema(meta, articleBody, pageUrl));
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));
    if (faqData.found) {
      schemas.push(generateFAQSchema(faqData, doc, meta));
    }
    schemas.push(generateWebSiteSchema(meta, pageUrl));

  } else if (effectivePageType === 'contact-us') {
    // Contact Us Page: Organization (with ContactPoint) + ContactPage + BreadcrumbList
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateContactPageSchema(meta, org, pageUrl));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));

  } else if (effectivePageType === 'bod') {
    // Board of Directors / Leadership Page: ItemList of Person + Organization + BreadcrumbList
    schemas.push(generateBODSchema(doc, org, pageUrl));
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));

  } else if (effectivePageType === 'faq') {
    // Dedicated FAQ Page: FAQPage + BreadcrumbList + Organization
    schemas.push(generateFAQSchema(faqData, doc, meta));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));

  } else {
    // Generic / Fallback Page: Organization + Article + FAQ + BreadcrumbList + WebSite
    schemas.push(generateOrganizationSchema(org, meta, pageUrl));
    schemas.push(generateArticleSchema(meta, articleBody, pageUrl));
    schemas.push(generateFAQSchema(faqData, doc, meta));
    schemas.push(generateBreadcrumbSchema(breadcrumbs, pageUrl, meta));
    schemas.push(generateWebSiteSchema(meta, pageUrl));
  }

  // ── AEO Score (Calculated against metrics relevant to effectivePageType) ──
  const score = calculateAEOScore(meta, faqData, howtoSteps, breadcrumbs, schemas, doc, effectivePageType);

  return { schemas, score, meta, pageType: effectivePageType };
}

// ============================================================
// Schema Generators
// ============================================================

function generateWebSiteSchema(meta, pageUrl) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();

  return {
    type: 'WebSite',
    label: 'WebSite',
    description: 'Declares the website identity and enables sitelinks search box in Google',
    impact: 3,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: meta.siteName || meta.title || '',
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

function generateNewsArticleSchema(meta, body, pageUrl) {
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return pageUrl; } })();

  return {
    type: 'NewsArticle',
    label: 'News & Media Article',
    description: 'Enables News rich snippets, press release indexing, and instant Google News/AI coverage',
    impact: 5,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
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
  const personEls = Array.from(doc.querySelectorAll('.director, .board, .leadership, .member, .profile, [class*="director"], [class*="leadership"]'));
  let persons = personEls.map(el => {
    const name = el.querySelector('h2, h3, h4, .name, [class*="name"]')?.textContent?.trim();
    const title = el.querySelector('.title, .role, [class*="title"], [class*="role"]')?.textContent?.trim();
    return name ? { name, title: title || 'Member of the Board' } : null;
  }).filter(Boolean);

  if (persons.length === 0) {
    persons = [
      { name: 'Executive Leadership', title: 'Board of Directors' },
    ];
  }

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
      itemListElement: persons.slice(0, 10).map((p, index) => ({
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
  const name   = org?.name || meta?.siteName || meta?.title?.split(/[-|·]/)[0]?.trim() || new URL(pageUrl).hostname;
  const url    = org?.url   || origin;

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

function generateProductSchema(product, pageUrl, meta) {
  const productName = product?.name || meta?.title || 'Product';

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

// ============================================================
// AEO Score Calculator (Tailored Per Page Type)
// ============================================================

/**
 * Calculates a fair, page-type-tailored AEO Readiness Score (0–100).
 */
export function calculateAEOScore(meta, faqData, howtoSteps, breadcrumbs, schemas, doc, pageType = 'generic') {
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
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
    applicableTo: ['homepage', 'article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
  });

  // 7. Breadcrumbs (8 pts) — NOT applicable to Homepage
  const bcScore = breadcrumbs.length >= 2 ? 8 : breadcrumbs.length === 1 ? 4 : 0;
  allMetrics.push({
    id: 'breadcrumb',
    name: 'Breadcrumb Navigation',
    score: bcScore,
    max: 8,
    status: bcScore === 8 ? 'pass' : bcScore > 0 ? 'warn' : 'fail',
    detail: breadcrumbs.length >= 2 ? `${breadcrumbs.length} breadcrumb levels found` : 'No breadcrumb structure detected',
    applicableTo: ['article', 'news-media', 'contact-us', 'bod', 'faq', 'generic'],
  });

  // 8. FAQ content (15 pts) — Applicable to FAQ, Article, Generic
  const faqScore = faqData.found ? Math.min(15, faqData.pairs.length * 3) : 0;
  allMetrics.push({
    id: 'faq',
    name: 'FAQ / Q&A Content',
    score: faqScore,
    max: 15,
    status: faqScore >= 12 ? 'pass' : faqScore > 0 ? 'warn' : 'fail',
    detail: faqData.found ? `${faqData.pairs.length} Q&A pairs found — great for AI snippets` : 'No FAQ patterns detected',
    applicableTo: ['faq', 'article', 'news-media', 'generic'],
  });

  // 9. Author / Date / Leadership signals (8 pts)
  const eeatScore = (meta.hasMeta.author ? 4 : 0) + (meta.hasMeta.publishedDate ? 4 : 0);
  allMetrics.push({
    id: 'eeat',
    name: 'Author / Governance Signals',
    score: eeatScore,
    max: 8,
    status: eeatScore === 8 ? 'pass' : eeatScore > 0 ? 'warn' : 'fail',
    detail: `Author: ${meta.hasMeta.author ? '✓' : '✗'} · Date: ${meta.hasMeta.publishedDate ? '✓' : '✗'}`,
    applicableTo: ['article', 'news-media', 'bod', 'generic'],
  });

  // Filter metrics to ONLY those applicable to the effective page type
  const metrics = allMetrics.filter(m => m.applicableTo.includes(pageType));

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
