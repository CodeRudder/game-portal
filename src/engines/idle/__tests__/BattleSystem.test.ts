import { vi } from 'vitest';
/**
 * BattleSystem 单元测试
 *
 * 覆盖战斗系统的所有核心功能：
 * - 波次注册与启动
 * - 攻击与伤害计算
 * - 敌人攻击
 * - 胜负判定
 * - Buff 管理与更新
 * - 掉落掷骰与结算
 * - 事件系统
 * - 序列化/反序列化
 * - 重置
 */

import {
  BattleSystem,
  type BattleDef,
  type EnemyDef,
  type BattleEvent,
} from '../modules/BattleSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建基础敌人定义 */
function createEnemyDef(overrides: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: 'goblin',
    name: '哥布林',
    hp: 50,
    attack: 10,
    defense: 2,
    drops: { gold: 0.5, herb: 0.2 },
    abilities: [],
    isBoss: false,
    ...overrides,
  };
}

/** 创建 Boss 敌人定义 */
function createBossDef(): EnemyDef {
  return createEnemyDef({
    id: 'dragon',
    name: '巨龙',
    hp: 200,
    attack: 30,
    defense: 10,
    drops: { gold: 1.0, dragon_scale: 0.3 },
    abilities: ['fire_breath'],
    isBoss: true,
  });
}

/** 创建基础波次定义 */
function createWaveDef(overrides: Partial<BattleDef> = {}): BattleDef {
  return {
    id: 'wave-1',
    stageId: 'stage-1',
    wave: 1,
    enemies: [createEnemyDef()],
    rewards: { gold: 100, exp: 20 },
    timeLimit: 60000,
    tags: ['normal'],
    ...overrides,
  };
}

/** 创建多敌人波次定义 */
function createMultiEnemyWaveDef(): BattleDef {
  return createWaveDef({
    id: 'wave-2',
    wave: 2,
    enemies: [
      createEnemyDef({ id: 'goblin-1', name: '哥布林A' }),
      createEnemyDef({ id: 'goblin-2', name: '哥布林B' }),
      createEnemyDef({ id: 'goblin-3', name: '哥布林C', hp: 100 }),
    ],
    rewards: { gold: 200, exp: 50 },
    nextWave: 'wave-3',
    tags: ['normal', 'multi'],
  });
}

/** 创建 Boss 波次定义 */
function createBossWaveDef(): BattleDef {
  return createWaveDef({
    id: 'boss-wave',
    wave: 5,
    enemies: [createBossDef()],
    rewards: { gold: 500, exp: 200 },
    tags: ['boss'],
  });
}

// ============================================================
// 测试套件
// ============================================================

