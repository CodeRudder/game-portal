/**
 * AchievementSystem 完整测试
 *
 * QST-4 成就系统 P0 级覆盖
 *
 * 覆盖范围：
 * - #16 成就框架(5维度) — 战斗/建设/收集/社交/转生
 * - #17 成就奖励 — 资源+积分+声望值+解锁
 * - #18 转生成就链 — 链式成就+链完成奖励
 *
 * 测试维度：生命周期 / 触发条件 / 进度累积 / 隐藏成就 / 奖励发放
 *           展示查询 / 成就链 / 事件集成 / 存档序列化 / 汇总API / 边界异常 / 集成流程
 */

import { vi, describe, it, expect } from 'vitest';
import { AchievementSystem } from '../AchievementSystem';
import type { ISystemDeps } from '../../../core/types';
import type { AchievementDimension, AchievementReward, AchievementSaveData } from '../../../core/achievement';
import { ALL_ACHIEVEMENTS, ACHIEVEMENT_DEF_MAP, REBIRTH_ACHIEVEMENT_CHAINS, ACHIEVEMENT_SAVE_VERSION } from '../../../core/achievement';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): AchievementSystem {
  const sys = new AchievementSystem();
  sys.init(mockDeps());
  return sys;
}

function createSystemWithListeners() {
  const deps = mockDeps();
  const sys = new AchievementSystem();
  sys.init(deps);
  const getListener = (event: string) => {
    const calls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
    const match = calls.find((c: [string]) => c[0] === event);
    return match ? (match[1] as (...args: unknown[]) => void) : undefined;
  };
  return { sys, deps, getListener };
}

function completeChain(sys: AchievementSystem, chainId: string) {
  const chain = REBIRTH_ACHIEVEMENT_CHAINS.find(c => c.chainId === chainId);
  if (!chain) return;
  for (const achId of chain.achievementIds) {
    const def = ACHIEVEMENT_DEF_MAP[achId];
    if (!def) continue;
    for (const cond of def.conditions) sys.updateProgress(cond.type, cond.targetValue);
    sys.claimReward(achId);
  }
}

const ALL_DIMS: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];

// ═══════════════════════════════════════════════════════════

