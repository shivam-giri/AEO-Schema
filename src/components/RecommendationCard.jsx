import { Zap } from 'lucide-react';
import { PRIORITY } from '../services/auditAnalyzer.js';

const PRIORITY_CONFIG = {
  [PRIORITY.HIGH]: {
    label: 'High Priority',
    priorityClass: 'priority-high',
    emoji: '🔴',
  },
  [PRIORITY.MEDIUM]: {
    label: 'Medium Priority',
    priorityClass: 'priority-medium',
    emoji: '🟡',
  },
  [PRIORITY.LOW]: {
    label: 'Quick Win',
    priorityClass: 'priority-low',
    emoji: '🟢',
  },
};

export default function RecommendationCard({ rec, onSwitchToSchema }) {
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG[PRIORITY.LOW];

  return (
    <div className={`rec-card ${cfg.priorityClass}`}>
      <div className="rec-card-header">
        <span className={`rec-priority-badge ${cfg.priorityClass}`}>
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
