import { useState, useCallback, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import ModeSelector from './components/ModeSelector.jsx';
import URLInput from './components/URLInput.jsx';
import AnalysisLoader from './components/AnalysisLoader.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import AuditReport from './components/AuditReport.jsx';
import ScoringCriteriaPage from './components/ScoringCriteriaPage.jsx';
import DocumentationPage from './components/DocumentationPage.jsx';
import QnAPage from './components/QnAPage.jsx';
import SchemaGenerationPage from './components/SchemaGenerationPage.jsx';
import { fetchPageHTML, fetchRobotsTxt } from './services/fetcher.js';
import { generateAEOSchemas } from './services/schemaGenerator.js';
import { runFullAudit } from './services/auditAnalyzer.js';

const STEP_DELAYS = {
  fetch:    800,
  parse:    600,
  detect:   500,
  generate: 600,
  qa:       700,
  score:    500,
};

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('aeo-theme') || 'dark';
  });

  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;
    if (hash === '#documentation' || path === '/documentation') return 'documentation';
    if (hash === '#scoring-criteria' || path === '/scoring-criteria') return 'scoring-criteria';
    if (hash === '#qna' || path === '/qna') return 'qna';
    if (hash === '#schema-generation' || path === '/schema-generation') return 'schema-generation';
    return 'home';
  });

  const [mode, setMode] = useState('schema');             // 'schema' | 'audit'
  const [state, setState] = useState('idle');             // 'idle' | 'loading' | 'results' | 'error'
  const [loaderStep, setLoaderStep] = useState('fetch');
  const [schemaResults, setSchemaResults] = useState(null);
  const [auditResults, setAuditResults] = useState(null);
  const [lastUrl, setLastUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Apply data-theme attribute on document root and persist in localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aeo-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Handle hash / URL route changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (hash === '#documentation' || path === '/documentation') {
        setCurrentView('documentation');
      } else if (hash === '#scoring-criteria' || path === '/scoring-criteria') {
        setCurrentView('scoring-criteria');
      } else if (hash === '#qna' || path === '/qna') {
        setCurrentView('qna');
      } else if (hash === '#schema-generation' || path === '/schema-generation') {
        setCurrentView('schema-generation');
      } else {
        setCurrentView('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const navigateToDocumentation = useCallback(() => {
    setCurrentView('documentation');
    window.history.pushState({}, '', '#documentation');
  }, []);

  const navigateToScoringCriteria = useCallback(() => {
    setCurrentView('scoring-criteria');
    window.history.pushState({}, '', '#scoring-criteria');
  }, []);

  const navigateToQnA = useCallback(() => {
    setCurrentView('qna');
    window.history.pushState({}, '', '#qna');
  }, []);

  const navigateToSchemaGeneration = useCallback(() => {
    setCurrentView('schema-generation');
    window.history.pushState({}, '', '#schema-generation');
  }, []);

  const navigateHome = useCallback(() => {
    setCurrentView('home');
    window.history.pushState({}, '', window.location.pathname);
  }, []);

  // Switch mode — if we already have results for the new mode, show them immediately
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    // If results already exist for this mode, jump to results
    if (newMode === 'schema' && schemaResults) setState('results');
    else if (newMode === 'audit' && auditResults) setState('results');
    else setState('idle');
  }, [schemaResults, auditResults]);

  // Switch to schema mode (called from audit "Fix with Schema Generator" CTA)
  const handleSwitchToSchema = useCallback(() => {
    setMode('schema');
    if (schemaResults) setState('results');
    else setState('idle');
  }, [schemaResults]);

  const advanceStep = (step) =>
    new Promise(resolve => setTimeout(() => { setLoaderStep(step); resolve(); }, STEP_DELAYS[step]));

  const handleAnalyze = useCallback(async (url) => {
    setState('loading');
    setLoaderStep('fetch');
    setErrorMessage('');
    setLastUrl(url);

    try {
      // Fetch page
      setLoaderStep('fetch');
      const { html, finalUrl } = await fetchPageHTML(url);
      const resolvedUrl = finalUrl || url;

      // Animate through steps while computing
      await advanceStep('parse');
      await advanceStep('detect');

      if (mode === 'schema') {
        await advanceStep('generate');
        await advanceStep('qa');
        const results = await generateAEOSchemas(html, resolvedUrl);
        await new Promise(r => setTimeout(r, 400));
        setSchemaResults(results);

      } else {
        // AI Crawler Access gate needs robots.txt — fetched separately (it's
        // not part of the page HTML) via the same proxy used for the page
        // itself. A failure here just means "treat as unrestricted", not an
        // audit failure, so it's never allowed to throw.
        const robotsTxt = await fetchRobotsTxt(resolvedUrl);
        const results = runFullAudit(html, resolvedUrl, robotsTxt);
        await advanceStep('generate');
        await advanceStep('score');
        await new Promise(r => setTimeout(r, 400));
        setAuditResults(results);
      }

      setState('results');
    } catch (err) {
      console.error('[AEO App] Error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setState('error');
    }
  }, [mode]);

  const handleReset = () => {
    setState('idle');
    setSchemaResults(null);
    setAuditResults(null);
    setErrorMessage('');
  };

  const showInput = state === 'idle' || state === 'error';

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true" />

      <div className="app-content">
        <Hero
          onNavigateToScoringCriteria={navigateToScoringCriteria}
          onNavigateToDocumentation={navigateToDocumentation}
          onNavigateToQnA={navigateToQnA}
          onNavigateToSchemaGeneration={navigateToSchemaGeneration}
          onNavigateHome={navigateHome}
          currentView={currentView}
          showHeader={state !== 'results'}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {currentView === 'documentation' ? (
          <DocumentationPage onBack={navigateHome} />
        ) : currentView === 'scoring-criteria' ? (
          <ScoringCriteriaPage onBack={navigateHome} />
        ) : currentView === 'qna' ? (
          <QnAPage onBack={navigateHome} />
        ) : currentView === 'schema-generation' ? (
          <SchemaGenerationPage onBack={navigateHome} />
        ) : (
          <>
            {/* Mode selector — visible when not viewing results */}
            {state !== 'results' && (
              <div className="mode-selector-wrap">
                <ModeSelector mode={mode} onChange={handleModeChange} />
              </div>
            )}

            {/* URL Input with Page Type Selector */}
            {showInput && (
              <>
                <URLInput
                  onAnalyze={handleAnalyze}
                  isLoading={false}
                  mode={mode}
                />

                {state === 'error' && (
                  <div
                    role="alert"
                    style={{
                      maxWidth: 640, margin: '24px auto 0',
                      padding: '16px 20px',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 12, color: '#fca5a5', fontSize: 14,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                    <div>
                      <strong style={{ color: '#ef4444', display: 'block', marginBottom: 4 }}>
                        Analysis Failed
                      </strong>
                      {errorMessage}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Loader */}
            {state === 'loading' && <AnalysisLoader step={loaderStep} mode={mode} />}

            {/* Results — Schema mode */}
            {state === 'results' && mode === 'schema' && schemaResults && (
              <ResultsPanel results={schemaResults} onReset={handleReset} />
            )}

            {/* Results — Audit mode */}
            {state === 'results' && mode === 'audit' && auditResults && (
              <AuditReport
                results={auditResults}
                onReset={handleReset}
                onSwitchToSchema={handleSwitchToSchema}
              />
            )}
          </>
        )}

        <footer className="footer">
          <p>
            AEO Schema Generator — Validate schemas at{' '}
            <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">
              Google Rich Results Test
            </a>{' '}·{' '}
            <a href="#schema-generation" onClick={(e) => { e.preventDefault(); navigateToSchemaGeneration(); }}>Schema Generation</a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
