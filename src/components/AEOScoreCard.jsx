import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const CIRCUMFERENCE = 2 * Math.PI * 52; // radius = 52

function getScoreColor(pct) {
  if (pct >= 80) return 'var(--accent-success)';
  if (pct >= 60) return 'var(--accent-primary)';
  if (pct >= 40) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

function getMetricBarColor(pct) {
  if (pct >= 80) return 'var(--accent-success)';
  if (pct >= 50) return 'var(--accent-primary)';
  return 'var(--accent-warning)';
}

const StatusIcon = ({ status }) => {
  if (status === 'pass') return <CheckCircle size={14} />;
  if (status === 'fail') return <XCircle size={14} />;
  return <AlertTriangle size={14} />;
};

export default function AEOScoreCard({ score }) {
  const [animated, setAnimated] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const pct = score.percentage;
  const color = getScoreColor(pct);
  const offset = animated
    ? CIRCUMFERENCE * (1 - pct / 100)
    : CIRCUMFERENCE;

  return (
    <div className="score-grid">
      {/* Main gauge card */}
      <div className="score-main-card" aria-label={`AEO Score: ${pct} out of 100`}>
        <p className="score-label">AEO Readiness Score</p>

        <div className="score-gauge" role="img" aria-label={`${pct}%`}>
          <svg width="220" height="220" viewBox="0 0 120 120">
            <circle
              className="score-gauge-bg"
              cx="60" cy="60" r="52"
            />
            <circle
              className="score-gauge-fill"
              cx="60" cy="60" r="52"
              stroke={color}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="score-number" style={{ color }}>
            {pct}
            <span>/ 100</span>
          </div>
        </div>

        <span className={`score-grade ${score.gradeClass}`}>
          {score.grade}
        </span>
      </div>

      {/* Metrics breakdown */}
      <div className="score-metrics-card">
        <p className="score-metrics-title">Score Breakdown</p>
        <div className="metric-list">
          {score.metrics.map(metric => {
            const metricPct = Math.round((metric.score / metric.max) * 100);
            const barColor = getMetricBarColor(metricPct);
            const barWidth = animated ? `${metricPct}%` : '0%';

            return (
              <div key={metric.id} className="metric-item" title={metric.detail}>
                <div className={`metric-icon ${metric.status}`}>
                  <StatusIcon status={metric.status} />
                </div>
                <div className="metric-info">
                  <div className="metric-name">{metric.name}</div>
                  <div className="metric-bar-wrap">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: barWidth,
                        background: barColor,
                        transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    />
                  </div>
                </div>
                <div className="metric-value" style={{ color: barColor }}>
                  {metric.score}/{metric.max}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
