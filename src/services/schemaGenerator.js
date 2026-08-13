/**
 * schemaGenerator.js
 * Orchestrates HTML parsing and generates AEO-optimized JSON-LD schemas.
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
 * Main entry point: analyze HTML and generate all relevant AEO schemas.
 * @param {string} html - Raw HTML string
 * @param {string} pageUrl - The URL of the page
 * @returns {{ schemas: SchemaResult[], score: AEOScore, meta: PageMeta, pageType: string }}
 */
export function generateAEOSchemas(html, pageUrl) {
  const doc = parseHTML(html);
  const meta = extractMeta(doc, pageUrl);
  const pageType = detectPageType(doc, meta);

  const schemas = [];

  // --- Always generate: WebSite ---
  schemas.push(generateWebSiteSchema(meta, pageUrl));

  // --- FAQ Schema ---
  const faqData = checkFAQPatterns(doc);
  if (faqData.found && faqData.pairs.length >= 2) {
    schemas.push(generateFAQSchema(faqData.pairs));
  }

  // --- HowTo Schema ---
  const howtoSteps = checkHowToPatterns(doc);
  if (howtoSteps.length >= 2) {
    schemas.push(generateHowToSchema(meta, howtoSteps));
  }

  // --- Article Schema ---
  if (['article', 'generic'].includes(pageType) || meta.datePublished || meta.author) {
    const body = extractArticleBody(doc);
    schemas.push(generateArticleSchema(meta, body, pageUrl));
  }

  // --- Organization Schema ---
  if (['homepage', 'generic'].includes(pageType)) {
    const org = extractOrganization(doc, meta, pageUrl);
    if (org.name) {
      schemas.push(generateOrganizationSchema(org));
    }
  }

  // --- BreadcrumbList Schema ---
  const breadcrumbs = extractBreadcrumbs(doc, pageUrl);
  if (breadcrumbs.length >= 2) {
    schemas.push(generateBreadcrumbSchema(breadcrumbs));
  }

  // --- Product Schema ---
  if (pageType === 'product') {
    const product = extractProduct(doc, meta);
    if (product.name) {
      schemas.push(generateProductSchema(product, pageUrl));
    }
  }

  // --- AEO Score ---
  const score = calculateAEOScore(meta, faqData, howtoSteps, breadcrumbs, schemas, doc);

  return { schemas, score, meta, pageType };
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

function generateFAQSchema(pairs) {
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
      step: steps.map(({ name, text }, i) => ({
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

function generateOrganizationSchema(org) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
  };

  if (org.logo) schema.logo = { '@type': 'ImageObject', url: org.logo };
  if (org.phone) schema.telephone = org.phone;
  if (org.email) schema.email = org.email;
  if (org.address) schema.address = { '@type': 'PostalAddress', streetAddress: org.address };
  if (org.socials?.length) schema.sameAs = org.socials;

  return {
    type: 'Organization',
    label: 'Organization',
    description: 'Establishes brand identity and links social profiles for knowledge panel eligibility',
    impact: 3,
    schema,
  };
}

function generateBreadcrumbSchema(items) {
  return {
    type: 'BreadcrumbList',
    label: 'Breadcrumb List',
    description: 'Shows breadcrumb navigation in search results, improving click-through rates',
    impact: 2,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map(({ position, name, item }) => ({
        '@type': 'ListItem',
        position,
        name,
        ...(item ? { item } : {}),
      })),
    },
  };
}

function generateProductSchema(product, pageUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    url: pageUrl,
  };

  if (product.image) schema.image = product.image;
  if (product.brand) schema.brand = { '@type': 'Brand', name: product.brand };

  if (product.price) {
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
// AEO Score Calculator
// ============================================================

/**
 * Calculates an AEO Readiness Score (0–100) and per-metric breakdown.
 */
export function calculateAEOScore(meta, faqData, howtoSteps, breadcrumbs, schemas, doc) {
  const metrics = [];

  // 1. Title tag (10 pts)
  const titleScore = meta.hasMeta.title ? (meta.title.length >= 30 && meta.title.length <= 70 ? 10 : 7) : 0;
  metrics.push({
    id: 'title',
    name: 'Title Tag',
    score: titleScore,
    max: 10,
    status: titleScore === 10 ? 'pass' : titleScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.title
      ? `Found (${meta.title.length} chars)`
      : 'Missing — critical for AEO',
  });

  // 2. Meta description (10 pts)
  const descScore = meta.hasMeta.description ? (meta.description.length >= 100 && meta.description.length <= 160 ? 10 : 7) : 0;
  metrics.push({
    id: 'description',
    name: 'Meta Description',
    score: descScore,
    max: 10,
    status: descScore === 10 ? 'pass' : descScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.description
      ? `Found (${meta.description.length} chars)`
      : 'Missing — AI engines use for context',
  });

  // 3. Open Graph tags (8 pts)
  const ogScore = meta.hasMeta.ogTags ? 8 : 0;
  metrics.push({
    id: 'og',
    name: 'Open Graph Tags',
    score: ogScore,
    max: 8,
    status: ogScore > 0 ? 'pass' : 'fail',
    detail: ogScore > 0 ? 'OG tags present' : 'Missing og:title, og:description',
  });

  // 4. Canonical URL (7 pts)
  const canonScore = meta.hasMeta.canonical ? 7 : 0;
  metrics.push({
    id: 'canonical',
    name: 'Canonical URL',
    score: canonScore,
    max: 7,
    status: canonScore > 0 ? 'pass' : 'fail',
    detail: canonScore > 0 ? 'Canonical link found' : 'Missing — may cause duplicate content',
  });

  // 5. FAQ content (15 pts)
  const faqScore = faqData.found ? Math.min(15, faqData.pairs.length * 3) : 0;
  metrics.push({
    id: 'faq',
    name: 'FAQ / Q&A Content',
    score: faqScore,
    max: 15,
    status: faqScore >= 12 ? 'pass' : faqScore > 0 ? 'warn' : 'fail',
    detail: faqData.found
      ? `${faqData.pairs.length} Q&A pairs found — great for AI snippets`
      : 'No FAQ patterns detected',
  });

  // 6. HowTo content (12 pts)
  const howtoScore = howtoSteps.length >= 3 ? Math.min(12, howtoSteps.length * 2) : (howtoSteps.length > 0 ? 5 : 0);
  metrics.push({
    id: 'howto',
    name: 'Step-by-Step Content',
    score: howtoScore,
    max: 12,
    status: howtoScore >= 10 ? 'pass' : howtoScore > 0 ? 'warn' : 'fail',
    detail: howtoSteps.length > 0
      ? `${howtoSteps.length} steps found`
      : 'No HowTo patterns detected',
  });

  // 7. Existing schema markup (15 pts)
  const existingSchemaCount = meta.existingSchemas.length;
  const existingScore = existingSchemaCount > 0 ? Math.min(15, existingSchemaCount * 5) : 0;
  metrics.push({
    id: 'existing-schema',
    name: 'Existing Schema Markup',
    score: existingScore,
    max: 15,
    status: existingScore >= 10 ? 'pass' : existingScore > 0 ? 'warn' : 'fail',
    detail: existingSchemaCount > 0
      ? `${existingSchemaCount} schema(s) already implemented`
      : 'No existing JSON-LD schema found',
  });

  // 8. Breadcrumbs (8 pts)
  const bcScore = breadcrumbs.length >= 2 ? 8 : breadcrumbs.length === 1 ? 4 : 0;
  metrics.push({
    id: 'breadcrumb',
    name: 'Breadcrumb Navigation',
    score: bcScore,
    max: 8,
    status: bcScore === 8 ? 'pass' : bcScore > 0 ? 'warn' : 'fail',
    detail: breadcrumbs.length >= 2
      ? `${breadcrumbs.length} breadcrumb levels found`
      : 'No breadcrumb structure detected',
  });

  // 9. Author / Date signals (8 pts)
  const eeatScore = (meta.hasMeta.author ? 4 : 0) + (meta.hasMeta.publishedDate ? 4 : 0);
  metrics.push({
    id: 'eeat',
    name: 'Author / Date Signals',
    score: eeatScore,
    max: 8,
    status: eeatScore === 8 ? 'pass' : eeatScore > 0 ? 'warn' : 'fail',
    detail: `Author: ${meta.hasMeta.author ? '✓' : '✗'} · Date: ${meta.hasMeta.publishedDate ? '✓' : '✗'}`,
  });

  // 10. Robots meta (7 pts)
  const robotsScore = meta.hasMeta.robots ? (meta.robots.includes('noindex') ? 0 : 7) : 4;
  metrics.push({
    id: 'robots',
    name: 'Robots Meta Tag',
    score: robotsScore,
    max: 7,
    status: robotsScore === 7 ? 'pass' : robotsScore > 0 ? 'warn' : 'fail',
    detail: meta.hasMeta.robots
      ? `Robots: ${meta.robots}`
      : 'Not set (defaults to indexable)',
  });

  const total = metrics.reduce((sum, m) => sum + m.score, 0);
  const maxTotal = metrics.reduce((sum, m) => sum + m.max, 0);
  const percentage = Math.round((total / maxTotal) * 100);

  let grade, gradeClass;
  if (percentage >= 80) { grade = 'Excellent'; gradeClass = 'grade-excellent'; }
  else if (percentage >= 60) { grade = 'Good'; gradeClass = 'grade-good'; }
  else if (percentage >= 40) { grade = 'Fair'; gradeClass = 'grade-fair'; }
  else { grade = 'Poor'; gradeClass = 'grade-poor'; }

  return { total, maxTotal, percentage, grade, gradeClass, metrics };
}
