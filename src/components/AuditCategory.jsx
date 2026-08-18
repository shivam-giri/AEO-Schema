import { useState } from 'react';
import { ChevronDown, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { PILLAR_WEIGHTS } from '../services/auditAnalyzer.js';

function getBarColor(pct) {
  if (pct >= 75) return 'var(--accent-success)';
  if (pct >= 45) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

export default function AuditCategory({ category, index, animated, isUX = false }) {
  const [open, setOpen] = useState(index < 2);
  const pct      = category.score;
  const barColor = getBarColor(pct);
  const weight   = PILLAR_WEIGHTS[category.id];

  return (
    <div
      className="audit-category-card"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      {/* Header */}
      <div
        className="audit-category-header"
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
      >
        <span className="audit-category-emoji" aria-hidden="true">{category.emoji}</span>

        <div className="audit-category-info">
          <div className="audit-category-name-row">
            <span className="audit-category-name">{category.label}</span>
            {weight && (
              <span className="audit-weight-badge">{weight.pct}</span>
            )}
            {isUX && (
              <span className="audit-ux-badge">not in main score</span>
            )}
          </div>
          <div className="audit-category-bar-wrap">
            <div
              className="audit-category-bar-fill"
              style={{
                width: animated ? `${pct}%` : '0%',
                background: barColor,
                transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${index * 0.1}s`,
              }}
            />
          </div>
        </div>

        <div className="audit-category-score" style={{ color: barColor }}>
          {category.checks.filter(c => c.passed && !c.isNA).length}/{category.checks.filter(c => !c.isNA).length || category.checks.length}
          <span className="audit-category-pct">{pct}%</span>
        </div>

        <div className={`chevron-btn ${open ? 'open' : ''}`} aria-hidden="true">
          <ChevronDown size={16} />
        </div>
      </div>

      {/* Check rows */}
      {open && (
        <div className="audit-category-body">
          {category.checks.map(check => {
            const isNA = check.isNA || check.status === 'na';
            const isPass = check.passed && !isNA;

            const iconColor = isNA
              ? '#94a3b8'
              : isPass
                ? 'var(--accent-success)'
                : 'var(--accent-danger)';

            const badgeBg = isNA
              ? 'rgba(148, 163, 184, 0.12)'
              : isPass
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.10)';

            const badgeColor = isNA
              ? '#94a3b8'
              : isPass
                ? 'var(--accent-success)'
                : 'var(--accent-danger)';

            const badgeBorder = isNA
              ? '1px solid rgba(148, 163, 184, 0.25)'
              : isPass
                ? '1px solid rgba(16, 185, 129, 0.25)'
                : '1px solid rgba(239, 68, 68, 0.25)';

            return (
              <div
                key={check.id}
                className={`audit-check-row ${isNA ? 'status-na' : isPass ? 'status-pass' : 'status-fail'}`}
              >
                <span className="audit-check-status-icon" style={{ color: iconColor }}>
                  {isNA ? <MinusCircle size={14} /> : isPass ? <CheckCircle size={14} /> : <XCircle size={14} />}
                </span>

                <div className="audit-check-info">
                  <span className="audit-check-label">{check.label}</span>
                  <span className="audit-check-detail">{check.detail}</span>
                </div>

                <span
                  className="audit-pass-fail-badge"
                  style={{
                    background: badgeBg,
                    color: badgeColor,
                    border: badgeBorder,
                  }}
                >
                  {isNA ? 'N/A' : isPass ? 'PASS' : 'FAIL'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
