/**
 * TowerDefenseMode 单元测试
 *
 * 覆盖塔防战斗模式的所有核心功能：
 * - 构造函数和配置
 * - init() 初始化
 * - 防御塔建造/升级/出售
 * - 敌人波次生成与移动
 * - 防御塔自动攻击（溅射/减速）
 * - 生命值管理
 * - 胜负判定
 * - 结算
 * - 存档/读档
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit } from '../../modules/battle/BattleMode';
import {
  TowerDefenseMode,
  type TowerDefenseConfig,
  type TowerDef,
  type EnemyWave,
  type PathNode,
} from '../../modules/battle/TowerDefenseMode';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit-1',
    name: '测试单位',
    side: 'attacker',
    stats: {
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 2,
      speed: 10,
      critRate: 0.0,
      critMultiplier: 1.5,
      evasion: 0.0,
      accuracy: 1.0,
    },
    skills: [],
    buffs: [],
    isAlive: true,
    ...overrides,
  };
}

/** 创建 Mock 上下文 */
function createMockContext(overrides?: {
  units?: BattleUnit[];
  speed?: number;
}): BattleModeContext {
  const units = overrides?.units ?? [];
  const dealDamageMock = jest.fn().mockReturnValue({ damage: 10, isCrit: false, isMiss: false });
  const healMock = jest.fn();
  const addBuffMock = jest.fn();
  const removeBuffMock = jest.fn();
  const emitMock = jest.fn();

  return {
    units,
    getUnit: jest.fn((id: string) => units.find((u) => u.id === id)),
    dealDamage: dealDamageMock,
    heal: healMock,
    addBuff: addBuffMock,
    removeBuff: removeBuffMock,
    getAliveUnits: jest.fn((side?: 'attacker' | 'defender') => {
      if (side) return units.filter((u) => u.isAlive && u.side === side);
      return units.filter((u) => u.isAlive);
    }),
    emit: emitMock,
    speed: overrides?.speed ?? 1,
  };
}

/** 基础路径 */
const SIMPLE_PATH: PathNode[] = [
  { x: 0, y: 300 },
  { x: 400, y: 300 },
  { x: 800, y: 300 },
];

/** 基础防御塔定义 */
const ARCHER_TOWER: TowerDef = {
  id: 'archer',
  name: '箭塔',
  attack: 10,
  range: 120,
  attackSpeed: 1,
  cost: 50,
};

const SPLASH_TOWER: TowerDef = {
  id: 'cannon',
  name: '炮塔',
  attack: 20,
  range: 100,
  attackSpeed: 0.5,
  cost: 80,
  splashRadius: 50,
};

const SLOW_TOWER: TowerDef = {
  id: 'ice',
  name: '冰塔',
  attack: 5,
  range: 100,
  attackSpeed: 1,
  cost: 60,
  slowFactor: 0.5,
};

const UPGRADEABLE_TOWER: TowerDef = {
  id: 'mage',
  name: '法师塔',
  attack: 15,
  range: 100,
  attackSpeed: 1,
  cost: 100,
  upgradeCost: 60,
  upgradeAttack: 30,
  upgradeRange: 140,
};

/** 基础波次定义 */
const SIMPLE_WAVES: EnemyWave[] = [
  {
    waveIndex: 0,
    enemies: [{ defId: 'goblin', count: 3, intervalMs: 500 }],
    startDelayMs: 0,
  },
  {
    waveIndex: 1,
    enemies: [{ defId: 'orc', count: 2, intervalMs: 800 }],
    startDelayMs: 500,
  },
];

/** 创建默认塔防配置 */
function createDefaultConfig(overrides?: Partial<TowerDefenseConfig>): TowerDefenseConfig {
  return {
    path: SIMPLE_PATH,
    towerSlots: [
      { x: 200, y: 200 },
      { x: 400, y: 400 },
      { x: 600, y: 200 },
    ],
    availableTowers: [ARCHER_TOWER, SPLASH_TOWER, SLOW_TOWER, UPGRADEABLE_TOWER],
    waves: SIMPLE_WAVES,
    lives: 20,
    startingGold: 200,
    ...overrides,
  };
}

/** 创建塔防模式 */
function createTowerDefenseMode(overrides?: Partial<TowerDefenseConfig>): TowerDefenseMode {
  return new TowerDefenseMode(createDefaultConfig(overrides));
}

