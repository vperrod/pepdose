import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { BottomNav } from './components/BottomNav';
import { Onboarding } from './pages/Onboarding';
// Every route is a separate chunk: this is a mobile PWA whose pages are large
// (Protocols alone is ~50KB of source) and a session opens two or three of them,
// so shipping all twenty in the entry bundle costs every load. Onboarding stays
// eager — it renders before the router on a first-ever launch.
const Dashboard = lazy(async () => ({ default: (await import('./pages/Dashboard')).Dashboard }));
const Calendar = lazy(async () => ({ default: (await import('./pages/Calendar')).Calendar }));
const Protocols = lazy(async () => ({ default: (await import('./pages/Protocols')).Protocols }));
const CycleDetail = lazy(async () => ({ default: (await import('./pages/CycleDetail')).CycleDetail }));
const AddPeptides = lazy(async () => ({ default: (await import('./pages/AddPeptides')).AddPeptides }));
const Insights = lazy(async () => ({ default: (await import('./pages/Insights')).Insights }));
const More = lazy(async () => ({ default: (await import('./pages/More')).More }));
const QuickLog = lazy(async () => ({ default: (await import('./pages/QuickLog')).QuickLog }));
const PeptideLibrary = lazy(async () => ({ default: (await import('./pages/PeptideLibrary')).PeptideLibrary }));
const ReconCalculator = lazy(async () => ({ default: (await import('./pages/ReconCalculator')).ReconCalculator }));
const HalfLife = lazy(async () => ({ default: (await import('./pages/HalfLife')).HalfLife }));
const HealthMarkers = lazy(async () => ({ default: (await import('./pages/HealthMarkers')).HealthMarkers }));
const ExperienceGuide = lazy(async () => ({ default: (await import('./pages/ExperienceGuide')).ExperienceGuide }));
const VialInventory = lazy(async () => ({ default: (await import('./pages/VialInventory')).VialInventory }));
const ExportImport = lazy(async () => ({ default: (await import('./pages/ExportImport')).ExportImport }));
const Settings = lazy(async () => ({ default: (await import('./pages/Settings')).Settings }));
const DoseHistory = lazy(async () => ({ default: (await import('./pages/DoseHistory')).DoseHistory }));
const InjectionMap = lazy(async () => ({ default: (await import('./pages/InjectionMap')).InjectionMap }));
const Symptoms = lazy(async () => ({ default: (await import('./pages/Symptoms')).Symptoms }));
const GoalPicker = lazy(async () => ({ default: (await import('./pages/GoalPicker')).GoalPicker }));
import { ViewFilterProvider } from './context/ViewFilterContext';
import { UserFilterChip } from './components/UserFilterChip';
import { AuthGate } from './components/AuthGate';
import { initReminders } from './utils/notifications';
import { repairDuplicateScheduledDoses, repairEmptyFiveDayProtocols } from './db/operations';

export default function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('pepdose-onboarded') === 'true');

  return (
    <AuthGate>
      <AppInner onboarded={onboarded} setOnboarded={setOnboarded} />
    </AuthGate>
  );
}

function AppInner({ onboarded, setOnboarded }: { onboarded: boolean; setOnboarded: (v: boolean) => void }) {
  useEffect(() => {
    if (!onboarded) return;
    // Clear schedules the old sync bug duplicated. Idempotent: once a device is
    // clean this finds nothing, and the fix in db/sync.ts stops it recurring.
    void repairDuplicateScheduledDoses().then(n => {
      if (n > 0) console.info(`[pepdose] removed ${n} duplicate scheduled dose(s)`);
    });
    void repairEmptyFiveDayProtocols();
    return initReminders();
  }, [onboarded]);

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <ViewFilterProvider>
    <BrowserRouter basename="/pepdose">
      <div className="noise-bg flex flex-col min-h-dvh relative">
        <header className="safe-top sticky top-0 z-40 flex justify-end px-5 py-2 bg-bg/80 backdrop-blur-xl">
          <UserFilterChip />
        </header>
        <main className="flex-1 pb-24 overflow-y-auto relative">
          <Suspense fallback={<div className="p-8" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/protocols" element={<Protocols />} />
            <Route path="/protocols/new" element={<AddPeptides />} />
            <Route path="/cycle/:protocolId/:peptideId" element={<CycleDetail />} />
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
            <Route path="/symptoms" element={<Symptoms />} />
            <Route path="/find" element={<GoalPicker />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
    </ViewFilterProvider>
  );
}
