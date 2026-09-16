import { ArrowLeft, CheckCircle2, ShieldCheck, Zap, Info, Layers, BarChart3, HelpCircle, CheckCircle, XCircle, MinusCircle } from 'lucide-react';

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
          Our Answer Engine Optimization (AEO) assessment uses a 5-pillar, page-type-aware methodology — gated by AI crawler accessibility — to measure how effectively AI search systems (ChatGPT, Perplexity, Google AI Overviews, Bing Copilot) can reach, understand, trust, and cite your website.
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
            When an AI search engine reads your website, it asks four main questions:
          </p>
          <ul className="plain-english-list">
            <li>
              <strong>"Can I even reach this page?"</strong> → Solved by <em>AI Crawler Access</em> — this one is a gate, not just another score, because a blocked bot can't cite you no matter how good the rest of the page is.
            </li>
            <li>
              <strong>"Do I understand what this page is about?"</strong> → Solved by <em>Structured Schema Markup</em>.
            </li>
            <li>
              <strong>"Is the information clearly written, structured, and front-loaded with a direct answer?"</strong> → Solved by <em>Content Structure &amp; Readability</em>.
            </li>
            <li>
              <strong>"Can I trust this business, and is the content current?"</strong> → Solved by <em>E-E-A-T</em>, <em>Content Freshness</em>, and <em>Technical SEO Signals</em>.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Section 2: Audit Status Badges ───────────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Info size={22} className="scoring-icon-accent" />
          Understanding Audit Status Badges
        </h2>
        <p className="scoring-section-desc">
          To ensure complete transparency, our audit engine uses 3 distinct status badges so you know exactly what was found versus what was excluded:
        </p>

        <div className="status-badges-grid">
          <div className="status-badge-card pass-card">
            <div className="status-badge-header">
              <CheckCircle size={18} style={{ color: 'var(--accent-success)' }} />
              <span className="status-pill pass-pill">PASS</span>
            </div>
            <h4>Present &amp; Validated</h4>
            <p>This item was detected directly on your page HTML and meets all AEO standards.</p>
          </div>

          <div className="status-badge-card na-card">
            <div className="status-badge-header">
              <MinusCircle size={18} style={{ color: '#94a3b8' }} />
              <span className="status-pill na-pill">N/A</span>
            </div>
            <h4>Not Applicable (0 Score Penalty)</h4>
            <p>This item is excluded because the underlying content wasn't detected anywhere on the page (e.g. no FAQ content was found, so FAQPage schema is N/A) — or, for Breadcrumbs, because the page is your Homepage. There's no manual page-type selection; every check is auto-detected from the page's own content.</p>
          </div>

          <div className="status-badge-card fail-card">
            <div className="status-badge-header">
              <XCircle size={18} style={{ color: 'var(--accent-danger)' }} />
              <span className="status-pill fail-pill">FAIL</span>
            </div>
            <h4>Required &amp; Missing</h4>
            <p>The underlying content (a FAQ section, a leadership roster, a product listing, etc.) WAS detected on the page, but the matching schema that should describe it is missing or incomplete.</p>
          </div>
        </div>
      </section>

      {/* ── Section 3: 5-Pillar Formula + AI Access Gate ─────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Layers size={22} className="scoring-icon-accent" />
          The AI Crawler Access Gate
        </h2>
        <p className="scoring-section-desc">
          Before anything else is scored, we check whether AI search bots (OpenAI's OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, and others) can actually reach your page — via robots.txt rules, the page's own meta-robots tag, and whether your content exists in the raw HTML without needing JavaScript to run. Every AEO/GEO audit framework we benchmarked against treats this as a prerequisite, not just another bucket to average in: a page blocked from an AI bot can't be cited by it no matter how good everything else is.
        </p>
        <p className="scoring-section-desc">
          So instead of being one more weighted pillar, <strong>AI Crawler Access multiplies the weighted score below</strong> — from ×1.00 when fully accessible down to ×0.25 when every tracked bot is blocked. A blocked page can still show strong pillar scores, but its final grade will reflect that it can't be reached.
        </p>

        <h2 className="scoring-section-title" style={{ marginTop: '32px' }}>
          <Layers size={22} className="scoring-icon-accent" />
          The 5-Pillar Scoring Formula
        </h2>
        <p className="scoring-section-desc">
          Every website audit evaluates 30+ quality components divided into 5 weighted pillars, each check additionally weighted by priority (High/Medium/Low) within its pillar. Measured scores use a <strong>65/100 pass threshold</strong>. Weights are derived from measured AEO/GEO research rather than an even split — see the rationale under each pillar.
        </p>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🗂️</span>
              <div>
                <h3 className="pillar-name">Schema Markup</h3>
                <span className="pillar-weight">25% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              Structured JSON-LD code embedded in your site that gives search engines machine-readable facts about your brand, articles, products, and FAQs. Research shows pages with FAQPage schema are cited ~3.2x more often in AI Overviews.
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
              Heading hierarchy (H1-H6), question-targeting, optimal paragraph lengths (50–200 characters), searchability, and whether the core answer is front-loaded in the opening paragraphs (~44% of LLM citations come from the first 30% of a page).
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🔧</span>
              <div>
                <h3 className="pillar-name">Technical SEO</h3>
                <span className="pillar-weight">20% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              HTTPS security, mobile responsiveness, fast simulated page speed, menu navigation clarity, image alt texts, and ARIA accessibility. Necessary for a good page, but a weaker citation driver than schema or content structure.
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
              Experience, Expertise, Authoritativeness &amp; Trust. Evaluates author bylines, professional credentials, real trust signals (reviews, testimonials, security badges), and contact info. Trust specifically cannot be satisfied by brand presence alone — Google's own quality-rater guidelines call it the hardest-to-fake, most important member of E-E-A-T.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-emoji">🕒</span>
              <div>
                <h3 className="pillar-name">Content Freshness</h3>
                <span className="pillar-weight">10% Weight</span>
              </div>
            </div>
            <p className="pillar-desc">
              Publication date, a distinct "last updated" date, and a human-visible date on the page. AI engines favor recently-maintained sources over stale ones. Not applicable to homepages, which are evergreen brand portals rather than dated content.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Content-Signal-Driven Schema Audit Rules ──────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <ShieldCheck size={22} className="scoring-icon-accent" />
          Content-Signal-Driven Schema Audit Rules
        </h2>
        <p className="scoring-section-desc">
          There is no page-type picker and no fixed per-type checklist. Every page is scanned <strong>once</strong> for every content signal below, independently and simultaneously — a Homepage with both a FAQ section and a leadership roster gets active FAQPage <em>and</em> Person/ItemList checks together, not just Homepage defaults. A signal that isn't found makes its matching schema check <strong>N/A</strong>, not FAIL — you're never penalized for a schema your content doesn't need.
        </p>

        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Content Signal</th>
                <th>How It's Detected</th>
                <th>🔍 Schema Actively Audited When Present</th>
                <th>⚪ Marked N/A When Absent</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div className="page-type-cell"><span>🌐</span> <strong>Every page</strong></div></td>
                <td className="explanation-cell">Always true — there's no detection step.</td>
                <td><span className="schema-pill required">Organization</span><span className="schema-pill required">WebSite</span></td>
                <td className="explanation-cell">Never N/A — required on every page.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>🏠</span> <strong>Not the Homepage</strong></div></td>
                <td className="explanation-cell">URL path is anything other than the site root (<code>/</code>).</td>
                <td><span className="schema-pill required">BreadcrumbList</span></td>
                <td className="explanation-cell">N/A only on the Homepage itself, which has no parent pages to show a hierarchy for.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>📰</span> <strong>Editorial / article content</strong></div></td>
                <td className="explanation-cell">An <code>&lt;article&gt;</code> element, <code>articleBody</code>/<code>.post-content</code> markup, or a byline/publish-date meta tag anywhere on the page.</td>
                <td><span className="schema-pill required">Article</span></td>
                <td className="explanation-cell">N/A when none of those signals are found — regardless of whether the page happens to be a Homepage, product page, etc.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>📺</span> <strong>News / press release content</strong></div></td>
                <td className="explanation-cell">Press-release DOM markers, "press release" / "newsroom" wording in the body text, or a news/press URL path. Takes priority over the generic Article signal above when both are present.</td>
                <td><span className="schema-pill required">NewsArticle</span></td>
                <td className="explanation-cell">N/A when no news/press signal is found.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>❓</span> <strong>FAQ / Q&amp;A content</strong></div></td>
                <td className="explanation-cell"><code>&lt;details&gt;/&lt;summary&gt;</code>, <code>&lt;dl&gt;/&lt;dt&gt;/&lt;dd&gt;</code>, or a question-style heading followed by a substantial answer paragraph — on any page, not just a dedicated FAQ page.</td>
                <td><span className="schema-pill required">FAQPage</span></td>
                <td className="explanation-cell">N/A when no Q&amp;A pattern is found on the page.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>📋</span> <strong>HowTo / step-by-step content</strong></div></td>
                <td className="explanation-cell">An ordered list with 3+ substantial items, or headings like "Step 1", "First", "Next", "Finally".</td>
                <td><span className="schema-pill required">HowTo</span></td>
                <td className="explanation-cell">N/A when no step-by-step pattern is found.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>👔</span> <strong>Leadership / Board of Directors content</strong></div></td>
                <td className="explanation-cell">Director/board-member/leadership DOM markers, "board of directors" wording, or a governance-style URL path.</td>
                <td><span className="schema-pill required">Person / ItemList</span></td>
                <td className="explanation-cell">N/A when no leadership/governance signal is found.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>📅</span> <strong>Event / calendar content</strong></div></td>
                <td className="explanation-cell">Event microdata or JSON-LD, event-card DOM markers, or event wording ("register now", "add to calendar") paired with a date element.</td>
                <td><span className="schema-pill required">Event</span></td>
                <td className="explanation-cell">N/A when no event signal is found.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>🛒</span> <strong>Product / e-commerce content</strong></div></td>
                <td className="explanation-cell">Product microdata, an "Add to cart"/"Buy now" element, or purchase wording paired with a price.</td>
                <td><span className="schema-pill required">Product</span></td>
                <td className="explanation-cell">N/A when no product/purchase signal is found.</td>
              </tr>

              <tr>
                <td><div className="page-type-cell"><span>📞</span> <strong>Dedicated Contact Us page</strong></div></td>
                <td className="explanation-cell">The one check gated on the page's overall auto-detected type, not just a signal: the URL/content pattern must classify the page itself as a Contact Us page.</td>
                <td><span className="schema-pill required">ContactPage</span></td>
                <td className="explanation-cell">N/A on every page that isn't classified as a dedicated Contact Us page — even if it has a phone number or contact link somewhere.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 5: Score Grades & Thresholds ──────────────── */}
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
            <p className="grade-card-desc">Critical technical or schema gaps — or an AI Crawler Access block dragging down an otherwise-decent score. Check the AI Crawler Access section first.</p>
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
