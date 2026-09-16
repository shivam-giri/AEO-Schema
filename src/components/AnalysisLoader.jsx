import { Loader2, X } from 'lucide-react';

const SCHEMA_STEPS = [
  { id: 'fetch', label: 'Fetching page content…' },
  { id: 'parse', label: 'Parsing HTML structure…' },
  { id: 'detect', label: 'Detecting content signals…' },
  { id: 'generate', label: 'Synthesizing AEO schemas…' },
  { id: 'qa', label: 'Generating Q&A pairs…' },
];

const AUDIT_STEPS = [
  { id: 'fetch', label: 'Fetching page content…' },
  { id: 'parse', label: 'Parsing HTML structure…' },
  { id: 'detect', label: 'Detecting content signals…' },
  { id: 'generate', label: 'Auditing page content & structure…' },
  { id: 'score', label: 'Calculating AEO readiness score…' },
];

export default function AnalysisLoader({ step: currentStep, mode = 'schema', onCancel }) {
  const steps = mode === 'schema' ? SCHEMA_STEPS : AUDIT_STEPS;
  const currentIdx = steps.findIndex(s => s.id === currentStep);

  return (
    <section className="loader-section" aria-live="polite" aria-label={mode === 'schema' ? 'Generating schemas' : 'Analyzing page'}>
      {onCancel && (
        <button
          type="button"
          className="loader-cancel-btn"
          onClick={onCancel}
          aria-label="Cancel and go back"
        >
          <X size={14} />
          Cancel
        </button>
      )}

      <div className="loader-orb">
        <div className="loader-orb-inner">
          <Loader2 size={36} />
        </div>
      </div>

      <h2 className="loader-title">
        {mode === 'schema' ? 'Generating AEO Schemas' : 'Analyzing Your Page'}
      </h2>
      <p className="loader-subtitle">This usually takes a few seconds…</p>

      <div className="loader-steps" role="list">
        {steps.map((step, i) => {
          const status =
            i < currentIdx ? 'done' :
              i === currentIdx ? 'active' :
                'pending';

          return (
            <div
              key={step.id}
              className={`loader-step ${status}`}
              role="listitem"
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <div className="loader-step-icon">
                {status === 'done' ? '✓' : status === 'active' ? '●' : '○'}
              </div>
              {step.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}
