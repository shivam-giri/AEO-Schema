import { Zap, ClipboardList } from 'lucide-react';

const MODES = [
  {
    id: 'schema',
    icon: Zap,
    label: 'Schema Generator',
    desc: 'Generate JSON-LD schemas',
  },
  {
    id: 'audit',
    icon: ClipboardList,
    label: 'Full AEO Audit',
    desc: 'Deep analysis + recommendations',
  },
];

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="mode-selector" role="tablist" aria-label="Tool mode">
      {MODES.map(({ id, icon: Icon, label, desc }) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            className={`mode-tab ${isActive ? 'active' : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
          >
            <span className="mode-tab-icon">
              <Icon size={16} />
            </span>
            <span className="mode-tab-text">
              <span className="mode-tab-label">{label}</span>
              <span className="mode-tab-desc">{desc}</span>
            </span>
            {isActive && <span className="mode-tab-active-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
