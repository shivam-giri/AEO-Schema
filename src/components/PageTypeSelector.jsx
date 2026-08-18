import { Sparkles, Home, FileText, ShoppingBag, HelpCircle, ListOrdered } from 'lucide-react';

export const PAGE_TYPES = [
  { id: 'auto',     label: 'Auto-Detect',     icon: Sparkles,    desc: 'Smart DOM & URL detection' },
  { id: 'homepage', label: 'Homepage',        icon: Home,        desc: 'Brand identity & WebSite' },
  { id: 'article',  label: 'Article / Blog',  icon: FileText,    desc: 'Editorial & publication' },
  { id: 'product',  label: 'Product Page',    icon: ShoppingBag, desc: 'E-commerce & pricing' },
  { id: 'faq',      label: 'FAQ Page',        icon: HelpCircle,  desc: 'Q&A & voice search' },
  { id: 'howto',    label: 'HowTo Guide',     icon: ListOrdered, desc: 'Step-by-step tutorial' },
];

export default function PageTypeSelector({ selectedType, onChange, disabled }) {
  return (
    <div className="page-type-selector-container">
      <label className="page-type-label">Target Page Type:</label>
      <div className="page-type-grid" role="radiogroup" aria-label="Target Page Type">
        {PAGE_TYPES.map(({ id, label, icon: Icon, desc }) => {
          const isSelected = selectedType === id;
          return (
            <button
              key={id}
              type="button"
              className={`page-type-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onChange(id)}
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
            >
              <div className="page-type-card-header">
                <Icon size={16} className="page-type-icon" />
                <span className="page-type-title">{label}</span>
              </div>
              <span className="page-type-desc">{desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