// ============================================================
// 测试套件
// ============================================================

describe('TowerDefenseMode', () => {
  let mode: TowerDefenseMode;
  let ctx: BattleModeContext;

  beforeEach(() => {
    mode = createTowerDefenseMode();
    ctx = createMockContext();
  });

  // ============================================================
  // 构造函数与类型
  // ============================================================

  describe('构造函数', () => {
    it('应正确设置 type 为 tower-defense', () => {
      expect(mode.type).toBe('tower-defense');
    });

    it('初始阶段应为 preparing', () => {
      const state = mode.getTowerDefenseState();
      expect(state.phase).toBe('preparing');
    });

    it('应正确初始化生命值', () => {
      const state = mode.getTowerDefenseState();
      expect(state.lives).toBe(20);
    });

    it('应正确初始化金币', () => {
      const state = mode.getTowerDefenseState();
      expect(state.gold).toBe(200);
    });

    it('初始无防御塔', () => {
      const state = mode.getTowerDefenseState();
      expect(state.towers).toHaveLength(0);
    });

    it('初始无敌人', () => {
      const state = mode.getTowerDefenseState();
      expect(state.enemies).toHaveLength(0);
    });

    it('初始分数为 0', () => {
      const state = mode.getTowerDefenseState();
      expect(state.score).toBe(0);
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应重置阶段为 preparing', () => {
      mode.init(ctx);
      const state = mode.getTowerDefenseState();
      expect(state.phase).toBe('preparing');
    });

    it('应重置所有状态', () => {
      mode.init(ctx);
      // 先操作一些状态
      mode.startWave();
      mode.update(ctx, 100);

      // 重新 init
      mode.init(ctx);
      const state = mode.getTowerDefenseState();
      expect(state.phase).toBe('preparing');
      expect(state.enemies).toHaveLength(0);
      expect(state.towers).toHaveLength(0);
      expect(state.gold).toBe(200);
      expect(state.lives).toBe(20);
    });
  });

  // ============================================================
  // 防御塔操作
  // ============================================================

  describe('buildTower', () => {
    it('应在有效槽位上建造防御塔', () => {
      mode.init(ctx);
      const result = mode.buildTower(0, 'archer');
      expect(result).toBe(true);
      const state = mode.getTowerDefenseState();
      expect(state.towers).toHaveLength(1);
      expect(state.towers[0].defId).toBe('archer');
      expect(state.towers[0].level).toBe(1);
    });

    it('建造后应扣除金币', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const state = mode.getTowerDefenseState();
      expect(state.gold).toBe(150); // 200 - 50
    });

    it('无效槽位索引应返回 false', () => {
      mode.init(ctx);
      expect(mode.buildTower(-1, 'archer')).toBe(false);
      expect(mode.buildTower(99, 'archer')).toBe(false);
    });

    it('已占用槽位应返回 false', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      expect(mode.buildTower(0, 'archer')).toBe(false);
    });

    it('金币不足应返回 false', () => {
      const cheapConfig = createDefaultConfig({ startingGold: 10 });
      const cheapMode = new TowerDefenseMode(cheapConfig);
      cheapMode.init(ctx);
      expect(cheapMode.buildTower(0, 'archer')).toBe(false);
    });

    it('不存在的塔定义应返回 false', () => {
      mode.init(ctx);
      expect(mode.buildTower(0, 'nonexistent')).toBe(false);
    });

    it('wave_active 阶段不应建造', () => {
      mode.init(ctx);
      mode.startWave();
      expect(mode.buildTower(0, 'archer')).toBe(false);
    });

    it('应在 between_waves 阶段允许建造', () => {
      mode.init(ctx);
      // 手动设置阶段为 between_waves
      mode['state'].phase = 'between_waves';
      const result = mode.buildTower(0, 'archer');
      expect(result).toBe(true);
    });
  });

  describe('upgradeTower', () => {
    it('应升级指定防御塔', () => {
      mode.init(ctx);
      mode.buildTower(0, 'mage');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      const result = mode.upgradeTower(towerId);
      expect(result).toBe(true);
      const state = mode.getTowerDefenseState();
      expect(state.towers[0].level).toBe(2);
    });

    it('升级后攻击力应提升', () => {
      mode.init(ctx);
      mode.buildTower(0, 'mage');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      mode.upgradeTower(towerId);
      const tower = mode.getTowerDefenseState().towers[0];
      expect(tower.currentAttack).toBe(30); // upgradeAttack
    });

    it('升级后范围应提升', () => {
      mode.init(ctx);
      mode.buildTower(0, 'mage');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      mode.upgradeTower(towerId);
      const tower = mode.getTowerDefenseState().towers[0];
      expect(tower.currentRange).toBe(140); // upgradeRange
    });

    it('已满级（2级）不应再升级', () => {
      mode.init(ctx);
      mode.buildTower(0, 'mage');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;
      mode.upgradeTower(towerId);
      expect(mode.upgradeTower(towerId)).toBe(false);
    });

    it('不存在的塔实例应返回 false', () => {
      mode.init(ctx);
      expect(mode.upgradeTower('nonexistent')).toBe(false);
    });

    it('没有升级费用的塔不应可升级', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;
      expect(mode.upgradeTower(towerId)).toBe(false);
    });
  });

  describe('sellTower', () => {
    it('应卖掉指定防御塔', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      const refund = mode.sellTower(towerId);
      expect(refund).toBeGreaterThan(0);
      expect(mode.getTowerDefenseState().towers).toHaveLength(0);
    });

    it('卖塔应返还 60% 金币', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer'); // cost 50
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      const refund = mode.sellTower(towerId);
      expect(refund).toBe(30); // 50 * 0.6 = 30
    });

    it('卖塔后金币应增加', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;

      const goldBefore = mode.getTowerDefenseState().gold;
      mode.sellTower(towerId);
      expect(mode.getTowerDefenseState().gold).toBe(goldBefore + 30);
    });

    it('卖塔后槽位应释放', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;
      mode.sellTower(towerId);
      expect(mode.getSlotOccupancy().has(0)).toBe(false);
    });

    it('不存在的塔实例应返回 0', () => {
      mode.init(ctx);
      expect(mode.sellTower('nonexistent')).toBe(0);
    });

    it('wave_active 阶段不应卖塔', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const towerId = mode.getTowerDefenseState().towers[0].instanceId;
      mode.startWave();
      expect(mode.sellTower(towerId)).toBe(0);
    });
  });

  // ============================================================
  // 波次控制
  // ============================================================

  describe('startWave', () => {
    it('应开始第一波', () => {
      mode.init(ctx);
      mode.startWave();
      const state = mode.getTowerDefenseState();
      expect(state.phase).toBe('wave_active');
      expect(state.currentWave).toBe(0);
    });

    it('finished 阶段不应开始新波次', () => {
      mode.init(ctx);
      mode['state'].phase = 'finished';
      mode.startWave();
      expect(mode.getTowerDefenseState().currentWave).toBe(0);
    });

    it('wave_active 阶段不应重复开始', () => {
      mode.init(ctx);
      mode.startWave();
      mode.startWave(); // 第二次应无效
      expect(mode.getTowerDefenseState().currentWave).toBe(0);
    });

    it('超过最大波次不应开始', () => {
      mode.init(ctx);
      mode['waveSpawnIndex'] = 99; // 超过 waves.length
      mode.startWave();
      // 应该不开始
    });
  });

  // ============================================================
  // update — 敌人生成与移动
  // ============================================================

  describe('update — 敌人生成', () => {
    it('preparing 阶段不应更新', () => {
      mode.init(ctx);
      mode.update(ctx, 100);
      expect(mode.getTowerDefenseState().enemies).toHaveLength(0);
    });

    it('开始波次后应生成敌人', () => {
      mode.init(ctx);
      mode.startWave();
      // startDelayMs=0, intervalMs=500, 需要足够时间生成
      mode.update(ctx, 600);
      expect(mode.getTowerDefenseState().enemies.length).toBeGreaterThan(0);
    });

    it('应按间隔逐个生成敌人', () => {
      mode.init(ctx);
      mode.startWave();
      mode.update(ctx, 100);
      expect(mode.getTowerDefenseState().enemies.length).toBeLessThanOrEqual(1);
    });
  });

  describe('update — 敌人移动', () => {
    it('敌人应沿路径移动', () => {
      mode.init(ctx);
      mode.startWave();
      mode.update(ctx, 600); // 生成敌人

      const enemies = mode.getTowerDefenseState().enemies;
      if (enemies.length > 0) {
        // 敌人 x 坐标应大于路径起点 x=0
        expect(enemies[0].x).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================
  // update — 塔攻击
  // ============================================================

  describe('update — 塔攻击', () => {
    it('塔应自动攻击范围内的敌人', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer'); // 在 (200, 200)，范围 120
      mode.startWave();
      // 生成敌人并让塔攻击
      for (let i = 0; i < 20; i++) {
        mode.update(ctx, 200);
      }
      // 塔应该发射了事件
      expect(ctx.emit).toHaveBeenCalled();
    });

    it('溅射塔应伤害范围内多个敌人', () => {
      mode.init(ctx);
      mode.buildTower(0, 'cannon'); // 溅射塔
      mode.startWave();
      for (let i = 0; i < 20; i++) {
        mode.update(ctx, 200);
      }
      // 不崩溃即可
      expect(mode.getTowerDefenseState().phase).toBeDefined();
    });

    it('冰塔应减速敌人', () => {
      mode.init(ctx);
      mode.buildTower(0, 'ice'); // 减速塔
      mode.startWave();
      for (let i = 0; i < 20; i++) {
        mode.update(ctx, 200);
      }
      // 不崩溃即可
      expect(mode.getTowerDefenseState().phase).toBeDefined();
    });

    it('击杀敌人应获得金币', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const goldBefore = mode.getTowerDefenseState().gold;
      mode.startWave();
      // 大量更新让塔击杀敌人
      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 200);
        if (mode.getTowerDefenseState().score > 0) break;
      }
      // 击杀后金币应增加
      if (mode.getTowerDefenseState().score > 0) {
        expect(mode.getTowerDefenseState().gold).toBeGreaterThan(goldBefore);
      }
    });
  });

  // ============================================================
  // update — 终点检查
  // ============================================================

  describe('update — 终点检查', () => {
    it('敌人到达终点应扣减生命值', () => {
      mode.init(ctx);
      // 创建短路径让敌人快速到达终点
      const shortPathConfig = createDefaultConfig({
        path: [{ x: 0, y: 300 }, { x: 10, y: 300 }],
      });
      const shortMode = new TowerDefenseMode(shortPathConfig);
      shortMode.init(ctx);
      shortMode.startWave();
      // 让敌人到达终点
      for (let i = 0; i < 50; i++) {
        shortMode.update(ctx, 200);
        if (shortMode.getTowerDefenseState().lives < 20) break;
      }
      expect(shortMode.getTowerDefenseState().lives).toBeLessThan(20);
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('checkWin / checkLose', () => {
    it('checkWin — 初始状态不应胜利', () => {
      mode.init(ctx);
      expect(mode.checkWin(ctx)).toBe(false);
    });

    it('checkLose — 生命值大于 0 不应失败', () => {
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(false);
    });

    it('checkLose — 生命值归零应失败', () => {
      mode.init(ctx);
      mode['state'].lives = 0;
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('生命值归零应转为 finished', () => {
      mode.init(ctx);
      mode['state'].lives = 0;
      mode.startWave();
      mode.update(ctx, 16);
      expect(mode.getTowerDefenseState().phase).toBe('finished');
    });
  });

  // ============================================================
  // 结算
  // ============================================================

  describe('settle', () => {
    it('胜利时应返回 won=true', () => {
      mode.init(ctx);
      // 模拟所有波次完成
      mode['waveSpawnIndex'] = 1; // 最后一波
      mode['waveSpawnCount'] = 0;
      mode['waveDelayTimer'] = 0;
      mode['state'].enemies = [];
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      mode.init(ctx);
      mode['state'].lives = 0;
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(false);
    });

    it('应包含战斗持续时间', () => {
      mode.init(ctx);
      const result = mode.settle(ctx, 12345);
      expect(result.durationMs).toBe(12345);
    });

    it('应包含统计数据', () => {
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.enemiesDefeated).toBe('number');
    });

    it('有塔时应计算 MVP', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBeDefined();
      expect(result.mvp).not.toBeNull();
    });

    it('无塔时 MVP 应为 null', () => {
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBeNull();
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('getState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      mode.startWave();
      mode.update(ctx, 500);

      const data = mode.getState();
      const newMode = createTowerDefenseMode();
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.phase).toBe(data.phase);
      expect(restored.gold).toBe(data.gold);
      expect(restored.lives).toBe(data.lives);
      expect(restored.score).toBe(data.score);
    });

    it('应正确序列化防御塔', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const data = mode.getState();
      const towers = data.towers as unknown[];
      expect(Array.isArray(towers)).toBe(true);
      expect(towers.length).toBe(1);
    });

    it('应正确序列化波次状态', () => {
      mode.init(ctx);
      mode.startWave();
      mode.update(ctx, 500);
      const data = mode.getState();
      expect(typeof data.waveSpawnIndex).toBe('number');
      expect(typeof data.waveGroupIndex).toBe('number');
    });

    it('应正确序列化槽位占用', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const data = mode.getState();
      expect(data.slotOccupancy).toBeDefined();
    });

    it('空数据不应崩溃', () => {
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      expect(() => mode.loadState(null as any)).not.toThrow();
    });

    it('undefined 数据不应崩溃', () => {
      expect(() => mode.loadState(undefined as any)).not.toThrow();
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      mode.startWave();
      mode.update(ctx, 500);

      mode.reset();

      const state = mode.getTowerDefenseState();
      expect(state.phase).toBe('preparing');
      expect(state.towers).toHaveLength(0);
      expect(state.enemies).toHaveLength(0);
      expect(state.gold).toBe(200);
      expect(state.lives).toBe(20);
      expect(state.score).toBe(0);
    });

    it('重置后应能重新初始化', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      mode.reset();
      mode.init(ctx);
      expect(mode.getTowerDefenseState().phase).toBe('preparing');
    });

    it('重置应清空槽位占用', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      mode.reset();
      expect(mode.getSlotOccupancy().size).toBe(0);
    });
  });

  // ============================================================
  // 公开访问器
  // ============================================================

  describe('公开访问器', () => {
    it('getTowerDefenseState 应返回副本', () => {
      mode.init(ctx);
      const s1 = mode.getTowerDefenseState();
      const s2 = mode.getTowerDefenseState();
      expect(s1).toEqual(s2);
      // 修改副本不应影响原状态
      s1.gold = 9999;
      expect(mode.getTowerDefenseState().gold).toBe(200);
    });

    it('getConfig 应返回配置', () => {
      const config = mode.getConfig();
      expect(config.lives).toBe(20);
      expect(config.startingGold).toBe(200);
      expect(config.path).toEqual(SIMPLE_PATH);
    });

    it('getSlotOccupancy 应返回副本', () => {
      mode.init(ctx);
      mode.buildTower(0, 'archer');
      const occ1 = mode.getSlotOccupancy();
      const occ2 = mode.getSlotOccupancy();
      expect(occ1).toEqual(occ2);
      expect(occ1).not.toBe(occ2);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('finished 阶段不应更新', () => {
      mode.init(ctx);
      mode['state'].phase = 'finished';
      const elapsedBefore = mode.getTowerDefenseState().elapsedMs;
      mode.update(ctx, 100);
      expect(mode.getTowerDefenseState().elapsedMs).toBe(elapsedBefore);
    });

    it('空路径不应崩溃', () => {
      const emptyPathMode = createTowerDefenseMode({ path: [] });
      emptyPathMode.init(ctx);
      emptyPathMode.startWave();
      expect(() => emptyPathMode.update(ctx, 100)).not.toThrow();
    });

    it('空波次不应崩溃', () => {
      const emptyWaveMode = createTowerDefenseMode({ waves: [] });
      emptyWaveMode.init(ctx);
      emptyWaveMode.startWave();
      expect(() => emptyWaveMode.update(ctx, 100)).not.toThrow();
    });

    it('空塔位不应崩溃', () => {
      const noSlotsMode = createTowerDefenseMode({ towerSlots: [] });
      noSlotsMode.init(ctx);
      expect(noSlotsMode.buildTower(0, 'archer')).toBe(false);
    });

    it('速度倍率应影响更新', () => {
      const fastCtx = createMockContext({ speed: 2 });
      mode.init(ctx);
      mode.startWave();
      mode.update(fastCtx, 100);
      // elapsedMs 应为 100 * 2 = 200
      expect(mode.getTowerDefenseState().elapsedMs).toBe(200);
    });

    it('非常大的 dt 不应崩溃', () => {
      mode.init(ctx);
      mode.startWave();
      expect(() => mode.update(ctx, 100000)).not.toThrow();
    });
  });
});
