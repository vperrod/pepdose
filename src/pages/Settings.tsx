import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Moon, Ruler, Clock } from 'lucide-react';

interface AppSettings {
  notificationsEnabled: boolean;
  reminderMinutesBefore: number;
  unitSystem: 'metric' | 'imperial';
  syringeType: 'u100' | 'u40';
  darkMode: boolean;
  defaultInjectionTime: string;
}

const DEFAULTS: AppSettings = {
  notificationsEnabled: false,
  reminderMinutesBefore: 15,
  unitSystem: 'metric',
  syringeType: 'u100',
  darkMode: true,
  defaultInjectionTime: '08:00',
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('pepdose-settings');
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function persistSettings(s: AppSettings) {
  localStorage.setItem('pepdose-settings', JSON.stringify(s));
}

export function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => { persistSettings(settings); }, [settings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNotificationToggle = async () => {
    if (!settings.notificationsEnabled) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') update('notificationsEnabled', true);
      }
    } else {
      update('notificationsEnabled', false);
    }
  };

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5 stagger-item">
        <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="space-y-2">
        {/* Notifications */}
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Push Notifications</p>
              <p className="text-xs text-text-muted">Injection reminders</p>
            </div>
            <button
              onClick={handleNotificationToggle}
              className={`w-11 h-6 rounded-full transition-colors relative ${settings.notificationsEnabled ? 'bg-primary' : 'bg-border'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.notificationsEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {settings.notificationsEnabled && (
            <div className="mt-3 pt-3 border-t border-border">
              <label className="text-xs text-text-muted">Remind before (minutes)</label>
              <select
                value={settings.reminderMinutesBefore}
                onChange={e => update('reminderMinutesBefore', parseInt(e.target.value))}
                className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
          )}
        </div>

        {/* Default time */}
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-secondary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Default Injection Time</p>
            </div>
            <input
              type="time"
              value={settings.defaultInjectionTime}
              onChange={e => update('defaultInjectionTime', e.target.value)}
              className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Units */}
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3">
            <Ruler className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-sm">Units</p>
            </div>
            <div className="flex bg-bg rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => update('unitSystem', 'metric')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${settings.unitSystem === 'metric' ? 'bg-primary text-bg' : 'text-text-muted'}`}
              >
                Metric
              </button>
              <button
                onClick={() => update('unitSystem', 'imperial')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${settings.unitSystem === 'imperial' ? 'bg-primary text-bg' : 'text-text-muted'}`}
              >
                Imperial
              </button>
            </div>
          </div>
        </div>

        {/* Syringe */}
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-text-muted" />
            <div className="flex-1">
              <p className="font-medium text-sm">Syringe Type</p>
            </div>
            <select
              value={settings.syringeType}
              onChange={e => update('syringeType', e.target.value as 'u100' | 'u40')}
              className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="u100">U-100 Insulin</option>
              <option value="u40">U-40</option>
            </select>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-text-muted mt-8 stagger-item" style={{ animationDelay: '0.25s' }}>
        PepDose v0.1.0
      </p>
      <p className="text-center text-[10px] text-text-muted mt-1 stagger-item" style={{ animationDelay: '0.3s' }}>
        Educational information only. Not medical advice.
      </p>
    </div>
  );
}
