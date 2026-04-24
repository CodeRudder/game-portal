import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi, afterEach } from 'vitest';

// ── Global cleanup after each test ──
// In singleFork mode all tests share one process, so DOM elements from
// previous test files persist unless we explicitly clean them up.
afterEach(() => {
  cleanup();
});

// ── CanvasRenderingContext2D mock for PixiJS ──
// jsdom does not provide CanvasRenderingContext2D as a global constructor.
// PixiJS (v8) references it internally via BrowserAdapter, so we expose a
// minimal stub on the global scope.  The actual 2d context returned by
// HTMLCanvasElement.prototype.getContext is already mocked below.
class CanvasRenderingContext2DMock {}
(globalThis as any).CanvasRenderingContext2D = CanvasRenderingContext2DMock;
(globalThis as any).OffscreenCanvasRenderingContext2D = CanvasRenderingContext2DMock;

// ── jest → vi compatibility shim ──
// Many test files use `jest.fn()`, `jest.spyOn()`, etc. but the project
// runs on Vitest (which provides `vi.*`).  Expose `jest` as an alias so
// those references resolve at runtime.
const jestShim = {
  fn: vi.fn.bind(vi),
  spyOn: vi.spyOn.bind(vi),
  mock: vi.mock ? vi.mock.bind(vi) : () => {},
  clearAllMocks: vi.clearAllMocks.bind(vi),
  restoreAllMocks: vi.restoreAllMocks.bind(vi),
  resetAllMocks: vi.resetAllMocks.bind(vi),
  useFakeTimers: vi.useFakeTimers ? vi.useFakeTimers.bind(vi) : () => {},
  useRealTimers: vi.useRealTimers ? vi.useRealTimers.bind(vi) : () => {},
  advanceTimersByTime: vi.advanceTimersByTime ? vi.advanceTimersByTime.bind(vi) : () => {},
  runAllTimers: vi.runAllTimers ? vi.runAllTimers.bind(vi) : () => {},
  setSystemTime: vi.setSystemTime ? vi.setSystemTime.bind(vi) : () => {},
} as unknown as jest.Jest;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = jestShim;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Canvas getContext
HTMLCanvasElement.prototype.getContext = function (
  contextId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): RenderingContext | null {
  if (contextId === '2d') {
    const canvas = this;
    return {
      fillRect: () => {},
      clearRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      drawImage: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      arcTo: () => {},
      ellipse: () => {},
      rect: () => {},
      roundRect: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      setLineDash: () => {},
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      createPattern: () => null,
      setTransform: () => {},
      resetTransform: () => {},
      canvas,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
};

// Mock requestAnimationFrame / cancelAnimationFrame
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

window.requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);
  return id;
};

window.cancelAnimationFrame = (id: number) => {
  rafCallbacks.delete(id);
};

// Helper: flush all pending rAF callbacks (call in tests to advance game loops)
globalThis.flushAnimationFrame = (time = 0) => {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((cb) => cb(time));
};

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Extend expect with jest-dom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Assertion<T = any> extends jest.Matchers<T> {}
  }
  function flushAnimationFrame(time?: number): void;
}
