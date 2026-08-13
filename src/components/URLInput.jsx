import { useState } from 'react';
import { Globe, Zap, AlertCircle, CheckCircle, Shield, Code2 } from 'lucide-react';
import { validateUrl } from '../services/fetcher.js';

const FEATURES = [
  { icon: Shield, text: 'No sign-up required' },
  { icon: Code2, text: 'Valid JSON-LD output' },
  { icon: CheckCircle, text: 'AEO Readiness Score' },
];

export default function URLInput({ onAnalyze, isLoading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const validation = validateUrl(url);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    onAnalyze(validation.normalized);
  };

  const handleChange = (e) => {
    setUrl(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="url-input-wrapper">
      <form className="url-form" onSubmit={handleSubmit} id="url-form">
        <div className="url-input-icon">
          <Globe size={18} />
        </div>

        <input
          id="url-input"
          className="url-input"
          type="text"
          placeholder="https://example.com/your-page"
          value={url}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="url"
          spellCheck="false"
          aria-label="Website URL to analyze"
          aria-describedby={error ? 'url-error' : undefined}
        />

        <button
          id="analyze-btn"
          className="analyze-btn"
          type="submit"
          disabled={isLoading || !url.trim()}
          aria-busy={isLoading}
        >
          <Zap size={16} />
          {isLoading ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>

      {error && (
        <p className="url-error" id="url-error" role="alert">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <div className="features-strip">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="feature-item">
            <Icon size={15} />
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
