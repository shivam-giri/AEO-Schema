import { useState, useCallback, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import ModeSelector from './components/ModeSelector.jsx';
import URLInput from './components/URLInput.jsx';
import AnalysisLoader from './components/AnalysisLoader.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import AuditReport from './components/AuditReport.jsx';
import ScoringCriteriaPage from './components/ScoringCriteriaPage.jsx';
import DocumentationPage from './components/DocumentationPage.jsx';
import { fetchPageHTML } from './services/fetcher.js';
import { generateAEOSchemas } from './services/schemaGenerator.js';
import { runFullAudit } from './services/auditAnalyzer.js';

const LOADER_STEPS_SCHEMA = ['fetch', 'parse', 'detect', 'generate', 'score'];
const LOADER_STEPS_AUDIT  = ['fetch', 'parse', 'detect', 'generate', 'score'];

const STEP_DELAYS = {
  fetch: 0, parse: 500, detect: 900, generate: 1400, score: 1900,
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
    return 'home';
  });

  const [mode, setMode] = useState('schema');             // 'schema' | 'audit'
  const [selectedPageType, setSelectedPageType] = useState('auto'); // 'auto' | 'homepage' | 'article' | 'product' | 'faq' | 'howto'
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
        const results = generateAEOSchemas(html, resolvedUrl, selectedPageType);
        await advanceStep('generate');
        await advanceStep('score');
        await new Promise(r => setTimeout(r, 400));
        setSchemaResults(results);

      } else {
        const results = runFullAudit(html, resolvedUrl, selectedPageType);
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
  }, [mode, selectedPageType]);

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
                  selectedPageType={selectedPageType}
                  onPageTypeChange={setSelectedPageType}
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
            {state === 'loading' && <AnalysisLoader step={loaderStep} />}

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
            </a> · <a href="#documentation" onClick={navigateToDocumentation}>How It Works</a> · <a href="#scoring-criteria" onClick={navigateToScoringCriteria}>Scoring Criteria</a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
