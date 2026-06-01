import { afterEach, describe, expect, it } from 'vitest';

import {
  VORLAGE_LAYOUT_V2_STORAGE_KEY,
  __setVorlageLayoutV2,
  isVorlageLayoutV2,
} from './featureFlags';

describe('featureFlags · vorlage_layout_v2', () => {
  afterEach(() => {
    __setVorlageLayoutV2(null);
    window.localStorage.clear();
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
});
