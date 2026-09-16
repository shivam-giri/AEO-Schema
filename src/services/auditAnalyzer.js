/**
 * auditAnalyzer.js
 * 5-Pillar Answer Engine Audit — Content-Signal-Driven, gated on AI crawler access.
 *
 * Formula: Schema Markup (25%) + Content Structure (25%) + Technical SEO (20%)
 *          + E-E-A-T (20%) + Content Freshness (10%), each check weighted by
 *          priority within its pillar (see computePillarScore), then the
 *          weighted sum is scaled by the AI Crawler Access gate multiplier
 *          (see AI_ACCESS_GATE_FLOOR and runFullAudit). Weights and their
 *          rationale are documented next to PILLAR_WEIGHTS below.
 *
 * AI Crawler Access is intentionally NOT one of the 5 weighted pillars — every
 * AEO/GEO audit framework we reviewed treats crawler accessibility as a
 * prerequisite ("if AI crawlers can't access your site, nothing else
 * matters"), not just another bucket to average in. It's still scored and
 * displayed like a pillar, but it multiplies the final score instead.
 *
 * The Schema Markup pillar is fully signal-driven: instead of a fixed
 * page-type matrix, it detects every content type on the page (FAQ, BOD,
 * Events, Article, News, etc.) and generates targeted checks for each.
 * Content types not present on the page are marked N/A — not Fail.
 */

import { parseHTML, extractMeta, getAllText, getAttr, detectAllContentSignals } from '../utils/htmlParser.js';
import { calculateReadability } from '../utils/readabilityScore.js';
import { analyzeRobotsTxt, AI_SEARCH_BOTS } from '../utils/robotsChecker.js';

export const PRIORITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// ─── Weights ──────────────────────────────────────────────────────────────────
// Re-derived from AEO/GEO audit research rather than an even split:
//  - Schema and Content carry the strongest measured evidence (FAQPage schema
//    -> 3.2x more likely in AI Overviews; connected schema -> +19.72% AI
//    Overview visibility; clear heading hierarchy -> 2.8x citation likelihood;
//    front-loaded answers -> ~44% of LLM citations pulled from the first 30%
//    of a page), so they keep the top two weights.
//  - Technical SEO drops from 25% to 20% — every source treats it as
//    necessary-but-not-a-citation-driver ("won't get you cited faster, just
//    won't actively hurt you").
//  - E-E-A-T stays at 20%, but the checks themselves were tightened (see
//    auditEEATPillar) so the weight is no longer propping up checks that
//    could never fail.
//  - Content Freshness (10%) is split out of E-E-A-T into its own pillar —
//    it was previously a single buried check.
// These 5 weights sum to 100%. AI Crawler Access is intentionally NOT in this
// list — see auditAIAccessPillar and the gate multiplier in runFullAudit.
export const PILLAR_WEIGHTS = {
  schema:     { weight: 0.25, label: 'Schema Markup',     pct: '25%', emoji: '🗂️'  },
  content:    { weight: 0.25, label: 'Content Structure', pct: '25%', emoji: '📝'  },
  technical:  { weight: 0.20, label: 'Technical SEO',     pct: '20%', emoji: '🔧'  },
  eeat:       { weight: 0.20, label: 'E-E-A-T',           pct: '20%', emoji: '🏆'  },
  freshness:  { weight: 0.10, label: 'Content Freshness', pct: '10%', emoji: '🕒'  },
};

// Gate floor: even a page fully blocked from every tracked AI bot still
// retains this fraction of its weighted pillar score, rather than dropping
// to zero. A hard zero would make the score feel binary/broken; a 0.25 floor
// still makes the gate dominant (a "Poor" page regardless of pillar scores)
// without hiding genuine on-page quality entirely.
export const AI_ACCESS_GATE_FLOOR = 0.25;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pass = (id, label, detail, priority, rec) => ({
  id, label, passed: true, isNA: false, status: 'pass', detail,
  priority, recommendation: rec,
});

const fail = (id, label, detail, priority, rec, schemaFix = false, schemaType = null) => ({
  id, label, passed: false, isNA: false, status: 'fail', detail,
  priority, recommendation: rec, schemaFix, schemaType,
});

const na = (id, label, detail, reason) => ({
  id, label, passed: true, isNA: true, status: 'na', detail,
  priority: 'low', recommendation: reason,
});

// Priority-weighted scoring: a failing HIGH-priority check should move a
// pillar's score more than a failing LOW-priority one. Previously every
// pillar used a flat passed/total pass-rate that ignored the `priority`
// field entirely, even though it was already being computed on every check.
const PRIORITY_POINTS = { [PRIORITY.HIGH]: 3, [PRIORITY.MEDIUM]: 2, [PRIORITY.LOW]: 1 };

