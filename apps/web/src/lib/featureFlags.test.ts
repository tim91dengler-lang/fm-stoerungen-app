import { afterEach, describe, expect, it } from 'vitest';

import {
  VORLAGE_LAYOUT_V2_STORAGE_KEY,
  __setVorlageLayoutV2,
  isVorlageLayoutV2,
  syncVorlageLayoutV2FromUrl,
} from './featureFlags';

describe('featureFlags · vorlage_layout_v2', () => {
  afterEach(() => {
    __setVorlageLayoutV2(null);
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('ist standardmäßig AUS (kein Env, kein Override, kein localStorage)', () => {
    __setVorlageLayoutV2(null);
    expect(isVorlageLayoutV2()).toBe(false);
  });

  it('Override schaltet AN und wieder AUS', () => {
    __setVorlageLayoutV2(true);
    expect(isVorlageLayoutV2()).toBe(true);
    __setVorlageLayoutV2(false);
    expect(isVorlageLayoutV2()).toBe(false);
  });

  it('localStorage schaltet AN/AUS (ohne Override)', () => {
    __setVorlageLayoutV2(null);
    window.localStorage.setItem(VORLAGE_LAYOUT_V2_STORAGE_KEY, '1');
    expect(isVorlageLayoutV2()).toBe(true);
    window.localStorage.setItem(VORLAGE_LAYOUT_V2_STORAGE_KEY, '0');
    expect(isVorlageLayoutV2()).toBe(false);
  });

  it('Override hat Vorrang vor localStorage', () => {
    window.localStorage.setItem(VORLAGE_LAYOUT_V2_STORAGE_KEY, '0');
    __setVorlageLayoutV2(true);
    expect(isVorlageLayoutV2()).toBe(true);
  });

  describe('syncVorlageLayoutV2FromUrl (Link-Schalter)', () => {
    it('?ff_vorlage_layout_v2=1 persistiert AN in localStorage', () => {
      __setVorlageLayoutV2(null);
      window.history.replaceState({}, '', '/?ff_vorlage_layout_v2=1');
      syncVorlageLayoutV2FromUrl();
      expect(window.localStorage.getItem(VORLAGE_LAYOUT_V2_STORAGE_KEY)).toBe('1');
      expect(isVorlageLayoutV2()).toBe(true);
    });

    it('?ff_vorlage_layout_v2=0 persistiert AUS in localStorage', () => {
      __setVorlageLayoutV2(null);
      window.localStorage.setItem(VORLAGE_LAYOUT_V2_STORAGE_KEY, '1');
      window.history.replaceState({}, '', '/?ff_vorlage_layout_v2=0');
      syncVorlageLayoutV2FromUrl();
      expect(window.localStorage.getItem(VORLAGE_LAYOUT_V2_STORAGE_KEY)).toBe('0');
      expect(isVorlageLayoutV2()).toBe(false);
    });

    it('ohne Parameter bleibt localStorage unangetastet', () => {
      __setVorlageLayoutV2(null);
      window.history.replaceState({}, '', '/tickets');
      syncVorlageLayoutV2FromUrl();
      expect(window.localStorage.getItem(VORLAGE_LAYOUT_V2_STORAGE_KEY)).toBeNull();
      expect(isVorlageLayoutV2()).toBe(false);
    });
  });
});