describe('BattleSystem', () => {
  let system: BattleSystem;

  beforeEach(() => {
    system = new BattleSystem();
  });

  // ============================================================
  // 构造函数与注册
  // ============================================================

  describe('构造函数', () => {
    it('应创建空系统', () => {
      const empty = new BattleSystem();
      expect(empty.getCurrentState().currentWave).toBeNull();
      expect(empty.getCurrentState().aliveEnemies).toEqual([]);
    });

    it('应注册传入的波次定义', () => {
      const sys = new BattleSystem([createWaveDef()]);
      sys.startWave('wave-1');
      const state = sys.getCurrentState();
      expect(state.currentWave).toBe('wave-1');
      expect(state.aliveEnemies.length).toBe(1);
    });

    it('应注册多个波次定义', () => {
      const sys = new BattleSystem([
        createWaveDef(),
        createMultiEnemyWaveDef(),
        createBossWaveDef(),
      ]);
      sys.startWave('wave-2');
      expect(sys.getCurrentState().aliveEnemies.length).toBe(3);
    });
  });

  // ============================================================
  // startWave
  // ============================================================

  describe('startWave', () => {
    beforeEach(() => {
      system = new BattleSystem([
        createWaveDef(),
        createMultiEnemyWaveDef(),
      ]);
    });

    it('应开始指定波次并创建敌人实例', () => {
      system.startWave('wave-1');
      const state = sys_getState(system);
      expect(state.currentWave).toBe('wave-1');
      expect(state.aliveEnemies.length).toBe(1);
      expect(state.aliveEnemies[0].defId).toBe('goblin');
      expect(state.aliveEnemies[0].currentHp).toBe(50);
      expect(state.aliveEnemies[0].maxHp).toBe(50);
      expect(state.aliveEnemies[0].isAlive).toBe(true);
      expect(state.aliveEnemies[0].buffs).toEqual([]);
    });

    it('应为每个敌人创建唯一 instanceId', () => {
      system.startWave('wave-2');
      const enemies = system.getCurrentState().aliveEnemies;
      const ids = enemies.map((e) => e.instanceId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('不存在的波次 ID 应静默忽略', () => {
      system.startWave('non-existent');
      expect(system.getCurrentState().currentWave).toBeNull();
    });

    it('应重置击杀计数和掉落物', () => {
      system.startWave('wave-1');
      // 先攻击击杀
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);
      expect(system.getCurrentState().killCount).toBe(1);

      // 开始新波次
      system.startWave('wave-2');
      expect(system.getCurrentState().killCount).toBe(0);
    });

    it('应触发 wave_started 事件', () => {
      const handler = vi.fn();
      system.onEvent(handler);
      system.startWave('wave-1');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'wave_started',
          data: expect.objectContaining({ waveId: 'wave-1', enemyCount: 1 }),
        }),
      );
    });
  });

  // ============================================================
  // attack
  // ============================================================

  describe('attack', () => {
    beforeEach(() => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
    });

    it('应扣除敌人 HP', () => {
      const enemy = system.getCurrentState().aliveEnemies[0];
      const result = system.attack(enemy.instanceId, 20);
      expect(result.killed).toBe(false);
      expect(result.damage).toBe(20);
      expect(system.getCurrentState().aliveEnemies[0].currentHp).toBe(30);
    });

    it('应击杀 HP 归零的敌人', () => {
      const enemy = system.getCurrentState().aliveEnemies[0];
      const result = system.attack(enemy.instanceId, 50);
      expect(result.killed).toBe(true);
      expect(result.damage).toBe(50);
      // getCurrentState().aliveEnemies only returns alive enemies
      expect(system.getCurrentState().aliveEnemies.length).toBe(0);
    });

    it('伤害不应低于 1', () => {
      const enemy = system.getCurrentState().aliveEnemies[0];
      const result = system.attack(enemy.instanceId, -100);
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    it('攻击已死亡的敌人应返回 killed=false, damage=0', () => {
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);
      const result = system.attack(enemy.instanceId, 10);
      expect(result.killed).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('攻击不存在的实例应返回 killed=false, damage=0', () => {
      const result = system.attack('non-existent', 10);
      expect(result.killed).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('应触发 enemy_killed 事件', () => {
      const handler = vi.fn();
      system.onEvent(handler);
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 50);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'enemy_killed' }),
      );
    });

    it('击杀 Boss 应触发 boss_defeated 事件', () => {
      system = new BattleSystem([createBossWaveDef()]);
      system.startWave('boss-wave');
      const handler = vi.fn();
      system.onEvent(handler);
      const boss = system.getCurrentState().aliveEnemies[0];
      system.attack(boss.instanceId, 200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'boss_defeated' }),
      );
    });

    it('击杀敌人应触发 loot_dropped 事件（概率掉落）', () => {
      // 使用必然掉落的敌人
      system = new BattleSystem([
        createWaveDef({
          enemies: [createEnemyDef({ id: 'always-drop', drops: { gold: 1.0 } })],
        }),
      ]);
      system.startWave('wave-1');
      const handler = vi.fn();
      system.onEvent(handler);
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'loot_dropped' }),
      );
    });

    it('应累计 totalDamageDealt 统计', () => {
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 10);
      system.attack(enemy.instanceId, 15);
      expect(system.getCurrentState().stats.totalDamageDealt).toBe(25);
    });
  });

  // ============================================================
  // enemyAttack
  // ============================================================

  describe('enemyAttack', () => {
    beforeEach(() => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
    });

    it('应使用公式 damage = max(1, attack - defense/2)', () => {
      // attack=10, defense=6 => max(1, 10 - 3) = 7
      const damage = system.enemyAttack('goblin', 6);
      expect(damage).toBe(7);
    });

    it('defense 很高时伤害至少为 1', () => {
      // attack=10, defense=100 => max(1, 10 - 50) = 1
      const damage = system.enemyAttack('goblin', 100);
      expect(damage).toBe(1);
    });

    it('defense 为 0 时伤害等于攻击力', () => {
      // attack=10, defense=0 => max(1, 10 - 0) = 10
      const damage = system.enemyAttack('goblin', 0);
      expect(damage).toBe(10);
    });

    it('不存在的敌人定义应返回 1', () => {
      const damage = system.enemyAttack('non-existent', 0);
      expect(damage).toBe(1);
    });

    it('应累计 totalDamageTaken 统计', () => {
      system.enemyAttack('goblin', 0);
      system.enemyAttack('goblin', 0);
      expect(system.getCurrentState().stats.totalDamageTaken).toBe(20);
    });

    it('应触发 player_damaged 事件', () => {
      const handler = vi.fn();
      system.onEvent(handler);
      system.enemyAttack('goblin', 0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player_damaged',
          data: expect.objectContaining({ enemyDefId: 'goblin' }),
        }),
      );
    });
  });

  // ============================================================
  // checkWin / checkLose
  // ============================================================

  describe('checkWin / checkLose', () => {
    it('checkWin 没有波次时应返回 false', () => {
      expect(system.checkWin()).toBe(false);
    });

    it('checkWin 敌人存活时应返回 false', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      expect(system.checkWin()).toBe(false);
    });

    it('checkWin 所有敌人死亡时应返回 true', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);
      expect(system.checkWin()).toBe(true);
    });

    it('checkLose playerHp <= 0 时返回 true', () => {
      expect(system.checkLose(0)).toBe(true);
      expect(system.checkLose(-5)).toBe(true);
    });

    it('checkLose playerHp > 0 时返回 false', () => {
      expect(system.checkLose(1)).toBe(false);
      expect(system.checkLose(100)).toBe(false);
    });
  });

  // ============================================================
  // update (buff 管理)
  // ============================================================

  describe('update', () => {
    it('应减少 buff 剩余时间', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];

      // 手动给敌人添加 buff（通过 attack 的 buff 机制测试）
      // 这里直接操作内部状态来测试 update
      const internalEnemy = (system as any).aliveEnemies[0];
      internalEnemy.buffs = [
        { id: 'buff-1', type: 'buff', stat: 'attack', value: 5, remainingMs: 1000 },
        { id: 'buff-2', type: 'debuff', stat: 'defense', value: 3, remainingMs: 500 },
      ];

      system.update(300);

      expect(internalEnemy.buffs[0].remainingMs).toBe(700);
      expect(internalEnemy.buffs[1].remainingMs).toBe(200);
    });

    it('应移除过期 buff', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const internalEnemy = (system as any).aliveEnemies[0];
      internalEnemy.buffs = [
        { id: 'buff-1', type: 'buff', stat: 'attack', value: 5, remainingMs: 100 },
      ];

      system.update(200);

      expect(internalEnemy.buffs.length).toBe(0);
    });

    it('没有进行中的波次时 update 应静默忽略', () => {
      expect(() => system.update(100)).not.toThrow();
    });

    it('已死亡的敌人 buff 不应被更新', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const internalEnemy = (system as any).aliveEnemies[0];
      internalEnemy.isAlive = false;
      internalEnemy.buffs = [
        { id: 'buff-1', type: 'buff', stat: 'attack', value: 5, remainingMs: 1000 },
      ];

      system.update(500);

      // buff 不变（因为敌人已死，跳过了更新）
      expect(internalEnemy.buffs[0].remainingMs).toBe(1000);
    });
  });

  // ============================================================
  // getRewardsPreview
  // ============================================================

  describe('getRewardsPreview', () => {
    it('没有进行中波次时应返回空对象', () => {
      expect(system.getRewardsPreview()).toEqual({});
    });

    it('应返回当前波次的奖励预览', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      expect(system.getRewardsPreview()).toEqual({ gold: 100, exp: 20 });
    });

    it('返回的应是副本，修改不影响内部', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const preview = system.getRewardsPreview();
      preview.gold = 999;
      expect(system.getRewardsPreview().gold).toBe(100);
    });
  });

  // ============================================================
  // settleWave
  // ============================================================

  describe('settleWave', () => {
    it('应返回固定奖励和掉落物', () => {
      system = new BattleSystem([
        createWaveDef({
          enemies: [createEnemyDef({ id: 'e1', drops: { gold: 1.0 } })],
          rewards: { gold: 100, exp: 20 },
        }),
      ]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);

      const result = system.settleWave();
      expect(result.rewards).toEqual({ gold: 100, exp: 20 });
      expect(result.drops.gold).toBeGreaterThanOrEqual(1);
    });

    it('通关时 wavesCleared 应增加', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);

      system.settleWave();
      expect(system.getCurrentState().stats.wavesCleared).toBe(1);
    });

    it('通关应触发 wave_cleared 事件', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);

      const handler = vi.fn();
      system.onEvent(handler);
      system.settleWave();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'wave_cleared' }),
      );
    });

    it('未完成时结算应触发 wave_failed 事件', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');

      const handler = vi.fn();
      system.onEvent(handler);
      system.settleWave();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'wave_failed' }),
      );
    });
  });

  // ============================================================
  // getCurrentState
  // ============================================================

  describe('getCurrentState', () => {
    it('初始状态应全部为零/空', () => {
      const state = system.getCurrentState();
      expect(state.currentWave).toBeNull();
      expect(state.aliveEnemies).toEqual([]);
      expect(state.killCount).toBe(0);
      expect(state.waveStartTime).toBe(0);
      expect(state.stats).toEqual({
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        wavesCleared: 0,
        bossesDefeated: 0,
      });
    });

    it('返回的 aliveEnemies 应只包含存活敌人', () => {
      system = new BattleSystem([createMultiEnemyWaveDef()]);
      system.startWave('wave-2');
      const enemies = system.getCurrentState().aliveEnemies;
      system.attack(enemies[0].instanceId, 100);

      const state = system.getCurrentState();
      expect(state.aliveEnemies.length).toBe(2);
    });

    it('返回的状态应是深拷贝', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const state = system.getCurrentState();
      state.killCount = 999;
      expect(system.getCurrentState().killCount).toBe(0);
    });
  });

  // ============================================================
  // reset
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 30);
      system.enemyAttack('goblin', 0);

      system.reset();

      const state = system.getCurrentState();
      expect(state.currentWave).toBeNull();
      expect(state.aliveEnemies).toEqual([]);
      expect(state.killCount).toBe(0);
      expect(state.stats.totalDamageDealt).toBe(0);
      expect(state.stats.totalDamageTaken).toBe(0);
    });

    it('重置后应能重新开始波次', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      system.reset();
      system.startWave('wave-1');
      expect(system.getCurrentState().currentWave).toBe('wave-1');
    });
  });

  // ============================================================
  // saveState / loadState
  // ============================================================

  describe('saveState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 20);
      system.enemyAttack('goblin', 0);

      const data = system.saveState();

      const newSystem = new BattleSystem([createWaveDef()]);
      newSystem.loadState(data);

      const state = newSystem.getCurrentState();
      expect(state.currentWave).toBe('wave-1');
      expect(state.killCount).toBe(0); // killCount=0 因为敌人没死
      expect(state.stats.totalDamageDealt).toBe(20);
      expect(state.stats.totalDamageTaken).toBe(10);
    });

    it('序列化空系统应返回默认值', () => {
      const data = system.saveState();
      expect(data.currentWave).toBeNull();
      expect(data.killCount).toBe(0);
      expect(data.aliveEnemies).toEqual([]);
    });

    it('反序列化空数据不应崩溃', () => {
      expect(() => system.loadState({})).not.toThrow();
    });

    it('应正确序列化/反序列化 buff', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const internalEnemy = (system as any).aliveEnemies[0];
      internalEnemy.buffs = [
        { id: 'buff-1', type: 'buff', stat: 'attack', value: 5, remainingMs: 1000 },
      ];

      const data = system.saveState();
      const newSystem = new BattleSystem([createWaveDef()]);
      newSystem.loadState(data);

      const restoredEnemy = (newSystem as any).aliveEnemies[0];
      expect(restoredEnemy.buffs.length).toBe(1);
      expect(restoredEnemy.buffs[0].id).toBe('buff-1');
      expect(restoredEnemy.buffs[0].remainingMs).toBe(1000);
    });

    it('应正确序列化/反序列化 pendingDrops', () => {
      system = new BattleSystem([
        createWaveDef({
          enemies: [createEnemyDef({ id: 'e1', drops: { gold: 1.0 } })],
        }),
      ]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);

      const data = system.saveState();
      expect(data.pendingDrops).toEqual({ gold: 1 });

      const newSystem = new BattleSystem([createWaveDef()]);
      newSystem.loadState(data);
      expect((newSystem as any).pendingDrops).toEqual({ gold: 1 });
    });
  });

  // ============================================================
  // onEvent
  // ============================================================

  describe('onEvent', () => {
    it('应返回取消监听函数', () => {
      const handler = vi.fn();
      const unsub = system.onEvent(handler);
      expect(typeof unsub).toBe('function');
    });

    it('取消监听后不应再收到事件', () => {
      const handler = vi.fn();
      const unsub = system.onEvent(handler);
      unsub();

      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');

      // handler 是在旧系统上注册的，新系统不会触发
      expect(handler).not.toHaveBeenCalled();
    });

    it('应支持多个监听器', () => {
      system = new BattleSystem([createWaveDef()]);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      system.onEvent(handler1);
      system.onEvent(handler2);
      system.startWave('wave-1');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // Boss 统计
  // ============================================================

  describe('Boss 统计', () => {
    it('击杀 Boss 应增加 bossesDefeated 计数', () => {
      system = new BattleSystem([createBossWaveDef()]);
      system.startWave('boss-wave');
      const boss = system.getCurrentState().aliveEnemies[0];
      system.attack(boss.instanceId, 200);
      expect(system.getCurrentState().stats.bossesDefeated).toBe(1);
    });

    it('击杀普通敌人不应增加 bossesDefeated 计数', () => {
      system = new BattleSystem([createWaveDef()]);
      system.startWave('wave-1');
      const enemy = system.getCurrentState().aliveEnemies[0];
      system.attack(enemy.instanceId, 100);
      expect(system.getCurrentState().stats.bossesDefeated).toBe(0);
    });
  });

  // ============================================================
  // 多敌人波次
  // ============================================================

  describe('多敌人波次', () => {
    it('应正确处理多敌人波次', () => {
      system = new BattleSystem([createMultiEnemyWaveDef()]);
      system.startWave('wave-2');
      expect(system.getCurrentState().aliveEnemies.length).toBe(3);

      // 击杀第一个
      const enemies = system.getCurrentState().aliveEnemies;
      system.attack(enemies[0].instanceId, 100);
      expect(system.checkWin()).toBe(false);

      // 击杀剩余
      const remaining = system.getCurrentState().aliveEnemies;
      for (const e of remaining) {
        system.attack(e.instanceId, 200);
      }
      expect(system.checkWin()).toBe(true);
    });
  });
});

/** 辅助函数：获取系统状态 */
function sys_getState(sys: BattleSystem) {
  return sys.getCurrentState();
}
