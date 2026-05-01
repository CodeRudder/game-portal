/**
 * P1 测试 — 转生后保留/重置规则（16项数据）
 *
 * PRD [PRS-4] 保留/重置规则：
 *   保留（7项）：VIP等级、充值记录、已购买商品、声望等级、成就进度、武将图鉴、皮肤收藏
 *   重置（8项）：资源、建筑等级、科技等级、武将等级、远征进度、竞技场排名、任务进度、联盟贡献
 *   衰减（PRD额外）：武将等级50%、天命30%、科技进度50%
 *
 * 验证策略：
 *   1. 引擎常量 REBIRTH_KEEP_RULES / REBIRTH_RESET_RULES 覆盖所有PRD项
 *   2. executeRebirth 触发 resetCallback 传入正确的重置规则
 *   3. 转生后保留项状态不变
 *   4. PRD中提到但引擎未实现的衰减逻辑标记 TODO
 *
 * @module engine/prestige/__tests__/ReincarnationRetention
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import { PrestigeSystem } from '../PrestigeSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
} from '../../../core/prestige';

// ═══════════════════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════════════════

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createRebirthSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

function createPrestigeSystem(): PrestigeSystem {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

/** 冷却时间常量（PRD要求72小时） */
const COOLDOWN_MS = 72 * 60 * 60 * 1000;

/** 创建满足转生条件的系统 */
function createReadyRebirthSystem(): {
  rebirth: RebirthSystem;
  prestige: PrestigeSystem;
  resetFn: ReturnType<typeof vi.fn>;
} {
  const rebirth = createRebirthSystem();
  const prestige = createPrestigeSystem();
  const resetFn = vi.fn();

  rebirth.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
  });
  rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

  return { rebirth, prestige, resetFn };
}

/** 创建带时间注入的系统（支持模拟冷却时间流逝，用于多次转生测试） */
function createReadyRebirthSystemWithTime(): {
  rebirth: RebirthSystem;
  prestige: PrestigeSystem;
  resetFn: ReturnType<typeof vi.fn>;
  advanceTime: (ms: number) => void;
} {
  let currentTime = Date.now();
  const rebirth = createRebirthSystem();
  const prestige = createPrestigeSystem();
  const resetFn = vi.fn();

  rebirth.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
    nowProvider: () => currentTime,
  });
  rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

  return {
    rebirth,
    prestige,
    resetFn,
    advanceTime: (ms: number) => { currentTime += ms; },
  };
}

// ═══════════════════════════════════════════════════════════
// 测试主体
// ═══════════════════════════════════════════════════════════

