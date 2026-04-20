/**
 * StarUpPanel 逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 StarUpLogic 的核心逻辑：
 * - 碎片进度
 * - 升星检查
 * - 属性变化预览
 * - 突破检查
 * - 星级显示
 */

import { StarUpLogic } from '../hero/StarUpPanel';
import type {
  FragmentProgress,
  StarUpPreview,
  BreakthroughPreview,
} from '../../../../engine/hero/star-up.types';

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────

function createFragmentProgress(overrides: Partial<FragmentProgress> = {}): FragmentProgress {
  return {
    generalId: 'guanyu',
    generalName: '关羽',
    currentFragments: 30,
    requiredFragments: 50,
    percentage: 60,
    currentStar: 3,
    canStarUp: false,
    ...overrides,
  };
}

function createStarUpPreview(overrides: Partial<StarUpPreview> = {}): StarUpPreview {
  return {
    generalId: 'guanyu',
    currentStar: 3,
    targetStar: 4,
    fragmentCost: 50,
    goldCost: 1000,
    fragmentOwned: 30,
    fragmentSufficient: false,
    statsDiff: {
      before: { attack: 100, defense: 80, intelligence: 60, speed: 70 },
      after: { attack: 120, defense: 96, intelligence: 72, speed: 84 },
    },
    ...overrides,
  };
}

function createBreakthroughPreview(overrides: Partial<BreakthroughPreview> = {}): BreakthroughPreview {
  return {
    generalId: 'guanyu',
    currentLevel: 30,
    currentLevelCap: 30,
    nextLevelCap: 40,
    nextBreakthroughStage: 1,
    fragmentCost: 20,
    goldCost: 500,
    breakthroughStoneCost: 5,
    levelReady: true,
    resourceSufficient: true,
    canBreakthrough: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('StarUpLogic — 碎片进度', () => {
  it('获取碎片进度百分比', () => {
    const logic = new StarUpLogic(createFragmentProgress(), null, null, 3);
    expect(logic.getFragmentPercent()).toBe(60);
  });

  it('碎片不足时不可升星', () => {
    const logic = new StarUpLogic(createFragmentProgress(), null, null, 3);
    expect(logic.canStarUp()).toBe(false);
  });

  it('碎片充足时可以升星', () => {
    const progress = createFragmentProgress({
      currentFragments: 50,
      requiredFragments: 50,
      percentage: 100,
      canStarUp: true,
    });
    const logic = new StarUpLogic(progress, null, null, 3);
    expect(logic.canStarUp()).toBe(true);
  });

  it('无碎片进度时百分比为0', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.getFragmentPercent()).toBe(0);
  });
});

describe('StarUpLogic — 星级', () => {
  it('3星显示', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.getStarDisplay()).toBe('★★★☆☆☆');
  });

  it('6星满星显示', () => {
    const logic = new StarUpLogic(null, null, null, 6);
    expect(logic.getStarDisplay()).toBe('★★★★★★');
  });

  it('1星显示', () => {
    const logic = new StarUpLogic(null, null, null, 1);
    expect(logic.getStarDisplay()).toBe('★☆☆☆☆☆');
  });

  it('满星时不可升星', () => {
    const logic = new StarUpLogic(null, null, null, 6);
    expect(logic.isMaxStar()).toBe(true);
  });

  it('未满星时可以升星', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.isMaxStar()).toBe(false);
  });
});

describe('StarUpLogic — 升星消耗', () => {
  it('获取升星消耗描述', () => {
    const preview = createStarUpPreview();
    const logic = new StarUpLogic(null, preview, null, 3);
    const cost = logic.getStarUpCostDesc();
    expect(cost.fragments).toBe('30/50');
    expect(cost.gold).toBe('1000');
  });

  it('无预览时返回占位符', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    const cost = logic.getStarUpCostDesc();
    expect(cost.fragments).toBe('-');
    expect(cost.gold).toBe('-');
  });
});

describe('StarUpLogic — 属性变化', () => {
  it('获取属性变化预览', () => {
    const preview = createStarUpPreview();
    const logic = new StarUpLogic(null, preview, null, 3);
    const diff = logic.getStatsDiff();
    expect(diff).not.toBeNull();
    expect(diff!.attack).toBe('+20');
    expect(diff!.defense).toBe('+16');
    expect(diff!.intelligence).toBe('+12');
    expect(diff!.speed).toBe('+14');
  });

  it('无预览时返回 null', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.getStatsDiff()).toBeNull();
  });
});

