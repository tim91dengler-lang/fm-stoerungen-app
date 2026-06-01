import { describe, expect, it } from 'vitest';

import type { TickettypBlockRead, TickettypFeldRead } from '../api/types';
import { buildVorlageLayout, FALLBACK_BLOCK_KEY } from './vorlageLayout';

function block(
  partial: Partial<TickettypBlockRead> & { id: string; block_key: string },
): TickettypBlockRead {
  return {
    label: partial.block_key,
    region: 'links',
    reihenfolge: 0,
    ist_system_block: false,
    collapsible_default_open: true,
    ...partial,
  };
}

function feld(
  partial: Partial<TickettypFeldRead> & { feld_key: string },
): TickettypFeldRead {
  return {
    id: `f-${partial.feld_key}`,
    label: partial.feld_key,
    ist_system_feld: true,
    sichtbar: true,
    pflicht: false,
    nur_admin_sichtbar: false,
    reihenfolge: 0,
    block_id: null,
    ...partial,
  };
}

describe('buildVorlageLayout', () => {
  it('liefert leer bei null-Vorlage', () => {
    expect(buildVorlageLayout(null)).toEqual({ links: [], rechts: [], alle: [] });
  });

  it('liefert leer ohne Blöcke', () => {
    const r = buildVorlageLayout({ bloecke: [], felder: [feld({ feld_key: 'x' })] });
    expect(r).toEqual({ links: [], rechts: [], alle: [] });
  });

  it('gruppiert Felder in Blöcke + Regionen und sortiert nach reihenfolge', () => {
    const bloecke = [
      block({ id: 'b-kopf', block_key: 'kopf', region: 'links', reihenfolge: 0 }),
      block({ id: 'b-bel', block_key: 'belege', region: 'rechts', reihenfolge: 0 }),
      block({ id: 'b-ver', block_key: 'verortung', region: 'links', reihenfolge: 1 }),
    ];
    const felder = [
      feld({ feld_key: 'titel', block_id: 'b-kopf', reihenfolge: 0 }),
      feld({ feld_key: 'foto', block_id: 'b-bel', reihenfolge: 0 }),
      feld({ feld_key: 'haus', block_id: 'b-ver', reihenfolge: 1 }),
      feld({ feld_key: 'objekt', block_id: 'b-ver', reihenfolge: 0 }),
    ];
    const l = buildVorlageLayout({ bloecke, felder });
    expect(l.links.map((b) => b.block_key)).toEqual(['kopf', 'verortung']);
    expect(l.rechts.map((b) => b.block_key)).toEqual(['belege']);
    expect(l.links[1]?.felder.map((f) => f.feld_key)).toEqual(['objekt', 'haus']);
    // Mobile-Reihenfolge: erst links, dann rechts.
    expect(l.alle.map((b) => b.block_key)).toEqual(['kopf', 'verortung', 'belege']);
  });

  it('filtert unsichtbare Felder (onlySichtbar default true)', () => {
    const bloecke = [block({ id: 'b', block_key: 'kopf' })];
    const felder = [
      feld({ feld_key: 'a', block_id: 'b', sichtbar: true }),
      feld({ feld_key: 'b', block_id: 'b', sichtbar: false }),
    ];
    const l = buildVorlageLayout({ bloecke, felder });
    expect(l.links[0]?.felder.map((f) => f.feld_key)).toEqual(['a']);
  });

  it('onlySichtbar=false behält unsichtbare Felder', () => {
    const bloecke = [block({ id: 'b', block_key: 'kopf' })];
    const felder = [feld({ feld_key: 'a', block_id: 'b', sichtbar: false })];
    const l = buildVorlageLayout({ bloecke, felder }, { onlySichtbar: false });
    expect(l.links[0]?.felder.map((f) => f.feld_key)).toEqual(['a']);
  });

  it('Felder mit fehlendem/unbekanntem block_id fallen in den Auffang-Block', () => {
    const bloecke = [
      block({ id: 'b-kopf', block_key: 'kopf', reihenfolge: 0 }),
      block({ id: 'b-weit', block_key: FALLBACK_BLOCK_KEY, reihenfolge: 9 }),
    ];
    const felder = [
      feld({ feld_key: 'x', block_id: null }),
      feld({ feld_key: 'y', block_id: 'nonexistent' }),
    ];
    const l = buildVorlageLayout({ bloecke, felder });
    const weit = l.links.find((b) => b.block_key === FALLBACK_BLOCK_KEY);
    expect(weit).toBeDefined();
    expect(weit?.felder.map((f) => f.feld_key).sort()).toEqual(['x', 'y']);
  });

  it('Felder ohne Block UND ohne Auffang fallen weg (kein Crash)', () => {
    const bloecke = [block({ id: 'b-kopf', block_key: 'kopf' })]; // kein "weitere"
    const felder = [feld({ feld_key: 'orphan', block_id: null })];
    const l = buildVorlageLayout({ bloecke, felder });
    expect(l.links).toEqual([]); // kopf bleibt leer → ausgefiltert
  });

  it('includeEmpty steuert das Behalten leerer Blöcke', () => {
    const bloecke = [
      block({ id: 'b-kopf', block_key: 'kopf', reihenfolge: 0 }),
      block({ id: 'b-leer', block_key: 'leer', reihenfolge: 1 }),
    ];
    const felder = [feld({ feld_key: 'a', block_id: 'b-kopf' })];
    expect(buildVorlageLayout({ bloecke, felder }).links.map((b) => b.block_key)).toEqual(
      ['kopf'],
    );
    expect(
      buildVorlageLayout({ bloecke, felder }, { includeEmpty: true }).links.map(
        (b) => b.block_key,
      ),
    ).toEqual(['kopf', 'leer']);
  });
});
