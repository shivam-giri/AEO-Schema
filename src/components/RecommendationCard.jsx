import { Zap } from 'lucide-react';
import { PRIORITY } from '../services/auditAnalyzer.js';

const PRIORITY_CONFIG = {
  [PRIORITY.HIGH]: {
    label: 'High Priority',
    dot: '#ef4444',
    bg: 'rgba(239,68,68,0.07)',
    border: 'rgba(239,68,68,0.2)',
    badge: 'rgba(239,68,68,0.15)',
    badgeText: '#f87171',
    emoji: '🔴',
  },
  [PRIORITY.MEDIUM]: {
    label: 'Medium Priority',
    dot: '#f59e0b',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.2)',
    badge: 'rgba(245,158,11,0.15)',
    badgeText: '#fbbf24',
    emoji: '🟡',
  },
  [PRIORITY.LOW]: {
    label: 'Quick Win',
    dot: '#10b981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.15)',
    badge: 'rgba(16,185,129,0.15)',
    badgeText: '#34d399',
    emoji: '🟢',
  },
};

export default function RecommendationCard({ rec, onSwitchToSchema }) {
  const cfg = PRIORITY_CONFIG[rec.priority];

  return (
    <div
      className="rec-card"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <div className="rec-card-header">
        <span
          className="rec-priority-badge"
          style={{ background: cfg.badge, color: cfg.badgeText }}
        >
          {cfg.emoji} {cfg.label}
        </span>
        <span className="rec-category-tag">{rec.category}</span>
      </div>
      <h4 className="rec-title">{rec.title}</h4>
      <p className="rec-description">{rec.description}</p>
      {rec.schemaFix && (
        <button
          className="rec-schema-btn"
          onClick={onSwitchToSchema}
          title={`Switch to Schema Generator to fix this`}
        >
          <Zap size={12} />
          Fix with Schema Generator
          {rec.schemaType && (
            <span className="rec-schema-type">→ {rec.schemaType}</span>
          )}
        </button>
      )}
    </div>
  );
}
