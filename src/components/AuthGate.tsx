import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { supabase, cloudEnabled } from '../db/supabase';
import { syncNow } from '../db/sync';
import { lockoutRemainingMs } from '../utils/loginThrottle';

// Takes the ref, not ref.current: the caller reads .current during render, when
// the ref is still null, and the effect's [container] dependency never changes
// afterwards — so the trap never armed and the login modal never autofocused.
function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (document.activeElement !== first && document.activeElement !== last) return;
      e.preventDefault();
      document.activeElement === first ? last.focus() : first.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [containerRef]);
}

export function AuthGate({ children }: { children: ReactNode }) {
  if (!cloudEnabled) return <>{children}</>;
  return <CloudGate>{children}</CloudGate>;
}

function CloudGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [firstSyncDone, setFirstSyncDone] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const trapContainerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s));

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      if ((document.activeElement?.tagName ?? '') === 'BODY') {
        triggerRef.current?.focus();
      }
      return;
    }
    triggerRef.current = document.activeElement as HTMLElement | null;
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    // Coalesce: the interval, a focus and a tab-hide can land within the same
    // second, and a full six-store sync takes longer than that — overlapping
    // runs duplicate the work and race each other's results.
    let inFlight: Promise<void> | null = null;
    const runSync = () => {
      if (inFlight) return inFlight;
      inFlight = syncNow()
        .then(res => {
          if (!cancelled && res) setSyncIssue(res.errors.length ? res.errors.join('; ') : null);
        })
        .catch(e => {
          if (!cancelled) setSyncIssue(e instanceof Error ? e.message : 'Sync failed');
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    };
    runSync().finally(() => {
      if (!cancelled) setFirstSyncDone(true);
    });

    const tick = () => { void runSync(); };
    // visibilitychange-hidden, not beforeunload: the browser aborts an unload-time
    // fetch mid-flight, so that trigger only looked like it protected the write.
    // Hiding fires on tab close, app switch and backgrounding, and fires early
    // enough for the request to complete.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') tick();
    };
    const interval = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [session]);

  if (!ready) return <Splash label="Loading…" />;
  if (!session) return <LoginForm containerRef={trapContainerRef} />;
  if (!firstSyncDone) return <Splash label="Syncing your data…" />;
  return (
    <>
      {syncIssue && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-50 safe-top flex items-center justify-center gap-1.5 px-4 py-1.5 bg-danger/15 text-danger text-xs"
        >
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Sync issue: {syncIssue}</span>
        </div>
      )}
      {children}
    </>
  );
}

// Stable fallback so the hook's dependency identity never changes when the
// caller passes no container.
const emptyRef: React.RefObject<HTMLElement | null> = { current: null };

function LoginForm({ containerRef }: { containerRef?: React.RefObject<HTMLDivElement | null> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const failures = useRef({ count: 0, at: 0 });

  useFocusTrap(containerRef ?? emptyRef);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const wait = lockoutRemainingMs(failures.current.count, failures.current.at, Date.now());
    if (wait > 0) {
      setError(`Too many failed attempts. Try again in ${Math.ceil(wait / 1000)}s.`);
      return;
    }
    setError(null);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      failures.current = { count: failures.current.count + 1, at: Date.now() };
      setError(error.message);
    } else {
      failures.current = { count: 0, at: 0 };
    }
  };

  return (
    <div ref={containerRef} className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <CloudCheck className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">pepdose</h1>
        </div>
        <p className="text-sm text-text-muted text-center mb-6">
          Sign in to sync your protocols and doses across devices.
        </p>

        {error && <div className="card-glass p-3 mb-3 border border-danger/40 text-sm text-danger">{error}</div>}

        <form onSubmit={submit} className="space-y-3">
          <input
            ref={emailRef}
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? '…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-4">
          pepdose uses a single shared account. Ask the owner for the credentials.
        </p>
      </div>
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 text-text-muted">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
