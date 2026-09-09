import {
  ArrowLeft,
  FileCode2,
  GitBranch,
  Layers,
  Cpu,
  ArrowRight,
  Database,
  Search,
  Globe,
  FileText,
  MessageSquare,
  ShoppingBag,
  User,
  Phone,
  List,
  HelpCircle,
  Workflow,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ── Content Signals → Schema matrix data ─────────────────────────────────────
const SIGNAL_MATRIX = [
  {
    signal: 'Always (every page)',
    icon: Globe,
    color: '#6366f1',
    schemas: ['Organization', 'WebSite'],
    note: 'Foundation schemas on every page — brand identity and sitelinks eligibility.',
  },
  {
    signal: 'Non-homepage pages',
    icon: List,
    color: '#8b5cf6',
    schemas: ['BreadcrumbList'],
    note: 'Skipped on the root homepage — home has no parent breadcrumbs.',
  },
  {
    signal: 'Article / editorial signals',
    icon: FileText,
    color: '#ec4899',
    schemas: ['Article'],
    note: 'Triggered by <article>, .post-content, datePublished, or author meta.',
  },
  {
    signal: 'News / press release signals',
    icon: Search,
    color: '#f43f5e',
    schemas: ['NewsArticle'],
    note: 'Triggered by URL patterns (news, press-release) or DOM class .press-release.',
  },
  {
    signal: 'FAQ / Q&A signals',
    icon: HelpCircle,
    color: '#10b981',
    schemas: ['FAQPage'],
    note: 'Triggered by <details>, <dt>/<dd>, or headings matching question patterns.',
  },
  {
    signal: 'Step-by-step / HowTo signals',
    icon: Workflow,
    color: '#06b6d4',
    schemas: ['HowTo'],
    note: 'Triggered by <ol> with 3+ items or headings matching Step N / First / Next patterns.',
  },
  {
    signal: 'Leadership / BOD signals',
    icon: User,
    color: '#f59e0b',
    schemas: ['ItemList (Persons)'],
    note: 'Triggered by .director, .leadership, .board-member classes or governance keywords.',
  },
  {
    signal: 'Event / calendar signals',
    icon: MessageSquare,
    color: '#a855f7',
    schemas: ['Event'],
    note: 'Triggered by [class*="event"], time[datetime] clusters, or keywords like RSVP, venue.',
  },
  {
    signal: 'Product / e-commerce signals',
    icon: ShoppingBag,
    color: '#f97316',
    schemas: ['Product'],
    note: 'Triggered by [itemprop="price"], .price, add-to-cart, or buy-now elements.',
  },
  {
    signal: 'Dedicated contact page',
    icon: Phone,
    color: '#14b8a6',
    schemas: ['ContactPage'],
    note: 'Only added when page type is contact-us (URL or DOM pattern match).',
  },
];

// ── Generator function descriptions ─────────────────────────────────────────
const GENERATORS = [
  {
    fn: 'generateOrganizationSchema()',
    schema: 'Organization',
    source: 'extractOrganization()',
    fields: 'name, url, logo, telephone, email, address, sameAs (socials)',
    impact: 3,
    color: '#6366f1',
  },
  {
    fn: 'generateWebSiteSchema()',
    schema: 'WebSite',
    source: 'meta + SearchAction template',
    fields: 'name, url, description, potentialAction (SearchAction)',
    impact: 3,
    color: '#8b5cf6',
  },
  {
    fn: 'generateArticleSchema()',
    schema: 'Article',
    source: 'meta (author, datePublished, image)',
    fields: 'headline, author, publisher, datePublished, mainEntityOfPage',
    impact: 4,
    color: '#ec4899',
  },
  {
    fn: 'generateNewsArticleSchema()',
    schema: 'NewsArticle',
    source: 'meta + defaults to today\'s date',
    fields: 'headline, author, publisher, datePublished, mainEntityOfPage',
    impact: 5,
    color: '#f59e0b',
  },
  {
    fn: 'generateFAQSchema()',
    schema: 'FAQPage',
    source: 'checkFAQPatterns() → H2/H3 headings → meta.title fallback',
    fields: 'mainEntity [ Question + Answer pairs ]',
    impact: 5,
    color: '#10b981',
  },
  {
    fn: 'generateHowToSchema()',
    schema: 'HowTo',
    source: 'checkHowToPatterns() → <ol> items / step headings',
    fields: 'name, description, step [ HowToStep: position, name, text ]',
    impact: 4,
    color: '#06b6d4',
  },
  {
    fn: 'generateBreadcrumbSchema()',
    schema: 'BreadcrumbList',
    source: 'extractBreadcrumbs() → URL pathname fallback',
    fields: 'itemListElement [ position, name, item URL ]',
    impact: 2,
    color: '#14b8a6',
  },
  {
    fn: 'generateContactPageSchema()',
    schema: 'ContactPage',
    source: 'org (phone, email, address)',
    fields: 'name, url, mainEntity (Organization with ContactPoint)',
    impact: 4,
    color: '#06b6d4',
  },
  {
    fn: 'generateBODSchema()',
    schema: 'ItemList',
    source: '.director / .leadership / .board-member CSS selectors',
    fields: 'itemListElement [ Person with name, jobTitle, worksFor ]',
    impact: 5,
    color: '#f97316',
  },
  {
    fn: 'generateEventSchema()',
    schema: 'Event',
    source: '[class*="event"] elements + time[datetime] + org',
    fields: 'name, startDate, location (Place), organizer, url',
    impact: 4,
    color: '#a855f7',
  },
  {
    fn: 'generateProductSchema()',
    schema: 'Product',
    source: 'extractProduct() — itemprop, .price, meta',
    fields: 'name, description, brand, offers (Offer with price)',
    impact: 4,
    color: '#f43f5e',
  },
];

// ── Fallback chains data ─────────────────────────────────────────────────────
const FALLBACKS = [
  {
    schema: 'FAQPage',
    icon: HelpCircle,
    chain: [
      'checkFAQPatterns() — <details>, <dt>/<dd>, [class*="faq"]',
      'H2/H3 headings → next sibling as answer',
      'meta.title as question + meta.description as answer',
    ],
  },
  {
    schema: 'BreadcrumbList',
    icon: List,
    chain: [
      'extractBreadcrumbs() — DOM nav breadcrumb elements',
      'Parse URL pathname into segments (e.g. /blog/post → Home › Blog › Post)',
      'Always produces at least [ Home ] + page title',
    ],
  },
  {
    schema: 'Organization',
    icon: Database,
    chain: [
      'extractOrganization() — JSON-LD / microdata / itemprop',
      'meta.siteName from OG tags / <meta name="application-name">',
      'URL hostname as final fallback',
    ],
  },
];

// ── Pipeline steps ───────────────────────────────────────────────────────────
const PIPELINE = [
  { step: '01', label: 'Fetch HTML', icon: Globe, desc: 'Express proxy / Vercel serverless function fetches raw HTML, bypassing browser CORS.' },
  { step: '02', label: 'Parse DOM', icon: Cpu, desc: 'htmlParser.js creates an in-memory DOM from the HTML string for querying.' },
  { step: '03', label: 'Extract Meta', icon: Search, desc: 'Meta tags, OG tags, canonical URL, author, dates, schema types, socials, and breadcrumbs are extracted.' },
  { step: '04', label: 'Detect All Signals', icon: GitBranch, desc: 'detectAllContentSignals() scans the entire page — not just the URL — to detect every content type present: FAQ, BOD, Events, Articles, News, Products, HowTo, and more.' },
  { step: '05', label: 'Accumulate Schemas', icon: Layers, desc: 'For every signal detected, the corresponding schema generator is invoked. A homepage with a FAQ section and a leadership listing gets Organization + WebSite + FAQPage + ItemList — not just homepage defaults.' },
  { step: '06', label: 'Generate JSON-LD', icon: FileCode2, desc: 'Template generator functions fill extracted data into schema.org-compliant JSON-LD objects.' },
  { step: '07', label: 'Score & Return', icon: CheckCircle2, desc: 'AEO readiness score is calculated using only metrics relevant to the detected signals, and all schemas + scores are returned to the UI.' },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function SchemaGenerationPage({ onBack }) {
  return (
    <div className="scoring-criteria-page">
      {/* ── Top Bar ── */}
      <div className="scoring-nav">
        <button className="btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tool
        </button>
        <span className="scoring-nav-badge">Schema Generation Engine</span>
      </div>

      {/* ── Hero Header ── */}
      <header className="scoring-header">
        <div className="hero-badge">
          <FileCode2 size={14} /> Schema Generation
        </div>
        <h1 className="hero-title">
          How <span className="hero-title-gradient">Schemas Are Generated</span>
        </h1>
        <p className="hero-subtitle">
          AEO Studio scans every content type present on your page — FAQ sections, leadership
          listings, event calendars, articles, and more — and generates a schema for each one
          found. No manual page type selection needed. Schemas are driven entirely by what's
          actually in the DOM.
        </p>
      </header>

      <div className="section-divider" />

      {/* ── Section 1: Pipeline ── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Workflow size={22} className="scoring-icon-accent" />
          End-to-End Generation Pipeline
        </h2>
        <p className="scoring-section-desc">
          Every URL you submit goes through a 7-stage pipeline before a single line of JSON-LD is produced.
        </p>

        <div className="pipeline-steps">
          {PIPELINE.map((s, i) => {
            const Icon = s.icon;
            return (
              <div className="pipeline-step" key={s.step}>
                <div className="pipeline-step-left">
                  <div className="pipeline-step-num">{s.step}</div>
                  {i < PIPELINE.length - 1 && <div className="pipeline-step-line" />}
                </div>
                <div className="pipeline-step-body">
                  <div className="pipeline-step-header">
                    <Icon size={16} className="scoring-icon-accent" />
                    <strong>{s.label}</strong>
                  </div>
                  <p className="pipeline-step-desc">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 2: Page Type → Schema Matrix ── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <GitBranch size={22} className="scoring-icon-accent" />
          Content Signal → Schema Matrix
        </h2>
        <p className="scoring-section-desc">
          Instead of a fixed page-type dropdown, the engine scans the page for every content signal
          present and generates a schema for each one detected. A homepage with a FAQ section and a
          BOD listing gets <strong>all three</strong> — not just the homepage defaults.
        </p>

        <div className="schema-matrix-grid">
          {SIGNAL_MATRIX.map((row) => {
            const Icon = row.icon;
            return (
              <div className="schema-matrix-card" key={row.signal}>
                <div className="schema-matrix-header">
                  <span className="schema-matrix-icon" style={{ background: row.color + '22', color: row.color }}>
                    <Icon size={18} />
                  </span>
                  <span className="schema-matrix-type">{row.signal}</span>
                </div>
                <div className="schema-matrix-schemas">
                  {row.schemas.map((s) => (
                    <span key={s} className="schema-tag">{s}</span>
                  ))}
                </div>
                <p className="schema-matrix-note">
                  <AlertCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', opacity: 0.6 }} />
                  {row.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 3: Generator Functions ── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <FileCode2 size={22} className="scoring-icon-accent" />
          Generator Functions
        </h2>
        <p className="scoring-section-desc">
          Each schema type has a dedicated template function. These are pure functions that take
          extracted signals and return a fully populated schema.org JSON-LD object.
        </p>

        <div className="generators-list">
          {GENERATORS.map((g) => (
            <div className="generator-card" key={g.fn}>
              <div className="generator-card-left" style={{ borderColor: g.color }}>
                <span className="generator-schema-type" style={{ color: g.color }}>{g.schema}</span>
                <span className="generator-impact-badge" title="AEO Impact Score">
                  ★ {g.impact}/5
                </span>
              </div>
              <div className="generator-card-body">
                <code className="generator-fn">{g.fn}</code>
                <div className="generator-meta">
                  <span className="generator-source-label">Data source:</span>
                  <span className="generator-source">{g.source}</span>
                </div>
                <div className="generator-meta">
                  <span className="generator-source-label">Fields:</span>
                  <span className="generator-source">{g.fields}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 4: Fallback Chains ── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Layers size={22} className="scoring-icon-accent" />
          Smart Fallback Chains
        </h2>
        <p className="scoring-section-desc">
          The generator never produces an empty or broken schema. If extracted data is missing,
          it falls back through a cascade of alternatives until a valid value is found.
        </p>

        <div className="fallbacks-grid">
          {FALLBACKS.map((fb) => {
            const Icon = fb.icon;
            return (
              <div className="fallback-card scoring-card" key={fb.schema}>
                <div className="fallback-header">
                  <Icon size={18} className="scoring-icon-accent" />
                  <strong>{fb.schema}</strong>
                </div>
                <ol className="fallback-chain">
                  {fb.chain.map((step, i) => (
                    <li key={i} className="fallback-chain-step">
                      <span className="fallback-chain-num">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 5: Output Format ── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Database size={22} className="scoring-icon-accent" />
          Output Format
        </h2>
        <p className="scoring-section-desc">
          <code className="generator-fn">generateAEOSchemas()</code> returns a structured object with four properties:
        </p>

        <div className="scoring-card plain-english-card" style={{ marginTop: 16 }}>
          <pre className="output-code-block">{`{
  schemas:  SchemaResult[],   // All schemas generated for signals found on this page
  score:    AEOScore,         // Signal-filtered readiness score (0–100) with per-metric breakdown
  meta:     PageMeta,         // Extracted meta — title, description, OG tags, canonical, author, dates
  pageType: string,           // Primary detected page type ('homepage' | 'article' | 'faq' | …)
  signals:  ContentSignals    // Full signal object — all boolean flags + extracted data
}`}</pre>
          <p style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
            Each schema object in the <code>schemas</code> array contains <code>type</code>, <code>label</code>,
            <code> description</code>, <code>impact</code> (1–5 AEO relevance), and the raw <code>schema</code> JSON-LD
            object ready to be injected into a <code>&lt;script type="application/ld+json"&gt;</code> tag.
          </p>
        </div>
      </section>
    </div>
  );
}
