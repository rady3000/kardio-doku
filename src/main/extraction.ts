// Runs one extraction: provider OCR → deterministic matching → automatic
// rejection → values enter the study UNCONFIRMED with provenance (gateway §4).
// Extraction only pre-fills: a field that already has an entered value is
// left untouched.
import type { ExtractionProvider } from '../gateway/provider';
import { extractFromOcr } from '../core/extraction/run';
import { formatQualified, readQualified } from '../core/format';
import { MODULE_SCHEMAS } from '../modules';
import { parseStudyData } from '../core/studyData';
import type { Betriebsmodus } from '../shared/mode';
import type { ExtractionSummary } from '../shared/types';
import type { DocumentStore } from './documents';
import type { Repository } from './repository';

export async function runExtraction(opts: {
  repo: Repository;
  docs: DocumentStore;
  provider: ExtractionProvider;
  mode: Betriebsmodus;
  threshold: number;
  studyId: number;
  documentId: number;
}): Promise<ExtractionSummary> {
  const { repo, docs, provider, mode, threshold, studyId, documentId } = opts;
  const study = repo.getStudy(studyId);
  const doc = docs.data(documentId);
  if (!study || !doc || doc.info.studyId !== studyId) throw new Error('Studie oder Dokument nicht gefunden.');
  if (!doc.info.anonymizedAt) {
    return { ok: false, message: 'Bitte zuerst bestätigen, dass das Dokument anonymisiert ist.', accepted: [], rejected: [], skipped: [] };
  }
  const schema = MODULE_SCHEMAS.get(study.moduleKey);
  if (!schema) throw new Error('Kein Formular für dieses Modul.');

  const ocr = await provider.ocr({ fileName: doc.info.fileName, mime: doc.info.mime, bytes: doc.bytes });
  const outcomes = extractFromOcr(schema, ocr, threshold);
  const data = parseStudyData(study.data);
  const summary: ExtractionSummary = { ok: true, message: '', accepted: [], rejected: [], skipped: [] };

  for (const { field, outcome } of outcomes) {
    const entered =
      Object.prototype.hasOwnProperty.call(data.values, field.key) &&
      data.values[field.key] !== null &&
      !data.presets.includes(field.key);
    if (!outcome.ok && outcome.candidate === null) continue; // label not in the document
    const c = outcome.candidate!;
    const shown = (v: number | string) => {
      const q = readQualified(v);
      return q ? formatQualified(q, 6) : String(v);
    };
    const extractionId = docs.audit({
      studyId,
      documentId,
      mode,
      provider: ocr.provider,
      model: ocr.model,
      fieldKey: field.key,
      rawText: c.rawText,
      valueExtracted: outcome.ok ? String(outcome.stored) : c.valueText,
      unit: outcome.ok ? outcome.unit : c.unitText,
      confidence: c.confidence,
      page: c.page,
      bbox: c.box,
      status: outcome.ok ? 'accepted' : 'rejected',
      reason: outcome.ok ? (entered ? 'bereits eingegeben' : null) : outcome.reason,
    });
    if (entered) {
      summary.skipped.push(field.label);
      continue;
    }
    if (!outcome.ok) {
      data.extractionFailed[field.key] = outcome.reason;
      summary.rejected.push({ field: field.label, reason: outcome.reason });
      continue;
    }
    data.values[field.key] = outcome.stored;
    data.presets = data.presets.filter((k) => k !== field.key);
    if (!data.unconfirmed.includes(field.key)) data.unconfirmed.push(field.key);
    delete data.extractionFailed[field.key];
    data.provenance[field.key] = {
      extractionId,
      documentId,
      page: c.page,
      box: c.box!,
      pageWidth: c.pageSize.width,
      pageHeight: c.pageSize.height,
      rawText: c.rawText,
      confidence: c.confidence!,
      extracted: outcome.stored,
    };
    summary.accepted.push(`${field.label}: ${shown(outcome.stored)}${outcome.unit ? ` ${outcome.unit}` : ''}`);
  }
  repo.updateStudy(studyId, { data });
  summary.message =
    `${summary.accepted.length} Werte übernommen (unbestätigt)` +
    (summary.rejected.length ? `, ${summary.rejected.length} verworfen` : '') +
    (summary.skipped.length ? `, ${summary.skipped.length} bereits eingegeben` : '') +
    '.';
  return summary;
}
