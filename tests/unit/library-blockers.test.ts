import { describe, expect, it } from 'vitest';
import { insertableBlocks, LIBRARIES } from '../../src/core/library';
import { exportBlockers } from '../../src/core/report';
import { tte } from '../../src/modules/tte';
import { run } from '../helpers/tte';

describe('text-block library (CLAUDE.md: physician-selected only)', () => {
  it('loads the TTE library', () => {
    expect(LIBRARIES.get('tte')?.map((b) => b.id)).toContain('LIB-HI-01');
  });
  it('unreviewed drafts are insertable in TESTBETRIEB only', () => {
    expect(insertableBlocks('tte', 'TESTBETRIEB').map((b) => b.id)).toContain('LIB-HI-01');
    expect(insertableBlocks('tte', 'ECHTBETRIEB')).toEqual([]);
  });
  it('no block enters a report by itself, whatever the values', () => {
    const r = run({ lvef: 25, lvedd: 70, nt_probnp: 5000, rhythm: 'Sinusrhythmus' });
    expect(r.text).not.toContain('Empfehlung');
    expect(r.text).not.toContain('Herzinsuffizienz');
  });
});

describe('export block (gateway §4.2, test §7.5)', () => {
  it('blocks while an unconfirmed value feeds the report', () => {
    const r = run({ lvef: 55 }, 'männlich', { unconfirmed: ['lvef'] });
    expect(exportBlockers(tte, r.data, r.ev)).toEqual(['LVEF']);
  });
  it('does not block for an unconfirmed field without a value', () => {
    const r = run({ lvef: 55 }, 'männlich', { unconfirmed: ['lvedd'] });
    expect(exportBlockers(tte, r.data, r.ev)).toEqual([]);
  });
});
