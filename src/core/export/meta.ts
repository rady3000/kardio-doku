// Shared data for DOCX and PDF exports.
import type { Betriebsmodus } from '../../shared/mode';

export interface ExportMeta {
  mode: Betriebsmodus;
  patientLine: string;
  studyDate: string;
  appVersion: string;
}

/** Export file name without patient data (D-44). */
export function exportFileName(moduleKey: string, studyDate: string, studyId: number, ext: 'docx' | 'pdf'): string {
  return `${moduleKey.toUpperCase()}_${studyDate}_U${studyId}.${ext}`;
}
