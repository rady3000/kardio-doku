import { evaluateStudy } from '../../src/core/evaluate';
import { generateReport, reportToText } from '../../src/core/report';
import { RULES } from '../../src/core/rules/registry';
import { parseStudyData, type StudyData } from '../../src/core/studyData';
import { tte } from '../../src/modules/tte';

export type Sex = 'weiblich' | 'männlich' | null;

export function run(values: Record<string, string | number | null>, sex: Sex = 'männlich', extra: Partial<StudyData> = {}) {
  const data = parseStudyData({ values, ...extra });
  const ev = evaluateStudy(tte, RULES.rules, data, { sex });
  const model = generateReport(tte, RULES.rules, data, { sex }, ev);
  return { data, ev, model, text: reportToText(model) };
}

/** Body text of one report line (e.g. "lv"). */
export function line(model: ReturnType<typeof run>['model'], id: string): string {
  for (const s of [...model.head, ...model.body]) {
    const l = s.lines.find((x) => x.id === id);
    if (l) return l.sentences.filter((x) => !x.removed).map((x) => x.text).join(' ');
  }
  throw new Error(`no line ${id}`);
}
