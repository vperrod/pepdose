import { useState } from 'react';
import { Syringe, Calendar, Bell, ChevronRight, Shield } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Syringe,
    title: 'Track Your Protocols',
    desc: 'Set up peptide cycles with auto-scheduled injections. Every dose, every day — planned for you.',
    color: '#00d4aa',
  },
  {
    icon: Calendar,
    title: 'Never Miss a Dose',
    desc: 'Calendar view shows all scheduled injections. One-tap logging when you inject.',
    color: '#6366f1',
  },
  {
    icon: Bell,
    title: 'Smart Reminders',
    desc: 'Push notifications at injection time. Titration step-up alerts. Cycle end warnings.',
    color: '#f59e0b',
  },
  {
    icon: Shield,
    title: 'Private & Local',
    desc: 'All data stays on your device. No accounts, no cloud, no tracking. Export anytime.',
    color: '#22c55e',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('pepdose-onboarded', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('pepdose-onboarded', 'true');
    onComplete();
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-8 bg-bg relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full" style={{ background: `radial-gradient(circle, ${current.color}40 0%, transparent 70%)` }} />
      </div>

      <button onClick={handleSkip} className="absolute top-12 right-6 text-sm text-text-muted tap-target">
        Skip
      </button>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-colors duration-500"
          style={{ backgroundColor: current.color + '20' }}
        >
          <Icon className="w-9 h-9 transition-colors duration-500" style={{ color: current.color }} />
        </div>

        <h1 className="text-2xl font-bold mb-3">{current.title}</h1>
        <p className="text-text-secondary text-sm leading-relaxed">{current.desc}</p>
      </div>

      <div className="relative z-10 mt-12 w-full max-w-sm">
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                backgroundColor: i === step ? current.color : '#1e2a42',
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full py-3.5 rounded-2xl font-semibold text-bg flex items-center justify-center gap-2 transition-colors duration-300"
          style={{ backgroundColor: current.color }}
        >
          {step < STEPS.length - 1 ? 'Continue' : 'Get Started'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="absolute bottom-8 text-[10px] text-text-muted text-center px-4">
        Educational information only. Not medical advice. Consult your healthcare provider.
      </p>
    </div>
  );
}
