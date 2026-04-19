/**
 * 适配层类型定义测试
 *
 * 测试新增的适配层类型：
 * - IdleGameRenderState
 * - RenderStrategy
 * - PixiGameAdapterConfig
 * - 类型完整性验证
 */

import { describe, it, expect } from 'vitest';
import type {
  IdleGameRenderState,
  RenderStrategy,
  PixiGameAdapterConfig,
} from '../types';
import { DEFAULT_RENDERER_CONFIG } from '../types';

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('IdleGameRenderState type', () => {
  it('should accept a valid complete state', () => {
    const state: IdleGameRenderState = {
      gameId: 'test-game',
      resources: [
        { id: 'gold', name: '金币', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
      ],
      upgrades: [
        {
          id: 'upgrade-1',
          name: '升级1',
          description: '描述',
          level: 1,
          maxLevel: 10,
          baseCost: { gold: 100 },
          costMultiplier: 1.5,
          unlocked: true,
          canAfford: true,
          effect: { type: 'add_production', target: 'gold', value: 1 },
        },
      ],
      prestige: { currency: 50, count: 2 },
      statistics: { totalGold: 10000 },
    };
    expect(state.gameId).toBe('test-game');
    expect(state.resources.length).toBe(1);
    expect(state.upgrades.length).toBe(1);
    expect(state.prestige.currency).toBe(50);
  });

  it('should accept a minimal state', () => {
    const state: IdleGameRenderState = {
      gameId: 'minimal',
      resources: [],
      upgrades: [],
      prestige: { currency: 0, count: 0 },
      statistics: {},
    };
    expect(state.resources).toEqual([]);
    expect(state.upgrades).toEqual([]);
  });

  it('should accept state with many resources', () => {
    const resources = Array.from({ length: 50 }, (_, i) => ({
      id: `res-${i}`,
      name: `资源${i}`,
      amount: i * 100,
      perSecond: i * 0.5,
      maxAmount: 1e9,
      unlocked: true,
    }));
    const state: IdleGameRenderState = {
      gameId: 'many-resources',
      resources,
      upgrades: [],
      prestige: { currency: 0, count: 0 },
      statistics: {},
    };
    expect(state.resources.length).toBe(50);
  });

  it('should accept state with upgrade icons', () => {
    const state: IdleGameRenderState = {
      gameId: 'icons',
      resources: [],
      upgrades: [
        {
          id: 'u1',
          name: 'U1',
          description: 'desc',
          level: 0,
          maxLevel: 10,
          baseCost: {},
          costMultiplier: 1,
          unlocked: true,
          canAfford: true,
          effect: { type: 'add_production', target: 'gold', value: 1 },
          icon: '🌾',
        },
      ],
      prestige: { currency: 0, count: 0 },
      statistics: {},
    };
    expect(state.upgrades[0].icon).toBe('🌾');
  });

  it('should accept state without optional upgrade icon', () => {
    const state: IdleGameRenderState = {
      gameId: 'no-icon',
      resources: [],
      upgrades: [
        {
          id: 'u1',
          name: 'U1',
          description: 'desc',
          level: 0,
          maxLevel: 10,
          baseCost: {},
          costMultiplier: 1,
          unlocked: true,
          canAfford: true,
          effect: { type: 'add_production', target: 'gold', value: 1 },
        },
      ],
      prestige: { currency: 0, count: 0 },
      statistics: {},
    };
    expect(state.upgrades[0].icon).toBeUndefined();
  });
});

describe('RenderStrategy type', () => {
  it('should accept a valid strategy', () => {
    const strategy: RenderStrategy = {
      name: 'test',
      sceneType: 'idle',
      theme: {
        background: '#0f0f1a',
        panelBackground: '#1a1a2e',
        textPrimary: '#e0e0e0',
        textSecondary: '#8888aa',
        accent: '#ffd700',
        success: '#4ecdc4',
        warning: '#f39c12',
        resourceBarBg: '#16162a',
        buttonBg: '#2a2a4a',
        buttonHover: '#3a3a6a',
      },
      layout: {
        resourceBarHeight: 0.1,
        buildingAreaHeight: 0.5,
        upgradePanelHeight: 0.3,
        statsPanelWidth: 0.2,
        gridColumns: 3,
        gridGap: 8,
        padding: 12,
        borderRadius: 8,
      },
    };
    expect(strategy.name).toBe('test');
    expect(strategy.sceneType).toBe('idle');
    expect(strategy.theme.accent).toBe('#ffd700');
    expect(strategy.layout.gridColumns).toBe(3);
  });

  it('should validate theme has all required properties', () => {
    const strategy: RenderStrategy = {
      name: 'full-theme',
      sceneType: 'idle',
      theme: {
        background: '#000',
        panelBackground: '#111',
        textPrimary: '#fff',
        textSecondary: '#888',
        accent: '#ff0',
        success: '#0f0',
        warning: '#f80',
        resourceBarBg: '#222',
        buttonBg: '#333',
        buttonHover: '#444',
      },
      layout: {
        resourceBarHeight: 0.1,
        buildingAreaHeight: 0.5,
        upgradePanelHeight: 0.3,
        statsPanelWidth: 0.2,
        gridColumns: 4,
        gridGap: 10,
        padding: 16,
        borderRadius: 12,
      },
    };
    const themeKeys = Object.keys(strategy.theme);
    expect(themeKeys).toContain('background');
    expect(themeKeys).toContain('panelBackground');
    expect(themeKeys).toContain('textPrimary');
    expect(themeKeys).toContain('textSecondary');
    expect(themeKeys).toContain('accent');
    expect(themeKeys).toContain('success');
    expect(themeKeys).toContain('warning');
    expect(themeKeys).toContain('resourceBarBg');
    expect(themeKeys).toContain('buttonBg');
    expect(themeKeys).toContain('buttonHover');
  });

  it('should validate layout has all required properties', () => {
    const strategy: RenderStrategy = {
      name: 'full-layout',
      sceneType: 'idle',
      theme: {
        background: '#000',
        panelBackground: '#111',
        textPrimary: '#fff',
        textSecondary: '#888',
        accent: '#ff0',
        success: '#0f0',
        warning: '#f80',
        resourceBarBg: '#222',
        buttonBg: '#333',
        buttonHover: '#444',
      },
      layout: {
        resourceBarHeight: 0.1,
        buildingAreaHeight: 0.5,
        upgradePanelHeight: 0.3,
        statsPanelWidth: 0.2,
        gridColumns: 4,
        gridGap: 10,
        padding: 16,
        borderRadius: 12,
      },
    };
    const layoutKeys = Object.keys(strategy.layout);
    expect(layoutKeys).toContain('resourceBarHeight');
    expect(layoutKeys).toContain('buildingAreaHeight');
    expect(layoutKeys).toContain('upgradePanelHeight');
    expect(layoutKeys).toContain('statsPanelWidth');
    expect(layoutKeys).toContain('gridColumns');
    expect(layoutKeys).toContain('gridGap');
    expect(layoutKeys).toContain('padding');
    expect(layoutKeys).toContain('borderRadius');
  });
});

describe('PixiGameAdapterConfig type', () => {
  it('should accept empty config', () => {
    const config: PixiGameAdapterConfig = {};
    expect(config).toBeDefined();
  });

  it('should accept full config', () => {
    const config: PixiGameAdapterConfig = {
      rendererConfig: {
        backgroundColor: '#ff0000',
        designWidth: 1920,
        designHeight: 1080,
      },
      strategy: {
        name: 'custom',
        sceneType: 'idle',
        theme: {
          background: '#000',
          panelBackground: '#111',
          textPrimary: '#fff',
          textSecondary: '#888',
          accent: '#ff0',
          success: '#0f0',
          warning: '#f80',
          resourceBarBg: '#222',
          buttonBg: '#333',
          buttonHover: '#444',
        },
        layout: {
          resourceBarHeight: 0.1,
          buildingAreaHeight: 0.5,
          upgradePanelHeight: 0.3,
          statsPanelWidth: 0.2,
          gridColumns: 3,
          gridGap: 8,
          padding: 12,
          borderRadius: 8,
        },
      },
      syncInterval: 500,
      autoStart: false,
      showFPS: true,
    };
    expect(config.syncInterval).toBe(500);
    expect(config.autoStart).toBe(false);
    expect(config.showFPS).toBe(true);
  });

  it('should accept partial config', () => {
    const config: PixiGameAdapterConfig = {
      syncInterval: 2000,
    };
    expect(config.syncInterval).toBe(2000);
    expect(config.autoStart).toBeUndefined();
  });
});

describe('DEFAULT_RENDERER_CONFIG', () => {
  it('should have all required properties', () => {
    expect(DEFAULT_RENDERER_CONFIG).toHaveProperty('resolution');
    expect(DEFAULT_RENDERER_CONFIG).toHaveProperty('backgroundColor');
    expect(DEFAULT_RENDERER_CONFIG).toHaveProperty('designWidth');
    expect(DEFAULT_RENDERER_CONFIG).toHaveProperty('designHeight');
    expect(DEFAULT_RENDERER_CONFIG).toHaveProperty('antialias');
  });

  it('should have reasonable defaults', () => {
    expect(DEFAULT_RENDERER_CONFIG.backgroundColor).toBe('#1a1a2e');
    expect(DEFAULT_RENDERER_CONFIG.designWidth).toBe(1920);
    expect(DEFAULT_RENDERER_CONFIG.designHeight).toBe(1080);
    expect(DEFAULT_RENDERER_CONFIG.antialias).toBe(true);
  });
});
