export interface Report {
  id: string; // uuid
  createdAt: string; // ISO date
  name: string; // e.g. "Fall 2025 Survey"
  status: 'in_progress' | 'complete';
}

export interface Pasture {
  id: string; // uuid
  reportId: string;
  index: number; // 1..11
  name: string;
  status: 'in_progress' | 'complete';
}

export type GrassType = 'GG' | 'WW' | 'SD' | 'LL' | 'OT';

export interface Entry {
  id: string; // uuid
  reportId: string;
  pastureId: string;
  lineNo: number; // 1..100

  bareGround: boolean;
  grassHeight?: number; // inches
  grassType?: GrassType;
  litter?: boolean;
  forbBush?: boolean;
  weed?: boolean;
  // Optional flag if we ever need to explicitly mark grass as the category.
  // Currently, grass is implied when none of the above flags are true and grass fields are present.
  grass?: boolean;

  updatedAt: string; // ISO
}
