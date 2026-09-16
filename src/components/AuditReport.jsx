import { useState, useEffect } from 'react';
import { RefreshCw, Download, Lightbulb, BarChart2, Info, ChevronsDown, ChevronsUp } from 'lucide-react';
import AuditCategory from './AuditCategory.jsx';
import RecommendationCard from './RecommendationCard.jsx';
import { PRIORITY, PILLAR_WEIGHTS } from '../services/auditAnalyzer.js';
import { exportAuditPDF } from '../utils/pdfExporter.js';

const CIRCUMFERENCE = 2 * Math.PI * 52;

// Pillars below this score auto-expand in the Score Breakdown tab; everything
// else starts collapsed to keep the page from being one long scroll. Matches
// the 65/100 pass threshold shown elsewhere in the audit formula.
const AUTO_EXPAND_THRESHOLD = 65;

function getScoreColor(score) {
  if (score >= 80) return 'var(--accent-success)';
  if (score >= 65) return 'var(--accent-primary)';
  if (score >= 40) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
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
  const [recFilter, setRecFilter] = useState(null); // null | PRIORITY.HIGH | PRIORITY.MEDIUM | PRIORITY.LOW

  const {
    pillars, uxPillar, aiAccessPillar, gateMultiplier, preGateScore,
    overallScore, grade, gradeClass,
    recommendations, meta, readabilityScore, searchabilityScore, speedScores,
    pageType, selectedPageType, effectivePageType,
  } = results;

  const allCategories = [aiAccessPillar, ...pillars, uxPillar];

  const [openMap, setOpenMap] = useState(() => {
    const map = {};
    allCategories.forEach(cat => {
      map[cat.id] = typeof cat.score === 'number' && cat.score < AUTO_EXPAND_THRESHOLD;
    });
    return map;
  });

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const toggleCategory = (id) => setOpenMap(m => ({ ...m, [id]: !m[id] }));
  const setAllCategories = (value) => setOpenMap(
    Object.fromEntries(allCategories.map(cat => [cat.id, value]))
  );

  const jumpToRecommendations = (priority) => {
    setRecFilter(priority);
    setActiveTab('recommendations');
  };

  const gatePenaltyPct = Math.round((1 - gateMultiplier) * 100);

  const color  = getScoreColor(overallScore);
  const offset = animated ? CIRCUMFERENCE * (1 - overallScore / 100) : CIRCUMFERENCE;

  const highRecs   = recommendations.filter(r => r.priority === PRIORITY.HIGH);
  const medRecs    = recommendations.filter(r => r.priority === PRIORITY.MEDIUM);
  const lowRecs    = recommendations.filter(r => r.priority === PRIORITY.LOW);
  const passCount  = pillars.reduce((s, p) => s + p.checks.filter(c => c.passed).length, 0);
  const totalCount = pillars.reduce((s, p) => s + p.checks.length, 0);

  const handleDownload = () => {
    try {
      exportAuditPDF({
        overallScore,
        grade,
        meta,
        pageType: effectivePageType || pageType,
        selectedPageType,
        pillars,
        recommendations,
        uxPillar,
        aiAccessPillar,
        gateMultiplier,
      });
    } catch (err) {
      console.error('[AEO Studio] Error generating PDF:', err);
    }
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
          <button className="btn-secondary" onClick={handleDownload}><Download size={14} /> PDF Report</button>
          <button className="btn-primary" onClick={() => onSwitchToSchema()}>⚡ Generate Schemas</button>
        </div>
      </div>

      {/* Overall score strip */}
      <div className="audit-score-strip">

        {/* Gauge + grade */}
        <div className="audit-gauge-wrap">
          <div className="score-gauge" style={{ width: 220, height: 220 }}>
            <svg width="220" height="220" viewBox="0 0 120 120">
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
          {/* AI Crawler Access — gate, not a weighted pillar. Shown first and
              distinctly styled since it scales the entire score below rather
              than being averaged into it. */}
          <div className="audit-summary-row ai-access-row">
            <span className="audit-summary-label">
              {aiAccessPillar.emoji} {aiAccessPillar.label}
              <span className="audit-summary-weight audit-gate-badge" style={{ marginLeft: 4 }}>GATE</span>
            </span>
            <div className="audit-summary-bar-track">
              <div
                className="audit-summary-bar-fill"
                style={{
                  width: animated ? `${aiAccessPillar.score}%` : '0%',
                  background: getScoreColor(aiAccessPillar.score),
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <span className="audit-summary-pct" style={{ color: getScoreColor(aiAccessPillar.score) }}>{aiAccessPillar.score}%</span>
          </div>
          {gatePenaltyPct > 0 && (
            <div className="audit-gate-warning" role="status">
              ⚠️ AI Crawler Access issues are reducing the overall score by {gatePenaltyPct}% ({preGateScore} → {overallScore}) — see the AI Crawler Access section below.
            </div>
          )}

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
              (Schema×25% + Content×25% + Technical×20% + E‑E‑A‑T×20% + Freshness×10%) × AI Access gate<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                = ({pillars.find(p=>p.id==='schema')?.score}×0.25
                + {pillars.find(p=>p.id==='content')?.score}×0.25
                + {pillars.find(p=>p.id==='technical')?.score}×0.20
                + {pillars.find(p=>p.id==='eeat')?.score}×0.20
                + {pillars.find(p=>p.id==='freshness')?.score}×0.10)
                = {preGateScore}
              </span><br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {preGateScore} × {gateMultiplier.toFixed(2)} (AI Access {aiAccessPillar.score}%) = {overallScore}
              </span><br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Pass threshold for calculated scores: 65/100 · UX not included in overall score
              </span>
            </div>
          )}
        </div>

        {/* Rec counts — click to jump to the matching Recommendations filter */}
        <div className="audit-rec-counts">
          <button
            type="button"
            className="rec-count-item rec-high rec-count-clickable"
            onClick={() => jumpToRecommendations(PRIORITY.HIGH)}
            disabled={highRecs.length === 0}
          >
            <span className="rec-count-number">{highRecs.length}</span>
            <span>High</span>
          </button>
          <button
            type="button"
            className="rec-count-item rec-medium rec-count-clickable"
            onClick={() => jumpToRecommendations(PRIORITY.MEDIUM)}
            disabled={medRecs.length === 0}
          >
            <span className="rec-count-number">{medRecs.length}</span>
            <span>Medium</span>
          </button>
          <button
            type="button"
            className="rec-count-item rec-low rec-count-clickable"
            onClick={() => jumpToRecommendations(PRIORITY.LOW)}
            disabled={lowRecs.length === 0}
          >
            <span className="rec-count-number">{lowRecs.length}</span>
            <span>Quick Wins</span>
          </button>
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
          <span className="audit-tab-badge">
            {recFilter ? recommendations.filter(r => r.priority === recFilter).length : recommendations.length}
          </span>
        </button>
      </div>

      {/* Score Breakdown */}
      {activeTab === 'categories' && (
        <div className="audit-categories-list">
          <div className="audit-categories-toolbar">
            <button type="button" className="audit-formula-btn" onClick={() => setAllCategories(true)}>
              <ChevronsDown size={13} /> Expand all
            </button>
            <button type="button" className="audit-formula-btn" onClick={() => setAllCategories(false)}>
              <ChevronsUp size={13} /> Collapse all
            </button>
          </div>
          {/* AI Access gate — shown first since it's a prerequisite, not a
              weighted pillar; see the score-strip warning above for its
              effect on the overall score. */}
          <AuditCategory
            category={aiAccessPillar}
            index={0}
            animated={animated}
            isOpen={!!openMap[aiAccessPillar.id]}
            onToggle={() => toggleCategory(aiAccessPillar.id)}
          />
          <div className="audit-ux-separator">
            <span>🗂️ Weighted Pillars</span>
            <span className="audit-ux-note">Combine into the overall score, then scaled by the AI Access gate above</span>
          </div>
          {pillars.map((cat, i) => (
            <AuditCategory
              key={cat.id}
              category={cat}
              index={i + 1}
              animated={animated}
              isOpen={!!openMap[cat.id]}
              onToggle={() => toggleCategory(cat.id)}
            />
          ))}
          {/* UX section — separated */}
          <div className="audit-ux-separator">
            <span>📱 User Experience</span>
            <span className="audit-ux-note">Reported separately — not included in overall score</span>
          </div>
          <AuditCategory
            category={uxPillar}
            index={pillars.length}
            animated={animated}
            isUX
            isOpen={!!openMap[uxPillar.id]}
            onToggle={() => toggleCategory(uxPillar.id)}
          />
        </div>
      )}

      {/* Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="audit-recs-list">
          {recFilter && (
            <button type="button" className="audit-rec-filter-chip" onClick={() => setRecFilter(null)}>
              Showing {PRIORITY_LABELS[recFilter].label} only ✕
            </button>
          )}
          {recommendations.length === 0 ? (
            <div className="audit-no-recs">
              🎉 All checks passed! Your page is well-optimized for AI answer engines.
            </div>
          ) : (
            [PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW].filter(p => !recFilter || p === recFilter).map(priority => {
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
