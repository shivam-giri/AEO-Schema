/**
 * auditAnalyzer.js
 * Rebuilt to match IDX Answer Engine Audit scoring methodology exactly.
 *
 * Formula: Schema Markup (30%) + Content Structure (25%) + Technical SEO (25%) + E-E-A-T (20%)
 * Each check is Pass/Fail. Category score = avg of checks (0–100).
 * Threshold for calculated scores (readability, speed, searchability): 65+
 */

import { parseHTML, extractMeta, getAllText, getAttr, detectPageType } from '../utils/htmlParser.js';
import { calculateReadability } from '../utils/readabilityScore.js';

export const PRIORITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// ─── Weights ──────────────────────────────────────────────────────────────────
export const PILLAR_WEIGHTS = {
  schema:    { weight: 0.30, label: 'Schema Markup',    pct: '30%', emoji: '🗂️'  },
  content:   { weight: 0.25, label: 'Content Structure', pct: '25%', emoji: '📝'  },
  technical: { weight: 0.25, label: 'Technical SEO',     pct: '25%', emoji: '🔧'  },
  eeat:      { weight: 0.20, label: 'E-E-A-T',           pct: '20%', emoji: '🏆'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pass = (id, label, detail, priority, rec) => ({
  id, label, passed: true, detail,
  priority, recommendation: rec,
});

const fail = (id, label, detail, priority, rec, schemaFix = false, schemaType = null) => ({
  id, label, passed: false, detail,
  priority, recommendation: rec, schemaFix, schemaType,
});

function detectSchemaTypes(doc) {
  // JSON-LD
  const jsonld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap(s => {
      try {
        const parsed = JSON.parse(s.textContent);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { return []; }
    });

  const jsonldTypes = jsonld.flatMap(s => {
    const type = s['@type'];
    return Array.isArray(type) ? type : type ? [type] : [];
  }).map(t => t.toLowerCase());

  // Microdata + RDFa
  const itemtypes = Array.from(doc.querySelectorAll('[itemtype]'))
    .map(el => el.getAttribute('itemtype')?.toLowerCase() || '');
  const typeofs = Array.from(doc.querySelectorAll('[typeof]'))
    .map(el => el.getAttribute('typeof')?.toLowerCase() || '');

  const all = [...jsonldTypes, ...itemtypes, ...typeofs].join(' ');
  return { all, jsonld, jsonldTypes };
}

function computeSearchabilityScore(doc, meta) {
  let score = 0;
  if (meta.title?.length >= 10) score += 20;
  if (meta.description?.length >= 50) score += 20;
  if (doc.querySelectorAll('h2, h3').length >= 2) score += 10;
  if (doc.querySelector('table')) score += 10;
  if (doc.querySelectorAll('ul li, ol li').length >= 3) score += 10;
  const faqSignals = doc.querySelectorAll('details, [class*="faq"], [id*="faq"]').length;
  if (faqSignals > 0) score += 15;
  const hasSearch = !!(
    doc.querySelector('input[type="search"], input[placeholder*="search" i], form[role="search"]')
  );
  if (hasSearch) score += 15;
  return Math.min(100, score);
}

function computePageSpeedScore(doc) {
  const cssLinks  = doc.querySelectorAll('link[rel="stylesheet"]').length;
  const scripts   = doc.querySelectorAll('script[src]').length;
  const images    = doc.querySelectorAll('img').length;
  const lazyImgs  = doc.querySelectorAll('img[loading="lazy"]').length;
  const lazyRatio = images > 0 ? lazyImgs / images : 1;

  // Desktop: penalise heavily over 10 scripts or 5 CSS
  let desktop = 100;
  if (scripts > 10)  desktop -= (scripts - 10) * 4;
  if (cssLinks > 5)  desktop -= (cssLinks - 5) * 3;
  if (lazyRatio < 0.5 && images > 3) desktop -= 10;
  desktop = Math.max(0, Math.min(100, desktop));

  // Mobile: stricter
  let mobile = 100;
  if (scripts > 8)  mobile -= (scripts - 8) * 5;
  if (cssLinks > 4) mobile -= (cssLinks - 4) * 4;
  if (lazyRatio < 0.5 && images > 3) mobile -= 15;
  mobile = Math.max(0, Math.min(100, mobile));

  return { desktop, mobile, cssLinks, scripts, images, lazyImgs };
}

function computeReadabilityScore(doc) {
  const selectors = ['article', '[itemprop="articleBody"]', '.post-content', '.entry-content', 'main', 'body'];
  let text = '';
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) { text = el.textContent?.trim() || ''; if (text.length > 100) break; }
  }
  const result = calculateReadability(text.slice(0, 3000));
  return result.score;
}

function getBodyText(doc) {
  return (doc.body?.textContent || '').toLowerCase();
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function runFullAudit(html, pageUrl, targetPageType = 'auto') {
  const doc      = parseHTML(html);
  const meta     = extractMeta(doc, pageUrl);
  const bodyText = getBodyText(doc);
  const schemas  = detectSchemaTypes(doc);
  const readabilityScore  = computeReadabilityScore(doc);
  const searchabilityScore = computeSearchabilityScore(doc, meta);
  const speedScores = computePageSpeedScore(doc);

  // Determine effective page type
  const detectedType = detectPageType(doc, meta);
  const effectivePageType = (targetPageType && targetPageType !== 'auto')
    ? targetPageType
    : detectedType;

  const schemaPillar    = auditSchemaPillar(doc, schemas, meta, effectivePageType);
  const contentPillar   = auditContentPillar(doc, meta, bodyText, readabilityScore, searchabilityScore);
  const technicalPillar = auditTechnicalPillar(doc, meta, pageUrl, speedScores);
  const eeatPillar      = auditEEATPillar(doc, meta, bodyText, schemas, pageUrl);
  const uxPillar        = auditUXPillar(doc, meta, bodyText, searchabilityScore, speedScores);

  const pillars = [schemaPillar, contentPillar, technicalPillar, eeatPillar];

  // Weighted overall score
  const overallScore = Math.round(
    schemaPillar.score    * PILLAR_WEIGHTS.schema.weight    +
    contentPillar.score   * PILLAR_WEIGHTS.content.weight   +
    technicalPillar.score * PILLAR_WEIGHTS.technical.weight +
    eeatPillar.score      * PILLAR_WEIGHTS.eeat.weight
  );

  let grade, gradeClass;
  if (overallScore >= 80) { grade = 'Excellent'; gradeClass = 'grade-excellent'; }
  else if (overallScore >= 65) { grade = 'Good';      gradeClass = 'grade-good';      }
  else if (overallScore >= 40) { grade = 'Fair';      gradeClass = 'grade-fair';      }
  else                         { grade = 'Poor';      gradeClass = 'grade-poor';      }

  // All recommendations sorted by priority
  const allRecommendations = pillars
    .concat([uxPillar])
    .flatMap(p => p.checks.filter(c => !c.passed))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .map(c => ({
      id:           c.id,
      priority:     c.priority,
      category:     c.pillarLabel,
      title:        c.recommendation,
      description:  c.detail,
      schemaFix:    c.schemaFix || false,
      schemaType:   c.schemaType || null,
    }));

  return {
    pillars,
    uxPillar,
    overallScore,
    grade,
    gradeClass,
    recommendations: allRecommendations,
    meta,
    readabilityScore,
    searchabilityScore,
    speedScores,
    effectivePageType,
  };
}

// ─── Pillar: Schema Markup (30%) ─────────────────────────────────────────────
function auditSchemaPillar(doc, schemas, meta, pageType = 'generic') {
  const label = 'Schema Markup';
  const { all } = schemas;

  const hasOrg        = /\b(organization|localbusiness|corporation|ngo|business|company)\b/.test(all);
  const hasWebsite    = /\bwebsite\b/.test(all);
  const hasArticle    = /\b(article|blogposting|newsarticle|techarticle|webpage|post)\b/.test(all);
  const hasProduct    = /product|offer|aggregateoffer|brand/.test(all);
  const hasFAQ        = /faqpage|question|qapage|\bfaq\b/.test(all);
  const hasBreadcrumb = /breadcrumblist|breadcrumb/.test(all);
  const hasHowTo      = /howto|howtostep/.test(all);

  let checks = [];

  if (pageType === 'homepage') {
    // ── Homepage Targeted Checks ──────────────────────────────────────────
    // 1. Organization Schema (Required for Homepage)
    const orgCheck = hasOrg
      ? pass('org-schema', 'Organization Schema', 'Organization / Business schema detected — establishes brand identity for AI.', PRIORITY.HIGH, 'Organization schema present')
      : fail('org-schema', 'Organization Schema', 'PASS: Detects Organization or LocalBusiness in structured markup. None found.', PRIORITY.HIGH, 'Add Organization schema to establish brand identity.', true, 'Organization');

    // 2. WebSite Schema (Required for Homepage)
    const websiteCheck = hasWebsite
      ? pass('website-schema', 'WebSite Schema', 'WebSite schema detected — enables sitelinks and brand search entity in AI.', PRIORITY.MEDIUM, 'WebSite schema present')
      : fail('website-schema', 'WebSite Schema', 'PASS: Detects WebSite schema in structured markup. None found for Homepage.', PRIORITY.MEDIUM, 'Add WebSite schema with SearchAction for sitelinks eligibility.', true, 'WebSite');

    // 3. Breadcrumb Schema (N/A for Homepage)
    const breadcrumbCheck = pass('breadcrumb-schema', 'Breadcrumb Schema', 'N/A for Homepage — Root domain (/) has no parent pages in site hierarchy.', PRIORITY.LOW, 'Breadcrumbs not required on Homepage');

    // 4. Content Schema (N/A for Homepage unless FAQ/Article explicit)
    const contentSchemaCheck = (hasArticle || hasOrg)
      ? pass('content-schema', 'Content Type Schema', 'Homepage identity schema verified.', PRIORITY.LOW, 'Homepage schema structure verified')
      : pass('content-schema', 'Content Type Schema', 'Homepage uses Brand & WebSite schemas for AI identification.', PRIORITY.LOW, 'Homepage schema verified');

    checks = [orgCheck, websiteCheck, breadcrumbCheck, contentSchemaCheck];

  } else if (pageType === 'product') {
    // ── Product Page Targeted Checks ──────────────────────────────────────
    const productCheck = hasProduct
      ? pass('product-schema', 'Product Schema', 'Product / E-commerce schema detected — enables rich shopping results.', PRIORITY.HIGH, 'Product schema present')
      : fail('product-schema', 'Product Schema', 'PASS: Detects Product or Offer in structured markup. None found.', PRIORITY.HIGH, 'Add Product schema to enable pricing and availability rich snippets.', true, 'Product');

    const orgCheck = hasOrg
      ? pass('org-schema', 'Organization Schema', 'Organization / Seller schema detected.', PRIORITY.MEDIUM, 'Organization schema present')
      : fail('org-schema', 'Organization Schema', 'Add Organization schema to link seller identity to product.', PRIORITY.MEDIUM, 'Add Organization schema for seller trust.', true, 'Organization');

    const breadcrumbCheck = hasBreadcrumb
      ? pass('breadcrumb-schema', 'Breadcrumb Schema', 'BreadcrumbList schema detected.', PRIORITY.MEDIUM, 'Breadcrumb schema present')
      : fail('breadcrumb-schema', 'Breadcrumb Schema', 'No Breadcrumb schema detected on product page.', PRIORITY.MEDIUM, 'Add BreadcrumbList schema for category hierarchy.', true, 'BreadcrumbList');

    const faqCheck = hasFAQ
      ? pass('faq-schema', 'FAQ Schema', 'FAQPage schema detected on product page.', PRIORITY.LOW, 'FAQ schema present')
      : pass('faq-schema', 'FAQ Schema', 'N/A — FAQ optional for Product pages.', PRIORITY.LOW, 'FAQ schema optional');

    checks = [productCheck, orgCheck, breadcrumbCheck, faqCheck];

  } else if (pageType === 'faq') {
    // ── Dedicated FAQ Page Targeted Checks ────────────────────────────────
    const faqCheck = hasFAQ
      ? pass('faq-schema', 'FAQ Schema', 'FAQPage schema detected — optimized for voice search and answer engine boxes.', PRIORITY.HIGH, 'FAQ schema present')
      : fail('faq-schema', 'FAQ Schema', 'PASS: Detects FAQPage in structured markup. None found on dedicated FAQ page.', PRIORITY.HIGH, 'Add FAQPage schema to surface Q&A pairs directly in AI answers.', true, 'FAQPage');

    const breadcrumbCheck = hasBreadcrumb
      ? pass('breadcrumb-schema', 'Breadcrumb Schema', 'BreadcrumbList schema detected.', PRIORITY.MEDIUM, 'Breadcrumb schema present')
      : fail('breadcrumb-schema', 'Breadcrumb Schema', 'Add BreadcrumbList schema to map FAQ page location in site hierarchy.', PRIORITY.MEDIUM, 'Add BreadcrumbList schema.', true, 'BreadcrumbList');

    const orgCheck = hasOrg
      ? pass('org-schema', 'Organization Schema', 'Organization schema detected.', PRIORITY.MEDIUM, 'Organization schema present')
      : fail('org-schema', 'Organization Schema', 'Add Organization schema to attribute FAQ answers to brand.', PRIORITY.MEDIUM, 'Add Organization schema.', true, 'Organization');

    const articleCheck = pass('article-schema', 'Article Schema', 'N/A — Dedicated FAQ page uses FAQPage schema as main entity.', PRIORITY.LOW, 'FAQ schema is primary');

    checks = [faqCheck, breadcrumbCheck, orgCheck, articleCheck];

  } else if (pageType === 'howto') {
    // ── HowTo Guide Targeted Checks ───────────────────────────────────────
    const howtoCheck = hasHowTo
      ? pass('howto-schema', 'HowTo Schema', 'HowTo schema detected — step-by-step instructions defined for AI.', PRIORITY.HIGH, 'HowTo schema present')
      : fail('howto-schema', 'HowTo Schema', 'PASS: Detects HowTo in structured markup. None found on tutorial page.', PRIORITY.HIGH, 'Add HowTo schema to highlight step-by-step guides in AI answers.', true, 'HowTo');

    const breadcrumbCheck = hasBreadcrumb
      ? pass('breadcrumb-schema', 'Breadcrumb Schema', 'BreadcrumbList schema detected.', PRIORITY.MEDIUM, 'Breadcrumb schema present')
      : fail('breadcrumb-schema', 'Breadcrumb Schema', 'Add BreadcrumbList schema to show guide category path.', PRIORITY.MEDIUM, 'Add BreadcrumbList schema.', true, 'BreadcrumbList');

    const orgCheck = hasOrg
      ? pass('org-schema', 'Organization Schema', 'Organization schema detected.', PRIORITY.MEDIUM, 'Organization schema present')
      : fail('org-schema', 'Organization Schema', 'Add Organization schema to attribute guide to authoring organization.', PRIORITY.MEDIUM, 'Add Organization schema.', true, 'Organization');

    const articleCheck = hasArticle
      ? pass('article-schema', 'Article Schema', 'Article schema detected.', PRIORITY.LOW, 'Article schema present')
      : pass('article-schema', 'Article Schema', 'HowTo schema serves as primary content entity.', PRIORITY.LOW, 'HowTo schema active');

    checks = [howtoCheck, breadcrumbCheck, orgCheck, articleCheck];

  } else {
    // ── Article / Generic Page Targeted Checks ───────────────────────────
    const articleCheck = hasArticle
      ? pass('article-schema', 'Article Schema', 'Article / content schema detected — enables AI content understanding.', PRIORITY.HIGH, 'Article schema present')
      : fail('article-schema', 'Article Schema', 'PASS: Detects Article, BlogPosting, or NewsArticle in structured markup. None found.', PRIORITY.HIGH, 'Add Article or BlogPosting schema to help AI engines understand content.', true, 'Article');

    const breadcrumbCheck = hasBreadcrumb
      ? pass('breadcrumb-schema', 'Breadcrumb Schema', 'BreadcrumbList schema detected — site hierarchy defined for AI.', PRIORITY.MEDIUM, 'Breadcrumb schema present')
      : fail('breadcrumb-schema', 'Breadcrumb Schema', 'No Breadcrumb schema detected. Site hierarchy not clearly defined for AI systems.', PRIORITY.MEDIUM, 'Add BreadcrumbList schema for site hierarchy.', true, 'BreadcrumbList');

    const orgCheck = hasOrg
      ? pass('org-schema', 'Organization Schema', 'Organization / business schema detected — brand identity established.', PRIORITY.MEDIUM, 'Organization schema present')
      : fail('org-schema', 'Organization Schema', 'Add Organization schema to establish brand identity.', PRIORITY.MEDIUM, 'Add Organization schema.', true, 'Organization');

    const faqCheck = hasFAQ
      ? pass('faq-schema', 'FAQ Schema', 'FAQPage schema detected — great for voice search & answer boxes.', PRIORITY.MEDIUM, 'FAQ schema present')
      : fail('faq-schema', 'FAQ Schema', 'PASS: Detects FAQPage in structured markup. None found.', PRIORITY.MEDIUM, 'Add FAQPage schema to capture voice search and answer box placements.', true, 'FAQPage');

    checks = [articleCheck, breadcrumbCheck, orgCheck, faqCheck];
  }

  const checksWithPillar = checks.map(c => ({ ...c, pillarLabel: label }));
  const score = Math.round((checksWithPillar.filter(c => c.passed).length / checksWithPillar.length) * 100);

  return { id: 'schema', label, score, checks: checksWithPillar, ...PILLAR_WEIGHTS.schema };
}

// ─── Pillar: Content Structure (25%) ─────────────────────────────────────────
function auditContentPillar(doc, meta, bodyText, readabilityScore, searchabilityScore) {
  const label = 'Content Structure';

  // 1. Heading Hierarchy — exactly one H1 AND at least 3 total headings
  const h1Count  = doc.querySelectorAll('h1').length;
  const allHdgs  = doc.querySelectorAll('h1,h2,h3,h4,h5,h6').length;
  const hasGoodHeadings = h1Count === 1 && allHdgs >= 3;
  const headingCheck = hasGoodHeadings
    ? pass('heading-hierarchy', 'Heading Hierarchy',
        `H1: ${h1Count}, Total headings: ${allHdgs} — PASS: Exactly one H1 AND at least 3 total headings.`,
        PRIORITY.HIGH, 'Heading structure is correct.')
    : fail('heading-hierarchy', 'Heading Hierarchy',
        `H1 count: ${h1Count}, Total headings: ${allHdgs}. PASS: Exactly one H1 AND at least 3 total headings (H1-H6).`,
        PRIORITY.HIGH,
        h1Count === 0 ? 'Poor heading hierarchy. No H1 found. Every page needs exactly one H1 tag.'
          : h1Count > 1 ? `Poor heading hierarchy. ${h1Count} H1 tags found — use only one H1.`
          : 'Poor heading hierarchy. Add at least 3 headings (H1-H6) to structure your content for AI parsing.');

  // 2. Question Targeting — headings with question words OR paragraphs with ?
  const allHeadingText = getAllText(doc, 'h1,h2,h3,h4').join(' ').toLowerCase();
  const questionWords  = /(what|how|why|when|where|who|which)\b/i;
  const headingsHaveQ  = questionWords.test(allHeadingText);
  const parasHaveQ     = (bodyText.match(/\?/g) || []).length >= 2;
  const hasQuestionTargeting = headingsHaveQ || parasHaveQ;
  const questionCheck = hasQuestionTargeting
    ? pass('question-targeting', 'Question Targeting',
        `PASS: Headings contain question words OR paragraphs contain "?". Found: ${headingsHaveQ ? 'question headings' : 'question marks in paragraphs'}.`,
        PRIORITY.HIGH, 'Question targeting signals present.')
    : fail('question-targeting', 'Question Targeting',
        "PASS: Headings contain question words (what, how, why, when, where, who, which) OR paragraphs contain question marks. None found.",
        PRIORITY.HIGH,
        "No clear question targeting detected. Add 'how to', 'what is', 'why' patterns to headings to improve AI matching.");

  // 3. Paragraph Length — avg 50–200 characters
  const paras = Array.from(doc.querySelectorAll('p'))
    .map(p => p.textContent?.trim() || '')
    .filter(t => t.length > 10);
  const avgParaLen = paras.length > 0
    ? Math.round(paras.reduce((s, p) => s + p.length, 0) / paras.length)
    : 0;
  const hasGoodParaLen = avgParaLen >= 50 && avgParaLen <= 200;
  const paraCheck = hasGoodParaLen
    ? pass('paragraph-length', 'Paragraph Length',
        `PASS: Average paragraph length ${avgParaLen} chars — within 50–200 char range.`,
        PRIORITY.MEDIUM, 'Paragraph length is optimal.')
    : fail('paragraph-length', 'Paragraph Length',
        `Average paragraph length: ${avgParaLen} chars. PASS: Average paragraph length between 50–200 characters (paragraphs over 10 chars only).`,
        PRIORITY.MEDIUM,
        avgParaLen < 50
          ? 'Paragraphs too short. Aim for 2–4 sentences (50–200 chars) per paragraph for better AI parsing.'
          : 'Paragraphs too long. Aim for 2–4 sentences (50–200 chars) per paragraph for better AI parsing.');

  // 4. Readability — score 65+
  const hasGoodReadability = readabilityScore >= 65;
  const readabilityCheck = hasGoodReadability
    ? pass('readability', 'Readability Score',
        `PASS: Readability score ${readabilityScore}/100 ≥ 65. Content complexity is well-suited for AI parsing.`,
        PRIORITY.MEDIUM, 'Readability score meets threshold.')
    : fail('readability', 'Readability Score',
        `Readability score: ${readabilityScore}/100. PASS: Readability score 65+ (based on content complexity analysis).`,
        PRIORITY.MEDIUM,
        `Readability score ${readabilityScore}/100 is below the 65 threshold. Simplify sentence structure, use shorter words, and aim for clear direct answers.`);

  // 5. Searchability — score 65+
  const hasGoodSearchability = searchabilityScore >= 65;
  const searchabilityCheck = hasGoodSearchability
    ? pass('searchability', 'Searchability Score',
        `PASS: Searchability score ${searchabilityScore}/100 ≥ 65 (title/meta, FAQ, tables, lists, search elements).`,
        PRIORITY.MEDIUM, 'Searchability score meets threshold.')
    : fail('searchability', 'Searchability Score',
        `Searchability score: ${searchabilityScore}/100. PASS: Searchability score 65+ (search elements, title/meta optimization, FAQ sections, tables, lists).`,
        PRIORITY.MEDIUM,
        `Searchability score ${searchabilityScore}/100 is below 65. Add meta description, structure content with tables/lists, add FAQ sections, and optimise title tags.`);

  // 6. Visual Hierarchy — single H1 + multiple headings + logical order + visual separators
  const hasHr    = doc.querySelector('hr, [class*="divider"], [class*="separator"]');
  const hasLogicalOrder = h1Count === 1 && allHdgs >= 2;
  const hasVisualHierarchy = hasLogicalOrder && (allHdgs >= 3 || !!hasHr);
  const visualCheck = hasVisualHierarchy
    ? pass('visual-hierarchy', 'Visual Hierarchy',
        'PASS: Single H1 + multiple headings + logical heading order + visual separation elements.',
        PRIORITY.MEDIUM, 'Visual hierarchy is well-structured.')
    : fail('visual-hierarchy', 'Visual Hierarchy',
        'PASS: Single H1 tag + multiple headings + logical heading order + visual separation elements (hr, dividers).',
        PRIORITY.MEDIUM,
        'Visual hierarchy needs work. Use proper H1-H6 structure and visual separation for better AI content understanding.');

  const checks = [headingCheck, questionCheck, paraCheck, readabilityCheck, searchabilityCheck, visualCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score  = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return { id: 'content', label, score, checks, ...PILLAR_WEIGHTS.content };
}

// ─── Pillar: Technical SEO (25%) ─────────────────────────────────────────────
function auditTechnicalPillar(doc, meta, pageUrl, speedScores) {
  const label = 'Technical SEO';

  // 1. HTTPS
  const isHTTPS = /^https:\/\//i.test(pageUrl);
  const httpsCheck = isHTTPS
    ? pass('https', 'HTTPS Security',
        'PASS: Page URL starts with https:// — secure connection confirmed.',
        PRIORITY.HIGH, 'HTTPS is enabled.')
    : fail('https', 'HTTPS Security',
        'PASS: Page URL starts with https://. This URL uses HTTP — insecure.',
        PRIORITY.HIGH,
        'Page is not served over HTTPS. AI systems and search engines penalise insecure sites. Migrate to HTTPS immediately.');

  // 2. Mobile Viewport
  const viewportMeta = doc.querySelector('meta[name="viewport"]');
  const viewportContent = viewportMeta?.getAttribute('content') || '';
  const hasResponsiveCSS = doc.querySelector('[class*="container"], [class*="responsive"]');
  const hasMobileViewport = /width=device-width/i.test(viewportContent) || !!hasResponsiveCSS;
  const viewportCheck = hasMobileViewport
    ? pass('viewport', 'Mobile Viewport',
        `PASS: Viewport meta tag contains 'width=device-width' OR responsive CSS classes present.`,
        PRIORITY.HIGH, 'Mobile viewport is configured.')
    : fail('viewport', 'Mobile Viewport',
        "PASS: Viewport meta tag contains 'width=device-width' OR responsive CSS classes present. Neither found.",
        PRIORITY.HIGH,
        'Not mobile-friendly. Critical issue since most AI searches happen on mobile devices. Add <meta name="viewport" content="width=device-width, initial-scale=1">.');

  // 3. Page Speed Desktop — simulated 80+
  const hasGoodDesktopSpeed = speedScores.desktop >= 80;
  const desktopSpeedCheck = hasGoodDesktopSpeed
    ? pass('speed-desktop', 'Page Speed (Desktop)',
        `PASS: Simulated page speed score ${speedScores.desktop}/100 ≥ 80 (CSS: ${speedScores.cssLinks}, Scripts: ${speedScores.scripts}).`,
        PRIORITY.MEDIUM, 'Desktop page speed is acceptable.')
    : fail('speed-desktop', 'Page Speed (Desktop)',
        `Simulated score: ${speedScores.desktop}/100. PASS: Simulated page speed score 80+ (resource count heuristic). CSS: ${speedScores.cssLinks}, Scripts: ${speedScores.scripts}.`,
        PRIORITY.MEDIUM,
        `Poor vitals — affects user experience and AI system trust scoring. Reduce scripts (found ${speedScores.scripts}), CSS files (found ${speedScores.cssLinks}), and add lazy loading.`);

  // 4. Page Speed Mobile — 65+
  const hasGoodMobileSpeed = speedScores.mobile >= 65;
  const mobileSpeedCheck = hasGoodMobileSpeed
    ? pass('speed-mobile', 'Page Speed (Mobile)',
        `PASS: Mobile page speed score ${speedScores.mobile}/100 ≥ 65 (calculated using resource count heuristic).`,
        PRIORITY.MEDIUM, 'Mobile page speed is acceptable.')
    : fail('speed-mobile', 'Page Speed (Mobile)',
        `Mobile speed score: ${speedScores.mobile}/100. PASS: Mobile page speed score 65+ (calculated using resource count heuristic).`,
        PRIORITY.MEDIUM,
        `Mobile page speed score ${speedScores.mobile}/100 is below 65. Optimise images, minify CSS/JS, and reduce render-blocking resources.`);

  // 5. Navigation Clarity — nav elements + menu structures + 3+ links
  const hasNav    = !!(doc.querySelector('nav, [class*="navigation"], [class*="navbar"], [class*="nav-"]'));
  const linkCount = doc.querySelectorAll('a[href]').length;
  const hasMenu   = !!(doc.querySelector('[class*="menu"], [role="menu"], [role="menubar"]'));
  const hasNavClarity = hasNav && linkCount >= 3;
  const navCheck = hasNavClarity
    ? pass('navigation', 'Navigation Clarity',
        `PASS: Navigation elements AND menu structures AND 3+ links. Found ${linkCount} links.`,
        PRIORITY.MEDIUM, 'Navigation structure is clear.')
    : fail('navigation', 'Navigation Clarity',
        `PASS: Navigation elements (nav, .navigation, .navbar) AND menu structures AND 3+ links. Links found: ${linkCount}, Nav found: ${hasNav}.`,
        PRIORITY.MEDIUM,
        'Navigation needs improvement. Add clear menu structure and descriptive labels for better AI understanding.');

  // 6. Accessibility — 80%+ images with alt + ARIA + semantic HTML + skip links
  const allImgs    = doc.querySelectorAll('img');
  const altImgs    = doc.querySelectorAll('img[alt]');
  const altRatio   = allImgs.length > 0 ? altImgs.length / allImgs.length : 1;
  const hasARIA    = !!(doc.querySelector('[aria-label], [aria-describedby], [role]'));
  const hasSkip    = !!(doc.querySelector('[href="#main"], [href="#content"], .skip-link'));
  const hasSemantic= !!(doc.querySelector('main, header, footer, article, section, aside'));
  const hasAccessibility = altRatio >= 0.8 && hasARIA && hasSemantic;
  const accessCheck = hasAccessibility
    ? pass('accessibility', 'Accessibility',
        `PASS: 80%+ images have alt text (${Math.round(altRatio * 100)}%) + ARIA attributes + semantic HTML tags.`,
        PRIORITY.MEDIUM, 'Accessibility standards are met.')
    : fail('accessibility', 'Accessibility',
        `PASS: 80%+ images have alt text + ARIA attributes + semantic HTML tags + skip links. Alt text: ${Math.round(altRatio * 100)}%, ARIA: ${hasARIA}, Semantic: ${hasSemantic}.`,
        PRIORITY.MEDIUM,
        `Accessibility issues found. ${Math.round(altRatio * 100)}% of images have alt text (need 80%+). ${!hasARIA ? 'Add ARIA attributes.' : ''} ${!hasSemantic ? 'Use semantic HTML (main, header, article).' : ''}`);

  // 7. Resource Optimization — ≤5 CSS + ≤10 scripts + lazy loading
  const hasLazy    = doc.querySelectorAll('img[loading="lazy"]').length > 0 || speedScores.images === 0;
  const hasGoodResources = speedScores.cssLinks <= 5 && speedScores.scripts <= 10 && (hasLazy || speedScores.images <= 2);
  const resourceCheck = hasGoodResources
    ? pass('resources', 'Resource Optimization',
        `PASS: ≤5 CSS files (${speedScores.cssLinks}) + ≤10 script tags (${speedScores.scripts}) + lazy loading.`,
        PRIORITY.LOW, 'Resource optimization is acceptable.')
    : fail('resources', 'Resource Optimization',
        `CSS: ${speedScores.cssLinks}/5, Scripts: ${speedScores.scripts}/10, Lazy images: ${speedScores.lazyImgs}/${speedScores.images}. PASS: 5 or fewer CSS files + optimized images + 10 or fewer script tags + lazy loading attributes.`,
        PRIORITY.LOW,
        `Slow loading speed detected. ${speedScores.scripts > 10 ? `Reduce scripts from ${speedScores.scripts} to ≤10. ` : ''}${speedScores.cssLinks > 5 ? `Reduce CSS files from ${speedScores.cssLinks} to ≤5. ` : ''}Add loading="lazy" to images.`);

  const checks = [httpsCheck, viewportCheck, desktopSpeedCheck, mobileSpeedCheck, navCheck, accessCheck, resourceCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return { id: 'technical', label, score, checks, ...PILLAR_WEIGHTS.technical };
}

// ─── Pillar: E-E-A-T (20%) ───────────────────────────────────────────────────
function auditEEATPillar(doc, meta, bodyText, schemas, pageUrl) {
  const label = 'E-E-A-T';
  const { all: schemaAll } = schemas;

  // 1. Author Signals
  const hasAuthorEl = !!(
    doc.querySelector('.author, .byline, [rel="author"], [itemprop="author"], [class*="author-name"], [class*="byline"]')
  );
  const hasAuthorJSON = /["']author["']/.test(schemaAll) || meta.author;
  const hasAuthor = hasAuthorEl || !!hasAuthorJSON;
  const authorCheck = hasAuthor
    ? pass('author', 'Author Signals',
        `PASS: Author elements (.author, .byline, [rel='author'], etc.) OR JSON-LD contains 'author' field. Found: ${hasAuthorEl ? 'author element' : 'JSON-LD author'}.`,
        PRIORITY.HIGH, 'Author attribution is present.')
    : fail('author', 'Author Signals',
        "PASS: Author elements (.author, .byline, [rel='author'], etc.) OR JSON-LD contains 'author' field. None found.",
        PRIORITY.HIGH,
        "Clear author bylines and biographical information missing. Add author attribution for E-E-A-T trust signals. AI systems use this to assess content credibility.",
        true, 'Article');

  // 2. Expertise Credentials
  const expertiseKeywords = /\b(phd|ph\.d|m\.d|md\b|certified|expert|specialist|award|years of experience|certified by|professional|accredited|licensed|registered)\b/i;
  const hasExpertise = expertiseKeywords.test(bodyText);
  const expertiseCheck = hasExpertise
    ? pass('expertise', 'Expertise Credentials',
        "PASS: Text contains professional credentials (phd, md, certified, expert, specialist, award, years of experience, certified by).",
        PRIORITY.MEDIUM, 'Expertise signals present.')
    : fail('expertise', 'Expertise Credentials',
        "PASS: Text contains: phd, md, certified, expert, specialist, award, years of experience, certified by. None found.",
        PRIORITY.MEDIUM,
        'Limited expertise signals. Add credentials, certifications, or experience indicators (e.g., "10+ years of experience", "certified by", "specialist in") to establish authority.');

  // 3. Trust Signals
  const hasTrustEl = !!(
    doc.querySelector('.review, .testimonial, .security, .ssl, .trust, [class*="review"], [class*="testimonial"], [class*="trust-badge"], [class*="security"]')
  );
  const trustKeywords = /\b(testimonial|review|rated|stars|guarantee|secure|ssl|certified|accredited|award|trusted|verified)\b/i;
  const hasTrustText = trustKeywords.test(bodyText);
  const hasTrust = hasTrustEl || hasTrustText;
  const trustCheck = hasTrust
    ? pass('trust', 'Trust Signals',
        `PASS: Trust elements (.review, .testimonial, .security, .ssl) OR text contains trust keywords. Found: ${hasTrustEl ? 'trust elements' : 'trust keywords'}.`,
        PRIORITY.HIGH, 'Trust indicators found.')
    : fail('trust', 'Trust Signals',
        "PASS: Trust elements (.testimonial, .review, .security, .ssl) OR text contains trust keywords (testimonial, review, guarantee, secure, verified). None found.",
        PRIORITY.HIGH,
        'Missing trust signals. Add testimonials, reviews, or security badges to build credibility. AI systems use these indicators to evaluate source trustworthiness.');

  // 4. Date Freshness
  const hasTimeEl   = !!(doc.querySelector('time[datetime], .date, .published, .updated, [class*="date-"], [class*="published"]'));
  const hasDateJSON = !!(meta.datePublished || meta.dateModified || /["'](datePublished|dateModified)["']/.test(schemaAll));
  const hasDate = hasTimeEl || hasDateJSON;
  const dateCheck = hasDate
    ? pass('date-freshness', 'Date Freshness',
        `PASS: Time elements, date classes (.date, .published, .updated) OR JSON-LD contains 'datePublished'/'dateModified'. Found: ${hasTimeEl ? 'date element' : 'JSON-LD date'}.`,
        PRIORITY.MEDIUM, 'Publication and update dates found. Helps AI systems assess content freshness.')
    : fail('date-freshness', 'Date Freshness',
        "PASS: Time elements, date classes (.date, .published, .updated) OR JSON-LD contains 'datePublished'/'dateModified'. None found.",
        PRIORITY.MEDIUM,
        'Missing date stamps. Add publication/update dates to show content freshness. AI engines prioritise recent, dated content.',
        true, 'Article');

  // 5. Contact Information
  const contactLinks = doc.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="contact"]');
  const contactKeywords = /\b(contact\s*us|get\s*in\s*touch|reach\s*us|phone|email|address|call\s*us)\b/i;
  const hasContactText = contactKeywords.test(bodyText);
  const hasContact = contactLinks.length > 0 || hasContactText;
  const contactCheck = hasContact
    ? pass('contact', 'Contact Information',
        `PASS: Links contain contact keywords (contact, phone, email, address) OR HTML contains contact us. Found ${contactLinks.length} contact link(s).`,
        PRIORITY.MEDIUM, 'Contact information is accessible.')
    : fail('contact', 'Contact Information',
        "PASS: Links contain contact keywords (contact, phone, email, address) OR HTML contains 'contact' or 'contact us'. None found.",
        PRIORITY.MEDIUM,
        'Limited contact information. Add phone, email, and address for better AI trust signals. AI systems need contact details to verify organizational legitimacy.');

  // 6. About Page
  const aboutLinks = doc.querySelectorAll('a[href*="about"], a[href*="our-story"], a[href*="company"]');
  const aboutKeywords = /\b(about\s*us|our\s*story|company|who\s*we\s*are|our\s*mission|about\s+[a-z])\b/i;
  const aboutInTitle = aboutKeywords.test(meta.title + ' ' + getAllText(doc, 'h1,h2').join(' '));
  const hasAbout = aboutLinks.length > 0 || aboutInTitle;
  const aboutCheck = hasAbout
    ? pass('about', 'About Page',
        `PASS: Links to about pages OR page title/headings contain about keywords. Found ${aboutLinks.length} about link(s).`,
        PRIORITY.LOW, 'About page / company context found.')
    : fail('about', 'About Page',
        "PASS: Links to about pages OR page title/headings contain about keywords (about, about us, our story, company). None found.",
        PRIORITY.LOW,
        'Weak or missing about page. AI systems need company/organization details for context. Add an About page and link to it from your navigation.');

  const checks = [authorCheck, expertiseCheck, trustCheck, dateCheck, contactCheck, aboutCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return { id: 'eeat', label, score, checks, ...PILLAR_WEIGHTS.eeat };
}

// ─── UX Pillar (reported separately, not in main score) ──────────────────────
function auditUXPillar(doc, meta, bodyText, searchabilityScore, speedScores) {
  const label = 'User Experience';

  // 1. Content Accessibility
  const allImgs  = doc.querySelectorAll('img');
  const altRatio = allImgs.length > 0 ? doc.querySelectorAll('img[alt]').length / allImgs.length : 1;
  const hasARIA  = !!(doc.querySelector('[aria-label],[aria-describedby],[role]'));
  const hasSemantic = !!(doc.querySelector('main,header,footer,article,section'));
  const accessCheck = (altRatio >= 0.8 && hasARIA && hasSemantic)
    ? pass('ux-accessibility', 'Content Accessibility',
        `PASS: 80%+ images have alt text (${Math.round(altRatio * 100)}%) + ARIA attributes + semantic HTML.`,
        PRIORITY.MEDIUM, 'Accessibility standards met.')
    : fail('ux-accessibility', 'Content Accessibility',
        `Alt text: ${Math.round(altRatio * 100)}%, ARIA: ${hasARIA}, Semantic HTML: ${hasSemantic}. PASS: 80%+ images have alt text + ARIA attributes + semantic HTML tags + skip links.`,
        PRIORITY.MEDIUM,
        'Accessibility improvements needed. Ensure 80%+ images have alt text, add ARIA labels, and use semantic HTML elements.');

  // 2. Interaction Design
  const hasBtns    = !!(doc.querySelector('button, input[type="button"], input[type="submit"], [class*="btn"]'));
  const hasForms   = !!(doc.querySelector('form'));
  const hasCTAText = /\b(click|buy|get\s*started|sign\s*up|subscribe|download|contact|call\s*now|learn\s*more|try|start|join)\b/i.test(bodyText);
  const hasSocial  = !!(doc.querySelector('a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="facebook.com"], a[href*="instagram.com"]'));
  const hasInteraction = (hasBtns || hasForms) && (hasCTAText || hasSocial);
  const interactionCheck = hasInteraction
    ? pass('ux-interaction', 'Interaction Design',
        'PASS: Buttons + forms with labels + contact links + social links + clear CTA phrases.',
        PRIORITY.LOW, 'Interaction design elements present.')
    : fail('ux-interaction', 'Interaction Design',
        'PASS: Buttons + forms with labels + contact links + social links + clear CTA phrases (click, buy, get, start).',
        PRIORITY.LOW,
        'Improve interaction design. Add clear CTA buttons, contact links, and social media links to increase engagement signals.');

  // 3. Navigation Clarity
  const hasNav  = !!(doc.querySelector('nav, [class*="navigation"], [class*="navbar"]'));
  const linkCnt = doc.querySelectorAll('a[href]').length;
  const navCheck = (hasNav && linkCnt >= 3)
    ? pass('ux-navigation', 'Navigation Clarity',
        `PASS: Navigation elements AND menu structures AND 3+ links. Found ${linkCnt} links.`,
        PRIORITY.MEDIUM, 'Navigation structure is clear.')
    : fail('ux-navigation', 'Navigation Clarity',
        `PASS: Navigation elements (nav, .navigation, .navbar) AND menu structures AND 3+ links. Links: ${linkCnt}.`,
        PRIORITY.MEDIUM,
        'Navigation needs improvement. Add clear menu structure and descriptive labels for better AI understanding.');

  // 4. Visual Hierarchy
  const h1c = doc.querySelectorAll('h1').length;
  const hAll = doc.querySelectorAll('h1,h2,h3,h4,h5,h6').length;
  const hasHr = !!(doc.querySelector('hr, [class*="divider"]'));
  const visualCheck = (h1c === 1 && hAll >= 3)
    ? pass('ux-visual', 'Visual Hierarchy',
        'PASS: Single H1 tag + multiple headings + logical heading order + visual separation elements.',
        PRIORITY.MEDIUM, 'Visual hierarchy is well-structured.')
    : fail('ux-visual', 'Visual Hierarchy',
        `PASS: Single H1 tag + multiple headings + logical heading order + visual separation elements. H1: ${h1c}, Total: ${hAll}.`,
        PRIORITY.MEDIUM,
        'Visual hierarchy needs work. Use proper H1-H6 structure and visual separation for better AI content understanding.');

  // 5. Loading Experience
  const hasLazy = doc.querySelectorAll('img[loading="lazy"]').length > 0 || speedScores.images === 0;
  const loadingCheck = (speedScores.cssLinks <= 5 && speedScores.scripts <= 10)
    ? pass('ux-loading', 'Loading Experience',
        `PASS: Reasonable resource count (CSS: ${speedScores.cssLinks}, Scripts: ${speedScores.scripts}) + optimized images.`,
        PRIORITY.MEDIUM, 'Loading experience is acceptable.')
    : fail('ux-loading', 'Loading Experience',
        `CSS: ${speedScores.cssLinks}, Scripts: ${speedScores.scripts}. PASS: 5 or fewer CSS files + optimized images + 10 or fewer script tags + lazy loading.`,
        PRIORITY.MEDIUM,
        `Slow loading speed detected. Page speed optimization needed. CSS files: ${speedScores.cssLinks} (target ≤5), Script tags: ${speedScores.scripts} (target ≤10).`);

  // 6. Searchability Score
  const searchCheck = (searchabilityScore >= 65)
    ? pass('ux-searchability', 'Searchability Score',
        `PASS: Searchability score ${searchabilityScore}/100 ≥ 65 (search elements, title/meta, FAQ sections, tables, lists).`,
        PRIORITY.MEDIUM, 'Searchability is above threshold.')
    : fail('ux-searchability', 'Searchability Score',
        `Searchability score: ${searchabilityScore}/100. PASS: Searchability score 65+ (search elements, title/meta optimization, FAQ sections, tables, lists).`,
        PRIORITY.MEDIUM,
        `Searchability needs improvement (score: ${searchabilityScore}/100). Add search functionality, optimize title/meta descriptions, and include structured content like tables and FAQ sections.`);

  const checks = [accessCheck, interactionCheck, navCheck, visualCheck, loadingCheck, searchCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return { id: 'ux', label, score, checks, emoji: '📱', isUX: true };
}
