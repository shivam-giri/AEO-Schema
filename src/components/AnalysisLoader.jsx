import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const STEPS = [
  { id: 'fetch',    label: 'Fetching page content…'    },
  { id: 'parse',    label: 'Parsing HTML structure…'    },
  { id: 'detect',   label: 'Detecting content type…'   },
  { id: 'generate', label: 'Generating AEO schemas…'   },
  { id: 'score',    label: 'Calculating AEO score…'    },
];

export default function AnalysisLoader({ step: currentStep }) {
  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  return (
    <section className="loader-section" aria-live="polite" aria-label="Analyzing page">
      <div className="loader-orb">
        <div className="loader-orb-inner">
          <Loader2 size={36} />
        </div>
      </div>

      <h2 className="loader-title">Analyzing your page</h2>
      <p className="loader-subtitle">This usually takes a few seconds…</p>

      <div className="loader-steps" role="list">
        {STEPS.map((step, i) => {
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
