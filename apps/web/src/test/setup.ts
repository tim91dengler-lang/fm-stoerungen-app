import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom implementiert weder IntersectionObserver (Scroll-Spy in core/detail)
// noch scrollIntoView — minimal mocken, damit Detail-Navigations-Tests laufen.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    constructor(_cb: IntersectionObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