function computePillarScore(checks) {
  const scoreable = checks.filter(c => !c.isNA);
  if (scoreable.length === 0) return 100;
  const totalPoints = scoreable.reduce((s, c) => s + (PRIORITY_POINTS[c.priority] || 2), 0);
  const passedPoints = scoreable
    .filter(c => c.passed)
    .reduce((s, c) => s + (PRIORITY_POINTS[c.priority] || 2), 0);
  return Math.round((passedPoints / totalPoints) * 100);
}

function detectSchemaTypes(doc) {
  // JSON-LD: Parse script tags, expand arrays and @graph graphs
  const jsonld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .flatMap(s => {
      try {
        const parsed = JSON.parse(s.textContent);
        if (!parsed) return [];
        const items = Array.isArray(parsed) ? parsed : [parsed];
        return items.flatMap(item => (item && Array.isArray(item['@graph'])) ? item['@graph'] : (item ? [item] : []));
      } catch { return []; }
    });

  const jsonldTypes = jsonld.flatMap(s => {
    if (!s || !s['@type']) return [];
    const type = s['@type'];
    return Array.isArray(type) ? type : [type];
  }).map(t => (typeof t === 'string' ? t.toLowerCase() : ''));

  // Microdata + RDFa
  const itemtypes = Array.from(doc.querySelectorAll('[itemtype]'))
    .map(el => el.getAttribute('itemtype')?.toLowerCase() || '');
  const typeofs = Array.from(doc.querySelectorAll('[typeof]'))
    .map(el => el.getAttribute('typeof')?.toLowerCase() || '');

  const all = [...jsonldTypes, ...itemtypes, ...typeofs].join(' ');
  return { all, jsonld, jsonldTypes };
}

/**
 * Whether the page's JSON-LD contains an ItemList or Person entry that is
 * actually leadership/governance-flavored (name/description/jobTitle mentions
 * board, director, executive, etc.) — not just any ItemList or Person schema.
 *
 * The previous check (`/\b(person|itemlist)\b/.test(all)`) false-positived on
 * any unrelated ItemList (a product list, a top-10 list) or any Person schema
 * (an Article's author byline commonly uses `{"@type":"Person"}`), which let
 * the "Leadership / Person Schema" check pass on pages with no BOD content at
 * all. This inspects the actual parsed JSON-LD objects instead of a flat
 * string of type names.
 */
function hasLeadershipSchema(schemas) {
  const leadershipKeywords = /\b(board|director|leadership|executive|governance|chair|chief|officer)\b/i;
  return schemas.jsonld.some(item => {
    if (!item || !item['@type']) return false;
    const types = (Array.isArray(item['@type']) ? item['@type'] : [item['@type']])
      .map(t => (typeof t === 'string' ? t.toLowerCase() : ''));

    if (types.includes('itemlist')) {
      const text = `${item.name || ''} ${item.description || ''}`;
      return leadershipKeywords.test(text);
    }
    if (types.includes('person')) {
      return leadershipKeywords.test(item.jobTitle || '');
    }
    return false;
  });
}

/**
 * Strips script/style/noscript and measures the remaining visible text in the
 * raw HTML — i.e. what an AI crawler sees WITHOUT executing JavaScript. Most
 * AI answer-engine crawlers do not render JS, so a page whose content only
 * appears after client-side rendering is effectively invisible to them even
 * if a human browser shows it fine.
 */
function hasSubstantialRawContent(doc) {
  const bodyClone = doc.body?.cloneNode(true);
  if (!bodyClone) return { substantial: false, textLength: 0 };
  bodyClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  const text = (bodyClone.textContent || '').replace(/\s+/g, ' ').trim();
  return { substantial: text.length >= 250, textLength: text.length };
}

/**
 * Checks whether the page opens with a concise, self-contained answer instead
 * of burying it after a long intro — GEO/front-loading research finds ~44% of
 * LLM citations are pulled from the first 30% of an article, and generative
 * engines process content in chunks without guaranteed full-page context.
 * Heuristic: the first substantial (40+ char) paragraph/list item within the
 * main content container must appear within the first 3 such elements and be
 * reasonably concise (not itself a giant wall of text).
 */
