import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest.config.ts doesn't enable `test.globals`, so React Testing
// Library's own auto-cleanup (which only self-registers against a global
// `afterEach`) never fires — without this, every test in a file renders
// into the same document without unmounting the previous one.
afterEach(() => {
  cleanup();
});

// This jsdom setup doesn't give components a fully working `localStorage`
// (methods exist but aren't callable) — swap in a minimal, reliable
// in-memory implementation rather than depend on jsdom's.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// jsdom doesn't implement `window.matchMedia`, used by ThemeProvider to
// read the `prefers-color-scheme` system preference.
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
  configurable: true,
});
