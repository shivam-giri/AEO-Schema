import { useState, useCallback } from 'react';
import Hero from './components/Hero.jsx';
import URLInput from './components/URLInput.jsx';
import AnalysisLoader from './components/AnalysisLoader.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import { fetchPageHTML } from './services/fetcher.js';
import { generateAEOSchemas } from './services/schemaGenerator.js';

// Simulated step timing (in ms)
const STEP_DELAYS = {
  fetch:    0,
  parse:    500,
  detect:   900,
  generate: 1300,
  score:    1700,
};

export default function App() {
  const [state, setstate] = useState('idle'); // 'idle' | 'loading' | 'results' | 'error'
  const [loaderStep, setLoaderStep] = useState('fetch');
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const advanceStep = (step) => {
    return new Promise(resolve => {
      setTimeout(() => {
        setLoaderStep(step);
        resolve();
      }, STEP_DELAYS[step]);
    });
  };

  const handleAnalyze = useCallback(async (url) => {
    setstate('loading');
    setLoaderStep('fetch');
    setErrorMessage('');
    setResults(null);

    try {
      // Step 1: Fetch
      setLoaderStep('fetch');
      const { html, finalUrl } = await fetchPageHTML(url);

      // Step 2-5: Parse + generate (with artificial step animations)
      const parsePromise = advanceStep('parse');
      const detectPromise = advanceStep('detect');
      const generatePromise = advanceStep('generate');
      const scorePromise = advanceStep('score');

      await parsePromise;
      await detectPromise;

      // Actually generate schemas (CPU work)
      const schemaResults = generateAEOSchemas(html, finalUrl || url);

      await generatePromise;
      await scorePromise;

      // Small delay for UX polish
      await new Promise(r => setTimeout(r, 400));

      setResults(schemaResults);
      setstate('results');
    } catch (err) {
      console.error('[AEO App] Analysis error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setstate('error');
    }
  }, []);

  const handleReset = () => {
    setstate('idle');
    setResults(null);
    setErrorMessage('');
  };

  return (
    <div className="app">
      {/* Animated background orbs */}
      <div className="app-bg" aria-hidden="true" />

      <div className="app-content">
        {/* Always show hero */}
        <Hero />

        {/* Show URL input when idle or error */}
        {(state === 'idle' || state === 'error') && (
          <>
            <URLInput onAnalyze={handleAnalyze} isLoading={false} />

            {state === 'error' && (
              <div
                role="alert"
                style={{
                  maxWidth: 600,
                  margin: '24px auto 0',
                  padding: '16px 20px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '12px',
                  color: '#fca5a5',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <strong style={{ color: '#ef4444', display: 'block', marginBottom: '4px' }}>
                    Analysis Failed
                  </strong>
                  {errorMessage}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <AnalysisLoader step={loaderStep} />
        )}

        {/* Results */}
        {state === 'results' && results && (
          <ResultsPanel results={results} onReset={handleReset} />
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            AEO Schema Generator — Built for developers, SEOs, and content teams.{' '}
            Validate your schemas at{' '}
            <a
              href="https://search.google.com/test/rich-results"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Rich Results Test
            </a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
