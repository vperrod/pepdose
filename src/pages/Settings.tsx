import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Bell, Moon, Ruler, Clock, Syringe } from 'lucide-react';
import { DEFAULT_ML_PER_CLICK } from '../utils/penClicks';
import { readStoredSettings } from '../utils/storedSettings';
import { requestNotificationPermission, scheduleReminders, showTestNotification, notificationsSupported, triggeredNotificationsSupported } from '../utils/notifications';

interface AppSettings {
  notificationsEnabled: boolean;
  reminderMinutesBefore: number;
  unitSystem: 'metric' | 'imperial';
  syringeType: 'u100' | 'u40';
  /** ml delivered per pen click — pens vary; see utils/penClicks.ts */
  penMlPerClick: number;
  darkMode: boolean;
  defaultInjectionTime: string;
  timezone: string;
}

const DEFAULTS: AppSettings = {
  notificationsEnabled: false,
  reminderMinutesBefore: 15,
  unitSystem: 'metric',
  syringeType: 'u100',
  penMlPerClick: DEFAULT_ML_PER_CLICK,
  darkMode: true,
  defaultInjectionTime: '08:00',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
};

function loadSettings(): AppSettings {
  return { ...DEFAULTS, ...readStoredSettings() };
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

  const [permDenied, setPermDenied] = useState(false);

  const handleNotificationToggle = async () => {
    if (!settings.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermDenied(false);
        update('notificationsEnabled', true);
        // Settings persist via the effect; arm reminders on the next tick.
        setTimeout(() => { void scheduleReminders(); }, 0);
      } else {
        setPermDenied(true);
      }
    } else {
      update('notificationsEnabled', false);
      void scheduleReminders();
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
              disabled={!notificationsSupported()}
              role="switch"
              aria-checked={settings.notificationsEnabled}
              aria-label="Toggle injection reminders"
              className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${settings.notificationsEnabled ? 'bg-primary' : 'bg-border'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.notificationsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {!notificationsSupported() && (
            <p className="mt-2 text-[11px] text-text-muted">This browser doesn't support notifications.</p>
          )}
          {permDenied && (
            <p className="mt-2 text-[11px] text-warning">
              Notifications are blocked. Enable them for this site in your browser settings, then try again.
            </p>
          )}
          {settings.notificationsEnabled && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div>
                <label className="text-xs text-text-muted">Remind before (minutes)</label>
                <select
                  value={settings.reminderMinutesBefore}
                  onChange={e => { update('reminderMinutesBefore', parseInt(e.target.value)); setTimeout(() => { void scheduleReminders(); }, 0); }}
                  className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value={0}>At dose time</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <button
                onClick={() => { void showTestNotification(); }}
                className="w-full text-xs font-medium text-primary border border-primary/30 rounded-lg py-2 tap-target"
              >
                Send a test notification
              </button>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <label className="text-xs text-text-muted">Reminder timezone</label>
                  <p className="text-[10px] text-text-muted">Use your home zone so travel doesn't shift dose times.</p>
                </div>
                <span className="text-xs font-mono text-text-secondary bg-bg border border-border rounded px-2 py-1">
                  {settings.timezone}
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {triggeredNotificationsSupported()
                  ? 'On this browser, reminders can fire even when pepdose is fully closed. Otherwise they fire while the app is open or in the background — keep it installed to your home screen and open daily.'
                  : 'Reminders fire while pepdose is open or in the background. For alerts when the app is fully closed, keep it installed to your home screen and open daily (some browsers support closed-app alerts).'}
              </p>
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

        {/* Pen */}
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.22s' }}>
          <div className="flex items-center gap-3">
            <Syringe className="w-5 h-5 text-text-muted" />
            <div className="flex-1">
              <p className="font-medium text-sm">Pen Click Volume</p>
              <p className="text-xs text-text-muted">Used to show clicks per dose</p>
            </div>
            <select
              value={settings.penMlPerClick}
              onChange={e => update('penMlPerClick', parseFloat(e.target.value))}
              className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm"
              aria-label="Pen click volume"
            >
              <option value={0.005}>0.005 ml (½ unit)</option>
              <option value={0.01}>0.01 ml (1 unit)</option>
              <option value={0.02}>0.02 ml (2 units)</option>
            </select>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-text-muted mt-8 stagger-item" style={{ animationDelay: '0.25s' }}>
        PepDose v0.1.0 · build {__BUILD_TIME__} UTC
      </p>
      <p className="text-center text-[10px] text-text-muted mt-1 stagger-item" style={{ animationDelay: '0.3s' }}>
        Educational information only. Not medical advice.
      </p>
    </div>
  );
}
