import { evaluateStudy } from '../../src/core/evaluate';
import { generateReport, reportToText } from '../../src/core/report';
import { RULES } from '../../src/core/rules/registry';
import { parseStudyData } from '../../src/core/studyData';
import { device } from '../../src/modules/device';

export function runDevice(values: Record<string, string | number | null>, sex: 'weiblich' | 'männlich' | null = 'männlich') {
  const data = parseStudyData({ values });
  const ev = evaluateStudy(device, RULES.rules, data, { sex });
  const model = generateReport(device, RULES.rules, data, { sex }, ev);
  return { ev, model, text: reportToText(model) };
}