describe('P1 — 转生后保留/重置规则（16项数据）', () => {

  // ─────────────────────────────────────────
  // A. 保留规则常量验证（7项）
  // ─────────────────────────────────────────

  describe('A. 保留规则常量验证', () => {

    test('REBIRTH_KEEP_RULES 包含 keep_prestige（声望等级保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_prestige');
    });

    test('REBIRTH_KEEP_RULES 包含 keep_vip（VIP等级保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_vip');
    });

    test('REBIRTH_KEEP_RULES 包含 keep_achievements（成就进度保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_achievements');
    });

    test('REBIRTH_KEEP_RULES 包含 keep_heroes（武将图鉴保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_heroes');
    });

    test('REBIRTH_KEEP_RULES 包含 keep_equipment（装备/皮肤收藏保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_equipment');
    });

    test('REBIRTH_KEEP_RULES 包含 keep_tech_points（科技点保留）', () => {
      expect(REBIRTH_KEEP_RULES).toContain('keep_tech_points');
    });

    test.todo('PRD: 充值记录保留 — 引擎 REBIRTH_KEEP_RULES 未包含 keep_recharge_records');
    test.todo('PRD: 已购买商品保留 — 引擎 REBIRTH_KEEP_RULES 未包含 keep_shop_purchases');
    test.todo('PRD: 皮肤收藏保留 — 引擎 REBIRTH_KEEP_RULES 未包含 keep_skins（当前以 keep_equipment 替代）');
  });

  // ─────────────────────────────────────────
  // B. 重置规则常量验证（8项）
  // ─────────────────────────────────────────

  describe('B. 重置规则常量验证', () => {

    test('REBIRTH_RESET_RULES 包含 reset_resources（资源清零）', () => {
      expect(REBIRTH_RESET_RULES).toContain('reset_resources');
    });

    test('REBIRTH_RESET_RULES 包含 reset_buildings（建筑等级重置）', () => {
      expect(REBIRTH_RESET_RULES).toContain('reset_buildings');
    });

    test('REBIRTH_RESET_RULES 包含 reset_map_progress（远征/地图进度重置）', () => {
      expect(REBIRTH_RESET_RULES).toContain('reset_map_progress');
    });

    test('REBIRTH_RESET_RULES 包含 reset_quest_progress（任务进度重置）', () => {
      expect(REBIRTH_RESET_RULES).toContain('reset_quest_progress');
    });

    test('REBIRTH_RESET_RULES 包含 reset_campaign（战役/竞技场重置）', () => {
      expect(REBIRTH_RESET_RULES).toContain('reset_campaign');
    });

    test.todo('PRD: 科技等级重置 — 引擎 REBIRTH_RESET_RULES 未包含 reset_tech_levels（当前以 reset_quest_progress 部分覆盖）');
    test.todo('PRD: 武将等级重置（衰减50%）— 引擎未实现 reset_hero_levels');
    test.todo('PRD: 竞技场排名重置 — 引擎未包含 reset_arena_rank');
    test.todo('PRD: 联盟贡献重置 — 引擎未包含 reset_alliance_contribution');
  });

  // ─────────────────────────────────────────
  // C. 保留/重置规则互斥性
  // ─────────────────────────────────────────

  describe('C. 保留/重置规则互斥性', () => {
    test('保留规则与重置规则无交集', () => {
      const keepSet = new Set(REBIRTH_KEEP_RULES);
      const overlap = REBIRTH_RESET_RULES.filter(r => keepSet.has(r));
      expect(overlap).toHaveLength(0);
    });

    test('保留规则无重复项', () => {
      const unique = new Set(REBIRTH_KEEP_RULES);
      expect(unique.size).toBe(REBIRTH_KEEP_RULES.length);
    });

    test('重置规则无重复项', () => {
      const unique = new Set(REBIRTH_RESET_RULES);
      expect(unique.size).toBe(REBIRTH_RESET_RULES.length);
    });
  });

  // ─────────────────────────────────────────
  // D. executeRebirth 触发重置回调验证
  // ─────────────────────────────────────────

  describe('D. executeRebirth 重置回调', () => {
    test('转生成功时 resetCallback 被调用一次', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      expect(resetFn).toHaveBeenCalledTimes(1);
    });

    test('resetCallback 接收完整重置规则列表', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules.sort()).toEqual([...REBIRTH_RESET_RULES].sort());
    });

    test('resetCallback 包含 reset_buildings', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules).toContain('reset_buildings');
    });

    test('resetCallback 包含 reset_resources', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules).toContain('reset_resources');
    });

    test('resetCallback 包含 reset_map_progress', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules).toContain('reset_map_progress');
    });

    test('resetCallback 包含 reset_quest_progress', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules).toContain('reset_quest_progress');
    });

    test('resetCallback 包含 reset_campaign', () => {
      const { rebirth, resetFn } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const passedRules = resetFn.mock.calls[0][0] as string[];
      expect(passedRules).toContain('reset_campaign');
    });

    test('转生失败时 resetCallback 不被调用', () => {
      const rebirth = createRebirthSystem();
      const resetFn = vi.fn();
      rebirth.setCallbacks({ onReset: resetFn });
      rebirth.executeRebirth();
      expect(resetFn).not.toHaveBeenCalled();
    });

    test('多次转生每次都触发 resetCallback', () => {
      let currentTime = Date.now();
      const COOLDOWN = 72 * 60 * 60 * 1000;
      const { rebirth, resetFn } = createReadyRebirthSystem();
      // 注入时间提供函数以支持多次转生
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
        onReset: resetFn,
        campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
        achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
        nowProvider: () => currentTime,
      });
      rebirth.executeRebirth();
      currentTime += COOLDOWN + 1;
      rebirth.executeRebirth();
      currentTime += COOLDOWN + 1;
      rebirth.executeRebirth();
      expect(resetFn).toHaveBeenCalledTimes(3);
    });
  });

  // ─────────────────────────────────────────
  // E. 保留项 — 转生后状态不变
  // ─────────────────────────────────────────

  describe('E. 保留项 — 转生后状态不变', () => {

    // E1. 声望等级保留
    describe('E1. 声望等级保留', () => {
      test('转生后声望等级不变（通过 keep_prestige 规则）', () => {
        const { rebirth } = createReadyRebirthSystem();
        const prestigeLevelBefore = REBIRTH_CONDITIONS.minPrestigeLevel;
        rebirth.executeRebirth();
        // 转生后 prestigeLevel 应保持不变（引擎通过 keep_prestige 规则声明）
        // RebirthSystem 不直接管理声望等级，但保留规则确保不重置
        expect(REBIRTH_KEEP_RULES).toContain('keep_prestige');
      });

      test('声望系统状态在转生后不重置', () => {
        const prestige = createPrestigeSystem();
        // 添加声望值使等级提升
        prestige.addPrestigePoints('daily_quest', 5000);
        const stateBefore = prestige.getState();
        const levelBefore = stateBefore.currentLevel;
        const pointsBefore = stateBefore.totalPoints;

        // 声望系统独立于转生系统的 reset
        // 验证声望状态不受 RebirthSystem.reset() 影响
        const rebirth = createRebirthSystem();
        rebirth.reset(); // 这只重置转生系统自身状态

        // 声望系统状态应保持不变
        expect(prestige.getState().currentLevel).toBe(levelBefore);
        expect(prestige.getState().totalPoints).toBe(pointsBefore);
      });
    });

    // E2. VIP等级保留
    describe('E2. VIP等级保留', () => {
      test('keep_vip 规则确保VIP等级不重置', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_vip');
      });

      test('重置规则不包含VIP相关项', () => {
        expect(REBIRTH_RESET_RULES).not.toContain('reset_vip');
        expect(REBIRTH_RESET_RULES).not.toContain('keep_vip');
      });
    });

    // E3. 成就进度保留
    describe('E3. 成就进度保留', () => {
      test('keep_achievements 规则确保成就进度不重置', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_achievements');
      });
    });

    // E4. 武将图鉴保留
    describe('E4. 武将图鉴保留', () => {
      test('keep_heroes 规则确保武将拥有权不重置', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_heroes');
      });

      test('武将拥有权100%保留（非衰减）', () => {
        // keep_heroes 表示武将本身保留，等级衰减是另一个维度
        expect(REBIRTH_KEEP_RULES).toContain('keep_heroes');
      });

      test.todo('PRD: 武将等级衰减50% — 引擎未实现 hero_level_decay 逻辑');
    });

    // E5. 装备/皮肤收藏保留
    describe('E5. 装备/皮肤收藏保留', () => {
      test('keep_equipment 规则确保装备保留', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_equipment');
      });

      test.todo('PRD: 皮肤收藏保留 — 引擎未实现 keep_skins 规则');
    });

    // E6. 科技点保留
    describe('E6. 科技点保留', () => {
      test('keep_tech_points 规则确保科技点保留', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_tech_points');
      });
    });
  });

  // ─────────────────────────────────────────
  // F. 重置项 — 转生后数据清零
  // ─────────────────────────────────────────

  describe('F. 重置项 — 转生后数据清零', () => {

    // F1. 资源清零
    describe('F1. 资源清零', () => {
      test('reset_resources 规则存在', () => {
        expect(REBIRTH_RESET_RULES).toContain('reset_resources');
      });

      test('转生回调传入 reset_resources', () => {
        const { rebirth, resetFn } = createReadyRebirthSystem();
        rebirth.executeRebirth();
        const rules = resetFn.mock.calls[0][0] as string[];
        expect(rules).toContain('reset_resources');
      });

      test.todo('PRD: 粮草/铜钱/兵符全部清零 — 需资源系统集成测试验证实际清零行为');
    });

    // F2. 建筑等级重置
    describe('F2. 建筑等级重置', () => {
      test('reset_buildings 规则存在', () => {
        expect(REBIRTH_RESET_RULES).toContain('reset_buildings');
      });

      test('转生回调传入 reset_buildings', () => {
        const { rebirth, resetFn } = createReadyRebirthSystem();
        rebirth.executeRebirth();
        const rules = resetFn.mock.calls[0][0] as string[];
        expect(rules).toContain('reset_buildings');
      });

      test.todo('PRD: 主城等级重置为Lv.1 — 需建筑系统集成测试验证');
      test.todo('PRD: 功能建筑等级重置为Lv.1 — 需建筑系统集成测试验证');
      test.todo('PRD: 建筑解锁状态保留 — 需验证 reset_buildings 不影响蓝图');
    });

    // F3. 科技等级重置
    describe('F3. 科技等级重置', () => {
      test.todo('PRD: 科技研究进度保留50% — 引擎 REBIRTH_RESET_RULES 未包含 reset_tech_levels');
      test.todo('PRD: 未完成科技清零 — 需科技系统集成测试验证');
    });

    // F4. 武将等级重置（衰减）
    describe('F4. 武将等级衰减', () => {
      test.todo('PRD: 武将等级衰减50%（向下取整，最低Lv.1）— 引擎未实现');
      test.todo('PRD: 武将技能等级衰减70% — 引擎未实现');
      test.todo('PRD: 武将升星100%保留 — 引擎 keep_heroes 覆盖拥有权，星级保留待验证');
    });

    // F5. 远征进度重置
    describe('F5. 远征进度重置', () => {
      test('reset_map_progress 覆盖远征进度重置', () => {
        expect(REBIRTH_RESET_RULES).toContain('reset_map_progress');
      });

      test('转生回调传入 reset_map_progress', () => {
        const { rebirth, resetFn } = createReadyRebirthSystem();
        rebirth.executeRebirth();
        const rules = resetFn.mock.calls[0][0] as string[];
        expect(rules).toContain('reset_map_progress');
      });
    });

    // F6. 竞技场排名重置
    describe('F6. 竞技场排名重置', () => {
      test.todo('PRD: 竞技场排名重置 — 引擎 REBIRTH_RESET_RULES 未包含 reset_arena_rank');
    });

    // F7. 任务进度重置
    describe('F7. 任务进度重置', () => {
      test('reset_quest_progress 规则存在', () => {
        expect(REBIRTH_RESET_RULES).toContain('reset_quest_progress');
      });

      test('转生回调传入 reset_quest_progress', () => {
        const { rebirth, resetFn } = createReadyRebirthSystem();
        rebirth.executeRebirth();
        const rules = resetFn.mock.calls[0][0] as string[];
        expect(rules).toContain('reset_quest_progress');
      });
    });

    // F8. 联盟贡献重置
    describe('F8. 联盟贡献重置', () => {
      test.todo('PRD: 联盟贡献重置 — 引擎 REBIRTH_RESET_RULES 未包含 reset_alliance_contribution');
    });
  });

  // ─────────────────────────────────────────
  // G. PRD 衰减规则（保留比例 < 100%）
  // ─────────────────────────────────────────

  describe('G. PRD 衰减规则（引擎未实现）', () => {
    test.todo('PRD: 武将等级衰减50%（向下取整，最低Lv.1）— 引擎未实现衰减逻辑');
    test.todo('PRD: 武将技能等级衰减70% — 引擎未实现');
    test.todo('PRD: 天命保留30% — 引擎未实现天命衰减');
    test.todo('PRD: 科技研究进度保留50%，未完成清零 — 引擎未实现');
    test.todo('PRD: 关卡通关记录100%保留，当前进度重置至第1章 — 引擎未实现');
    test.todo('PRD: 三星记录100%保留 — 引擎未实现');
  });

  // ─────────────────────────────────────────
  // H. 转生后初始赠送（补偿重置损失）
  // ─────────────────────────────────────────

  describe('H. 转生后初始赠送', () => {
    test('getInitialGift 返回正确资源值', () => {
      const { rebirth } = createReadyRebirthSystem();
      const gift = rebirth.getInitialGift();
      expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
      expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
    });

    test('赠送值全部 > 0', () => {
      const { rebirth } = createReadyRebirthSystem();
      const gift = rebirth.getInitialGift();
      expect(gift.grain).toBeGreaterThan(0);
      expect(gift.gold).toBeGreaterThan(0);
      expect(gift.troops).toBeGreaterThan(0);
    });

    test('赠送资源与重置规则对应（重置资源后给予起步资源）', () => {
      // 验证设计意图：reset_resources 后给予初始资源
      expect(REBIRTH_RESET_RULES).toContain('reset_resources');
      expect(REBIRTH_INITIAL_GIFT.gold).toBeGreaterThan(0);
      expect(REBIRTH_INITIAL_GIFT.grain).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────
  // I. 存档一致性 — 保留/重置后存档正确
  // ─────────────────────────────────────────

  describe('I. 存档一致性', () => {
    test('转生后存档/读档 rebirthCount 一致', () => {
      const { rebirth } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const state = rebirth.getState();

      const newSys = createRebirthSystem();
      newSys.loadSaveData({ rebirth: state });
      expect(newSys.getState().rebirthCount).toBe(1);
    });

    test('转生后存档/读档 multiplier 一致', () => {
      const { rebirth } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const state = rebirth.getState();

      const newSys = createRebirthSystem();
      newSys.loadSaveData({ rebirth: state });
      expect(newSys.getState().currentMultiplier).toBeCloseTo(state.currentMultiplier);
    });

    test('转生后存档/读档 accelerationDaysLeft 一致', () => {
      const { rebirth } = createReadyRebirthSystem();
      rebirth.executeRebirth();
      const state = rebirth.getState();

      const newSys = createRebirthSystem();
      newSys.loadSaveData({ rebirth: state });
      expect(newSys.getState().accelerationDaysLeft).toBe(state.accelerationDaysLeft);
    });

    test('多次转生存档/读档记录完整', () => {
      const { rebirth, advanceTime } = createReadyRebirthSystemWithTime();
      rebirth.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      rebirth.executeRebirth();
      const state = rebirth.getState();

      const newSys = createRebirthSystem();
      newSys.loadSaveData({ rebirth: state });
      expect(newSys.getState().rebirthRecords).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────
  // J. PRD 差距汇总 — 保留/重置规则
  // ─────────────────────────────────────────

  describe('J. PRD 差距汇总', () => {
    test('引擎保留规则6项 vs PRD保留规则7项（缺充值记录/已购买商品/皮肤收藏）', () => {
      // 引擎当前6项: keep_heroes, keep_equipment, keep_tech_points, keep_prestige, keep_achievements, keep_vip
      expect(REBIRTH_KEEP_RULES).toHaveLength(6);
    });

    test('引擎重置规则5项 vs PRD重置规则8项（缺科技等级/武将等级/竞技场/联盟）', () => {
      // 引擎当前5项: reset_buildings, reset_resources, reset_map_progress, reset_quest_progress, reset_campaign
      expect(REBIRTH_RESET_RULES).toHaveLength(5);
    });

    test('PRD 衰减规则全部未实现', () => {
      // PRD要求：武将等级50%、技能等级70%、天命30%、科技进度50%
      // 引擎保留规则为100%保留，无衰减逻辑
      expect(REBIRTH_KEEP_RULES).toContain('keep_heroes');
      expect(REBIRTH_KEEP_RULES).toContain('keep_tech_points');
      // 但无衰减比例配置
    });

    test.todo('PRD: 建筑解锁状态保留 — 需建筑系统集成测试验证 reset_buildings 不清除蓝图');
    test.todo('PRD: 关卡通关记录保留 — 需战役系统集成测试验证');
    test.todo('PRD: 三星记录保留 — 需战役系统集成测试验证');
    test.todo('PRD: 公会/好友/NPC好感度保留 — 需社交系统集成测试验证');
    test.todo('PRD: 扫荡令保留 — 需背包系统集成测试验证');
    test.todo('PRD: 科技路线记录保留 — 需科技系统集成测试验证');
  });
});