describe('AchievementSystem', () => {

  // ═══════════════════════════════════════════
  // 1. ISubsystem 生命周期
  // ═══════════════════════════════════════════

  describe('ISubsystem 生命周期', () => {
    it('name 为 achievement', () => expect(createSystem().name).toBe('achievement'));

    it('初始状态 totalPoints 为 0', () => expect(createSystem().getTotalPoints()).toBe(0));

    it('初始无已完成链', () => expect(createSystem().getCompletedChains()).toHaveLength(0));

    it('getState 返回不可变快照', () => {
      const sys = createSystem();
      const s1 = sys.getState();
      s1.totalPoints = 999;
      expect(sys.getState().totalPoints).toBe(0);
    });

    it('reset 完全恢复初始状态', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 100);
      sys.updateProgress('hero_count', 20);
      sys.reset();
      expect(sys.getTotalPoints()).toBe(0);
      expect(sys.getCompletedChains()).toHaveLength(0);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(0);
    });

    it('update 不抛异常', () => {
      const sys = createSystem();
      expect(() => sys.update(16)).not.toThrow();
      expect(() => sys.update(0)).not.toThrow();
      expect(() => sys.update(-1)).not.toThrow();
    });

    it('多次 init 不崩溃', () => {
      const sys = new AchievementSystem();
      sys.init(mockDeps());
      expect(() => sys.init(mockDeps())).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 成就触发与条件检查
  // ═══════════════════════════════════════════

  describe('成就触发与条件检查', () => {
    it('所有5维度都有对应成就', () => {
      const sys = createSystem();
      for (const dim of ALL_DIMS) {
        expect(sys.getAchievementsByDimension(dim).length, `维度 ${dim} 应有成就`).toBeGreaterThan(0);
      }
    });

    it('各维度成就数量与配置一致', () => {
      const sys = createSystem();
      for (const dim of ALL_DIMS) {
        expect(sys.getAchievementsByDimension(dim)).toHaveLength(ALL_ACHIEVEMENTS.filter(a => a.dimension === dim).length);
      }
    });

    it('getAllAchievements 返回全部配置成就且含 instance', () => {
      const all = createSystem().getAllAchievements();
      expect(all).toHaveLength(ALL_ACHIEVEMENTS.length);
      for (const ach of all) {
        expect(ach.instance).toBeDefined();
        expect(ach.instance.defId).toBe(ach.id);
      }
    });

    it('getAchievement 返回正确详情', () => {
      const ach = createSystem().getAchievement('ach-battle-001');
      expect(ach).not.toBeNull();
      expect(ach!.id).toBe('ach-battle-001');
      expect(ach!.name).toBe('初出茅庐');
      expect(ach!.dimension).toBe('battle');
      expect(ach!.rarity).toBe('common');
      expect(ach!.conditions[0].type).toBe('battle_wins');
      expect(ach!.conditions[0].targetValue).toBe(10);
    });

    it('getAchievement 不存在的ID返回 null', () => {
      const sys = createSystem();
      expect(sys.getAchievement('nonexistent')).toBeNull();
      expect(sys.getAchievement('')).toBeNull();
    });

    it('条件类型覆盖多种', () => {
      const types = new Set(ALL_ACHIEVEMENTS.flatMap(a => a.conditions.map(c => c.type)));
      expect(types.size).toBeGreaterThanOrEqual(5);
      expect(types.has('battle_wins')).toBe(true);
      expect(types.has('building_level')).toBe(true);
      expect(types.has('hero_count')).toBe(true);
    });

    it('updateProgress 精确匹配条件类型', () => {
      const sys = createSystem();
      sys.updateProgress('building_level', 5);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(0);
      expect(sys.getAchievement('ach-build-001')!.instance.progress['building_level']).toBe(5);
    });

    it('updateProgressFromSnapshot 批量更新', () => {
      const sys = createSystem();
      sys.updateProgressFromSnapshot({ battle_wins: 10, building_level: 5, hero_count: 5 });
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(10);
      expect(sys.getAchievement('ach-build-001')!.instance.progress['building_level']).toBe(5);
      expect(sys.getAchievement('ach-collect-001')!.instance.progress['hero_count']).toBe(5);
    });

    it('updateProgressFromSnapshot 空快照不影响状态', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      sys.updateProgressFromSnapshot({});
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 进度累积与完成判定
  // ═══════════════════════════════════════════

  describe('进度累积与完成判定', () => {
    it('进度取最大值', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 8);
      sys.updateProgress('battle_wins', 3);
      sys.updateProgress('battle_wins', 5);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(8);
    });

    it('恰好达到目标值时完成', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
    });

    it('超过目标值也完成', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 100);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
    });

    it('低于目标值不完成', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 9);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
    });

    it('目标值-1 边界不完成', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 9);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
    });

    it('一次性大跳转：前置和后续同时满足条件', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 100);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('completed');
    });

    it('前置成就 claim 后后续成就自动解锁', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('in_progress');
      expect(sys.getAchievement('ach-battle-002')!.instance.progress['battle_wins']).toBe(10);
    });

    it('已完成成就不再更新进度', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.updateProgress('battle_wins', 999);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
    });

    it('已领取成就完全冻结', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      sys.updateProgress('battle_wins', 9999);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('claimed');
    });

    it('completed 时记录完成时间', () => {
      const sys = createSystem();
      const before = Date.now();
      sys.updateProgress('battle_wins', 10);
      const ach = sys.getAchievement('ach-battle-001')!.instance;
      expect(ach.completedAt).toBeGreaterThanOrEqual(before);
      expect(ach.completedAt).toBeLessThanOrEqual(Date.now());
    });

    it('未完成成就 completedAt 为 null', () => {
      expect(createSystem().getAchievement('ach-battle-001')!.instance.completedAt).toBeNull();
    });

    it('连续快速更新在完成前正确累积', () => {
      const sys = createSystem();
      for (let i = 1; i <= 9; i++) sys.updateProgress('battle_wins', i);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(9);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
    });

    it('完成后不再更新进度', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.updateProgress('battle_wins', 999);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 隐藏成就
  // ═══════════════════════════════════════════

  describe('隐藏成就', () => {
    it('配置中有隐藏成就', () => {
      expect(ALL_ACHIEVEMENTS.filter(a => a.hidden).length).toBeGreaterThan(0);
    });

    it('隐藏成就 hidden=true，非隐藏 hidden=false', () => {
      const sys = createSystem();
      expect(sys.getAchievement('ach-battle-004')!.hidden).toBe(true);
      expect(sys.getAchievement('ach-battle-001')!.hidden).toBe(false);
    });

    it('隐藏成就可通过进度完成', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      sys.updateProgress('building_level', 5); sys.claimReward('ach-build-001');
      sys.updateProgress('building_upgrades', 50); sys.claimReward('ach-build-002');
      sys.updateProgress('building_level', 15); sys.claimReward('ach-build-003');
      sys.updateProgress('building_upgrades', 500);
      expect(sys.getAchievement('ach-build-004')!.instance.status).toBe('completed');
    });

    it('隐藏成就出现在 getAllAchievements 中', () => {
      const hiddenIds = createSystem().getAllAchievements().filter(a => a.hidden).map(a => a.id);
      expect(hiddenIds).toContain('ach-battle-004');
      expect(hiddenIds).toContain('ach-build-004');
      expect(hiddenIds).toContain('ach-collect-006');
    });

    it('隐藏成就稀有度为 legendary', () => {
      for (const ach of ALL_ACHIEVEMENTS.filter(a => a.hidden)) {
        expect(ach.rarity).toBe('legendary');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 成就奖励发放
  // ═══════════════════════════════════════════

  describe('成就奖励发放', () => {
    it('领取完成成就返回成功和奖励', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const r = sys.claimReward('ach-battle-001');
      expect(r.success).toBe(true);
      expect(r.reward!.achievementPoints).toBe(10);
      expect(r.reward!.resources!.gold).toBe(100);
    });

    it('高稀有度成就奖励含声望值', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.updateProgress('battle_wins', 100); sys.claimReward('ach-battle-002');
      sys.updateProgress('battle_wins', 500);
      const r = sys.claimReward('ach-battle-003');
      expect(r.success).toBe(true);
      expect(r.reward!.prestigePoints).toBe(200);
    });

    it('积分持续累加', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.updateProgress('building_level', 5); sys.claimReward('ach-build-001');
      expect(sys.getTotalPoints()).toBe(20);
    });

    it('未完成/已领取/不存在 均领取失败', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      expect(sys.claimReward('ach-battle-001').success).toBe(false);
      expect(sys.claimReward('ach-battle-001').reason).toContain('未完成');
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      expect(sys.claimReward('ach-battle-001').success).toBe(false);
      expect(sys.claimReward('nonexistent').success).toBe(false);
    });

    it('领取后状态变为 claimed 并记录时间', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const before = Date.now();
      sys.claimReward('ach-battle-001');
      const inst = sys.getAchievement('ach-battle-001')!.instance;
      expect(inst.status).toBe('claimed');
      expect(inst.claimedAt).toBeGreaterThanOrEqual(before);
    });

    it('领取触发奖励回调', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ achievementPoints: 10, resources: { gold: 100 } }));
    });

    it('不设回调时领取不崩溃', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      expect(() => sys.claimReward('ach-battle-001')).not.toThrow();
    });

    it('getClaimableAchievements 正确返回', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.updateProgress('building_level', 5);
      expect(sys.getClaimableAchievements()).toContain('ach-battle-001');
      expect(sys.getClaimableAchievements()).toContain('ach-build-001');
      sys.claimReward('ach-battle-001');
      expect(sys.getClaimableAchievements()).not.toContain('ach-battle-001');
    });

    it('领取后维度统计更新，未领取不影响统计', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      expect(sys.getDimensionStats().battle.completedCount).toBe(0);
      sys.claimReward('ach-battle-001');
      expect(sys.getDimensionStats().battle.completedCount).toBe(1);
      expect(sys.getDimensionStats().battle.totalPoints).toBe(10);
    });

    it('不同维度分别统计', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.updateProgress('building_level', 5); sys.claimReward('ach-build-001');
      const stats = sys.getDimensionStats();
      expect(stats.battle.completedCount).toBe(1);
      expect(stats.building.completedCount).toBe(1);
      expect(stats.collection.completedCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 成就展示与查询
  // ═══════════════════════════════════════════

  describe('成就展示与查询', () => {
    it('维度统计包含所有5维度且 totalCount 与配置一致', () => {
      const stats = createSystem().getDimensionStats();
      for (const dim of ALL_DIMS) {
        expect(stats[dim]).toBeDefined();
        expect(stats[dim].completedCount).toBe(0);
        expect(stats[dim].totalCount).toBe(ALL_ACHIEVEMENTS.filter(a => a.dimension === dim).length);
      }
    });

    it('成就状态流转: locked -> in_progress -> completed -> claimed', () => {
      const sys = createSystem();
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('locked');
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('in_progress');
      sys.updateProgress('battle_wins', 100);
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('completed');
      sys.claimReward('ach-battle-002');
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('claimed');
    });

    it('无前置成就初始 in_progress，有前置初始 locked', () => {
      const sys = createSystem();
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
      expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('locked');
    });

    it('getAchievementsByDimension 只返回对应维度', () => {
      const sys = createSystem();
      for (const ach of sys.getAchievementsByDimension('battle')) expect(ach.dimension).toBe('battle');
      for (const ach of sys.getAchievementsByDimension('building')) expect(ach.dimension).toBe('building');
    });

    it('getDimensionStats 返回浅拷贝（外层新对象，内层共享引用）', () => {
      const sys = createSystem();
      const s1 = sys.getDimensionStats();
      s1.battle.completedCount = 999;
      const s2 = sys.getDimensionStats();
      expect(s1).not.toBe(s2);
      expect(s2.battle.completedCount).toBe(999); // 浅拷贝：内层共享
    });
  });

  // ═══════════════════════════════════════════
  // 7. 转生成就链
  // ═══════════════════════════════════════════

  describe('转生成就链', () => {
    it('初始无已完成链，链进度为0', () => {
      const sys = createSystem();
      expect(sys.getCompletedChains()).toHaveLength(0);
      for (const c of sys.getAchievementChains()) {
        expect(c.progress).toBe(0);
        expect(c.completed).toBe(false);
      }
    });

    it('getAchievementChains 返回所有配置链', () => {
      expect(createSystem().getAchievementChains()).toHaveLength(REBIRTH_ACHIEVEMENT_CHAINS.length);
    });

    it('链中成就ID都存在于配置中', () => {
      for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
        for (const id of chain.achievementIds) expect(ACHIEVEMENT_DEF_MAP[id]).toBeDefined();
      }
    });

    it('链部分完成不标记为已完成', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      const chain = sys.getAchievementChains().find(c => c.chainId === 'chain-battle-master');
      expect(chain!.progress).toBe(1);
      expect(chain!.completed).toBe(false);
      expect(sys.getCompletedChains()).toHaveLength(0);
    });

    it('完成链中所有成就后链标记完成并发放奖励', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      expect(sys.getCompletedChains()).toContain('chain-battle-master');
      const lastReward = cb.mock.calls[cb.mock.calls.length - 1][0] as AchievementReward;
      expect(lastReward.achievementPoints).toBe(100);
    });

    it('链完成触发 chainCompleted 事件', () => {
      const { sys, deps } = createSystemWithListeners();
      completeChain(sys, 'chain-battle-master');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('achievement:chainCompleted',
        expect.objectContaining({ chainId: 'chain-battle-master' }));
    });

    it('链不重复完成', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      const before = sys.getCompletedChains().length;
      sys.updateProgress('battle_wins', 9999);
      expect(sys.getCompletedChains().length).toBe(before);
    });

    it('多条链可同时完成', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      completeChain(sys, 'chain-builder-king');
      const completed = sys.getCompletedChains();
      expect(completed).toContain('chain-battle-master');
      expect(completed).toContain('chain-builder-king');
    });

    it('链奖励回调次数正确（4成就+1链奖励=5次）', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      expect(cb).toHaveBeenCalledTimes(5);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 事件监听集成
  // ═══════════════════════════════════════════

  describe('事件监听集成', () => {
    it('注册所有必要事件监听', () => {
      const deps = mockDeps();
      new AchievementSystem().init(deps);
      const events = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls.map((c: [string]) => c[0]);
      for (const e of ['battle:completed', 'building:upgraded', 'hero:recruited', 'rebirth:completed', 'prestige:levelUp']) {
        expect(events).toContain(e);
      }
    });

    it('battle:completed 更新战斗进度', () => {
      const { sys, getListener } = createSystemWithListeners();
      getListener('battle:completed')!({ wins: 10 });
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(10);
    });

    it('battle:completed 忽略无 wins 参数', () => {
      const { sys, getListener } = createSystemWithListeners();
      getListener('battle:completed')!({});
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(0);
    });

    it('building:upgraded 更新建筑等级和升级次数', () => {
      const { sys, getListener } = createSystemWithListeners();
      const listener = getListener('building:upgraded')!;
      listener({ level: 5 });
      expect(sys.getAchievement('ach-build-001')!.instance.progress['building_level']).toBe(5);
      sys.claimReward('ach-build-001');
      listener({ totalUpgrades: 50 });
      expect(sys.getAchievement('ach-build-002')!.instance.progress['building_upgrades']).toBe(50);
    });

    it('hero:recruited 更新武将数量', () => {
      const { sys, getListener } = createSystemWithListeners();
      getListener('hero:recruited')!({ count: 5 });
      expect(sys.getAchievement('ach-collect-001')!.instance.progress['hero_count']).toBe(5);
    });

    it('rebirth:completed 更新转生次数', () => {
      const { sys, getListener } = createSystemWithListeners();
      getListener('rebirth:completed')!({ count: 1 });
      expect(sys.getAchievement('ach-rebirth-001')!.instance.progress['rebirth_count']).toBe(1);
    });

    it('prestige:levelUp 更新声望等级', () => {
      const { sys, getListener } = createSystemWithListeners();
      getListener('prestige:levelUp')!({ level: 50 });
      expect(sys.getAchievement('ach-rebirth-006')!.instance.progress['prestige_level']).toBe(50);
    });

    it('成就完成发射 achievement:completed 事件含稀有度', () => {
      const { sys, deps } = createSystemWithListeners();
      sys.updateProgress('battle_wins', 10);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('achievement:completed', expect.objectContaining({
        id: 'ach-battle-001', name: '初出茅庐', dimension: 'battle', rarity: 'common',
      }));
    });
  });

  // ═══════════════════════════════════════════
  // 9. 存档序列化/反序列化
  // ═══════════════════════════════════════════

  describe('存档序列化/反序列化', () => {
    it('getSaveData 包含正确版本和完整状态', () => {
      const save = createSystem().getSaveData();
      expect(save.version).toBe(ACHIEVEMENT_SAVE_VERSION);
      expect(save.state.achievements).toBeDefined();
      expect(save.state.totalPoints).toBeDefined();
      expect(save.state.dimensionStats).toBeDefined();
      expect(save.state.completedChains).toBeDefined();
    });

    it('空状态存档读档一致', () => {
      const save = createSystem().getSaveData();
      const newSys = createSystem();
      newSys.loadSaveData(save);
      expect(newSys.getTotalPoints()).toBe(0);
      expect(newSys.getCompletedChains()).toHaveLength(0);
    });

    it('有进度存档读档一致', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      const newSys = createSystem();
      newSys.loadSaveData(sys.getSaveData());
      expect(newSys.getTotalPoints()).toBe(10);
      expect(newSys.getAchievement('ach-battle-001')!.instance.status).toBe('claimed');
    });

    it('多维度存档读档一致', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.updateProgress('building_level', 5); sys.claimReward('ach-build-001');
      const newSys = createSystem();
      newSys.loadSaveData(sys.getSaveData());
      expect(newSys.getTotalPoints()).toBe(20);
      expect(newSys.getDimensionStats().battle.completedCount).toBe(1);
    });

    it('链完成存档读档一致', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      const newSys = createSystem();
      newSys.loadSaveData(sys.getSaveData());
      expect(newSys.getCompletedChains()).toContain('chain-battle-master');
    });

    it('版本不匹配不加载', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const before = sys.getTotalPoints();
      sys.loadSaveData({ state: sys.getState(), version: 999 } as AchievementSaveData);
      expect(sys.getTotalPoints()).toBe(before);
    });

    it('读档后可继续正常操作', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      const newSys = createSystem();
      newSys.loadSaveData(sys.getSaveData());
      newSys.updateProgress('building_level', 5); newSys.claimReward('ach-build-001');
      expect(newSys.getTotalPoints()).toBe(20);
    });

    it('存档数据是深拷贝（修改不影响系统）', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const save = sys.getSaveData();
      save.state.totalPoints = 9999;
      expect(sys.getTotalPoints()).toBe(0);
    });

    it('读档后链进度重建', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.updateProgress('battle_wins', 100); sys.claimReward('ach-battle-002');
      const newSys = createSystem();
      newSys.loadSaveData(sys.getSaveData());
      const chain = newSys.getAchievementChains().find(c => c.chainId === 'chain-battle-master');
      expect(chain!.progress).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 统一汇总 API (getUnlockedSummary)
  // ═══════════════════════════════════════════

  describe('getUnlockedSummary', () => {
    it('初始状态全部为0', () => {
      const s = createSystem().getUnlockedSummary();
      expect(s.totalAchievements).toBe(ALL_ACHIEVEMENTS.length);
      expect(s.unlockedCount).toBe(0);
      expect(s.completedChains).toHaveLength(0);
    });

    it('completed 和 claimed 都计入 unlockedCount', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      expect(sys.getUnlockedSummary().unlockedCount).toBe(1);
      sys.claimReward('ach-battle-001');
      expect(sys.getUnlockedSummary().unlockedCount).toBe(1);
    });

    it('byDimension 按维度分组且 total 总和等于 totalAchievements', () => {
      const s = createSystem().getUnlockedSummary();
      for (const dim of ALL_DIMS) {
        expect(s.byDimension[dim]).toBeDefined();
        expect(s.byDimension[dim].total).toBeGreaterThan(0);
        expect(s.byDimension[dim].unlocked).toBe(0);
      }
      const totalFromDims = Object.values(s.byDimension).reduce((sum, d) => sum + d.total, 0);
      expect(totalFromDims).toBe(s.totalAchievements);
    });

    it('完成链后 completedChains 更新', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      expect(sys.getUnlockedSummary().completedChains).toContain('chain-battle-master');
    });

    it('多维度完成时统计正确', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.updateProgress('building_level', 5);
      const s = sys.getUnlockedSummary();
      expect(s.unlockedCount).toBe(2);
      expect(s.byDimension.battle.unlocked).toBe(1);
      expect(s.byDimension.building.unlocked).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 边界条件与异常
  // ═══════════════════════════════════════════

  describe('边界条件与异常', () => {
    it('负数进度不导致异常', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', -1);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(0);
    });

    it('极大值进度正常处理', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', Number.MAX_SAFE_INTEGER);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
    });

    it('浮点数进度正常处理', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10.5);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(10.5);
    });

    it('不相关条件类型不影响成就', () => {
      const sys = createSystem();
      sys.updateProgress('quest_completed', 1000);
      expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(0);
    });

    it('setRewardCallback 可多次设置（后者覆盖前者）', () => {
      const sys = createSystem();
      const cb1 = vi.fn(), cb2 = vi.fn();
      sys.setRewardCallback(cb1); sys.setRewardCallback(cb2);
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('reset 后可重新使用', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10); sys.claimReward('ach-battle-001');
      sys.reset();
      sys.updateProgress('battle_wins', 10);
      expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
      expect(sys.claimReward('ach-battle-001').success).toBe(true);
    });

    it('getCompletedChains 返回副本', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      completeChain(sys, 'chain-battle-master');
      const c1 = sys.getCompletedChains();
      c1.push('fake');
      expect(sys.getCompletedChains()).not.toContain('fake');
    });

    it('所有成就ID唯一', () => {
      const ids = ALL_ACHIEVEMENTS.map(a => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('所有链ID唯一', () => {
      const ids = REBIRTH_ACHIEVEMENT_CHAINS.map(c => c.chainId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('前置成就引用的ID都存在且不形成循环', () => {
      const visited = new Set<string>();
      const checkCycle = (id: string): boolean => {
        if (visited.has(id)) return true;
        visited.add(id);
        const def = ACHIEVEMENT_DEF_MAP[id];
        if (def?.prerequisiteId) return checkCycle(def.prerequisiteId);
        visited.delete(id);
        return false;
      };
      for (const ach of ALL_ACHIEVEMENTS) {
        if (ach.prerequisiteId) expect(ACHIEVEMENT_DEF_MAP[ach.prerequisiteId]).toBeDefined();
        visited.clear();
        expect(checkCycle(ach.id)).toBe(false);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 12. 完整流程集成
  // ═══════════════════════════════════════════

  describe('完整流程集成', () => {
    it('从零完成战斗维度成就链', () => {
      const sys = createSystem();
      const cb = vi.fn(); sys.setRewardCallback(cb);
      const steps = [
        { progress: 10, id: 'ach-battle-001', points: 10 },
        { progress: 100, id: 'ach-battle-002', points: 30 },
        { progress: 500, id: 'ach-battle-003', points: 100 },
        { progress: 2000, id: 'ach-battle-004', points: 300 },
      ];
      let totalPts = 0;
      for (const step of steps) {
        sys.updateProgress('battle_wins', step.progress);
        expect(sys.getAchievement(step.id)!.instance.status).toBe('completed');
        const r = sys.claimReward(step.id);
        expect(r.success).toBe(true);
        expect(r.reward!.achievementPoints).toBe(step.points);
        totalPts += step.points;
      }
      expect(sys.getTotalPoints()).toBe(totalPts);
      expect(sys.getCompletedChains()).toContain('chain-battle-master');
      expect(sys.getDimensionStats().battle.completedCount).toBe(4);
    });

    it('多维度并行推进', () => {
      const sys = createSystem();
      sys.updateProgressFromSnapshot({
        battle_wins: 10, building_level: 5, hero_count: 5,
        npc_max_favorability: 50, rebirth_count: 1,
      });
      const claimable = sys.getClaimableAchievements();
      expect(claimable.length).toBeGreaterThanOrEqual(5);
      for (const id of claimable) expect(sys.claimReward(id).success).toBe(true);
      expect(sys.getTotalPoints()).toBeGreaterThan(0);
    });

    it('存档迁移后继续游戏', () => {
      const sys1 = createSystem();
      sys1.updateProgress('battle_wins', 10); sys1.claimReward('ach-battle-001');
      const sys2 = createSystem();
      sys2.loadSaveData(sys1.getSaveData());
      expect(sys2.getTotalPoints()).toBe(10);
      sys2.updateProgress('battle_wins', 100); sys2.claimReward('ach-battle-002');
      expect(sys2.getTotalPoints()).toBe(40);
      const sys3 = createSystem();
      sys3.loadSaveData(sys2.getSaveData());
      expect(sys3.getTotalPoints()).toBe(40);
      expect(sys3.getAchievement('ach-battle-002')!.instance.status).toBe('claimed');
    });
  });
});
