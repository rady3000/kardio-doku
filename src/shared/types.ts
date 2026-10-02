// Shared data model of the Study core (SPEC-shared §2–3), validated with Zod
// at the IPC boundary.
import { z } from 'zod';
import { MODES } from './mode';
import { MODULE_KEYS } from './modules';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SEXES = ['weiblich', 'männlich'] as const;
export type Sex = (typeof SEXES)[number];

/** Editable patient header. Autosave stores incomplete drafts; required fields are flagged in the UI. */
export const PatientInputSchema = z.object({
  lastName: z.string().max(200),
  firstName: z.string().max(200),
  birthDate: isoDate.nullable(),
  sex: z.enum(SEXES).nullable(), // no default (D-40)
  caseId: z.string().max(100),
});
export type PatientInput = z.infer<typeof PatientInputSchema>;

export interface Patient extends PatientInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export const StudyCreateSchema = z.object({
  patientId: z.number().int().positive(),
  moduleKey: z.enum(MODULE_KEYS),
  studyDate: isoDate,
});
export type StudyCreate = z.infer<typeof StudyCreateSchema>;

export const StudyUpdateSchema = z.object({
  studyDate: isoDate.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type StudyUpdate = z.infer<typeof StudyUpdateSchema>;

export interface Study {
  id: number;
  patientId: number;
  moduleKey: (typeof MODULE_KEYS)[number];
  studyDate: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const ModeSchema = z.enum(MODES);

export interface ProviderInfo {
  id: string;
  displayName: string;
  isLocal: boolean;
  /** False when the provider cannot be used in the current mode or is not built yet. */
  enabled: boolean;
  /** Shown next to a greyed-out provider. */
  disabledReason: string | null;
}

export interface AppState {
  mode: (typeof MODES)[number];
  databasePath: string;
  version: string;
  providers: ProviderInfo[];
}
