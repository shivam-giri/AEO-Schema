import { Zap, BarChart3, BookOpen, Sun, Moon, MessageSquare } from 'lucide-react';

const ENGINES = ['Google SGE', 'Bing Copilot', 'Perplexity', 'ChatGPT'];

export default function Hero({
  onNavigateToScoringCriteria,
  onNavigateToDocumentation,
  onNavigateToQnA,
  onNavigateHome,
  currentView,
  showHeader = true,
  theme = 'dark',
  onToggleTheme,
}) {
  return (
    <>
      {/* ── Navbar ────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand" onClick={onNavigateHome} style={{ cursor: 'pointer' }}>
          <span className="navbar-logo"><Zap size={16} /></span>
          <span className="navbar-name">AEO<span className="navbar-name-accent">Studio</span></span>
        </div>

        <div className="navbar-right">
          <button
            className={`navbar-link-btn ${currentView === 'documentation' ? 'active' : ''}`}
            onClick={onNavigateToDocumentation}
          >
            <BookOpen size={14} /> How It Works
          </button>
          <button
            className={`navbar-link-btn ${currentView === 'scoring-criteria' ? 'active' : ''}`}
            onClick={onNavigateToScoringCriteria}
          >
            <BarChart3 size={14} /> Scoring Criteria
          </button>
          <button
            className={`navbar-link-btn ${currentView === 'qna' ? 'active' : ''}`}
            onClick={onNavigateToQnA}
          >
            <MessageSquare size={14} /> Q&amp;A
          </button>
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </nav>

      {/* ── Hero (Only show on home view when showHeader is true) ── */}
      {currentView === 'home' && showHeader && (
        <header className="hero">
          <h1 className="hero-title">
            Generate{' '}
            <span className="hero-title-gradient">AEO Schemas</span>
            {' '}&amp; Audit Instantly
          </h1>
          <p className="hero-subtitle">
            Paste any website URL — get structured JSON-LD schemas or a full AEO audit with recommendations, optimised for AI-powered answer engines.
          </p>

          <div className="navbar-engines">
            {ENGINES.map(engine => (
              <span key={engine} className="engine-pill">
                <span className="engine-pill-dot" />
                {engine}
              </span>
            ))}
          </div>
        </header>
      )}
    </>
  );
}
