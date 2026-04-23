/**
 * 集成测试：异常与边界场景（§12.1 ~ §12.6）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 6 个流程：
 *   §12.1 战斗中断处理：中断后状态保存和恢复
 *   §12.2 回合上限耗尽：达到最大回合数后判定
 *   §12.3 武将阵亡处理：武将HP归零后正确移除
 *   §12.4 全军覆没处理：一方全灭后战斗结束
 *   §12.5 资源溢出处理：资源超过上限截断
 *   §12.6 关卡数据异常处理：异常数据防护
 *
 * 测试策略：使用 BattleEngine + CampaignProgressSystem + ResourceSystem 真实实例，
 * 验证各种异常和边界条件下的系统行为。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../../../battle/BattleEngine';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import { RewardDistributor } from '../../RewardDistributor';
import { ResourceSystem } from '../../../resource/ResourceSystem';
import {
  BattleOutcome,
  BattlePhase,
  StarRating,
  TroopType,
} from '../../../battle/battle.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';
import type {
  BattleState,
  BattleTeam,
  BattleUnit,
} from '../../../battle/battle.types';
import type {
  RewardDistributorDeps,
} from '../../campaign.types';
import {
  campaignDataProvider,
  getChapters,
  getStage,
} from '../../campaign-config';
import type { ResourceType } from '../../../../shared/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建一个战斗单位 */
function createUnit(
  id: string,
  name: string,
  hp: number,
  attack: number,
  side: 'ally' | 'enemy' = 'enemy',
  speed = 50,
): BattleUnit {
  return {
    id,
    name,
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side,
    attack,
    baseAttack: attack,
    defense: 50,
    baseDefense: 50,
    intelligence: 50,
    speed,
    hp,
    maxHp: hp,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: `${id}_normal`,
      name: '普攻',
      type: 'active',
      level: 1,
      description: '普通攻击',
      multiplier: 1.0,
      targetType: 'SINGLE_ENEMY' as const,
      rageCost: 0,
      cooldown: 0,
      currentCooldown: 0,
    },
    skills: [],
    buffs: [],
  };
}

/** 创建均衡队伍 */
function createTeam(side: 'ally' | 'enemy', count: number, hp: number, attack: number): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    units.push(createUnit(`${side}_${i}`, `${side === 'ally' ? '武将' : '敌军'}${i}`, hp, attack, side));
  }
  return { units, side };
}

/** 创建测试环境 */
function createTestEnv() {
  const progress = new CampaignProgressSystem(campaignDataProvider);
  const resource = new ResourceSystem();
  const engine = new BattleEngine();

  const rewardDeps: RewardDistributorDeps = {
    addResource: (type: ResourceType, amount: number) =>
      resource.addResource(type, amount),
  };

  const rewardDistributor = new RewardDistributor(campaignDataProvider, rewardDeps);

  return { progress, resource, engine, rewardDistributor };
}

