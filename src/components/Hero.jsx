import { Zap, Globe, Brain, Search } from 'lucide-react';

const ENGINES = ['Google SGE', 'Bing Copilot', 'Perplexity', 'ChatGPT'];

export default function Hero() {
  return (
    <header className="hero">
      <div className="hero-badge">
        <Zap size={14} />
        Answer Engine Optimization
      </div>

      <h1 className="hero-title">
        Generate{' '}
        <span className="hero-title-gradient">AEO Schemas</span>
        {' '}Instantly
      </h1>

      <p className="hero-subtitle">
        Paste any website URL and get structured JSON-LD schema markup
        optimized to rank in AI-powered answer engines — no sign-up required.
      </p>

      <div className="hero-engines">
        {ENGINES.map(engine => (
          <span key={engine} className="engine-pill">
            <span className="engine-pill-dot" />
            {engine}
          </span>
        ))}
      </div>
    </header>
  );
}