function checkFrontLoadedAnswer(doc) {
  const container = doc.querySelector('main, article, [itemprop="articleBody"], .post-content, .entry-content, .article-body') || doc.body;
  if (!container) return { found: false };

  const blocks = Array.from(container.querySelectorAll('p, li'));
  const firstIndex = blocks.findIndex(el => (el.textContent || '').trim().length >= 40);
  if (firstIndex === -1) return { found: false };

  const text = blocks[firstIndex].textContent.trim();
  const isEarly = firstIndex <= 2;
  const isConcise = text.length <= 500;

  return { found: isEarly && isConcise, text: text.slice(0, 160), position: firstIndex, length: text.length };
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
/**
 * @param {string} html
 * @param {string} pageUrl
 * @param {string|null} [robotsTxt] - Raw robots.txt content for pageUrl's origin,
 *   or null if unavailable (treated as "no restrictions" per spec). Fetched
 *   separately (network call) since this function stays synchronous — see
 *   fetchRobotsTxt() in services/fetcher.js.
 */
export function runFullAudit(html, pageUrl, robotsTxt = null) {
  const doc      = parseHTML(html);
  const meta     = extractMeta(doc, pageUrl);
  const bodyText = getBodyText(doc);
  const schemas  = detectSchemaTypes(doc);
  const readabilityScore   = computeReadabilityScore(doc);
  const searchabilityScore = computeSearchabilityScore(doc, meta);
  const speedScores        = computePageSpeedScore(doc);
  const robotsInfo         = analyzeRobotsTxt(robotsTxt);

  // Single source of truth — all content signals
  const signals = detectAllContentSignals(doc, meta, pageUrl);
  const { pageType } = signals;

  const schemaPillar     = auditSchemaPillar(doc, schemas, signals);
  const contentPillar    = auditContentPillar(doc, meta, bodyText, readabilityScore, searchabilityScore);
  const technicalPillar  = auditTechnicalPillar(doc, meta, pageUrl, speedScores);
  const eeatPillar       = auditEEATPillar(doc, meta, bodyText, schemas, pageUrl, signals);
  const freshnessPillar  = auditFreshnessPillar(doc, meta, schemas, signals);
  const aiAccessPillar   = auditAIAccessPillar(doc, meta, robotsInfo);
  const uxPillar         = auditUXPillar(doc, meta, bodyText, searchabilityScore, speedScores);

  const pillars = [schemaPillar, contentPillar, technicalPillar, eeatPillar, freshnessPillar];

  // Weighted score across the 5 scored pillars (sums to 100%)
  const pillarWeightedScore =
    schemaPillar.score     * PILLAR_WEIGHTS.schema.weight    +
    contentPillar.score    * PILLAR_WEIGHTS.content.weight   +
    technicalPillar.score  * PILLAR_WEIGHTS.technical.weight +
    eeatPillar.score       * PILLAR_WEIGHTS.eeat.weight      +
    freshnessPillar.score  * PILLAR_WEIGHTS.freshness.weight;

  // AI Crawler Access gate: scales the weighted score by a factor between
  // AI_ACCESS_GATE_FLOOR (fully blocked) and 1.0 (fully accessible), instead
  // of being diluted into one more weighted bucket. This is what makes a
  // robots.txt block on every tracked AI bot drag a page into "Poor"
  // regardless of how good its schema/content scores are.
  const gateMultiplier = AI_ACCESS_GATE_FLOOR + (1 - AI_ACCESS_GATE_FLOOR) * (aiAccessPillar.score / 100);
  const preGateScore   = Math.round(pillarWeightedScore);
  const overallScore   = Math.round(pillarWeightedScore * gateMultiplier);

  let grade, gradeClass;
  if (overallScore >= 80)      { grade = 'Excellent'; gradeClass = 'grade-excellent'; }
  else if (overallScore >= 65) { grade = 'Good';      gradeClass = 'grade-good';      }
  else if (overallScore >= 40) { grade = 'Fair';      gradeClass = 'grade-fair';      }
  else                         { grade = 'Poor';      gradeClass = 'grade-poor';      }

  // All recommendations sorted by priority (exclude N/A items)
  const allRecommendations = pillars
    .concat([uxPillar, aiAccessPillar])
    .flatMap(p => p.checks.filter(c => !c.passed && !c.isNA))
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
    aiAccessPillar,
    gateMultiplier,
    preGateScore,
    overallScore,
    grade,
    gradeClass,
    recommendations: allRecommendations,
    meta,
    readabilityScore,
    searchabilityScore,
    speedScores,
    pageType,
    signals,
  };
}

// ─── Pillar: Schema Markup (25%) — Signal-Driven ─────────────────────────────
/**
 * Generates a targeted check for each content type detected on the page.
 * Content types not present are marked N/A (not Fail), preventing false negatives.
 * @param {Document} doc
 * @param {{ all: string }} schemas - Flat string of all detected schema types
 * @param {ContentSignals} signals  - Result of detectAllContentSignals()
 */