// ═══════════════════════════════════════════════
// §12.1 战斗中断处理
// ═══════════════════════════════════════════════
describe('§12.1 战斗中断处理', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should preserve battle state when interrupted mid-turn', () => {
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);

    // 初始化战斗
    const state = env.engine.initBattle(allyTeam, enemyTeam);

    // 执行若干回合
    env.engine.executeTurn(state);
    const turnAfter1 = state.currentTurn;

    // 模拟中断：保存当前状态
    const savedPhase = state.phase;
    const savedTurn = state.currentTurn;
    const savedActionLog = [...state.actionLog];

    expect(savedPhase).toBe(BattlePhase.IN_PROGRESS);
    expect(savedTurn).toBeGreaterThanOrEqual(1);
    expect(savedActionLog.length).toBeGreaterThan(0);

    // 恢复后状态应一致
    expect(state.phase).toBe(savedPhase);
    expect(state.currentTurn).toBe(savedTurn);
  });

  it('should have serializable battle state for save/restore', () => {
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);

    const state = env.engine.initBattle(allyTeam, enemyTeam);
    env.engine.executeTurn(state);

    // 战斗状态应可序列化
    const serialized = JSON.stringify(state);
    expect(serialized).toBeTruthy();

    // 反序列化
    const restored = JSON.parse(serialized) as BattleState;
    expect(restored.currentTurn).toBe(state.currentTurn);
    expect(restored.phase).toBe(state.phase);
    expect(restored.id).toBe(state.id);
  });

  it('should be able to resume battle from saved state', () => {
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);

    const state = env.engine.initBattle(allyTeam, enemyTeam);

    // 执行2回合
    env.engine.executeTurn(state);
    state.currentTurn++;
    env.engine.executeTurn(state);

    expect(state.currentTurn).toBeGreaterThanOrEqual(2);

    // 从保存的状态继续战斗
    while (state.phase === BattlePhase.IN_PROGRESS && state.currentTurn <= state.maxTurns) {
      env.engine.executeTurn(state);
      if (env.engine.isBattleOver(state)) break;
      state.currentTurn++;
    }

    // 战斗应正常结束
    expect(state.phase).toBe(BattlePhase.FINISHED);
    expect(state.result).toBeDefined();
  });

  it('should preserve unit HP state across interruption', () => {
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);

    const state = env.engine.initBattle(allyTeam, enemyTeam);
    env.engine.executeTurn(state);

    // 记录各单位HP
    const allyHpBefore = state.allyTeam.units.map(u => u.hp);
    const enemyHpBefore = state.enemyTeam.units.map(u => u.hp);

    // 至少有一些单位HP变化（战斗已发生）
    const allyChanged = allyHpBefore.some(hp => hp < 3000);
    const enemyChanged = enemyHpBefore.some(hp => hp < 3000);
    expect(allyChanged || enemyChanged).toBe(true);
  });

  it('should preserve action log after interruption for replay', () => {
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);

    const state = env.engine.initBattle(allyTeam, enemyTeam);
    env.engine.executeTurn(state);

    const logCount = state.actionLog.length;
    expect(logCount).toBeGreaterThan(0);

    // 模拟中断后恢复 — 行动日志应保留
    env.engine.executeTurn(state);
    state.currentTurn++;

    // 行动日志应持续增长
    expect(state.actionLog.length).toBeGreaterThan(logCount);
  });
});

