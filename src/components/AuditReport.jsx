import { useState, useEffect } from 'react';
import { RefreshCw, Download, Lightbulb, BarChart2, Info } from 'lucide-react';
import AuditCategory from './AuditCategory.jsx';
import RecommendationCard from './RecommendationCard.jsx';
import { PRIORITY, PILLAR_WEIGHTS } from '../services/auditAnalyzer.js';

const CIRCUMFERENCE = 2 * Math.PI * 52;

function getScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 65) return '#8b5cf6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

const PRIORITY_LABELS = {
  [PRIORITY.HIGH]:   { label: 'High Priority', emoji: '🔴' },
  [PRIORITY.MEDIUM]: { label: 'Medium Priority', emoji: '🟡' },
  [PRIORITY.LOW]:    { label: 'Quick Wins', emoji: '🟢' },
};

export default function AuditReport({ results, onReset, onSwitchToSchema }) {
  const [animated,   setAnimated]   = useState(false);
  const [activeTab,  setActiveTab]  = useState('categories');
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const {
    pillars, uxPillar, overallScore, grade, gradeClass,
    recommendations, meta, readabilityScore, searchabilityScore, speedScores,
  } = results;

  const color  = getScoreColor(overallScore);
  const offset = animated ? CIRCUMFERENCE * (1 - overallScore / 100) : CIRCUMFERENCE;

  const highRecs   = recommendations.filter(r => r.priority === PRIORITY.HIGH);
  const medRecs    = recommendations.filter(r => r.priority === PRIORITY.MEDIUM);
  const lowRecs    = recommendations.filter(r => r.priority === PRIORITY.LOW);
  const passCount  = pillars.reduce((s, p) => s + p.checks.filter(c => c.passed).length, 0);
  const totalCount = pillars.reduce((s, p) => s + p.checks.length, 0);

  const handleDownload = () => {
    const lines = [
      'AEO AUDIT REPORT — 4-Pillar Methodology',
      `URL: ${meta.canonicalUrl || 'Unknown'}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      `Overall Score: ${overallScore}/100 — ${grade}`,
      `Formula: Schema(30%) + Content(25%) + Technical(25%) + E-E-A-T(20%)`,
      '',
      '=== PILLAR SCORES ===',
      ...pillars.map(p =>
        `${p.emoji} ${p.label} [${p.pct}]: ${p.score}% — ${p.checks.filter(c => c.passed).length}/${p.checks.length} checks passed`
      ),
      '',
      `📱 UX [separate]: ${uxPillar.score}% — ${uxPillar.checks.filter(c => c.passed).length}/${uxPillar.checks.length} checks passed`,
      '',
      '=== RECOMMENDATIONS ===',
      ...recommendations.map((r, i) =>
        `${i + 1}. [${r.priority.toUpperCase()}] ${r.title}\n   ${r.description}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'aeo-audit-report.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const shortUrl = (() => {
    try {
      const u = new URL(meta.canonicalUrl || '');
      return u.hostname + (u.pathname !== '/' ? u.pathname.slice(0, 30) : '');
    } catch { return meta.canonicalUrl || ''; }
  })();

  return (
    <section className="results-section audit-report" aria-label="AEO Audit Report">

      {/* Header */}
      <div className="results-header">
        <div>
          <h2 className="results-title">AEO Audit Report</h2>
          {shortUrl && <div className="results-url-tag" style={{ marginTop: 8 }}>🔗 {shortUrl}</div>}
        </div>
        <div className="results-actions">
          <button className="btn-secondary" onClick={onReset}><RefreshCw size={14} /> New Analysis</button>
          <button className="btn-secondary" onClick={handleDownload}><Download size={14} /> Report</button>
          <button className="btn-primary" onClick={onSwitchToSchema}>⚡ Generate Schemas</button>
        </div>
      </div>

      {/* Overall score strip */}
      <div className="audit-score-strip">

        {/* Gauge + grade */}
        <div className="audit-gauge-wrap">
          <div className="score-gauge" style={{ width: 110, height: 110 }}>
            <svg width="110" height="110" viewBox="0 0 120 120">
              <circle className="score-gauge-bg" cx="60" cy="60" r="52" />
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
              {overallScore}<span>/ 100</span>
            </div>
          </div>
          <span className={`score-grade ${gradeClass}`}>{grade}</span>
          <span className="audit-checks-summary">{passCount}/{totalCount} checks passed</span>
        </div>

        {/* Pillar bars */}
        <div className="audit-summary-bars">
          {pillars.map(pillar => {
            const barColor = getScoreColor(pillar.score);
            return (
              <div key={pillar.id} className="audit-summary-row">
                <span className="audit-summary-label">
                  {pillar.emoji} {pillar.label}
                  <span className="audit-summary-weight">{pillar.pct}</span>
                </span>
                <div className="audit-summary-bar-track">
                  <div
                    className="audit-summary-bar-fill"
                    style={{
                      width: animated ? `${pillar.score}%` : '0%',
                      background: barColor,
                      transition: 'width 1s ease',
                    }}
                  />
                </div>
                <span className="audit-summary-pct" style={{ color: barColor }}>{pillar.score}%</span>
              </div>
            );
          })}
          {/* UX row — visually separated */}
          <div className="audit-summary-row ux-row">
            <span className="audit-summary-label" style={{ color: 'var(--text-muted)' }}>
              {uxPillar.emoji} {uxPillar.label}
              <span className="audit-summary-weight" style={{ opacity: 0.6 }}>UX only</span>
            </span>
            <div className="audit-summary-bar-track" style={{ opacity: 0.5 }}>
              <div
                className="audit-summary-bar-fill"
                style={{
                  width: animated ? `${uxPillar.score}%` : '0%',
                  background: 'var(--text-muted)',
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <span className="audit-summary-pct" style={{ color: 'var(--text-muted)' }}>{uxPillar.score}%</span>
          </div>

          {/* Formula hint */}
          <button
            className="audit-formula-btn"
            onClick={() => setShowFormula(f => !f)}
          >
            <Info size={11} /> {showFormula ? 'Hide' : 'Show'} scoring formula
          </button>

          {showFormula && (
            <div className="audit-formula-box">
              <strong>Overall Score Formula:</strong><br />
              Schema×30% + Content×25% + Technical×25% + E‑E‑A‑T×20%<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                = {pillars.find(p=>p.id==='schema')?.score}×0.30
                + {pillars.find(p=>p.id==='content')?.score}×0.25
                + {pillars.find(p=>p.id==='technical')?.score}×0.25
                + {pillars.find(p=>p.id==='eeat')?.score}×0.20
                = {overallScore}
              </span><br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Pass threshold for calculated scores: 65/100 · UX not included in overall score
              </span>
            </div>
          )}
        </div>

        {/* Rec counts */}
        <div className="audit-rec-counts">
          <div className="rec-count-item" style={{ color: '#f87171' }}>
            <span className="rec-count-number">{highRecs.length}</span>
            <span>High</span>
          </div>
          <div className="rec-count-item" style={{ color: '#fbbf24' }}>
            <span className="rec-count-number">{medRecs.length}</span>
            <span>Medium</span>
          </div>
          <div className="rec-count-item" style={{ color: '#34d399' }}>
            <span className="rec-count-number">{lowRecs.length}</span>
            <span>Quick Wins</span>
          </div>
        </div>
      </div>

      <div className="section-divider" />

      {/* Tabs */}
      <div className="audit-tabs">
        <button
          className={`audit-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <BarChart2 size={15} /> Score Breakdown
        </button>
        <button
          className={`audit-tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          <Lightbulb size={15} /> Recommendations
          <span className="audit-tab-badge">{recommendations.length}</span>
        </button>
      </div>

      {/* Score Breakdown */}
      {activeTab === 'categories' && (
        <div className="audit-categories-list">
          {pillars.map((cat, i) => (
            <AuditCategory key={cat.id} category={cat} index={i} animated={animated} />
          ))}
          {/* UX section — separated */}
          <div className="audit-ux-separator">
            <span>📱 User Experience</span>
            <span className="audit-ux-note">Reported separately — not included in overall score</span>
          </div>
          <AuditCategory category={uxPillar} index={pillars.length} animated={animated} isUX />
        </div>
      )}

      {/* Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="audit-recs-list">
          {recommendations.length === 0 ? (
            <div className="audit-no-recs">
              🎉 All checks passed! Your page is well-optimized for AI answer engines.
            </div>
          ) : (
            [PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW].map(priority => {
              const recs = recommendations.filter(r => r.priority === priority);
              if (!recs.length) return null;
              const cfg = PRIORITY_LABELS[priority];
              return (
                <div key={priority} className="rec-group">
                  <h3 className="rec-group-title">
                    {cfg.emoji} {cfg.label}
                    <span className="rec-group-count">{recs.length}</span>
                  </h3>
                  {recs.map(rec => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      onSwitchToSchema={onSwitchToSchema}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
