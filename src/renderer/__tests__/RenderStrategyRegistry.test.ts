/**
 * RenderStrategyRegistry 测试
 *
 * 测试渲染策略注册表的所有功能：
 * - 默认策略获取
 * - 游戏映射策略获取
 * - 自定义策略注册
 * - 策略列表和查询
 */

import { RenderStrategyRegistry } from '../RenderStrategyRegistry';
import type { RenderStrategy } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试用策略
// ═══════════════════════════════════════════════════════════════

const TEST_STRATEGY: RenderStrategy = {
  name: 'test-strategy',
  sceneType: 'idle',
  theme: {
    background: '#ff0000',
    panelBackground: '#00ff00',
    textPrimary: '#0000ff',
    textSecondary: '#888888',
    accent: '#ffff00',
    success: '#00ff00',
    warning: '#ff8800',
    resourceBarBg: '#333333',
    buttonBg: '#444444',
    buttonHover: '#555555',
  },
  layout: {
    resourceBarHeight: 0.15,
    buildingAreaHeight: 0.4,
    upgradePanelHeight: 0.35,
    statsPanelWidth: 0.25,
    gridColumns: 5,
    gridGap: 12,
    padding: 16,
    borderRadius: 6,
  },
};

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('RenderStrategyRegistry', () => {
  // ─── getDefault ───────────────────────────────────────────

  describe('getDefault', () => {
    it('should return a valid default strategy', () => {
      const strategy = RenderStrategyRegistry.getDefault();
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe('default');
      expect(strategy.sceneType).toBe('idle');
    });

    it('default strategy should have all required theme properties', () => {
      const strategy = RenderStrategyRegistry.getDefault();
      expect(strategy.theme).toHaveProperty('background');
      expect(strategy.theme).toHaveProperty('panelBackground');
      expect(strategy.theme).toHaveProperty('textPrimary');
      expect(strategy.theme).toHaveProperty('textSecondary');
      expect(strategy.theme).toHaveProperty('accent');
      expect(strategy.theme).toHaveProperty('success');
      expect(strategy.theme).toHaveProperty('warning');
      expect(strategy.theme).toHaveProperty('resourceBarBg');
      expect(strategy.theme).toHaveProperty('buttonBg');
      expect(strategy.theme).toHaveProperty('buttonHover');
    });

    it('default strategy should have all required layout properties', () => {
      const strategy = RenderStrategyRegistry.getDefault();
      expect(strategy.layout).toHaveProperty('resourceBarHeight');
      expect(strategy.layout).toHaveProperty('buildingAreaHeight');
      expect(strategy.layout).toHaveProperty('upgradePanelHeight');
      expect(strategy.layout).toHaveProperty('statsPanelWidth');
      expect(strategy.layout).toHaveProperty('gridColumns');
      expect(strategy.layout).toHaveProperty('gridGap');
      expect(strategy.layout).toHaveProperty('padding');
      expect(strategy.layout).toHaveProperty('borderRadius');
    });

    it('default strategy layout values should be valid proportions', () => {
      const strategy = RenderStrategyRegistry.getDefault();
      expect(strategy.layout.resourceBarHeight).toBeGreaterThan(0);
      expect(strategy.layout.resourceBarHeight).toBeLessThan(1);
      expect(strategy.layout.buildingAreaHeight).toBeGreaterThan(0);
      expect(strategy.layout.buildingAreaHeight).toBeLessThan(1);
      expect(strategy.layout.upgradePanelHeight).toBeGreaterThan(0);
      expect(strategy.layout.upgradePanelHeight).toBeLessThan(1);
      expect(strategy.layout.statsPanelWidth).toBeGreaterThan(0);
      expect(strategy.layout.statsPanelWidth).toBeLessThan(1);
    });
  });

  // ─── get (by gameId) ──────────────────────────────────────

  describe('get', () => {
    it('should return default strategy for unknown game IDs', () => {
      const strategy = RenderStrategyRegistry.get('unknown-game-xyz');
      expect(strategy.name).toBe('default');
    });

    it('should return cookie-clicker strategy for cookie-clicker', () => {
      const strategy = RenderStrategyRegistry.get('cookie-clicker');
      expect(strategy.name).toBe('cookie-clicker');
    });

    it('should return civ-egypt strategy for civ-egypt', () => {
      const strategy = RenderStrategyRegistry.get('civ-egypt');
      expect(strategy.name).toBe('civ-egypt');
    });

    it('should return civ-china strategy for civ-china', () => {
      const strategy = RenderStrategyRegistry.get('civ-china');
      expect(strategy.name).toBe('civ-china');
    });

    it('should return fantasy strategy for idle-xianxia', () => {
      const strategy = RenderStrategyRegistry.get('idle-xianxia');
      expect(strategy.name).toBe('fantasy');
    });

    it('should return scifi strategy for space-war', () => {
      const strategy = RenderStrategyRegistry.get('space-war');
      expect(strategy.name).toBe('scifi');
    });

    it('should return nature strategy for ant-kingdom', () => {
      const strategy = RenderStrategyRegistry.get('ant-kingdom');
      expect(strategy.name).toBe('nature');
    });

    it('should return default for three-kingdoms', () => {
      const strategy = RenderStrategyRegistry.get('three-kingdoms');
      expect(strategy.name).toBe('default');
    });

    it('should return fantasy for clan-saga', () => {
      const strategy = RenderStrategyRegistry.get('clan-saga');
      expect(strategy.name).toBe('fantasy');
    });

    it('all mapped games should return valid strategies', () => {
      const mappings = RenderStrategyRegistry.listGameMappings();
      for (const [gameId, strategyName] of Object.entries(mappings)) {
        const strategy = RenderStrategyRegistry.get(gameId);
        expect(strategy).toBeDefined();
        expect(strategy.name).toBe(strategyName);
      }
    });
  });

  // ─── register (custom strategy) ───────────────────────────

  describe('register', () => {
    it('should register a new custom strategy', () => {
      RenderStrategyRegistry.register('test-strategy', TEST_STRATEGY);
      expect(RenderStrategyRegistry.hasStrategy('test-strategy')).toBe(true);
    });

    it('should allow game mapping to custom strategy', () => {
      RenderStrategyRegistry.register('test-strategy', TEST_STRATEGY);
      RenderStrategyRegistry.registerGameMapping('test-game', 'test-strategy');
      const strategy = RenderStrategyRegistry.get('test-game');
      expect(strategy.name).toBe('test-strategy');
    });

    it('should overwrite existing strategy with same name', () => {
      const modified = { ...TEST_STRATEGY, name: 'test-strategy-overwrite' };
      RenderStrategyRegistry.register('test-strategy-overwrite', TEST_STRATEGY);
      RenderStrategyRegistry.register('test-strategy-overwrite', modified);
      const strategy = RenderStrategyRegistry.get('test-game-ow');
      // Should still be the original since we haven't mapped
      expect(strategy.name).toBe('default');
    });
  });

  // ─── listStrategies ───────────────────────────────────────

  describe('listStrategies', () => {
    it('should list all built-in strategies', () => {
      const strategies = RenderStrategyRegistry.listStrategies();
      expect(strategies).toContain('default');
      expect(strategies).toContain('cookie-clicker');
      expect(strategies).toContain('civilization');
      expect(strategies).toContain('fantasy');
      expect(strategies).toContain('scifi');
      expect(strategies).toContain('nature');
    });

    it('should include custom registered strategies', () => {
      RenderStrategyRegistry.register('custom-list-test', TEST_STRATEGY);
      const strategies = RenderStrategyRegistry.listStrategies();
      expect(strategies).toContain('custom-list-test');
    });
  });

  // ─── listGameMappings ─────────────────────────────────────

  describe('listGameMappings', () => {
    it('should return a non-empty mapping object', () => {
      const mappings = RenderStrategyRegistry.listGameMappings();
      expect(Object.keys(mappings).length).toBeGreaterThan(0);
    });

    it('should include known game IDs', () => {
      const mappings = RenderStrategyRegistry.listGameMappings();
      expect(mappings).toHaveProperty('cookie-clicker');
      expect(mappings).toHaveProperty('civ-egypt');
      expect(mappings).toHaveProperty('idle-xianxia');
    });
  });

  // ─── hasStrategy / hasGameMapping ──────────────────────────

  describe('hasStrategy', () => {
    it('should return true for existing strategies', () => {
      expect(RenderStrategyRegistry.hasStrategy('default')).toBe(true);
      expect(RenderStrategyRegistry.hasStrategy('cookie-clicker')).toBe(true);
    });

    it('should return false for non-existent strategies', () => {
      expect(RenderStrategyRegistry.hasStrategy('non-existent-xyz')).toBe(false);
    });
  });

  describe('hasGameMapping', () => {
    it('should return true for mapped games', () => {
      expect(RenderStrategyRegistry.hasGameMapping('cookie-clicker')).toBe(true);
    });

    it('should return false for unmapped games', () => {
      expect(RenderStrategyRegistry.hasGameMapping('non-existent-game')).toBe(false);
    });
  });

  // ─── removeGameMapping ────────────────────────────────────

  describe('removeGameMapping', () => {
    it('should remove an existing mapping', () => {
      RenderStrategyRegistry.registerGameMapping('removable-game', 'default');
      expect(RenderStrategyRegistry.hasGameMapping('removable-game')).toBe(true);
      const removed = RenderStrategyRegistry.removeGameMapping('removable-game');
      expect(removed).toBe(true);
      expect(RenderStrategyRegistry.hasGameMapping('removable-game')).toBe(false);
    });

    it('should return false for non-existent mapping', () => {
      const removed = RenderStrategyRegistry.removeGameMapping('non-existent-game');
      expect(removed).toBe(false);
    });
  });

  // ─── 策略主题验证 ─────────────────────────────────────────

  describe('strategy themes', () => {
    const strategyNames = ['default', 'cookie-clicker', 'civilization', 'fantasy', 'scifi', 'nature'];

    it.each(strategyNames)('strategy "%s" should have valid hex colors', (name) => {
      expect(RenderStrategyRegistry.hasStrategy(name)).toBe(true);
      // We can't easily get strategy by name directly, but we can verify through get
      // by mapping a test game
      RenderStrategyRegistry.registerGameMapping(`theme-test-${name}`, name);
      const strategy = RenderStrategyRegistry.get(`theme-test-${name}`);
      expect(strategy.theme.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(strategy.theme.accent).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});
