/**
 * cloud-save.types — 单元测试
 *
 * 覆盖：
 *   - CloudSyncState 枚举值完整性
 *   - DefaultNetworkDetector.isWifi / isOnline
 *   - 类型接口编译验证
 *
 * @module engine/settings/__tests__/cloud-save-types.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CloudSyncState,
  DefaultNetworkDetector,
} from '../cloud-save.types';

// ─────────────────────────────────────────────
// CloudSyncState 枚举
// ─────────────────────────────────────────────

describe('CloudSyncState', () => {
  it('should have all expected states', () => {
    expect(CloudSyncState.Idle).toBe('idle');
    expect(CloudSyncState.Syncing).toBe('syncing');
    expect(CloudSyncState.Success).toBe('success');
    expect(CloudSyncState.Failed).toBe('failed');
    expect(CloudSyncState.Conflict).toBe('conflict');
  });

  it('should have exactly 5 states', () => {
    const values = Object.values(CloudSyncState);
    expect(values).toHaveLength(5);
  });

  it('all values should be unique strings', () => {
    const values = Object.values(CloudSyncState);
    const set = new Set(values);
    expect(set.size).toBe(values.length);
  });
});

// ─────────────────────────────────────────────
// DefaultNetworkDetector
// ─────────────────────────────────────────────

describe('DefaultNetworkDetector', () => {
  let detector: DefaultNetworkDetector;

  beforeEach(() => {
    detector = new DefaultNetworkDetector();
  });

  describe('isWifi', () => {
    it('should return true when navigator is undefined (SSR)', () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error — testing SSR scenario
      delete globalThis.navigator;
      expect(detector.isWifi()).toBe(true);
      globalThis.navigator = originalNavigator;
    });

    it('should return true when navigator.connection.type is wifi', () => {
      const original = (globalThis.navigator as Record<string, unknown>).connection;
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: { type: 'wifi' },
        configurable: true,
        writable: true,
      });
      expect(detector.isWifi()).toBe(true);
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: original,
        configurable: true,
        writable: true,
      });
    });

    it('should return false when navigator.connection.type is cellular', () => {
      const original = (globalThis.navigator as Record<string, unknown>).connection;
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: { type: 'cellular' },
        configurable: true,
        writable: true,
      });
      expect(detector.isWifi()).toBe(false);
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: original,
        configurable: true,
        writable: true,
      });
    });

    it('should return true when navigator.connection has no type property', () => {
      const original = (globalThis.navigator as Record<string, unknown>).connection;
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: { effectiveType: '4g' },
        configurable: true,
        writable: true,
      });
      expect(detector.isWifi()).toBe(true);
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: original,
        configurable: true,
        writable: true,
      });
    });

    it('should return true when navigator.connection is null', () => {
      const original = (globalThis.navigator as Record<string, unknown>).connection;
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: null,
        configurable: true,
        writable: true,
      });
      expect(detector.isWifi()).toBe(true);
      Object.defineProperty(globalThis.navigator, 'connection', {
        value: original,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('isOnline', () => {
    it('should return true when navigator is undefined (SSR)', () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error — testing SSR scenario
      delete globalThis.navigator;
      expect(detector.isOnline()).toBe(true);
      globalThis.navigator = originalNavigator;
    });

    it('should return navigator.onLine value when available', () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });
      expect(detector.isOnline()).toBe(true);

      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });
      expect(detector.isOnline()).toBe(false);

      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
        writable: true,
      });
    });
  });
});