function auditSchemaPillar(doc, schemas, signals) {
  const label = 'Schema Markup';
  const { all } = schemas;
  const { isHomepage, hasArticle: articleSignal, hasFAQ: faqSignal, hasHowTo: howToSignal,
          hasBOD: bodSignal, hasNews: newsSignal, hasProduct: productSignal,
          hasContactInfo: contactSignal, hasEvents: eventSignal, pageType } = signals;

  // Existing schema detection
  const hasOrg        = /\b(organization|localbusiness|corporation|ngo|business|company)\b/.test(all);
  const hasWebsite    = /\bwebsite\b/.test(all);
  // Note: bare "webpage"/"post" were dropped — WebPage is one of the most
  // generic, ubiquitous schema types on the web and doesn't indicate genuine
  // editorial/article content, so it was letting non-article pages false-pass.
  const hasArticle    = /\b(article|blogposting|newsarticle|techarticle)\b/.test(all);
  // "brand" was dropped — it's too generic (Organization.brand, alt text,
  // nav labels) to reliably indicate an actual Product schema.
  const hasProduct    = /\b(product|offer|aggregateoffer)\b/.test(all);
  const hasFAQ        = /faqpage|question|qapage|\bfaq\b/.test(all);
  const hasBreadcrumb = /breadcrumblist|breadcrumb/.test(all);
  const hasHowTo      = /howto|howtostep/.test(all);
  // See hasLeadershipSchema() — a bare "person" or "itemlist" type match false
  // -positived on article author bylines and unrelated lists.
  const hasBOD        = hasLeadershipSchema(schemas);
  const hasNews       = /\bnewsarticle\b/.test(all);
  const hasEvent      = /\bevent\b/.test(all);
  const hasContact    = /\bcontactpage\b/.test(all);

  const checks = [];

  // ── 1. Organization — required on EVERY page ──────────────────────────────
  checks.push(hasOrg
    ? pass('org-schema', 'Organization Schema',
        'Organization / Business schema detected — establishes brand identity for AI.',
        PRIORITY.HIGH, 'Organization schema present')
    : fail('org-schema', 'Organization Schema',
        'No Organization or LocalBusiness schema found. Required on every page.',
        PRIORITY.HIGH, 'Add Organization schema to establish brand identity.', true, 'Organization'));

  // ── 2. WebSite — required on EVERY page ───────────────────────────────────
  checks.push(hasWebsite
    ? pass('website-schema', 'WebSite Schema',
        'WebSite schema detected — enables sitelinks and brand search entity in AI.',
        PRIORITY.MEDIUM, 'WebSite schema present')
    : fail('website-schema', 'WebSite Schema',
        'No WebSite schema found. Required on every page for sitelinks eligibility.',
        PRIORITY.MEDIUM, 'Add WebSite schema with SearchAction for sitelinks eligibility.', true, 'WebSite'));

  // ── 3. BreadcrumbList — required on non-homepage pages ───────────────────
  if (isHomepage) {
    checks.push(na('breadcrumb-schema', 'Breadcrumb Schema',
      'N/A — Homepage is root domain. No parent breadcrumbs exist.',
      'Breadcrumbs not required on Homepage'));
  } else {
    checks.push(hasBreadcrumb
      ? pass('breadcrumb-schema', 'Breadcrumb Schema',
          'BreadcrumbList schema detected — site hierarchy defined for AI.',
          PRIORITY.MEDIUM, 'Breadcrumb schema present')
      : fail('breadcrumb-schema', 'Breadcrumb Schema',
          'No BreadcrumbList schema detected. Site hierarchy not defined for AI.',
          PRIORITY.MEDIUM, 'Add BreadcrumbList schema for site hierarchy.', true, 'BreadcrumbList'));
  }

  // ── 4. Article / NewsArticle — only when article/news signals detected ────
  if (newsSignal) {
    checks.push(hasNews || hasArticle
      ? pass('news-schema', 'NewsArticle Schema',
          'NewsArticle / Article schema detected — enables Google News & AI coverage.',
          PRIORITY.HIGH, 'NewsArticle schema present')
      : fail('news-schema', 'NewsArticle Schema',
          'News/press release content detected but no NewsArticle schema found.',
          PRIORITY.HIGH, 'Add NewsArticle schema for press releases and media updates.', true, 'NewsArticle'));
  } else if (articleSignal) {
    checks.push(hasArticle
      ? pass('article-schema', 'Article Schema',
          'Article / content schema detected — enables AI content understanding.',
          PRIORITY.HIGH, 'Article schema present')
      : fail('article-schema', 'Article Schema',
          'Editorial content detected but no Article schema found.',
          PRIORITY.HIGH, 'Add Article or BlogPosting schema to help AI engines understand content.', true, 'Article'));
  } else {
    checks.push(na('article-schema', 'Article Schema',
      'N/A — No editorial article content detected on this page.',
      'No article/news content signals found'));
  }

  // ── 5. FAQPage — only when FAQ signals detected ───────────────────────────
  if (faqSignal) {
    checks.push(hasFAQ
      ? pass('faq-schema', 'FAQ Schema',
          'FAQPage schema detected — optimized for voice search and answer engine boxes.',
          PRIORITY.HIGH, 'FAQ schema present')
      : fail('faq-schema', 'FAQ Schema',
          'FAQ / Q&A content detected on the page but no FAQPage schema found.',
          PRIORITY.HIGH, 'Add FAQPage schema to surface Q&A pairs directly in AI answers.', true, 'FAQPage'));
  } else {
    checks.push(na('faq-schema', 'FAQ Schema',
      'N/A — No FAQ or Q&A patterns detected on this page.',
      'No FAQ content signals found'));
  }

  // ── 6. HowTo — only when step-by-step signals detected ───────────────────
  if (howToSignal) {
    checks.push(hasHowTo
      ? pass('howto-schema', 'HowTo Schema',
          'HowTo schema detected — step-by-step instructions defined for AI.',
          PRIORITY.HIGH, 'HowTo schema present')
      : fail('howto-schema', 'HowTo Schema',
          'Step-by-step guide content detected but no HowTo schema found.',
          PRIORITY.HIGH, 'Add HowTo schema to highlight step-by-step guides in AI answers.', true, 'HowTo'));
  } else {
    checks.push(na('howto-schema', 'HowTo Schema',
      'N/A — No step-by-step guide or tutorial content detected.',
      'No HowTo content signals found'));
  }

  // ── 7. Person/ItemList (BOD) — only when leadership signals detected ──────
  if (bodSignal) {
    checks.push(hasBOD
      ? pass('bod-schema', 'Leadership / Person Schema',
          'Person / ItemList schema detected — structured Board of Directors governance.',
          PRIORITY.HIGH, 'Person / ItemList schema present')
      : fail('bod-schema', 'Leadership / Person Schema',
          'Leadership / Board of Directors content detected but no Person or ItemList schema found.',
          PRIORITY.HIGH, 'Add Person schema array for Board of Directors to boost E-E-A-T.', true, 'Organization'));
  } else {
    checks.push(na('bod-schema', 'Leadership / Person Schema',
      'N/A — No Board of Directors or leadership content detected.',
      'No BOD/leadership content signals found'));
  }

  // ── 8. Event — only when event signals detected ───────────────────────────
  if (eventSignal) {
    checks.push(hasEvent
      ? pass('event-schema', 'Event Schema',
          'Event schema detected — events indexed for rich results and AI.',
          PRIORITY.MEDIUM, 'Event schema present')
      : fail('event-schema', 'Event Schema',
          'Event / calendar content detected but no Event schema found.',
          PRIORITY.MEDIUM, 'Add Event schema to enable rich event results in AI engines.', true, 'Event'));
  } else {
    checks.push(na('event-schema', 'Event Schema',
      'N/A — No event or calendar content detected on this page.',
      'No event content signals found'));
  }

  // ── 9. ContactPage — only for dedicated contact pages ────────────────────
  if (pageType === 'contact-us') {
    checks.push(hasContact
      ? pass('contact-schema', 'ContactPage Schema',
          'ContactPage schema detected — verified corporate contact channels established.',
          PRIORITY.HIGH, 'ContactPage schema present')
      : fail('contact-schema', 'ContactPage Schema',
          'Contact page detected but no ContactPage schema found.',
          PRIORITY.HIGH, 'Add ContactPage schema with telephone, email, and address for AI trust.', true, 'Organization'));
  } else {
    checks.push(na('contact-schema', 'ContactPage Schema',
      'N/A — This is not a dedicated contact page.',
      'ContactPage schema N/A for this page type'));
  }

  const checksWithPillar = checks.map(c => ({ ...c, pillarLabel: label }));
  const score = computePillarScore(checksWithPillar);

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

  // 7. Answer-First Structure — is the core answer front-loaded, or buried
  // after a long intro? GEO research finds ~44% of LLM citations are pulled
  // from the first 30% of a page.
  const frontLoaded = checkFrontLoadedAnswer(doc);
  const frontLoadedCheck = frontLoaded.found
    ? pass('front-loaded-answer', 'Answer-First Structure',
        `PASS: A concise, self-contained passage (${frontLoaded.length} chars) appears within the first few paragraphs of the main content.`,
        PRIORITY.HIGH, 'Content opens with a direct answer.')
    : fail('front-loaded-answer', 'Answer-First Structure',
        'No concise, self-contained answer found within the first few paragraphs of the main content.',
        PRIORITY.HIGH,
        'Open with a direct 1-3 sentence answer before adding background, narrative, or scene-setting — AI engines pull most of what they cite from the first ~30% of a page.');

  const checks = [headingCheck, questionCheck, paraCheck, readabilityCheck, searchabilityCheck, visualCheck, frontLoadedCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score = computePillarScore(checks);

  return { id: 'content', label, score, checks, ...PILLAR_WEIGHTS.content };
}

// ─── Pillar: Technical SEO (20%) ─────────────────────────────────────────────
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
  const score = computePillarScore(checks);

  return { id: 'technical', label, score, checks, ...PILLAR_WEIGHTS.technical };
}

