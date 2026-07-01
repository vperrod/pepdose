import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Protocols } from './pages/Protocols';
import { NewProtocol } from './pages/NewProtocol';
import { Insights } from './pages/Insights';
import { More } from './pages/More';
import { QuickLog } from './pages/QuickLog';
import { PeptideLibrary } from './pages/PeptideLibrary';
import { ReconCalculator } from './pages/ReconCalculator';
import { HalfLife } from './pages/HalfLife';
import { HealthMarkers } from './pages/HealthMarkers';
import { ExperienceGuide } from './pages/ExperienceGuide';
import { VialInventory } from './pages/VialInventory';
import { ExportImport } from './pages/ExportImport';
import { Settings } from './pages/Settings';
import { DoseHistory } from './pages/DoseHistory';
import { Onboarding } from './pages/Onboarding';
import { InjectionMap } from './pages/InjectionMap';

export default function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('pepdose-onboarded') === 'true');

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <BrowserRouter basename="/pepdose">
      <div className="noise-bg flex flex-col min-h-dvh relative">
        <main className="flex-1 pb-24 overflow-y-auto relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/protocols" element={<Protocols />} />
            <Route path="/protocols/new" element={<NewProtocol />} />
            <Route path="/log" element={<QuickLog />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/half-life" element={<HalfLife />} />
            <Route path="/health-markers" element={<HealthMarkers />} />
            <Route path="/more" element={<More />} />
            <Route path="/library" element={<PeptideLibrary />} />
            <Route path="/calculator" element={<ReconCalculator />} />
            <Route path="/experience-guide" element={<ExperienceGuide />} />
            <Route path="/inventory" element={<VialInventory />} />
            <Route path="/export" element={<ExportImport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<DoseHistory />} />
            <Route path="/injection-map" element={<InjectionMap />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
