import { afterEach, describe, expect, it } from 'vitest';

import { __setVorlageLayoutV2, isVorlageLayoutV2 } from './featureFlags';

describe('featureFlags · vorlage_layout_v2', () => {
  afterEach(() => __setVorlageLayoutV2(null));

  it('ist standardmäßig AUS (kein Env, kein Override)', () => {
    __setVorlageLayoutV2(null);
    expect(isVorlageLayoutV2()).toBe(false);
  });

  it('Override schaltet AN und wieder AUS', () => {
    __setVorlageLayoutV2(true);
    expect(isVorlageLayoutV2()).toBe(true);
    __setVorlageLayoutV2(false);
    expect(isVorlageLayoutV2()).toBe(false);
  });
});