// ─── Pillar: E-E-A-T (20%) ───────────────────────────────────────────────────
function auditEEATPillar(doc, meta, bodyText, schemas, pageUrl, signals = {}) {
  const pageType = signals.pageType || 'generic';
  const label = 'E-E-A-T';
  const { all: schemaAll } = schemas;

  const isEditorialPage = ['article', 'news', 'press-release', 'howto', 'generic'].includes(pageType);

  // Only a real, schema-backed Organization/LocalBusiness counts as brand
  // evidence. The previous version also accepted a bare `meta.siteName` (an
  // og:site_name meta tag — present on almost every professionally-built
  // site), which let Author, Expertise, and Trust all pass on brand presence
  // alone. Google's own quality-rater guidelines call Trust "the most
  // important member of the E-E-A-T family... untrustworthy pages have low
  // E-E-A-T no matter how Experienced, Expert, or Authoritative they may
  // seem" — so it should be the hardest pillar to satisfy, not the easiest.
  const hasOrgSchema = /\b(organization|corporation|localbusiness)\b/.test(schemaAll);

  // 1. Author Signals
  const hasAuthorEl = !!(
    doc.querySelector('.author, .byline, [rel="author"], [itemprop="author"], [class*="author-name"], [class*="byline"]')
  );
  // Check the actual parsed JSON-LD objects for an `author` field, not the
  // flat @type-name string (`schemaAll` never contains property names or
  // quote characters at all — a pre-existing regex here tested for them
  // anyway and could never match; fixed while rewriting this check).
  const hasAuthorJSON = schemas.jsonld.some(item => item && item.author) || !!meta.author;

  let authorCheck;
  if (!isEditorialPage) {
    // On Homepage, Product, or FAQ pages, an Organization schema can serve as
    // the publishing authority in place of a byline — but it must actually
    // exist. Previously BOTH branches of this check called pass(), so it
    // could never fail on non-editorial pages regardless of page content.
    authorCheck = (hasAuthorEl || hasAuthorJSON || hasOrgSchema)
      ? pass('author', 'Author / Brand Signals',
          `PASS: Organization schema or author attribution found — establishes publishing authority for ${pageType.toUpperCase()} page.`,
          PRIORITY.MEDIUM, 'Brand attribution is present.')
      : fail('author', 'Author / Brand Signals',
          `No Organization schema and no author byline found on this ${pageType.toUpperCase()} page. AI systems need a clear "who published this" signal even on non-editorial pages.`,
          PRIORITY.MEDIUM,
          'Add Organization schema (or an author byline) so AI systems can attribute this page to a real publisher.',
          true, 'Organization');
  } else {
    // On Editorial pages (Article, Blog, News, HowTo), explicit author bylines are expected
    authorCheck = (hasAuthorEl || hasAuthorJSON)
      ? pass('author', 'Author Signals',
          `PASS: Author elements (.author, .byline, [rel='author']) OR JSON-LD contains 'author' field. Found: ${hasAuthorEl ? 'author element' : 'JSON-LD author'}.`,
          PRIORITY.HIGH, 'Author attribution is present.')
      : fail('author', 'Author Signals',
          "PASS: Author elements (.author, .byline, [rel='author']) OR JSON-LD contains 'author' field. None found.",
          PRIORITY.HIGH,
          "Clear author bylines missing. Add author attribution for editorial content. AI systems use author bylines to assess article credibility.",
          true, 'Article');
  }

  // 2. Expertise Credentials
  const expertiseKeywords = /\b(phd|ph\.d|m\.d|md\b|certified|expert|specialist|award|years of experience|certified by|professional|accredited|licensed|registered|leading|pioneer|global|founded)\b/i;
  const hasExpertiseText = expertiseKeywords.test(bodyText);

  let expertiseCheck;
  if (!isEditorialPage) {
    // Same fix as Author above: this branch previously always passed too.
    expertiseCheck = (hasExpertiseText || hasOrgSchema)
      ? pass('expertise', 'Expertise & Authority',
          `PASS: ${hasExpertiseText ? 'Credential/authority language' : 'Organization schema'} found for ${pageType.toUpperCase()} page.`,
          PRIORITY.MEDIUM, 'Brand expertise & authority present.')
      : fail('expertise', 'Expertise & Authority',
          `No credential/authority language (certified, expert, award, founded, etc.) and no Organization schema found on this ${pageType.toUpperCase()} page.`,
          PRIORITY.MEDIUM,
          'Add concrete authority signals (years in business, certifications, awards) or an Organization schema so AI systems have evidence of legitimacy.');
  } else {
    // On Editorial pages, individual author credentials/degrees boost E-E-A-T
    expertiseCheck = hasExpertiseText
      ? pass('expertise', 'Expertise Credentials',
          "PASS: Text contains professional credentials (phd, md, certified, expert, specialist, award, years of experience).",
          PRIORITY.MEDIUM, 'Expertise signals present.')
      : fail('expertise', 'Expertise Credentials',
          "PASS: Text contains: phd, md, certified, expert, specialist, award, years of experience, certified by. None found.",
          PRIORITY.MEDIUM,
          'Limited author expertise signals. Add credentials, certifications, or experience indicators (e.g., "certified by", "specialist in") to establish authoritativeness.');
  }

  // 3. Trust Signals
  const hasTrustEl = !!(
    doc.querySelector('.review, .testimonial, .security, .ssl, .trust, [class*="review"], [class*="testimonial"], [class*="trust-badge"], [class*="security"]')
  );
  const trustKeywords = /\b(testimonial|review|rated|stars|guarantee|secure|ssl|certified|accredited|award|trusted|verified)\b/i;
  const hasTrustText = trustKeywords.test(bodyText);
  // Deliberately does NOT fall back to hasOrgSchema/brand presence — Trust is
  // the strictest check in this pillar by design (see note above authorCheck).
  const hasTrust = hasTrustEl || hasTrustText;
  const trustCheck = hasTrust
    ? pass('trust', 'Trust Signals',
        `PASS: Trust elements (.review, .testimonial, .security, .ssl) OR trust keywords found in page text.`,
        PRIORITY.HIGH, 'Trust indicators found.')
    : fail('trust', 'Trust Signals',
        "PASS: Trust elements (.testimonial, .review, .security, .ssl) OR text contains trust keywords (testimonial, review, guarantee, secure, verified). None found.",
        PRIORITY.HIGH,
        'Missing trust signals. Add testimonials, reviews, or security badges to build credibility.',
        true);

  // Date freshness now lives in its own pillar — see auditFreshnessPillar().
  // (It was a single check buried here before, and homepage handling used
  // pass() instead of na(), which kept it in the scoring denominator as a
  // guaranteed point rather than genuinely excluding it.)

  // 4. Contact Information
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

  // 5. About Page
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

  const checks = [authorCheck, expertiseCheck, trustCheck, contactCheck, aboutCheck]
    .map(c => ({ ...c, pillarLabel: label }));
  const score = computePillarScore(checks);

  return { id: 'eeat', label, score, checks, ...PILLAR_WEIGHTS.eeat };
}

