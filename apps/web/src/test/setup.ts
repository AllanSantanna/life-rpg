import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 13, 12));
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
