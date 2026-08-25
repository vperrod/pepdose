import { type DBSchema, openDB, type IDBPDatabase } from 'idb';
import type { SchedulePhase } from '../data/peptides';
import type { ProtocolBreak } from '../data/protocols';
import type { UserName } from '../data/users';

/** How this protocol's vial was mixed, so each dose can be shown as pen clicks.
 *  `vialAmount` is in the dose's own unit family — mg for mcg/mg peptides, IU for
 *  IU peptides (see the IU rule in CLAUDE.md). */
export interface ReconMix {
  vialAmount: number;
  bacWaterMl: number;
}

export interface UserProtocol {
  id: string;
  owner: UserName;
  name: string;
  peptideIds: string[];
  /** `customSchedule: true` marks a dose config where the user deliberately picked
   *  "Custom (set your own schedule)" over a peptide's canned protocol variant —
   *  distinct from an older record that simply predates variants existing for its
   *  peptide. Both leave `schedulePhases`/`variantId` unset, but only the latter
   *  should fall back to the peptide's default variant phases (see `openSheet` in
   *  `pages/Protocols.tsx`). */
  doses: { peptideId: string; dose: number; unit: 'mcg' | 'mg' | 'IU'; frequency: string; timesPerDay?: number; timeOfDay: string; durationWeeks?: number; customFrequencyDays?: number; daysOfWeek?: number[]; schedulePhases?: SchedulePhase[]; variantId?: string; recon?: ReconMix; penColor?: string; customSchedule?: boolean }[];
  startDate: string;
  durationWeeks: number;
  status: 'active' | 'paused' | 'completed' | 'archived';
  templateId?: string;
  /** Explicitly scheduled off-week ranges where no doses should be generated. */
  breaks?: ProtocolBreak[];
  /** Opt-in titration alerts: the dashboard's step-up coach card and the
   *  "dose increase today" chip. Off unless the protocol turns them on —
   *  the schedule still contains the step-ups, they just stop being announced. */
  titrationAlerts?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledDose {
  id: string;
  owner: UserName;
  protocolId: string;
  peptideId: string;
  date: string;
  time: string;
  dose: number;
  unit: 'mcg' | 'mg' | 'IU';
  route: string;
  status: 'upcoming' | 'logged' | 'missed' | 'skipped';
  suggestedSite?: string;
  isTitrationStepUp?: boolean;
  weekNumber: number;
  editNote?: string;
  /** When this row was written — not `date`, which is when the injection is due.
   *  Sync merges on this; timing a dose by its future injection date is what let
   *  deleted doses resurrect (see db/sync.ts rowTs). Absent on pre-fix rows. */
  createdAt?: string;
  updatedAt?: string;
}

export interface DoseLog {
  id: string;
  owner: UserName;
  scheduledDoseId?: string;
  protocolId: string;
  peptideId: string;
  date: string;
  time: string;
  dose: number;
  unit: 'mcg' | 'mg' | 'IU';
  route: string;
  injectionSite?: string;
  notes?: string;
  siteReaction?: 'redness' | 'lump' | 'pain' | 'bruise';
  // Systemic symptoms felt around this dose, each rated 1-10. Optional; older
  // logs simply omit it (no migration needed).
  symptoms?: { name: string; severity: number }[];
  createdAt: string;
  updatedAt?: string;
}

export interface Vial {
  id: string;
  owner: UserName;
  peptideId: string;
  amountMg: number;
  bacWaterMl: number;
  reconstitutionDate?: string;
  dosesRemaining: number;
  totalDoses: number;
  expirationDate?: string;
  storageLocation?: string;
  source?: string;
  batchNumber?: string;
  status: 'unreconstituted' | 'active' | 'empty' | 'expired';
  createdAt: string;
  updatedAt?: string;
}

export interface HealthMarker {
  id: string;
  owner: UserName;
  date: string;
  weight?: number;
  bodyFatPct?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  restingHR?: number;
  fastingGlucose?: number;
  mood?: number;
  energy?: number;
  sleepQuality?: number;
  sideEffects?: string;
  notes?: string;
  bloodwork?: Record<string, number>;
  measurements?: Record<string, number>;
  createdAt: string;
  updatedAt?: string;
}

/** Local deletion ledger: every local delete of a synced record is written here
 *  so cloud sync pushes deletes as explicit tombstones instead of inferring them
 *  from absence (which nuked the cloud on a fresh device's first pull). Entries
 *  are pruned once the tombstone lands in the cloud. */
export interface DeletionRecord {
  id: string; // the deleted record's id
  kind: 'protocols' | 'scheduledDoses' | 'doseLogs' | 'vials' | 'healthMarkers';
  deletedAt: string; // ISO timestamp — LWW against a later remote re-edit
}

interface PepDoseDB extends DBSchema {
  protocols: {
    key: string;
    value: UserProtocol;
    indexes: { 'by-status': string; 'by-updatedAt': string };
  };
  scheduledDoses: {
    key: string;
    value: ScheduledDose;
    indexes: {
      'by-date': string;
      'by-protocol': string;
      'by-status': string;
      'by-peptide-date': [string, string];
      'by-updatedAt': string;
    };
  };
  doseLogs: {
    key: string;
    value: DoseLog;
    indexes: {
      'by-date': string;
      'by-protocol': string;
      'by-peptide': string;
      'by-updatedAt': string;
    };
  };
  vials: {
    key: string;
    value: Vial;
    indexes: {
      'by-peptide': string;
      'by-status': string;
      'by-updatedAt': string;
    };
  };
  healthMarkers: {
    key: string;
    value: HealthMarker;
    indexes: { 'by-date': string; 'by-updatedAt': string };
  };
  deletions: {
    key: string;
    value: DeletionRecord;
  };
}

let dbInstance: IDBPDatabase<PepDoseDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<PepDoseDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PepDoseDB>('pepdose', 4, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const protocolStore = db.createObjectStore('protocols', { keyPath: 'id' });
        protocolStore.createIndex('by-status', 'status');

        const doseStore = db.createObjectStore('scheduledDoses', { keyPath: 'id' });
        doseStore.createIndex('by-date', 'date');
        doseStore.createIndex('by-protocol', 'protocolId');
        doseStore.createIndex('by-status', 'status');
        doseStore.createIndex('by-peptide-date', ['peptideId', 'date']);

        const logStore = db.createObjectStore('doseLogs', { keyPath: 'id' });
        logStore.createIndex('by-date', 'date');
        logStore.createIndex('by-protocol', 'protocolId');
        logStore.createIndex('by-peptide', 'peptideId');

        const vialStore = db.createObjectStore('vials', { keyPath: 'id' });
        vialStore.createIndex('by-peptide', 'peptideId');
        vialStore.createIndex('by-status', 'status');

        const healthStore = db.createObjectStore('healthMarkers', { keyPath: 'id' });
        healthStore.createIndex('by-date', 'date');
      }

      if (oldVersion < 2) {
        // Backfill existing single-user data to Victor.
        const owned = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers'] as const;
        for (const storeName of owned) {
          let cursor = await tx.objectStore(storeName).openCursor();
          while (cursor) {
            if (!(cursor.value as { owner?: UserName }).owner) {
              await cursor.update({ ...cursor.value, owner: 'Victor' });
            }
            cursor = await cursor.continue();
          }
        }
      }

      if (oldVersion < 3) {
        // Deletion ledger only — existing stores and data are untouched.
        db.createObjectStore('deletions', { keyPath: 'id' });
      }

      if (oldVersion < 4) {
        // Lets sync read only rows touched since its delta cursor instead of a
        // full-table scan every 30s (see db/sync.ts syncNow). Rows without an
        // `updatedAt` (pre-existing legacy rows) simply aren't indexed here —
        // they're already only reachable via the periodic full sync.
        const stores = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers'] as const;
        for (const name of stores) {
          tx.objectStore(name).createIndex('by-updatedAt', 'updatedAt');
        }
      }
    },
  });

  return dbInstance;
}
