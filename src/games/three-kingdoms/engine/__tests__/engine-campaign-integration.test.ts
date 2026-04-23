import { vi } from 'vitest';
/**
 * ThreeKingdomsEngine 编排层 — 战斗/关卡系统集成测试
 *
 * 验证 v3.0 阶段1C：战斗系统和关卡系统接入引擎编排层
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { BattleOutcome, StarRating } from '../battle/battle.types';
import { SAVE_KEY } from '../../shared/constants';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('ThreeKingdomsEngine — 战斗/关卡系统集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════
  // 1. 子系统初始化与注册
  // ═══════════════════════════════════════════

  describe('子系统初始化', () => {
    it('初始化后战斗引擎可用', () => {
      engine.init();
      const be = engine.getBattleEngine();
      expect(be).toBeDefined();
      expect(typeof be.runFullBattle).toBe('function');
    });

    it('初始化后关卡进度系统可用', () => {
      engine.init();
      const cs = engine.getCampaignSystem();
      expect(cs).toBeDefined();
      expect(typeof cs.getProgress).toBe('function');
      expect(typeof cs.canChallenge).toBe('function');
    });

    it('初始化后奖励分发器可用', () => {
      engine.init();
      const rd = engine.getRewardDistributor();
      expect(rd).toBeDefined();
      expect(typeof rd.calculateRewards).toBe('function');
    });

    it('初始化后快照包含关卡进度', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap.campaignProgress).toBeDefined();
      expect(snap.campaignProgress.stageStates).toBeDefined();
      expect(snap.campaignProgress.currentChapterId).toBe('chapter1');
    });

    it('第1章第1关默认可挑战', () => {
      engine.init();
      expect(engine.getCampaignSystem().canChallenge('chapter1_stage1')).toBe(true);
    });

    it('后续关卡默认锁定', () => {
      engine.init();
      expect(engine.getCampaignSystem().canChallenge('chapter1_stage2')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 关卡查询 API
  // ═══════════════════════════════════════════

  describe('关卡查询', () => {
    it('getStageList() 返回所有关卡', () => {
      const stages = engine.getStageList();
      expect(stages.length).toBeGreaterThan(0);
      // 第1章有 8 个关卡（6普通 + 1精英 + 1BOSS）
      expect(stages.filter(s => s.chapterId === 'chapter1').length).toBe(8);
    });

    it('getStageInfo() 返回关卡详情', () => {
      const stage = engine.getStageInfo('chapter1_stage1');
      expect(stage).toBeDefined();
      expect(stage!.id).toBe('chapter1_stage1');
      expect(stage!.enemyFormation).toBeDefined();
      expect(stage!.enemyFormation.units.length).toBeGreaterThan(0);
    });

    it('getStageInfo() 不存在返回 undefined', () => {
      expect(engine.getStageInfo('nonexistent')).toBeUndefined();
    });

    it('getChapters() 返回章节列表', () => {
      const chapters = engine.getChapters();
      expect(chapters.length).toBeGreaterThanOrEqual(3);
      expect(chapters[0].id).toBe('chapter1');
    });

    it('getCampaignProgress() 返回进度', () => {
      engine.init();
      const progress = engine.getCampaignProgress();
      expect(progress.currentChapterId).toBe('chapter1');
      expect(Object.keys(progress.stageStates).length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 战斗 API
  // ═══════════════════════════════════════════

  describe('startBattle()', () => {
    it('对不存在的关卡抛出异常', () => {
      engine.init();
      expect(() => engine.startBattle('nonexistent')).toThrow('关卡不存在');
    });

    it('对未解锁关卡抛出异常', () => {
      engine.init();
      expect(() => engine.startBattle('chapter1_stage2')).toThrow('关卡未解锁');
    });

    it('对已解锁关卡返回战斗结果', () => {
      engine.init();
      // chapter1_stage1 默认可挑战
      // 但没有武将（空编队），我方队伍为空，战斗会立即失败
      const result = engine.startBattle('chapter1_stage1');
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
      // 空编队 → 我方全灭 → DEFEAT
      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 通关处理
  // ═══════════════════════════════════════════

  describe('completeBattle()', () => {
    it('通关后关卡状态更新', () => {
      engine.init();
      expect(engine.getCampaignSystem().isFirstCleared('chapter1_stage1')).toBe(false);

      engine.completeBattle('chapter1_stage1', 3);

      expect(engine.getCampaignSystem().isFirstCleared('chapter1_stage1')).toBe(true);
      expect(engine.getCampaignSystem().getStageStars('chapter1_stage1')).toBe(3);
    });

    it('通关后解锁下一关', () => {
      engine.init();
      expect(engine.getCampaignSystem().canChallenge('chapter1_stage2')).toBe(false);

      engine.completeBattle('chapter1_stage1', 1);

      expect(engine.getCampaignSystem().canChallenge('chapter1_stage2')).toBe(true);
    });

    it('首通发放奖励并增加资源', () => {
      engine.init();
      const grainBefore = engine.getSnapshot().resources.grain;

      engine.completeBattle('chapter1_stage1', 3);

      const grainAfter = engine.getSnapshot().resources.grain;
      expect(grainAfter).toBeGreaterThan(grainBefore);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 存档序列化
  // ═══════════════════════════════════════════

  describe('存档/读档', () => {
    it('序列化包含 campaign 数据', () => {
      engine.init();
      engine.completeBattle('chapter1_stage1', 2);

      const json = engine.serialize();
      const data = JSON.parse(json);

      expect(data.campaign).toBeDefined();
      expect(data.campaign.version).toBe(1);
      expect(data.campaign.progress.stageStates['chapter1_stage1'].stars).toBe(2);
    });

    it('反序列化恢复关卡进度', () => {
      engine.init();
      engine.completeBattle('chapter1_stage1', 3);
      const json = engine.serialize();

      const engine2 = new ThreeKingdomsEngine();
      engine2.deserialize(json);

      expect(engine2.getCampaignSystem().getStageStars('chapter1_stage1')).toBe(3);
      expect(engine2.getCampaignSystem().canChallenge('chapter1_stage2')).toBe(true);
      engine2.reset();
    });

    it('save/load 保留关卡进度', () => {
      engine.init();
      engine.completeBattle('chapter1_stage1', 3);

      engine.save();

      const engine2 = new ThreeKingdomsEngine();
      const result = engine2.load();

      expect(engine2.getCampaignSystem().getStageStars('chapter1_stage1')).toBe(3);
      expect(engine2.getCampaignSystem().canChallenge('chapter1_stage2')).toBe(true);
      engine2.reset();
    });

    it('v2.0 存档迁移：无关卡数据时自动初始化', () => {
      // 模拟 v2.0 存档（无 campaign 字段）
      const v2Save = {
        version: 3,
        saveTime: Date.now(),
        resource: {
          resources: { grain: 100, gold: 100, troops: 100, mandate: 0 },
          lastSaveTime: Date.now(),
          productionRates: { grain: 1, gold: 1, troops: 1, mandate: 0 },
          caps: { grain: 1000, gold: null, troops: 1000, mandate: null },
          version: 1,
        },
        building: {
          buildings: {},
          version: 1,
        },
      };
      storage[SAVE_KEY] = JSON.stringify(v2Save);

      const engine2 = new ThreeKingdomsEngine();
      const result = engine2.load();

      // 关卡系统应自动初始化
      expect(engine2.getCampaignSystem()).toBeDefined();
      expect(engine2.getCampaignSystem().canChallenge('chapter1_stage1')).toBe(true);
      engine2.reset();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 重置
  // ═══════════════════════════════════════════

  describe('reset()', () => {
    it('重置后关卡进度清空', () => {
      engine.init();
      engine.completeBattle('chapter1_stage1', 3);
      expect(engine.getCampaignSystem().getStageStars('chapter1_stage1')).toBe(3);

      engine.reset();

      // 重置后需要重新初始化
      engine.init();
      expect(engine.getCampaignSystem().getStageStars('chapter1_stage1')).toBe(0);
    });
  });
});