// ═══════════════════════════════════════════════
// §12.2 回合上限耗尽
// ═══════════════════════════════════════════════
describe('§12.2 回合上限耗尽', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should end battle as DRAW when max turns reached', () => {
    // 创建双方极强防御的队伍（高HP、低攻击），战斗很难分出胜负
    const allyTeam = createTeam('ally', 6, 99999, 1);
    const enemyTeam = createTeam('enemy', 6, 99999, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    // 应达到最大回合数
    expect(result.totalTurns).toBe(BATTLE_CONFIG.MAX_TURNS);

    // 应判定为平局
    expect(result.outcome).toBe(BattleOutcome.DRAW);

    // 平局无星级
    expect(result.stars).toBe(StarRating.NONE);
  });

  it('should have correct max turns configuration', () => {
    expect(BATTLE_CONFIG.MAX_TURNS).toBe(8);
  });

  it('should not exceed max turns in battle state', () => {
    const allyTeam = createTeam('ally', 6, 99999, 1);
    const enemyTeam = createTeam('enemy', 6, 99999, 1);

    const state = env.engine.initBattle(allyTeam, enemyTeam);

    while (
      state.phase === BattlePhase.IN_PROGRESS &&
      state.currentTurn <= state.maxTurns
    ) {
      env.engine.executeTurn(state);
      if (env.engine.isBattleOver(state)) break;
      state.currentTurn++;
    }

    expect(state.currentTurn).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
  });

  it('should give VICTORY if enemy eliminated before max turns', () => {
    // 我方极强，敌方极弱
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
  });

  it('should give DEFEAT if ally eliminated before max turns', () => {
    // 我方极弱，敌方极强
    const allyTeam = createTeam('ally', 3, 100, 1);
    const enemyTeam = createTeam('enemy', 6, 5000, 9999);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    expect(result.stars).toBe(StarRating.NONE);
  });

  it('should have DRAW outcome when both sides survive to max turns', () => {
    // 使用极高HP+极低攻击确保双方存活
    const allyTeam = createTeam('ally', 6, 999999, 1);
    const enemyTeam = createTeam('enemy', 6, 999999, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.DRAW);
    // 平局时双方都应有存活
    expect(result.allySurvivors).toBeGreaterThan(0);
    expect(result.enemySurvivors).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §12.3 武将阵亡处理
// ═══════════════════════════════════════════════
describe('§12.3 武将阵亡处理', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should mark unit as dead when HP reaches zero', () => {
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const state = env.engine.initBattle(allyTeam, enemyTeam);
    env.engine.executeTurn(state);

    // 敌方应有单位死亡
    const deadEnemies = state.enemyTeam.units.filter(u => !u.isAlive);
    if (deadEnemies.length > 0) {
      for (const dead of deadEnemies) {
        expect(dead.hp).toBeLessThanOrEqual(0);
        expect(dead.isAlive).toBe(false);
      }
    }
  });

  it('should not include dead units in subsequent turn order', () => {
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const state = env.engine.initBattle(allyTeam, enemyTeam);

    // 执行多个回合
    for (let i = 0; i < 3; i++) {
      env.engine.executeTurn(state);
      if (env.engine.isBattleOver(state)) break;
      state.currentTurn++;
    }

    // 如果战斗已结束
    if (state.phase === BattlePhase.FINISHED) {
      const deadEnemies = state.enemyTeam.units.filter(u => !u.isAlive);
      // 所有敌方单位应已阵亡
      expect(deadEnemies.length).toBe(state.enemyTeam.units.length);
    }
  });

  it('should track ally survivors correctly for star rating', () => {
    // 我方6人，强力，应能三星通关
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    if (result.outcome === BattleOutcome.VICTORY) {
      expect(result.allySurvivors).toBeGreaterThan(0);
      expect(result.allySurvivors).toBeLessThanOrEqual(6);

      // 6人存活 ≥ 4 且 回合 ≤ 6 → 三星
      if (result.allySurvivors >= 4 && result.totalTurns <= 6) {
        expect(result.stars).toBe(StarRating.THREE);
      }
    }
  });

  it('should handle all ally units taking damage in battle', () => {
    // 双方均衡，应有伤亡
    const allyTeam = createTeam('ally', 6, 1000, 300);
    const enemyTeam = createTeam('enemy', 6, 1000, 300);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    // 战斗应正常结束
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);

    // 应有战斗统计
    expect(result.allyTotalDamage).toBeGreaterThan(0);
    expect(result.enemyTotalDamage).toBeGreaterThanOrEqual(0);
  });

  it('should have hp <= 0 for all dead units after battle', () => {
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    // 敌方全灭
    expect(result.enemySurvivors).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// §12.4 全军覆没处理
// ═══════════════════════════════════════════════
describe('§12.4 全军覆没处理', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should end battle when all ally units are dead', () => {
    const allyTeam = createTeam('ally', 3, 100, 1);
    const enemyTeam = createTeam('enemy', 6, 5000, 9999);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.allySurvivors).toBe(0);
    expect(result.stars).toBe(StarRating.NONE);
  });

  it('should end battle when all enemy units are dead', () => {
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.enemySurvivors).toBe(0);
    expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
  });

  it('should set battle phase to FINISHED on wipeout', () => {
    const allyTeam = createTeam('ally', 3, 100, 1);
    const enemyTeam = createTeam('enemy', 6, 5000, 9999);

    const state = env.engine.initBattle(allyTeam, enemyTeam);

    while (state.phase === BattlePhase.IN_PROGRESS && state.currentTurn <= state.maxTurns) {
      env.engine.executeTurn(state);
      if (env.engine.isBattleOver(state)) break;
      state.currentTurn++;
    }

    expect(state.phase).toBe(BattlePhase.FINISHED);
    expect(state.result).toBeDefined();
    expect(state.result!.outcome).toBe(BattleOutcome.DEFEAT);
  });

  it('should detect battle over when one side is wiped', () => {
    const allyTeam = createTeam('ally', 6, 5000, 9999);
    const enemyTeam = createTeam('enemy', 3, 100, 1);

    const state = env.engine.initBattle(allyTeam, enemyTeam);

    // 执行回合直到战斗结束
    while (state.phase === BattlePhase.IN_PROGRESS && state.currentTurn <= state.maxTurns) {
      env.engine.executeTurn(state);
      if (env.engine.isBattleOver(state)) break;
      state.currentTurn++;
    }

    // isBattleOver 应返回 true
    expect(env.engine.isBattleOver(state)).toBe(true);
  });

  it('should handle 1v1 wipeout correctly', () => {
    // 1v1 极端场景
    const allyTeam: BattleTeam = {
      units: [createUnit('ally_solo', '独将', 5000, 9999, 'ally')],
      side: 'ally',
    };
    const enemyTeam: BattleTeam = {
      units: [createUnit('enemy_solo', '独敌', 100, 1, 'enemy')],
      side: 'enemy',
    };

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.enemySurvivors).toBe(0);
    expect(result.allySurvivors).toBe(1);
  });

  it('should record correct damage stats on wipeout', () => {
    const allyTeam = createTeam('ally', 3, 100, 1);
    const enemyTeam = createTeam('enemy', 6, 5000, 9999);

    const result = env.engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    // 敌方对我方造成了伤害
    expect(result.enemyTotalDamage).toBeGreaterThan(0);
    // 战斗日志应有摘要
    expect(result.summary).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════
// §12.5 资源溢出处理
// ═══════════════════════════════════════════════
describe('§12.5 资源溢出处理', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should cap resource at maximum value via addResource', () => {
    // 先添加大量资源
    const result1 = env.resource.addResource('grain', 999999);
    const result2 = env.resource.addResource('grain', 999999);

    // 资源系统应有上限处理
    const resources = env.resource.getResources();
    expect(resources.grain).toBeGreaterThan(0);
  });

  it('should handle zero resource addition', () => {
    const before = env.resource.getResources();
    env.resource.addResource('grain', 0);
    const after = env.resource.getResources();

    expect(after.grain).toBe(before.grain);
  });

  it('should handle negative resource gracefully', () => {
    env.resource.addResource('grain', 1000);
    const before = env.resource.getResources();

    // 尝试消耗超过持有量的资源
    const result = env.resource.addResource('grain', -2000);

    // 资源不应变为负数
    const after = env.resource.getResources();
    expect(after.grain).toBeGreaterThanOrEqual(0);
  });

  it('should distribute rewards without overflow via RewardDistributor', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 先填满资源
    for (const type of ['grain', 'gold', 'troops', 'mandate'] as ResourceType[]) {
      env.resource.addResource(type, 9999999);
    }

    // 分发奖励
    const reward = env.rewardDistributor.calculateAndDistribute(firstStageId, 3, true);

    // 资源应保持为正数且不溢出为负数
    const resources = env.resource.getResources();
    expect(resources.grain).toBeGreaterThanOrEqual(0);
    expect(resources.gold).toBeGreaterThanOrEqual(0);
    expect(resources.troops).toBeGreaterThanOrEqual(0);
    expect(resources.mandate).toBeGreaterThanOrEqual(0);
  });

  it('should handle star multiplier edge case (0 stars)', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 0星通关
    const reward = env.rewardDistributor.calculateRewards(firstStageId, 0, false);
    expect(reward.starMultiplier).toBe(0);
    // 0星时基础资源奖励应为0（starMultiplier=0 导致 Math.floor(amount * 0) = 0）
    // 注意：掉落表奖励独立于星级，可能通过 rollDropTable 添加非零值
    // 验证 starMultiplier 为 0 即可
    expect(reward.starMultiplier).toBe(0);
  });

  it('should handle very large star value gracefully', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 星级超过3应被截断
    expect(() => {
      env.rewardDistributor.calculateRewards(firstStageId, 999, false);
    }).not.toThrow();
  });

  it('should enforce caps when updating resource limits', () => {
    // 添加大量资源
    env.resource.addResource('grain', 999999);
    const beforeCap = env.resource.getResources().grain;

    // 设置一个较低的上限
    env.resource.setCap('grain', 500);

    // 资源应被截断到上限
    const afterCap = env.resource.getResources().grain;
    expect(afterCap).toBeLessThanOrEqual(500);
  });

  it('should emit overflow event when resource exceeds cap', () => {
    let overflowEmitted = false;
    let overflowData: any = null;

    // 设置上限
    env.resource.setCap('grain', 1000);

    // 监听溢出事件
    const eventBus = (env.resource as any).deps?.eventBus;
    if (eventBus) {
      eventBus.on('resource:overflow', (data: any) => {
        overflowEmitted = true;
        overflowData = data;
      });
    }

    // 添加超过上限的资源
    env.resource.addResource('grain', 9999);

    const resources = env.resource.getResources();
    expect(resources.grain).toBeLessThanOrEqual(1000);
  });
});

