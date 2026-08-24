import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, Upload, Trash2, CheckCircle, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { exportAllData, importData, clearAllData } from '../db/operations';
import { getLastOwner } from '../data/users';
import { supabase, cloudEnabled } from '../db/supabase';
import { resetSyncCursor, syncNow } from '../db/sync';

export function ExportImport() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pepdose-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: 'Backup downloaded' });
    } catch {
      setStatus({ type: 'error', msg: 'Export failed' });
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.version || !parsed.protocols) throw new Error('Invalid backup');
        await importData(text, getLastOwner());
        setStatus({ type: 'success', msg: `Imported ${parsed.protocols.length} protocols. Reloading…` });
        // Reload so every screen re-reads the restored data instead of showing stale in-memory state.
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setStatus({ type: 'error', msg: 'Invalid backup file' });
      }
    };
    input.click();
  };

  const handleClear = async () => {
    try {
      await clearAllData();
      setStatus({ type: 'success', msg: 'All data cleared. Reloading…' });
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setStatus({ type: 'error', msg: 'Could not clear data — nothing was deleted' });
    } finally {
      setShowClearConfirm(false);
    }
  };

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5 stagger-item">
        <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Export / Import</h1>
      </div>

      {cloudEnabled && <CloudSyncCard />}

      {status && (
        <div className={`card-glass p-3 mb-4 flex items-center gap-2 stagger-item ${status.type === 'error' ? 'border-danger/40' : 'border-success/40'} border`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-danger" />}
          <p className="text-sm">{status.msg}</p>
        </div>
      )}

      <div className="space-y-3">
        <button onClick={handleExport} className="card-glass w-full p-5 tap-target text-left flex items-center gap-4 stagger-item" style={{ animationDelay: '0.05s' }}>
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Export Backup</p>
            <p className="text-xs text-text-muted">Download all data as JSON</p>
          </div>
        </button>

        <button onClick={handleImport} className="card-glass w-full p-5 tap-target text-left flex items-center gap-4 stagger-item" style={{ animationDelay: '0.1s' }}>
          <div className="w-11 h-11 rounded-xl bg-secondary/15 flex items-center justify-center">
            <Upload className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Import Backup</p>
            <p className="text-xs text-text-muted">Restore from JSON file</p>
          </div>
        </button>

        <div className="pt-4">
          {!showClearConfirm ? (
            <button onClick={() => setShowClearConfirm(true)} className="card-glass w-full p-5 tap-target text-left flex items-center gap-4 stagger-item border border-danger/20" style={{ animationDelay: '0.15s' }}>
              <div className="w-11 h-11 rounded-xl bg-danger/15 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <p className="font-semibold text-sm text-danger">Clear All Data</p>
                <p className="text-xs text-text-muted">Permanently delete everything</p>
              </div>
            </button>
          ) : (
            <div className="card-glass p-4 border border-danger/40 stagger-item">
              <p className="text-sm font-semibold text-danger mb-3">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Cancel</button>
                <button onClick={handleClear} className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-medium">Delete Everything</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CloudSyncCard() {
  const [email, setEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase!.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      resetSyncCursor(); // manual sync = full pass, not a delta
      const res = await syncNow();
      if (!res) setMsg('Not signed in');
      else if (res.errors.length) setMsg(`Partial sync (↑${res.pushed} ↓${res.pulled}) — failed: ${res.errors.join('; ')}`);
      else setMsg(`Synced (↑${res.pushed} ↓${res.pulled})`);
    } catch {
      setMsg('Sync failed — check connection');
    } finally {
      setSyncing(false);
    }
  };

  // Sign-out must wipe the local store: the next account to sign in on this device
  // would otherwise read (and re-upload) the previous account's rows.
  const handleSignOut = async () => {
    setSyncing(true);
    setMsg('Saving your data to the cloud…');
    try {
      await syncNow();
    } catch {
      // A failed final push must not trap the user in a signed-in session; the
      // cloud copy is behind by whatever was unsynced, which is the same state
      // as closing the app.
      setMsg('Could not sync before signing out — local data will still be cleared');
    }
    try {
      await clearAllData();
      resetSyncCursor();
      await supabase!.auth.signOut();
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="card-glass p-4 mb-4 border border-primary/20 stagger-item">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">Cloud sync</p>
          <p className="text-xs text-text-muted">{email ?? 'Signed in'}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="tap-target flex items-center gap-1.5 text-xs text-text-muted"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full py-2.5 rounded-xl bg-primary/15 text-primary text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync now'}
      </button>
      {msg && <p className="text-xs text-text-muted mt-2 text-center">{msg}</p>}
    </div>
  );
}
