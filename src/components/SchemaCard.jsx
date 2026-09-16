import { useEffect, useRef, useState } from 'react';
import { Copy, Check, ChevronDown, FileJson, Sparkles, HelpCircle, WrapText, ExternalLink } from 'lucide-react';

// Schema type → color/icon configuration
const TYPE_CONFIG = {
  FAQPage:        { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', emoji: '❓' },
  HowTo:          { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   emoji: '🪜' },
  Article:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  emoji: '📄' },
  NewsArticle:    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   emoji: '📰' },
  Organization:   { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  emoji: '🏢' },
  BreadcrumbList: { color: '#ec4899', bg: 'rgba(236,72,153,0.15)',  emoji: '🔗' },
  WebSite:        { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  emoji: '🌐' },
  Product:        { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  emoji: '📦' },
  Event:          { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  emoji: '📅' },
  ItemList:       { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  emoji: '👥' },
  ContactPage:    { color: '#14b8a6', bg: 'rgba(20,184,166,0.15)',  emoji: '📞' },
};

/**
 * Syntax-highlight JSON string into HTML spans.
 */
function highlightJSON(json) {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
}

export default function SchemaCard({ schemaResult, index, focusType = null, pageUrl = '' }) {
  const { type, label, description, impact, schema, qaPairs = [], qaSource = 'heuristic' } = schemaResult;
  const isFocused = Boolean(focusType) && focusType === type;

  // Deep-linked from an audit recommendation ("Fix with Schema Generator →
  // FAQPage") opens that specific card; otherwise the first card opens.
  const [isOpen, setIsOpen] = useState(isFocused || (!focusType && index === 0));
  const [copied, setCopied] = useState(false);
  const [wrapCode, setWrapCode] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.Article;
  const jsonStr = JSON.stringify(schema, null, 2);
  const highlighted = highlightJSON(jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(
        `<script type="application/ld+json">\n${jsonStr}\n</script>`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const animationDelay = `${index * 0.08}s`;

  return (
    <article
      ref={cardRef}
      className={`schema-card ${isFocused ? 'schema-card-focused' : ''}`}
      style={{ animationDelay }}
      aria-expanded={isOpen}
    >
      {/* Header */}
      <div
        className="schema-card-header"
        onClick={() => setIsOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setIsOpen(o => !o)}
        aria-controls={`schema-body-${type}`}
        id={`schema-header-${type}`}
      >
        {/* Type icon */}
        <div
          className="schema-type-icon"
          style={{ background: config.bg }}
          aria-hidden="true"
        >
          <span style={{ fontSize: 20 }}>{config.emoji}</span>
        </div>

        {/* Info */}
        <div className="schema-card-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="schema-card-type" style={{ color: config.color }}>
              {label}
            </span>
            {qaPairs.length > 0 && (
              <span className={`schema-qa-pill ${qaSource === 'gemini' ? 'qa-pill-ai' : 'qa-pill-dom'}`}>
                {qaSource === 'gemini' ? <Sparkles size={11} /> : <HelpCircle size={11} />}
                {qaPairs.length} Q&amp;A Included
              </span>
            )}
          </div>
          <div className="schema-card-desc">{description}</div>
        </div>

        {/* Actions */}
        <div className="schema-card-actions" onClick={e => e.stopPropagation()}>
          <div className="copy-btn-wrap">
            <button
              id={`copy-btn-${type}`}
              className={`icon-btn ${copied ? 'copy-success' : ''}`}
              onClick={handleCopy}
              title="Copy as <script> tag"
              aria-label={`Copy ${label} schema`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {copied && (
              <span className="copy-confirm-tooltip" role="status">Copied!</span>
            )}
          </div>
        </div>

        <div className={`chevron-btn ${isOpen ? 'open' : ''}`} aria-hidden="true">
          <ChevronDown size={18} />
        </div>
      </div>

      {/* Body (collapsible) */}
      <div
        className={`schema-card-body ${isOpen ? 'open' : ''}`}
        id={`schema-body-${type}`}
        role="region"
        aria-labelledby={`schema-header-${type}`}
      >
        {/* JSON-LD Code with embedded Q&A */}
        <div className="schema-code-wrapper">
          <div className="schema-code-toolbar">
            <button
              type="button"
              className="schema-wrap-toggle"
              onClick={(e) => { e.stopPropagation(); setWrapCode(w => !w); }}
              aria-pressed={wrapCode}
              title={wrapCode ? 'Disable soft-wrap' : 'Soft-wrap long lines'}
            >
              <WrapText size={12} />
              {wrapCode ? 'Wrap: On' : 'Wrap: Off'}
            </button>
          </div>
          <pre
            className={`schema-code ${wrapCode ? 'schema-code-wrap' : ''}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
            aria-label={`${label} JSON-LD schema`}
          />
        </div>

        {/* Impact bar */}
        <div className="schema-impact-bar">
          <span className="impact-label">
            <FileJson size={12} />
            AEO Impact
          </span>
          <div className="impact-stars" aria-label={`Impact: ${impact} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`impact-star ${i < impact ? 'filled' : ''}`}
              />
            ))}
          </div>
          {pageUrl && (
            <a
              className="schema-validate-link"
              href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Validate this page's structured data in Google Rich Results Test"
            >
              <ExternalLink size={12} />
              Validate in Rich Results Test
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
