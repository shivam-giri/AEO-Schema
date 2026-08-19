import { Sparkles, Home, FileText, Newspaper, PhoneCall, Users, HelpCircle } from 'lucide-react';

export const PAGE_TYPES = [
  { id: 'auto',       label: 'Auto-Detect',       icon: Sparkles,   desc: 'Smart DOM & URL detection' },
  { id: 'homepage',   label: 'Homepage',          icon: Home,       desc: 'Brand identity & WebSite' },
  { id: 'article',    label: 'Article / Blog',    icon: FileText,   desc: 'Editorial & publication' },
  { id: 'news-media', label: 'News & Media',      icon: Newspaper,  desc: 'Press releases & news' },
  { id: 'contact-us', label: 'Contact Us',        icon: PhoneCall,  desc: 'Location & contact info' },
  { id: 'bod',        label: 'Board of Directors',icon: Users,      desc: 'Leadership & Person profiles' },
  { id: 'faq',        label: 'FAQ Page',          icon: HelpCircle, desc: 'Q&A & voice search' },
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
