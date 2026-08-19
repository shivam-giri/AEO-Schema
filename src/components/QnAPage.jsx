import { ArrowLeft, HelpCircle, Briefcase, Zap, MessageSquare, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const QA_ITEMS = [
  {
    q: '1. Why do we need an AEO tool when we already use traditional SEO tools like Semrush or Ahrefs?',
    a: 'Traditional SEO tools measure keyword density and backlinks to rank in Google blue links. AEO Studio measures AI Digestibility — whether Large Language Models (LLMs) and RAG search engines can parse structured entity data without hallucinating. It evaluates schema interlinking (@id), direct question-to-answer paragraph formatting, and corporate E-E-A-T signals that traditional SEO tools ignore.'
  },
  {
    q: '2. Is client website data stored on any external database or third-party server?',
    a: 'No. Security and privacy are primary design considerations. All HTML parsing, JSON-LD extraction, and score calculations run entirely client-side in your browser session. No site data, scraped HTML, or client URLs are logged or stored on external servers.'
  },
  {
    q: '3. How does AEO Studio differ from free schema generators found online?',
    a: 'Generic schema generators provide blank, static text templates where developers must manually fill in every field. AEO Studio is automated & content-aware: It fetches live webpage DOMs, extracts brand names, logos, phone numbers, press release dates, and executive leadership rosters, and automatically synthesizes a fully connected Knowledge Graph.'
  },
  {
    q: '4. Why did we customize the tool for News & Media, Contact Us, and Board of Directors (BOD) pages?',
    a: 'Corporate and enterprise clients rely heavily on corporate newsrooms, executive leadership profiles, and headquarters contact portals. By creating dedicated rule sets for NewsArticle, ContactPage, and ItemList (Person/Director profiles), our audits directly address corporate governance and high E-E-A-T authority requirements.'
  },
  {
    q: '5. How is the overall AEO Readiness Score calculated?',
    a: 'The overall score uses a weighted 4-pillar formula: Schema Markup (30%) + Content Structure (25%) + Technical SEO (25%) + E-E-A-T & Trust (20%). Each check is Pass/Fail, and scores use a 65/100 benchmark threshold for AI search engine readiness.'
  },
  {
    q: '6. Why do some checks show "⚪ N/A" instead of PASS or FAIL?',
    a: 'Showing a green PASS for a missing item (like Breadcrumbs on a Homepage) can trick users into thinking it exists on their page. Showing a red FAIL penalizes them for something they do not need. The ⚪ N/A status badge excludes non-applicable items from the score calculation with 0 penalty, providing 100% honest reporting.'
  },
  {
    q: '7. How difficult is it for our development team to implement the generated code?',
    a: 'It takes less than 2 minutes. The tool outputs a single valid <script type="application/ld+json"> block. Developers or CMS managers simply paste it into the <head> of the page HTML or insert it via Google Tag Manager (GTM).'
  },
  {
    q: '8. Which AI platforms and search engines directly benefit from these schemas?',
    a: 'Our schemas adhere strictly to Schema.org and Google Rich Results standards. They directly feed RAG (Retrieval-Augmented Generation) pipelines for Google AI Overviews (SGE), ChatGPT Search, Perplexity AI, Bing Copilot, and Claude.'
  },
  {
    q: '9. How does the tool bypass browser CORS restrictions when fetching live client sites?',
    a: 'Browsers block cross-origin requests by default. AEO Studio incorporates a multi-fallback CORS proxy service (fetchPageHTML) that securely retrieves raw public HTML strings, which are then parsed locally into a clean DOM tree using the native DOMParser() API.'
  },
  {
    q: '10. What is the long-term vision or roadmap for this internal tool?',
    a: 'Potential Phase 2 enhancements include: 1) Bulk Domain Auditing for entire XML sitemaps, 2) PDF Executive Summary Exporters for client decks, and 3) Direct CMS Integration Plugins for WordPress, Sitecore, and headless CMSs.'
  }
];

export default function QnAPage({ onBack }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleQA = (idx) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="scoring-criteria-page qna-page">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <div className="scoring-nav">
        <button className="btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tool
        </button>
        <span className="scoring-nav-badge">Q&amp;A</span>
      </div>

      {/* ── Hero Header ──────────────────────────────────────── */}
      <header className="scoring-header">
        <h1 className="hero-title"><span className="hero-title-gradient">Q&amp;A</span></h1>
      </header>

      <div className="section-divider" />

      {/* ── Section 1: 1-Minute Pitch ─────────────────────────── */}
      <section className="scoring-section">
        <div className="scoring-card plain-english-card">
          <p className="qna-quote">
         
              "As search behavior shifts from traditional Google 'blue links' to conversational AI platforms like 
              <strong> ChatGPT Search, Perplexity AI, Google AI Overviews, and Bing Copilot</strong>, businesses are losing visibility if their websites aren't optimized for AI answer extraction.
            
          </p>
          <p className="qna-quote-sub">
           
              I developed <strong>AEO Studio</strong> — an internal enterprise tool designed to solve this exact challenge. It automates 
              <strong> Answer Engine Optimization (AEO)</strong> by performing 4-pillar readiness audits and generating targeted, machine-readable 
              <strong> JSON-LD schemas</strong> tailored specifically for corporate websites, newsrooms, governance (Board of Directors), and client portals in under 3 seconds."
            
          </p>
        </div>
      </section>

      {/* ── Section 2: Value & Capabilities Table ───────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Briefcase size={22} className="scoring-icon-accent" />
          Core Capabilities &amp; Business Value
        </h2>

        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>What It Does</th>
                <th>Business Impact for Our Org</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Targeted JSON-LD Schema Synthesizer</strong></td>
                <td>Scans live web DOM trees to build valid Organization, NewsArticle, ContactPage, Person (BOD), and FAQPage schemas.</td>
                <td><span className="schema-pill required">Saves 5–10 Hours / Project</span></td>
              </tr>
              <tr>
                <td><strong>4-Pillar AEO Audit Engine</strong></td>
                <td>Evaluates Schema Markup (30%), Content Structure (25%), Technical SEO (25%), and E-E-A-T (20%).</td>
                <td><span className="schema-pill required">Data-Backed Benchmark Score (0–100)</span></td>
              </tr>
              <tr>
                <td><strong>Corporate Page-Type Intelligence</strong></td>
                <td>Dynamically adapts rules for Homepage, News &amp; Media, Contact Us, Board of Directors, and FAQ pages.</td>
                <td><span className="schema-pill required">Fair &amp; Honest Scoring</span></td>
              </tr>
              <tr>
                <td><strong>100% Client-Side Privacy</strong></td>
                <td>All DOM parsing, proxy fetching, and scoring execute locally in the browser session.</td>
                <td><span className="schema-pill required">Zero Server Data Retention</span></td>
              </tr>
              <tr>
                <td><strong>1-Click Report Exporter</strong></td>
                <td>Generates instant text/markdown audit summaries with priority recommendations.</td>
                <td><span className="schema-pill required">Client Deliverable Ready</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: 10 Q&A Accordions ────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <HelpCircle size={22} className="scoring-icon-accent" />
          Top 10 Q&amp;A
        </h2>
        <p className="scoring-section-desc">
          Click any question below to reveal the exact technical &amp; business response to present to your leadership:
        </p>

        <div className="doc-module-list">
          {QA_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="scoring-card doc-module-card qna-card" onClick={() => toggleQA(idx)}>
                <div className="doc-module-header qna-card-header">
                  <h3 className="qna-card-title">
                    {item.q}
                  </h3>
                  <div className={`chevron-btn ${isOpen ? 'open' : ''}`} aria-hidden="true">
                    <ChevronDown size={18} />
                  </div>
                </div>
                {isOpen && (
                  <p className="qna-card-body">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <div className="scoring-cta-box">
        <h3>Ready to Demo AEO Studio?</h3>
        <p>Run a live 3-second audit or generate AEO schemas for your website now.</p>
        <button className="btn-primary analyze-btn" onClick={onBack}>
          <Zap size={18} /> Launch Tool &amp; Live Demo
        </button>
      </div>
    </div>
  );
}
