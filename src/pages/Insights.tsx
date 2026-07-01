import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, Heart, MapPin } from 'lucide-react';

export function Insights() {
  const navigate = useNavigate();

  return (
    <div className="safe-top px-5 pt-4">
      <h1 className="text-xl font-bold mb-5 stagger-item">Insights</h1>

      <div className="space-y-3">
        <button onClick={() => navigate('/half-life')} className="card-glass w-full p-5 tap-target text-left stagger-item flex items-center gap-4" style={{ animationDelay: '0.05s' }}>
          <div className="w-11 h-11 rounded-xl bg-secondary-dim flex items-center justify-center">
            <Activity className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-semibold">Half-Life Decay</p>
            <p className="text-sm text-text-muted">Compound levels over time</p>
          </div>
        </button>

        <button onClick={() => navigate('/health-markers')} className="card-glass w-full p-5 tap-target text-left stagger-item flex items-center gap-4" style={{ animationDelay: '0.1s' }}>
          <div className="w-11 h-11 rounded-xl bg-primary-dim flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Health Markers</p>
            <p className="text-sm text-text-muted">Weight, vitals, bloodwork trends</p>
          </div>
        </button>

        <button onClick={() => navigate('/history')} className="card-glass w-full p-5 tap-target text-left stagger-item flex items-center gap-4" style={{ animationDelay: '0.15s' }}>
          <div className="w-11 h-11 rounded-xl bg-warning-dim flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="font-semibold">Dose History</p>
            <p className="text-sm text-text-muted">Log, heatmap, and export</p>
          </div>
        </button>

        <button onClick={() => navigate('/injection-map')} className="card-glass w-full p-5 tap-target text-left stagger-item flex items-center gap-4" style={{ animationDelay: '0.2s' }}>
          <div className="w-11 h-11 rounded-xl bg-secondary-dim flex items-center justify-center">
            <MapPin className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-semibold">Injection Map</p>
            <p className="text-sm text-text-muted">Zone volume &amp; site rotation</p>
          </div>
        </button>
      </div>
    </div>
  );
}
