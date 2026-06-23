import { useNavigate } from 'react-router-dom';
import { Package, Calculator, BookOpen, Settings, Download, Shield, Syringe, ClipboardList } from 'lucide-react';

const menuItems = [
  { icon: Syringe, label: 'Protocols', desc: 'Create and manage cycles', color: '#00d4aa', path: '/protocols' },
  { icon: ClipboardList, label: 'Dose History', desc: 'Full injection log', color: '#6366f1', path: '/history' },
  { icon: Package, label: 'Vial Inventory', desc: 'Track vials, doses remaining', color: '#22c55e', path: '/inventory' },
  { icon: Calculator, label: 'Reconstitution Calculator', desc: 'Dose volume calculations', color: '#6366f1', path: '/calculator' },
  { icon: BookOpen, label: 'Peptide Library', desc: 'Profiles, protocols, stacking', color: '#00d4aa', path: '/library' },
  { icon: Shield, label: 'Experience Guide', desc: 'Week-by-week, side effects', color: '#f59e0b', path: '/experience-guide' },
  { icon: Download, label: 'Export / Import', desc: 'Backup and restore data', color: '#94a3b8', path: '/export' },
  { icon: Settings, label: 'Settings', desc: 'Notifications, units, theme', color: '#64748b', path: '/settings' },
];

export function More() {
  const navigate = useNavigate();

  return (
    <div className="safe-top px-5 pt-4">
      <h1 className="text-xl font-bold mb-5 stagger-item">More</h1>

      <div className="space-y-2">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className="card-glass w-full p-4 tap-target text-left flex items-center gap-4 stagger-item"
              style={{ animationDelay: `${0.05 + i * 0.04}s` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: item.color + '22' }}
              >
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-text-muted">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-text-muted mt-8 mb-4 stagger-item" style={{ animationDelay: '0.3s' }}>
        PepDose v0.1.0 · Educational use only
      </p>
    </div>
  );
}