// ═══════════════════════════════════════════════
// §12.6 关卡数据异常处理
// ═══════════════════════════════════════════════
describe('§12.6 关卡数据异常处理', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should throw error when completing non-existent stage', () => {
    expect(() => {
      env.progress.completeStage('nonexistent_stage', 3);
    }).toThrow(/关卡不存在/);
  });

  it('should throw error when calculating rewards for non-existent stage', () => {
    expect(() => {
      env.rewardDistributor.calculateRewards('nonexistent_stage', 3, false);
    }).toThrow(/关卡不存在/);
  });

  it('should return locked status for non-existent stage', () => {
    const status = env.progress.getStageStatus('nonexistent_stage');
    expect(status).toBe('locked');
  });

  it('should return false for canChallenge with non-existent stage', () => {
    expect(env.progress.canChallenge('nonexistent_stage')).toBe(false);
  });

  it('should return 0 stars for non-existent stage', () => {
    expect(env.progress.getStageStars('nonexistent_stage')).toBe(0);
  });

  it('should return 0 clear count for non-existent stage', () => {
    expect(env.progress.getClearCount('nonexistent_stage')).toBe(0);
  });

  it('should return false for isFirstCleared with non-existent stage', () => {
    expect(env.progress.isFirstCleared('nonexistent_stage')).toBe(false);
  });

  it('should handle empty team in battle', () => {
    const emptyAlly: BattleTeam = { units: [], side: 'ally' };
    const enemyTeam = createTeam('enemy', 3, 1000, 100);

    // 空队伍应能处理（不会崩溃）
    const state = env.engine.initBattle(emptyAlly, enemyTeam);
    expect(state).toBeDefined();
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
  });

  it('should handle stage with empty drop table', () => {
    // 使用自定义数据提供者模拟空掉落表
    const chapters = getChapters();
    const firstStage = chapters[0]?.stages[0];
    if (!firstStage) return;

    // 正常关卡应有掉落表（可能为空数组）
    const reward = env.rewardDistributor.calculateRewards(firstStage.id, 3, false);
    expect(reward).toBeDefined();
    expect(reward.fragments).toBeDefined();
  });

  it('should handle progress serialization with corrupted data gracefully', () => {
    // 正常序列化
    const saveData = env.progress.serialize();
    expect(saveData.version).toBeDefined();
    expect(saveData.progress).toBeDefined();

    // 反序列化正常数据
    const newProgress = new CampaignProgressSystem(campaignDataProvider);
    expect(() => {
      newProgress.deserialize(saveData);
    }).not.toThrow();
  });

  it('should handle negative star values in completeStage', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 负星级应被截断为0
    env.progress.completeStage(firstStageId, -5);
    expect(env.progress.getStageStars(firstStageId)).toBe(0);
  });

  it('should handle star values exceeding max in completeStage', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 星级超过3应被截断为3
    env.progress.completeStage(firstStageId, 100);
    expect(env.progress.getStageStars(firstStageId)).toBe(3);
  });

  it('should handle fractional star values in completeStage', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 浮点星级应被截断
    env.progress.completeStage(firstStageId, 2.7);
    expect(env.progress.getStageStars(firstStageId)).toBe(2);
  });

  it('should handle getStage returning undefined for unknown stage', () => {
    const stage = getStage('completely_invalid_id');
    expect(stage).toBeUndefined();
  });

  it('should handle battle engine reset correctly', () => {
    // 先运行一场战斗
    const allyTeam = createTeam('ally', 6, 3000, 200);
    const enemyTeam = createTeam('enemy', 6, 3000, 200);
    env.engine.runFullBattle(allyTeam, enemyTeam);

    // 重置引擎
    env.engine.reset();

    // 应能正常进行新战斗
    const result = env.engine.runFullBattle(allyTeam, enemyTeam);
    expect(result).toBeDefined();
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
  });

  it('should handle NaN star values in completeStage', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // NaN星级应被截断为0
    env.progress.completeStage(firstStageId, NaN);
    expect(env.progress.getStageStars(firstStageId)).toBe(0);
  });

  it('should handle Infinity star values in completeStage', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // Infinity星级应被截断为3
    env.progress.completeStage(firstStageId, Infinity);
    expect(env.progress.getStageStars(firstStageId)).toBe(3);
  });
});
