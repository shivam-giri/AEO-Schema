import { ArrowLeft, BookOpen, Cpu, Zap, Search, ShieldCheck, FileCode, CheckCircle2, ArrowRight, Sparkles, Bot, Brain } from 'lucide-react';

export default function DocumentationPage({ onBack }) {
  return (
    <div className="scoring-criteria-page documentation-page">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <div className="scoring-nav">
        <button className="btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tool
        </button>
        <span className="scoring-nav-badge">App Architecture &amp; Workflow</span>
      </div>

      {/* ── Hero Header ──────────────────────────────────────── */}
      <header className="scoring-header">
        <div className="hero-badge">
          <BookOpen size={14} /> How AEO Studio Works
        </div>
        <h1 className="hero-title">
          System Architecture &amp; <span className="hero-title-gradient">Workflow Guide</span>
        </h1>
        <p className="hero-subtitle">
          Understand the end-to-end technical pipeline behind AEO Studio — from CORS-bypassing HTML fetching to DOM parsing, targeted JSON-LD schema generation, AI search engine emulation, and 4-pillar AEO audits.
        </p>
      </header>

      <div className="section-divider" />

      {/* ── Section: How AI is Used ────────────────────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Brain size={22} className="scoring-icon-accent" />
          How We Use AI in AEO Studio
        </h2>
        <p className="scoring-section-desc">
          AEO Studio does not just generate code — it emulates how Large Language Models (LLMs) and Retrieval-Augmented Generation (RAG) pipelines parse and cite web content.
        </p>

        <div className="pillars-grid ai-use-grid">
          <div className="pillar-card">
            <div className="pillar-header">
              <Bot size={24} className="scoring-icon-accent" />
              <div>
                <h3 className="pillar-name">1. AI Search Engine Emulation</h3>
                <span className="pillar-weight">RAG Simulation</span>
              </div>
            </div>
            <p className="pillar-desc">
              Simulates how AI engines like <strong>ChatGPT Search, Perplexity AI, Google SGE, Bing Copilot, and Claude</strong> extract information. It checks whether your content is structured cleanly for LLM crawlers to ingest without hallucinating.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <Sparkles size={24} className="scoring-icon-accent" />
              <div>
                <h3 className="pillar-name">2. NLP Q&amp;A Pattern Recognition</h3>
                <span className="pillar-weight">Semantic Natural Language</span>
              </div>
            </div>
            <p className="pillar-desc">
              Uses Natural Language Processing (NLP) heuristics to scan headlines and paragraphs. It automatically detects implicit question-and-answer pairs (<em>"What is...", "How to...", "Why choose..."</em>) even if no explicit HTML tags exist.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <FileCode size={24} className="scoring-icon-accent" />
              <div>
                <h3 className="pillar-name">3. AI Knowledge Graph Synthesis</h3>
                <span className="pillar-weight">JSON-LD Machine Entities</span>
              </div>
            </div>
            <p className="pillar-desc">
              Synthesizes JSON-LD structured data graphs with `@context`, `@type`, and entity links (`sameAs`, `@id`). This establishes your brand in AI Knowledge Panels and gives LLMs verifiable facts.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <CheckCircle2 size={24} className="scoring-icon-accent" />
              <div>
                <h3 className="pillar-name">4. Page-Type-Tailored AI Scoring</h3>
                <span className="pillar-weight">Smart Contextual Audit</span>
              </div>
            </div>
            <p className="pillar-desc">
              Adapts scoring dynamically based on whether you are auditing a Homepage, Article, Product, FAQ, or HowTo guide — ensuring scores reflect how AI crawlers evaluate that specific page type.
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 1: Workflow Visual Diagram ───────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <Cpu size={22} className="scoring-icon-accent" />
          The 6-Step AEO Processing Pipeline
        </h2>
        <p className="scoring-section-desc">
          When you enter any webpage URL, AEO Studio executes a 6-phase analysis and generation sequence in under 3 seconds:
        </p>

        <div className="pipeline-flow-grid">
          <div className="pipeline-step-card">
            <div className="pipeline-step-num">01</div>
            <div className="pipeline-step-content">
              <h3>URL Input &amp; Validation</h3>
              <p>Normalizes inputs (`example.com` ➔ `https://example.com`), verifies protocol security, and strips tracking parameters.</p>
            </div>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">02</div>
            <div className="pipeline-step-content">
              <h3>Proxy Fetch &amp; DOM Parsing</h3>
              <p>Fetches raw HTML via secure CORS proxy, handling server responses, redirection, and converting strings into a live DOM tree.</p>
            </div>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">03</div>
            <div className="pipeline-step-content">
              <h3>Page Type Classification</h3>
              <p>Runs a 4-step waterfall algorithm (OpenGraph, DOM elements, microdata, URL path) or applies your manual Page Type selection.</p>
            </div>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">04</div>
            <div className="pipeline-step-content">
              <h3>Targeted Schema Extraction</h3>
              <p>Extracts metadata, headings, Q&amp;A pairs, author dates, and breadcrumbs to build valid, compliant JSON-LD schemas with fallbacks.</p>
            </div>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">05</div>
            <div className="pipeline-step-content">
              <h3>4-Pillar AEO Audit</h3>
              <p>Evaluates Schema Markup (30%), Content Structure (25%), Technical SEO (25%), and E-E-A-T (20%) against a 65/100 threshold.</p>
            </div>
          </div>

          <div className="pipeline-step-card">
            <div className="pipeline-step-num">06</div>
            <div className="pipeline-step-content">
              <h3>Smart Recommendations</h3>
              <p>Generates priority-badged recommendations with 1-click CTA buttons to fix missing schemas instantly in Schema Generator mode.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Detailed Phase Breakdown ──────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <FileCode size={22} className="scoring-icon-accent" />
          Detailed Module Breakdown
        </h2>

        <div className="doc-module-list">
          <div className="scoring-card doc-module-card">
            <div className="doc-module-header">
              <span className="doc-module-badge">Module 1</span>
              <h3>HTML Fetching &amp; CORS Proxy Service</h3>
            </div>
            <p>
              Web browsers prevent direct cross-origin HTTP requests (CORS restrictions). AEO Studio uses a multi-fallback proxy service to retrieve public web pages safely.
            </p>
            <div className="doc-code-block">
              <code>fetchPageHTML(url) ➔ CORS Proxy ➔ Raw HTML String ➔ DOMParser()</code>
            </div>
          </div>

          <div className="scoring-card doc-module-card">
            <div className="doc-module-header">
              <span className="doc-module-badge">Module 2</span>
              <h3>Targeted JSON-LD Schema Synthesizer</h3>
            </div>
            <p>
              Unlike generic schema generators that push empty templates, AEO Studio inspects real DOM content to generate tailored JSON-LD markup:
            </p>
            <ul className="plain-english-list">
              <li><strong>Organization Schema:</strong> Pulls site name, logo, phone, address, and social profiles (`sameAs`).</li>
              <li><strong>Article Schema:</strong> Extracts headline, author bylines, publisher, datePublished, and mainEntityOfPage.</li>
              <li><strong>FAQPage Schema:</strong> Scans <code>&lt;details&gt;/&lt;summary&gt;</code>, <code>.faq</code> containers, and heading-paragraph Q&amp;A patterns.</li>
              <li><strong>BreadcrumbList Schema:</strong> Maps breadcrumb items or synthesizes path hierarchy (`Home › Category › Page`).</li>
            </ul>
          </div>

          <div className="scoring-card doc-module-card">
            <div className="doc-module-header">
              <span className="doc-module-badge">Module 3</span>
              <h3>4-Pillar AEO Scoring &amp; Audit Engine</h3>
            </div>
            <p>
              Evaluates 30 components using clear Pass/Fail criteria tailored to the active Page Type:
            </p>
            <ul className="plain-english-list">
              <li><strong>Schema Markup (30%):</strong> Verifies required schemas for the page type. On Homepages, Breadcrumb &amp; Article schemas are marked <strong>PASS (N/A)</strong>.</li>
              <li><strong>Content Structure (25%):</strong> Checks single H1 tag, headline question words (`what`, `how`, `why`), paragraph lengths (50–200 chars), and Flesch-Kincaid readability.</li>
              <li><strong>Technical SEO (25%):</strong> Checks HTTPS, mobile viewport, resource counts (CSS ≤5, Scripts ≤10), nav links, and accessibility.</li>
              <li><strong>E-E-A-T (20%):</strong> Checks author attribution, credentials (`phd`, `certified`, `expert`), trust badges (`testimonials`, `ssl`), and contact details.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 3: Frequently Asked Questions ──────────────── */}
      <section className="scoring-section">
        <h2 className="scoring-section-title">
          <ShieldCheck size={22} className="scoring-icon-accent" />
          Frequently Asked Questions
        </h2>

        <div className="doc-faq-grid">
          <div className="scoring-card doc-faq-card">
            <h4>How do I test the generated JSON-LD code?</h4>
            <p>
              Copy the JSON-LD script block from Schema Generator mode and paste it directly into <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">Google Rich Results Test</a> or <a href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">Schema.org Validator</a>.
            </p>
          </div>

          <div className="scoring-card doc-faq-card">
            <h4>Which AI answer engines benefit from AEO Studio?</h4>
            <p>
              Our schemas and content structure recommendations are optimized for <strong>Google SGE / AI Overviews</strong>, <strong>Bing Copilot</strong>, <strong>Perplexity AI</strong>, <strong>ChatGPT Search</strong>, and <strong>Claude</strong>.
            </p>
          </div>

          <div className="scoring-card doc-faq-card">
            <h4>Is any user data or website content stored?</h4>
            <p>
              No. All DOM parsing, schema generation, and AEO score calculations run locally in your browser session. No data is sent to external databases or stored on servers.
            </p>
          </div>

          <div className="scoring-card doc-faq-card">
            <h4>Why are some schemas marked N/A on Homepages?</h4>
            <p>
              A Homepage is the root of a domain (`/`). It has no parent pages, so Breadcrumbs are unnecessary. Homepages focus on Brand Identity (`Organization` &amp; `WebSite`).
            </p>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <div className="scoring-cta-box">
        <h3>Ready to Try AEO Studio?</h3>
        <p>Generate targeted JSON-LD schemas or run a full 4-pillar AEO audit for your website in seconds.</p>
        <button className="btn-primary analyze-btn" onClick={onBack}>
          <Zap size={18} /> Launch Generator &amp; Audit Tool
        </button>
      </div>
    </div>
  );
}
