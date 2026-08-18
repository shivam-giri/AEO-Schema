import { ArrowLeft, CheckCircle2, ShieldCheck, Zap, Info, Layers, BarChart3, HelpCircle } from 'lucide-react';

export default function ScoringCriteriaPage({ onBack }) {
  return (
    <div className="scoring-criteria-page">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <div className="scoring-nav">
        <button className="btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tool
        </button>
        <span className="scoring-nav-badge">Documentation</span>
      </div>

      {/* ── Hero Header ──────────────────────────────────────── */}
      <header className="scoring-header">
        <div className="hero-badge">
          <BarChart3 size={14} /> Methodology &amp; Scoring Criteria
        </div>
        <h1 className="hero-title">
          How Your <span className="hero-title-gradient">AEO Score</span> is Calculated
        </h1>
        <p className="hero-subtitle">
          Our Answer Engine Optimization (AEO) assessment uses a 4-pillar, page-type-aware methodology to measure how effectively AI search systems (ChatGPT, Perplexity, Google SGE, Bing Copilot) can understand, trust, and cite your website.
        </p>
      </header>

      <div className="section-divider" />

      {/* ── Section 1: Non-Technical Primer ───────────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <HelpCircle size={22} className="scoring-icon-accent" />
          What is AEO and Why Does it Matter?
        </h2>
        <div className="scoring-card plain-english-card">
          <p>
            Traditional SEO focuses on getting your website to rank in a list of blue links on Google. 
            <strong> Answer Engine Optimization (AEO)</strong> prepares your content for AI search engines that answer users directly in paragraphs, bullet points, and voice answers.
          </p>
          <p style={{ marginTop: '12px' }}>
            When an AI search engine reads your website, it asks three main questions:
          </p>
          <ul className="plain-english-list">
            <li>
              <strong>"Do I understand what this page is about?"</strong> → Solved by <em>Structured Schema Markup</em>.
            </li>
            <li>
              <strong>"Is the information clearly written and structured?"</strong> → Solved by <em>Content Structure &amp; Readability</em>.
            </li>
            <li>
              <strong>"Can I trust this business as a credible source?"</strong> → Solved by <em>E-E-A-T &amp; Technical SEO Signals</em>.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Section 2: 4-Pillar Formula ────────────────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Layers size={22} className="scoring-icon-accent" />
          The 4-Pillar Scoring Formula
        </h2>
        <p className="scoring-section-desc">
          Every website audit evaluates 30+ quality components divided into 4 weighted pillars. Measured scores use a <strong>65/100 pass threshold</strong>.
        </p>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🗂️</span>
              <div>
                <h3 className="pillar-name">Schema Markup</h3>
                <span className="pillar-weight">30% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              Structured JSON-LD code embedded in your site that gives search engines machine-readable facts about your brand, articles, products, and FAQs.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">📝</span>
              <div>
                <h3 className="pillar-name">Content Structure</h3>
                <span className="pillar-weight">25% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              Heading hierarchy (H1-H6), direct question-targeting in headlines, optimal paragraph lengths (50–200 characters), and searchability.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🔧</span>
              <div>
                <h3 className="pillar-name">Technical SEO</h3>
                <span className="pillar-weight">25% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              HTTPS security, mobile responsiveness, fast simulated page speed, menu navigation clarity, image alt texts, and ARIA accessibility.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🏆</span>
              <div>
                <h3 className="pillar-name">E-E-A-T &amp; Trust</h3>
                <span className="pillar-weight">20% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              Experience, Expertise, Authoritativeness, &amp; Trust. Evaluates author bylines, professional credentials, trust badges, content freshness, and contact info.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Page Type vs Schema Matrix Table ──────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <ShieldCheck size={22} className="scoring-icon-accent" />
          Page Type &amp; Targeted Schema Audit Rules
        </h2>
        <p className="scoring-section-desc">
          Different pages serve different purposes. Our engine does <strong>NOT</strong> penalize pages for schemas they do not need. Below is the exact rule matrix used for auditing and schema generation:
        </p>

        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Page Type</th>
                <th>🔍 Actively Audited (Required Schemas)</th>
                <th>✅ Automatically Passed (N/A Schemas)</th>
                <th>Why It's Marked N/A (Non-Technical Explanation)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>🏠</span> <strong>Homepage</strong>
                  </div>
                </td>
                <td>
                  <span className="schema-pill required">Organization</span>
                  <span className="schema-pill required">WebSite</span>
                </td>
                <td>
                  <span className="schema-pill pass-na">BreadcrumbList</span>
                  <span className="schema-pill pass-na">Article</span>
                  <span className="schema-pill pass-na">FAQPage</span>
                </td>
                <td className="explanation-cell">
                  A Homepage is the main entry door (`/`) of your site. It has no parent pages, so <strong>Breadcrumb navigation is not required</strong>. Its job is to declare brand identity (`Organization` &amp; `WebSite`).
                </td>
              </tr>

              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>🛍️</span> <strong>Product Page</strong>
                  </div>
                </td>
                <td>
                  <span className="schema-pill required">Product</span>
                  <span className="schema-pill required">Offer / Price</span>
                  <span className="schema-pill required">BreadcrumbList</span>
                </td>
                <td>
                  <span className="schema-pill pass-na">Article</span>
                  <span className="schema-pill pass-na">FAQPage</span>
                </td>
                <td className="explanation-cell">
                  E-commerce item pages focus on price, availability, and category path. They use `Product` schema as their primary entity rather than blog article metadata.
                </td>
              </tr>

              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>❓</span> <strong>FAQ Page</strong>
                  </div>
                </td>
                <td>
                  <span className="schema-pill required">FAQPage</span>
                  <span className="schema-pill required">Question / Answer</span>
                  <span className="schema-pill required">BreadcrumbList</span>
                </td>
                <td>
                  <span className="schema-pill pass-na">Article</span>
                  <span className="schema-pill pass-na">Product</span>
                </td>
                <td className="explanation-cell">
                  Dedicated Q&amp;A pages provide direct answers for voice search and AI snippets. `FAQPage` schema is their main entity.
                </td>
              </tr>

              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>📝</span> <strong>HowTo Guide</strong>
                  </div>
                </td>
                <td>
                  <span className="schema-pill required">HowTo / Steps</span>
                  <span className="schema-pill required">BreadcrumbList</span>
                  <span className="schema-pill required">Organization</span>
                </td>
                <td>
                  <span className="schema-pill pass-na">Product</span>
                  <span className="schema-pill pass-na">FAQPage</span>
                </td>
                <td className="explanation-cell">
                  Tutorials focus on step-by-step procedure execution. `HowTo` schema outlines the exact steps for AI assistants.
                </td>
              </tr>

              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>📰</span> <strong>Article / Blog</strong>
                  </div>
                </td>
                <td>
                  <span className="schema-pill required">Article</span>
                  <span className="schema-pill required">BreadcrumbList</span>
                  <span className="schema-pill required">Organization</span>
                </td>
                <td>
                  <span className="schema-pill pass-na">Product</span>
                </td>
                <td className="explanation-cell">
                  Blog posts and news articles require clear author bylines, publication dates, and hierarchy breadcrumbs for credibility.
                </td>
              </tr>

              <tr>
                <td>
                  <div className="page-type-cell">
                    <span>✨</span> <strong>Auto-Detect</strong>
                  </div>
                </td>
                <td colSpan="3" className="explanation-cell">
                  Automatically inspects HTML meta tags, DOM containers (<code>&lt;article&gt;</code>, <code>.price</code>, <code>&lt;details&gt;</code>), and URL path to select the optimal rule set above.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 4: Score Grades & Thresholds ──────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <CheckCircle2 size={22} className="scoring-icon-accent" />
          Score Thresholds &amp; Grades
        </h2>
        <div className="grades-grid">
          <div className="grade-card grade-excellent">
            <span className="grade-card-score">80 – 100</span>
            <span className="grade-card-label">Excellent</span>
            <p className="grade-card-desc">Fully optimized for AI answer engines, voice search, and featured snippets.</p>
          </div>

          <div className="grade-card grade-good">
            <span className="grade-card-score">65 – 79</span>
            <span className="grade-card-label">Good</span>
            <p className="grade-card-desc">Solid technical &amp; content foundation. Minor schema additions will boost rankings.</p>
          </div>

          <div className="grade-card grade-fair">
            <span className="grade-card-score">40 – 64</span>
            <span className="grade-card-label">Fair</span>
            <p className="grade-card-desc">Lacks essential structured data or question targeting. Needs improvement.</p>
          </div>

          <div className="grade-card grade-poor">
            <span className="grade-card-score">0 – 39</span>
            <span className="grade-card-label">Poor</span>
            <p className="grade-card-desc">Critical technical or schema gaps preventing AI crawlers from indexing effectively.</p>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <div className="scoring-cta-box">
        <h3>Ready to Audit or Generate Schemas for Your Website?</h3>
        <p>Run a free instant audit or generate AEO-optimized JSON-LD schemas tailored to your page type.</p>
        <button className="btn-primary analyze-btn" onClick={onBack}>
          <Zap size={18} /> Test Your Page Now
        </button>
      </div>
    </div>
  );
}
