import Dexie, { Table } from 'dexie';
import type { Entry, Pasture, Report } from './types';

export class PasturizeDB extends Dexie {
  reports!: Table<Report, string>;
  pastures!: Table<Pasture, string>;
  entries!: Table<Entry, string>;

  constructor() {
    super('pasturize');
    this.version(1).stores({
      // Primary keys are string uuids (id)
      reports: 'id, createdAt, name, status',
      pastures: 'id, reportId, index, status',
      // Helpful composite index to ensure fast lookup and uniqueness by line
      entries: 'id, reportId, pastureId, lineNo, updatedAt, [reportId+pastureId+lineNo]'
    });
  }
}

export const db = new PasturizeDB();