// ─── Pillar: Content Freshness (10%) ─────────────────────────────────────────
/**
 * Split out of E-E-A-T into its own pillar — freshness was previously a
 * single check buried inside E-E-A-T. AEO/GEO audit frameworks treat
 * freshness as a distinct category (AirOps: 5 dedicated factors; ZipTie
 * treats update timestamps as a maintenance signal separate from authority).
 */
function auditFreshnessPillar(doc, meta, schemas, signals = {}) {
  const label = 'Content Freshness';
  const isHomepage = !!signals.isHomepage;

  if (isHomepage) {
    // Homepage is an evergreen brand portal — publication/update dates aren't
    // a meaningful signal here. Uses na() (properly excluded from scoring)
    // rather than an auto-pass, so the pillar's score stays honest on page
    // types where freshness genuinely does apply.
    const checks = [
      na('date-published', 'Publication Date', 'N/A — Homepage is an evergreen brand portal, not dated content.', 'Not applicable to Homepage'),
      na('date-modified', 'Last Updated Date', 'N/A — Homepage is an evergreen brand portal, not dated content.', 'Not applicable to Homepage'),
      na('date-visible', 'Visible Date on Page', 'N/A — Homepage is an evergreen brand portal, not dated content.', 'Not applicable to Homepage'),
    ].map(c => ({ ...c, pillarLabel: label }));
    return { id: 'freshness', label, score: computePillarScore(checks), checks, ...PILLAR_WEIGHTS.freshness };
  }

  // Look at the actual parsed JSON-LD objects for a datePublished/dateModified
  // field. (The previous version of this check — inherited from the old
  // buried E-E-A-T check — tested the property names against `schemas.all`,
  // which only ever contains @type name tokens like "organization" or
  // "article", never property names or values. That regex could never match
  // anything; it was dead code being carried forward. Since this pillar
  // already receives the full `schemas` object, checking `schemas.jsonld`
  // directly is both correct and no extra cost.)
  const hasDateJSON = schemas.jsonld.some(item => item && (item.datePublished || item.dateModified));
  const publishedCheck = (!!meta.datePublished || hasDateJSON)
    ? pass('date-published', 'Publication Date',
        'PASS: A publication date was found (meta tag, time element, or JSON-LD datePublished).',
        PRIORITY.HIGH, 'Publication date is present.')
    : fail('date-published', 'Publication Date',
        'No publication date found in meta tags, time elements, or JSON-LD.',
        PRIORITY.HIGH,
        'Add a visible and/or structured publication date. AI engines use it to judge how current an answer is.',
        true, 'Article');

  const hasDistinctModified = !!meta.dateModified && meta.dateModified !== meta.datePublished;
  const modifiedCheck = hasDistinctModified
    ? pass('date-modified', 'Last Updated Date',
        `PASS: A distinct dateModified (${meta.dateModified}) shows the content is actively maintained.`,
        PRIORITY.MEDIUM, 'Update date is present.')
    : fail('date-modified', 'Last Updated Date',
        'No distinct "last updated" date found separate from the publish date.',
        PRIORITY.MEDIUM,
        'Add a dateModified value whenever content is revised — AI engines favor recently-maintained sources over stale ones.',
        true, 'Article');

  const hasVisibleDate = !!doc.querySelector('time[datetime], .date, .published, .updated, [class*="date-"], [class*="published"]');
  const visibleCheck = hasVisibleDate
    ? pass('date-visible', 'Visible Date on Page',
        'PASS: A human-visible date element (time, .date, .published, .updated) was found on the page.',
        PRIORITY.LOW, 'Date is visible to readers.')
    : fail('date-visible', 'Visible Date on Page',
        'No visible date element found on the rendered page.',
        PRIORITY.LOW,
        'Show the publish/update date visibly on the page, not just in metadata, so readers and AI summaries can cite it.');

  const checks = [publishedCheck, modifiedCheck, visibleCheck].map(c => ({ ...c, pillarLabel: label }));
  return { id: 'freshness', label, score: computePillarScore(checks), checks, ...PILLAR_WEIGHTS.freshness };
}

