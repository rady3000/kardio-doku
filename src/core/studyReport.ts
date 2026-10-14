// Report of a stored study: the same function feeds the preview (renderer)
// and every export (main process), so what you see is what is exported.
import { MODULE_SCHEMAS } from '../modules';
import type { Patient, Study } from '../shared/types';
import { evaluateStudy, type Evaluation } from './evaluate';
import { exportBlockers, generateReport, type ReportModel } from './report';
import { RULES } from './rules/registry';
import type { ModuleSchema } from './schema';
import { parseStudyData, type StudyData } from './studyData';

export interface StudyReport {
  schema: ModuleSchema;
  data: StudyData;
  evaluation: Evaluation;
  model: ReportModel;
  blockers: string[];
}

export function buildStudyReport(
  study: Pick<Study, 'moduleKey' | 'data'>,
  patient: Pick<Patient, 'sex'>,
  data: StudyData = parseStudyData(study.data),
): StudyReport | null {
  const schema = MODULE_SCHEMAS.get(study.moduleKey);
  if (!schema) return null;
  if (RULES.problems.length) throw new Error(`Invalid rule files:\n${RULES.problems.join('\n')}`);
  const ctx = { sex: patient.sex };
  const evaluation = evaluateStudy(schema, RULES.rules, data, ctx);
  const model = generateReport(schema, RULES.rules, data, ctx, evaluation);
  return { schema, data, evaluation, model, blockers: exportBlockers(schema, data, evaluation) };
}
