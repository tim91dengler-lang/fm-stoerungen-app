import { describe, expect, it } from 'vitest';

import { boolStatusValue, dateLteFilter } from './listFields';

describe('listFields — boolStatusValue', () => {
  it('mappt true/false auf die (Default-)Labels', () => {
    expect(boolStatusValue(true)).toBe('aktiv');
    expect(boolStatusValue(false)).toBe('inaktiv');
  });

  it('respektiert eigene Labels', () => {
    expect(boolStatusValue(true, 'an', 'aus')).toBe('an');
    expect(boolStatusValue(false, 'an', 'aus')).toBe('aus');
  });
});

describe('listFields — dateLteFilter (fällig bis ≤)', () => {
  const row = (v: unknown) => ({ getValue: () => v });

  it('matcht, wenn Zeilen-Datum ≤ Filter-Datum (inkl. Gleichheit)', () => {
    expect(dateLteFilter(row('2026-06-01'), 'd', '2026-06-03')).toBe(true);
    expect(dateLteFilter(row('2026-06-03'), 'd', '2026-06-03')).toBe(true);
  });

  it('matcht nicht, wenn Zeilen-Datum > Filter-Datum', () => {
    expect(dateLteFilter(row('2026-06-05'), 'd', '2026-06-03')).toBe(false);
  });

  it('leeres Zeilen-Datum = kein Treffer; kein Filter = alle Treffer', () => {
    expect(dateLteFilter(row(null), 'd', '2026-06-03')).toBe(false);
    expect(dateLteFilter(row('2026-06-05'), 'd', undefined)).toBe(true);
  });
});