// ─── Gate: AI Crawler Access (not weighted — see AI_ACCESS_GATE_FLOOR) ───────
/**
 * Every AEO/GEO audit framework surveyed treats crawler accessibility as a
 * PREREQUISITE, not one more weighted bucket: "if AI crawlers can't access
 * your site, nothing else on this list matters" (ZipTie). So this pillar is
 * still scored and displayed like the others, but it also drives a
 * multiplicative gate applied to the final score in runFullAudit — a page
 * that blocks every tracked AI bot can't hide that behind strong schema or
 * content scores.
 */
function auditAIAccessPillar(doc, meta, robotsInfo) {
  const label = 'AI Crawler Access';
  const checks = [];

  // 1. AI bot access via robots.txt
  if (!robotsInfo.checked) {
    checks.push(pass('robots-ai-access', 'AI Bot Access (robots.txt)',
      'No robots.txt found (or it could not be fetched) — per spec, sites with no robots.txt allow all crawlers by default.',
      PRIORITY.HIGH, 'AI search bots are not blocked.'));
  } else if (robotsInfo.blockedBots.length === 0) {
    checks.push(pass('robots-ai-access', 'AI Bot Access (robots.txt)',
      `robots.txt does not block any of the ${AI_SEARCH_BOTS.length} tracked AI search bots (${robotsInfo.allowedBots.join(', ')}).`,
      PRIORITY.HIGH, 'AI search bots are not blocked.'));
  } else {
    checks.push(fail('robots-ai-access', 'AI Bot Access (robots.txt)',
      `robots.txt blocks ${robotsInfo.blockedBots.length}/${AI_SEARCH_BOTS.length} tracked AI search bots: ${robotsInfo.blockedBots.join(', ')}. A blocked bot cannot crawl or cite this page at all, regardless of on-page quality.`,
      PRIORITY.HIGH,
      `Remove the Disallow rule(s) for ${robotsInfo.blockedBots.join(', ')} in robots.txt. Each blocked AI search bot removes that engine as a citation source entirely.`));
  }

  // 2. Meta robots noindex
  const robotsMeta = (meta.robots || '').toLowerCase();
  const isNoIndex = /noindex/.test(robotsMeta);
  checks.push(!isNoIndex
    ? pass('meta-robots-index', 'Indexability (meta robots)',
        meta.hasMeta.robots ? `Robots meta tag present and does not block indexing ("${meta.robots}").` : 'No robots meta tag — page is indexable by default.',
        PRIORITY.HIGH, 'Page is indexable.')
    : fail('meta-robots-index', 'Indexability (meta robots)',
        `Robots meta tag contains "noindex" ("${meta.robots}") — this blocks the page from every search and AI answer engine.`,
        PRIORITY.HIGH, 'Remove "noindex" from the robots meta tag if this page should be discoverable.'));

  // 3. Content present in raw HTML (no JS execution required)
  const contentCheck = hasSubstantialRawContent(doc);
  checks.push(contentCheck.substantial
    ? pass('raw-html-content', 'Content in Raw HTML',
        `PASS: ${contentCheck.textLength} characters of visible text found in the raw HTML, with no JavaScript execution required.`,
        PRIORITY.HIGH, 'Content is present without client-side rendering.')
    : fail('raw-html-content', 'Content in Raw HTML',
        `Only ${contentCheck.textLength} characters of text found in the raw HTML. Most AI crawlers do not execute JavaScript, so client-rendered content may be invisible to them.`,
        PRIORITY.HIGH,
        'Server-render or statically pre-render the main content so it exists in the initial HTML response, not just after JavaScript runs.'));

  const checksWithPillar = checks.map(c => ({ ...c, pillarLabel: label }));
  return { id: 'ai-access', label, score: computePillarScore(checksWithPillar), checks: checksWithPillar, emoji: '🤖', pct: 'Gate' };
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
  const score = computePillarScore(checks);

  return { id: 'ux', label, score, checks, emoji: '📱', isUX: true };
}
