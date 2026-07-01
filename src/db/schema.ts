import { type DBSchema, openDB, type IDBPDatabase } from 'idb';
import type { SchedulePhase } from '../data/peptides';

export interface UserProtocol {
  id: string;
  name: string;
  peptideIds: string[];
  doses: { peptideId: string; dose: number; unit: 'mcg' | 'mg'; frequency: string; timesPerDay?: number; timeOfDay: string; durationWeeks?: number; customFrequencyDays?: number; schedulePhases?: SchedulePhase[]; variantId?: string }[];
  startDate: string;
  durationWeeks: number;
  status: 'active' | 'paused' | 'completed' | 'archived';
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledDose {
  id: string;
  protocolId: string;
  peptideId: string;
  date: string;
  time: string;
  dose: number;
  unit: 'mcg' | 'mg';
  route: string;
  status: 'upcoming' | 'logged' | 'missed' | 'skipped';
  suggestedSite?: string;
  isTitrationStepUp?: boolean;
  weekNumber: number;
  editNote?: string;
}

export interface DoseLog {
  id: string;
  scheduledDoseId?: string;
  protocolId: string;
  peptideId: string;
  date: string;
  time: string;
  dose: number;
  unit: 'mcg' | 'mg';
  route: string;
  injectionSite?: string;
  notes?: string;
  siteReaction?: 'redness' | 'lump' | 'pain' | 'bruise';
  createdAt: string;
}

export interface Vial {
  id: string;
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
}

export interface HealthMarker {
  id: string;
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
  createdAt: string;
}

export interface EditHistory {
  id: string;
  protocolId: string;
  field: string;
  oldValue: string;
  newValue: string;
  affectedDoses: number;
  date: string;
}

interface PepDoseDB extends DBSchema {
  protocols: {
    key: string;
    value: UserProtocol;
    indexes: { 'by-status': string };
  };
  scheduledDoses: {
    key: string;
    value: ScheduledDose;
    indexes: {
      'by-date': string;
      'by-protocol': string;
      'by-status': string;
      'by-peptide-date': [string, string];
    };
  };
  doseLogs: {
    key: string;
    value: DoseLog;
    indexes: {
      'by-date': string;
      'by-protocol': string;
      'by-peptide': string;
    };
  };
  vials: {
    key: string;
    value: Vial;
    indexes: {
      'by-peptide': string;
      'by-status': string;
    };
  };
  healthMarkers: {
    key: string;
    value: HealthMarker;
    indexes: { 'by-date': string };
  };
  editHistory: {
    key: string;
    value: EditHistory;
    indexes: { 'by-protocol': string };
  };
}

let dbInstance: IDBPDatabase<PepDoseDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<PepDoseDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PepDoseDB>('pepdose', 1, {
    upgrade(db) {
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

      const editStore = db.createObjectStore('editHistory', { keyPath: 'id' });
      editStore.createIndex('by-protocol', 'protocolId');
    },
  });

  return dbInstance;
}