describe('StarUpLogic — 突破检查', () => {
  it('可以突破', () => {
    const preview = createBreakthroughPreview();
    const logic = new StarUpLogic(null, null, preview, 3);
    expect(logic.canBreakthrough()).toBe(true);
  });

  it('等级未达到上限不可突破', () => {
    const preview = createBreakthroughPreview({
      levelReady: false,
      canBreakthrough: false,
    });
    const logic = new StarUpLogic(null, null, preview, 3);
    expect(logic.canBreakthrough()).toBe(false);
    expect(logic.getBreakthroughDesc()).toContain('等级');
  });

  it('资源不足不可突破', () => {
    const preview = createBreakthroughPreview({
      resourceSufficient: false,
      canBreakthrough: false,
    });
    const logic = new StarUpLogic(null, null, preview, 3);
    expect(logic.canBreakthrough()).toBe(false);
    expect(logic.getBreakthroughDesc()).toContain('资源');
  });

  it('无突破数据', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.canBreakthrough()).toBe(false);
    expect(logic.getBreakthroughDesc()).toContain('无突破数据');
  });
});

describe('StarUpLogic — 突破消耗', () => {
  it('获取突破消耗', () => {
    const preview = createBreakthroughPreview();
    const logic = new StarUpLogic(null, null, preview, 3);
    const cost = logic.getBreakthroughCost();
    expect(cost).not.toBeNull();
    expect(cost!.fragments).toBe(20);
    expect(cost!.gold).toBe(500);
    expect(cost!.stones).toBe(5);
  });

  it('无突破数据时返回 null', () => {
    const logic = new StarUpLogic(null, null, null, 3);
    expect(logic.getBreakthroughCost()).toBeNull();
  });
});

describe('StarUpLogic — 操作验证', () => {
  it('升星验证：满星不合法', () => {
    const logic = new StarUpLogic(null, null, null, 6);
    const v = logic.validateStarUp();
    expect(v.valid).toBe(false);
    expect(v.reason).toContain('最高星级');
  });

  it('升星验证：碎片不足不合法', () => {
    const progress = createFragmentProgress({ canStarUp: false });
    const logic = new StarUpLogic(progress, null, null, 3);
    const v = logic.validateStarUp();
    expect(v.valid).toBe(false);
    expect(v.reason).toContain('碎片');
  });

  it('升星验证：碎片充足合法', () => {
    const progress = createFragmentProgress({
      currentFragments: 50, requiredFragments: 50, percentage: 100, canStarUp: true,
    });
    const preview = createStarUpPreview({ fragmentSufficient: true });
    const logic = new StarUpLogic(progress, preview, null, 3);
    const v = logic.validateStarUp();
    expect(v.valid).toBe(true);
  });

  it('突破验证：条件满足合法', () => {
    const preview = createBreakthroughPreview();
    const logic = new StarUpLogic(null, null, preview, 3);
    const v = logic.validateBreakthrough();
    expect(v.valid).toBe(true);
  });

  it('突破验证：等级不足不合法', () => {
    const preview = createBreakthroughPreview({
      levelReady: false, canBreakthrough: false,
    });
    const logic = new StarUpLogic(null, null, preview, 3);
    const v = logic.validateBreakthrough();
    expect(v.valid).toBe(false);
    expect(v.reason).toContain('等级');
  });
});

describe('StarUpLogic — 进度条颜色', () => {
  it('100%时绿色', () => {
    const progress = createFragmentProgress({ percentage: 100 });
    const logic = new StarUpLogic(progress, null, null, 3);
    expect(logic.getProgressColor()).toBe('#4ade80');
  });

  it('60%时黄色', () => {
    const progress = createFragmentProgress({ percentage: 60 });
    const logic = new StarUpLogic(progress, null, null, 3);
    expect(logic.getProgressColor()).toBe('#fbbf24');
  });

  it('30%时蓝色', () => {
    const progress = createFragmentProgress({ percentage: 30 });
    const logic = new StarUpLogic(progress, null, null, 3);
    expect(logic.getProgressColor()).toBe('#60a5fa');
  });
});
