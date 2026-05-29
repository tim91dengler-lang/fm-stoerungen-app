import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. SSR-safe (returns false until mounted).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True at Tailwind's `lg` breakpoint (>= 1024px) — the single mobile/desktop boundary. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
