import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Plus, BarChart3, Menu } from 'lucide-react';

const tabs = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/log', label: 'Log', icon: Plus, isFab: true },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/more', label: 'More', icon: Menu },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
      <div className="bg-bg-raised/95 backdrop-blur-xl border-t border-border safe-bottom">
        <div className="flex items-end justify-around px-2 pt-1">
          {tabs.map((tab) => {
            const isActive = tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
            const Icon = tab.icon;

            if (tab.isFab) {
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="tap-target relative -top-3 flex flex-col items-center"
                  aria-label="Quick Log"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 pulse-glow">
                    <Icon className="w-7 h-7 text-bg" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-medium text-primary mt-1">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="tap-target flex flex-col items-center gap-0.5 py-2 px-3 transition-colors"
                aria-label={tab.label}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-primary' : 'text-text-muted'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-0 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
