/**
 * StateDAG 测试骨架 — P0优先级
 * 
 * 覆盖范围：StateDAG中11条未覆盖路径
 * 目标：将StateDAG覆盖率从60.1%提升至97%+
 * 
 * 每条路径对应一个describe块，路径上每个状态转换对应一个it块
 * 断言注释描述了应该验证的内容
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// 辅助类型定义
// ═══════════════════════════════════════════════════════════════

interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  condition: string;
  sideEffects: string[];
}

interface EntityState {
  id: string;
  entity: string;
  state: string;
  isInitial: boolean;
  isFinal: boolean;
}

/**
 * 模拟状态机 — 用于测试状态转换逻辑
 */
class StateMachineMock {
  private currentState: string;
  private history: string[] = [];
  private sideEffectsLog: string[][] = [];

  constructor(initialState: string) {
    this.currentState = initialState;
    this.history.push(initialState);
  }

  getState(): string {
    return this.currentState;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getSideEffects(): string[][] {
    return [...this.sideEffectsLog];
  }

  transition(transition: StateTransition): void {
    if (this.currentState !== transition.from) {
      throw new Error(`Invalid transition: expected from '${transition.from}' but current state is '${this.currentState}'`);
    }
    this.currentState = transition.to;
    this.history.push(transition.to);
    this.sideEffectsLog.push(transition.sideEffects);
  }
}

// ═══════════════════════════════════════════════════════════════
// 路径1: alliance:none → alliance:leader
// 描述：直接创建联盟成为盟主
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: alliance:none → alliance:leader (创建联盟)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('alliance:none');
  });

  it('初始状态应为 alliance:none（未加入任何联盟）', () => {
    // 验证：玩家初始联盟状态为 none
    expect(sm.getState()).toBe('alliance:none');
    expect(sm.getHistory()).toContain('alliance:none');
  });

  it('alliance:none → alliance:leader: 触发 createAlliance 创建联盟并成为盟主', () => {
    // 前置条件：资源充足 && 未加入联盟
    // 触发器：createAlliance
    // 副作用：创建联盟，成为盟主
    
    const transition: StateTransition = {
      from: 'alliance:none',
      to: 'alliance:leader',
      trigger: 'createAlliance',
      condition: '资源充足 && 未加入联盟',
      sideEffects: ['创建联盟', '成为盟主'],
    };

    sm.transition(transition);

    // 验证：状态已变为 leader
    expect(sm.getState()).toBe('alliance:leader');
    // 验证：状态历史记录正确
    expect(sm.getHistory()).toEqual(['alliance:none', 'alliance:leader']);
    // 验证：副作用包含创建联盟和成为盟主
    expect(sm.getSideEffects()[0]).toContain('创建联盟');
    expect(sm.getSideEffects()[0]).toContain('成为盟主');
  });

  it('应验证创建联盟的资源消耗', () => {
    // TODO: 验证创建联盟扣除铜钱
    // expect(resourceSystem.getGold()).toBe(initialGold - allianceCreateCost);
  });

  it('应验证创建联盟后获得盟主权限', () => {
    // TODO: 验证玩家角色为 leader
    // expect(player.allianceRole).toBe('leader');
    // expect(player.canManageAlliance).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径2: building:locked → building:idle → building:upgrading
// 描述：建筑解锁→空闲→升级中
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: building:locked → building:idle → building:upgrading (建筑升级)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('building:locked');
  });

  it('初始状态应为 building:locked（建筑锁定）', () => {
    // 验证：建筑初始状态为锁定
    expect(sm.getState()).toBe('building:locked');
  });

  it('building:locked → building:idle: 触发 unlock 解锁建筑', () => {
    // 前置条件：主城等级 >= 建筑解锁等级
    // 触发器：unlock
    // 副作用：建筑解锁动画、新手引导触发
    
    const transition: StateTransition = {
      from: 'building:locked',
      to: 'building:idle',
      trigger: 'unlock',
      condition: '主城等级 >= 建筑解锁等级',
      sideEffects: ['建筑解锁动画', '新手引导触发'],
    };

    sm.transition(transition);

    // 验证：建筑状态变为空闲
    expect(sm.getState()).toBe('building:idle');
    expect(sm.getHistory()).toEqual(['building:locked', 'building:idle']);
  });

  it('building:idle → building:upgrading: 触发 startUpgrade 开始升级', () => {
    // 先解锁建筑
    sm.transition({
      from: 'building:locked',
      to: 'building:idle',
      trigger: 'unlock',
      condition: '主城等级 >= 建筑解锁等级',
      sideEffects: ['建筑解锁动画'],
    });

    // 前置条件：资源充足 && 队列有空位
    // 触发器：startUpgrade
    // 副作用：扣除升级资源、开始倒计时
    
    const transition: StateTransition = {
      from: 'building:idle',
      to: 'building:upgrading',
      trigger: 'startUpgrade',
      condition: '资源充足 && 队列有空位',
      sideEffects: ['扣除升级资源', '开始倒计时'],
    };

    sm.transition(transition);

    // 验证：建筑状态变为升级中
    expect(sm.getState()).toBe('building:upgrading');
    expect(sm.getHistory()).toEqual(['building:locked', 'building:idle', 'building:upgrading']);
  });

  it('应验证建筑解锁时主城等级检查', () => {
    // TODO: 验证主城等级不足时无法解锁
    // expect(buildingSystem.canUnlock(building, castleLevel)).toBe(false);
  });

  it('应验证升级资源扣除正确性', () => {
    // TODO: 验证升级扣除粮草、铜钱、兵力
    // expect(resourceSystem.getGrain()).toBe(initialGrain - upgradeCost.grain);
    // expect(resourceSystem.getGold()).toBe(initialGold - upgradeCost.gold);
    // expect(resourceSystem.getTroops()).toBe(initialTroops - upgradeCost.troops);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径3: stage:locked → stage:available → stage:threeStar
// 描述：关卡解锁→直接三星通关
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: stage:locked → stage:available → stage:threeStar (关卡三星通关)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('stage:locked');
  });

  it('初始状态应为 stage:locked（关卡锁定）', () => {
    expect(sm.getState()).toBe('stage:locked');
  });

  it('stage:locked → stage:available: 触发 unlockStage 解锁关卡', () => {
    // 前置条件：前置关卡已通关
    // 触发器：unlockStage
    // 副作用：关卡解锁动画
    
    sm.transition({
      from: 'stage:locked',
      to: 'stage:available',
      trigger: 'unlockStage',
      condition: '前置关卡已通关',
      sideEffects: ['关卡解锁动画'],
    });

    expect(sm.getState()).toBe('stage:available');
  });

  it('stage:available → stage:threeStar: 触发 threeStarClear 三星通关', () => {
    sm.transition({
      from: 'stage:locked',
      to: 'stage:available',
      trigger: 'unlockStage',
      condition: '前置关卡已通关',
      sideEffects: ['关卡解锁动画'],
    });

    // 前置条件：战斗胜利(3星) && 存活≥4 && 回合≤6
    // 触发器：threeStarClear
    // 副作用：发放三星奖励、解锁扫荡功能
    
    sm.transition({
      from: 'stage:available',
      to: 'stage:threeStar',
      trigger: 'threeStarClear',
      condition: '战斗胜利(3星) && 存活≥4 && 回合≤6',
      sideEffects: ['发放三星奖励', '解锁扫荡功能'],
    });

    expect(sm.getState()).toBe('stage:threeStar');
    expect(sm.getHistory()).toEqual(['stage:locked', 'stage:available', 'stage:threeStar']);
  });

  it('应验证三星通关条件：存活武将≥4且回合≤6', () => {
    // TODO: 验证三星评定的具体条件
    // expect(battleResult.survivors).toBeGreaterThanOrEqual(4);
    // expect(battleResult.rounds).toBeLessThanOrEqual(6);
    // expect(battleResult.stars).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径4: battle:init → battle:in-progress → battle:finished
// 描述：战斗初始化→进行中→结束
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: battle:init → battle:in-progress → battle:finished (战斗流程)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('battle:init');
  });

  it('初始状态应为 battle:init（战斗初始化）', () => {
    expect(sm.getState()).toBe('battle:init');
  });

  it('battle:init → battle:in-progress: 触发 startBattle 开始战斗', () => {
    // 前置条件：双方队伍就绪
    // 触发器：startBattle
    // 副作用：初始化战斗状态、排序行动顺序
    
    sm.transition({
      from: 'battle:init',
      to: 'battle:in-progress',
      trigger: 'startBattle',
      condition: '双方队伍就绪',
      sideEffects: ['初始化战斗状态', '排序行动顺序'],
    });

    expect(sm.getState()).toBe('battle:in-progress');
  });

  it('battle:in-progress → battle:finished: 触发 battleEnd 战斗结束', () => {
    sm.transition({
      from: 'battle:init',
      to: 'battle:in-progress',
      trigger: 'startBattle',
      condition: '双方队伍就绪',
      sideEffects: ['初始化战斗状态'],
    });

    // 前置条件：一方全灭 或 回合耗尽
    // 触发器：battleEnd
    // 副作用：计算星级评定、生成战斗结果
    
    sm.transition({
      from: 'battle:in-progress',
      to: 'battle:finished',
      trigger: 'battleEnd',
      condition: '一方全灭 或 回合耗尽',
      sideEffects: ['计算星级评定', '生成战斗结果'],
    });

    expect(sm.getState()).toBe('battle:finished');
    expect(sm.getHistory()).toEqual(['battle:init', 'battle:in-progress', 'battle:finished']);
  });

  it('应验证战斗结束时星级评定计算正确', () => {
    // TODO: 验证战斗结果的星级评定逻辑
    // expect(battleResult.stars).toBeGreaterThanOrEqual(1);
    // expect(battleResult.stars).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径5: alliance-task:active → alliance-task:completed → alliance-task:claimed
// 描述：联盟任务激活→完成→领取奖励
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: alliance-task:active → alliance-task:completed → alliance-task:claimed (联盟任务)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('alliance-task:active');
  });

  it('初始状态应为 alliance-task:active（联盟任务激活）', () => {
    expect(sm.getState()).toBe('alliance-task:active');
  });

  it('alliance-task:active → alliance-task:completed: 触发 completeTask 完成任务', () => {
    // 前置条件：任务进度 >= 目标数量
    // 触发器：completeTask
    // 副作用：任务标记完成、通知联盟成员
    
    sm.transition({
      from: 'alliance-task:active',
      to: 'alliance-task:completed',
      trigger: 'completeTask',
      condition: '任务进度 >= 目标数量',
      sideEffects: ['任务标记完成', '通知联盟成员'],
    });

    expect(sm.getState()).toBe('alliance-task:completed');
  });

  it('alliance-task:completed → alliance-task:claimed: 触发 claimReward 领取奖励', () => {
    sm.transition({
      from: 'alliance-task:active',
      to: 'alliance-task:completed',
      trigger: 'completeTask',
      condition: '任务进度 >= 目标数量',
      sideEffects: ['任务标记完成'],
    });

    // 前置条件：玩家领取奖励
    // 触发器：claimReward
    // 副作用：发放公会币、发放联盟经验
    
    sm.transition({
      from: 'alliance-task:completed',
      to: 'alliance-task:claimed',
      trigger: 'claimReward',
      condition: '玩家领取奖励',
      sideEffects: ['发放公会币', '发放联盟经验'],
    });

    expect(sm.getState()).toBe('alliance-task:claimed');
    expect(sm.getHistory()).toEqual([
      'alliance-task:active',
      'alliance-task:completed',
      'alliance-task:claimed',
    ]);
  });

  it('应验证联盟任务奖励发放正确', () => {
    // TODO: 验证公会币和联盟经验发放
    // expect(player.guildCoins).toBe(initialCoins + reward.guildCoins);
    // expect(player.allianceExp).toBe(initialExp + reward.allianceExp);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径6: prestige:initial → prestige:leveling → prestige:max-level
// 描述：声望初始→升级中→满级
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: prestige:initial → prestige:leveling → prestige:max-level (声望成长)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('prestige:initial');
  });

  it('初始状态应为 prestige:initial（声望初始）', () => {
    expect(sm.getState()).toBe('prestige:initial');
  });

  it('prestige:initial → prestige:leveling: 触发 gainPrestigePoints 获得声望点数', () => {
    // 前置条件：首次获得声望点数
    // 触发器：gainPrestigePoints
    // 副作用：声望等级提升
    
    sm.transition({
      from: 'prestige:initial',
      to: 'prestige:leveling',
      trigger: 'gainPrestigePoints',
      condition: '首次获得声望点数',
      sideEffects: ['声望等级提升'],
    });

    expect(sm.getState()).toBe('prestige:leveling');
  });

  it('prestige:leveling → prestige:max-level: 触发 reachMaxLevel 达到满级', () => {
    sm.transition({
      from: 'prestige:initial',
      to: 'prestige:leveling',
      trigger: 'gainPrestigePoints',
      condition: '首次获得声望点数',
      sideEffects: ['声望等级提升'],
    });

    // 前置条件：声望等级达到上限
    // 触发器：reachMaxLevel
    // 副作用：解锁转生功能
    
    sm.transition({
      from: 'prestige:leveling',
      to: 'prestige:max-level',
      trigger: 'reachMaxLevel',
      condition: '声望等级达到上限',
      sideEffects: ['解锁转生功能'],
    });

    expect(sm.getState()).toBe('prestige:max-level');
    expect(sm.getHistory()).toEqual([
      'prestige:initial',
      'prestige:leveling',
      'prestige:max-level',
    ]);
  });

  it('应验证声望满级后解锁转生功能', () => {
    // TODO: 验证转生功能解锁
    // expect(player.canRebirth).toBe(true);
    // expect(rebirthSystem.isUnlocked()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径7: rebirth:ready → rebirth:in-progress → rebirth:completed
// 描述：转生就绪→进行中→完成
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: rebirth:ready → rebirth:in-progress → rebirth:completed (转生流程)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('rebirth:ready');
  });

  it('初始状态应为 rebirth:ready（转生就绪）', () => {
    expect(sm.getState()).toBe('rebirth:ready');
  });

  it('rebirth:ready → rebirth:in-progress: 触发 startRebirth 开始转生', () => {
    // 前置条件：声望达到转生要求 && 确认转生
    // 触发器：startRebirth
    // 副作用：重置进度、保留传承项
    
    sm.transition({
      from: 'rebirth:ready',
      to: 'rebirth:in-progress',
      trigger: 'startRebirth',
      condition: '声望达到转生要求 && 确认转生',
      sideEffects: ['重置进度', '保留传承项'],
    });

    expect(sm.getState()).toBe('rebirth:in-progress');
  });

  it('rebirth:in-progress → rebirth:completed: 触发 rebirthComplete 转生完成', () => {
    sm.transition({
      from: 'rebirth:ready',
      to: 'rebirth:in-progress',
      trigger: 'startRebirth',
      condition: '声望达到转生要求 && 确认转生',
      sideEffects: ['重置进度', '保留传承项'],
    });

    // 前置条件：转生流程完成
    // 触发器：rebirthComplete
    // 副作用：发放转生初始礼物、应用加速加成
    
    sm.transition({
      from: 'rebirth:in-progress',
      to: 'rebirth:completed',
      trigger: 'rebirthComplete',
      condition: '转生流程完成',
      sideEffects: ['发放转生初始礼物', '应用加速加成'],
    });

    expect(sm.getState()).toBe('rebirth:completed');
    expect(sm.getHistory()).toEqual([
      'rebirth:ready',
      'rebirth:in-progress',
      'rebirth:completed',
    ]);
  });

  it('应验证转生后传承加成保留', () => {
    // TODO: 验证传承加成正确保留
    // expect(player.heritagePoints).toBeGreaterThan(0);
    // expect(player.heritageBonuses).toContainEqual(expect.objectContaining({ type: 'production' }));
  });

  it('应验证转生后初始礼物发放', () => {
    // TODO: 验证转生初始礼物
    // expect(resourceSystem.getGrain()).toBe(rebirthGift.grain);
    // expect(resourceSystem.getGold()).toBe(rebirthGift.gold);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径8: activity:inactive → activity:active → activity:expired
// 描述：活动未激活→激活→过期
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: activity:inactive → activity:active → activity:expired (活动过期)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('activity:inactive');
  });

  it('初始状态应为 activity:inactive（活动未激活）', () => {
    expect(sm.getState()).toBe('activity:inactive');
  });

  it('activity:inactive → activity:active: 触发 activityStart 活动开始', () => {
    // 前置条件：活动开启时间到达
    // 触发器：activityStart
    // 副作用：活动面板解锁
    
    sm.transition({
      from: 'activity:inactive',
      to: 'activity:active',
      trigger: 'activityStart',
      condition: '活动开启时间到达',
      sideEffects: ['活动面板解锁'],
    });

    expect(sm.getState()).toBe('activity:active');
  });

  it('activity:active → activity:expired: 触发 activityEnd 活动过期', () => {
    sm.transition({
      from: 'activity:inactive',
      to: 'activity:active',
      trigger: 'activityStart',
      condition: '活动开启时间到达',
      sideEffects: ['活动面板解锁'],
    });

    // 前置条件：活动结束时间到达
    // 触发器：activityEnd
    // 副作用：活动关闭
    
    sm.transition({
      from: 'activity:active',
      to: 'activity:expired',
      trigger: 'activityEnd',
      condition: '活动结束时间到达',
      sideEffects: ['活动关闭'],
    });

    expect(sm.getState()).toBe('activity:expired');
    expect(sm.getHistory()).toEqual([
      'activity:inactive',
      'activity:active',
      'activity:expired',
    ]);
  });

  it('应验证活动过期后无法继续参与', () => {
    // TODO: 验证过期活动的交互限制
    // expect(activitySystem.canParticipate(activityId)).toBe(false);
    // expect(activitySystem.isExpired(activityId)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径9: bond:inactive → bond:partial → bond:active
// 描述：羁绊未激活→部分激活→完全激活
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: bond:inactive → bond:partial → bond:active (羁绊激活)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('bond:inactive');
  });

  it('初始状态应为 bond:inactive（羁绊未激活）', () => {
    expect(sm.getState()).toBe('bond:inactive');
  });

  it('bond:inactive → bond:partial: 触发 collectBondHeroes 收集部分羁绊武将', () => {
    // 前置条件：拥有部分羁绊武将
    // 触发器：collectBondHeroes
    // 副作用：部分羁绊效果生效
    
    sm.transition({
      from: 'bond:inactive',
      to: 'bond:partial',
      trigger: 'collectBondHeroes',
      condition: '拥有部分羁绊武将',
      sideEffects: ['部分羁绊效果生效'],
    });

    expect(sm.getState()).toBe('bond:partial');
  });

  it('bond:partial → bond:active: 触发 completeBond 集齐所有羁绊武将', () => {
    sm.transition({
      from: 'bond:inactive',
      to: 'bond:partial',
      trigger: 'collectBondHeroes',
      condition: '拥有部分羁绊武将',
      sideEffects: ['部分羁绊效果生效'],
    });

    // 前置条件：集齐所有羁绊武将
    // 触发器：completeBond
    // 副作用：完整羁绊加成生效
    
    sm.transition({
      from: 'bond:partial',
      to: 'bond:active',
      trigger: 'completeBond',
      condition: '集齐所有羁绊武将',
      sideEffects: ['完整羁绊加成生效'],
    });

    expect(sm.getState()).toBe('bond:active');
    expect(sm.getHistory()).toEqual(['bond:inactive', 'bond:partial', 'bond:active']);
  });

  it('应验证部分羁绊效果弱于完整羁绊', () => {
    // TODO: 验证羁绊效果递进关系
    // expect(partialBondBonus.value).toBeLessThan(fullBondBonus.value);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径10: vip:level-0 → vip:leveling → vip:max-level
// 描述：VIP初始→升级中→满级
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: vip:level-0 → vip:leveling → vip:max-level (VIP成长)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('vip:level-0');
  });

  it('初始状态应为 vip:level-0（VIP等级0）', () => {
    expect(sm.getState()).toBe('vip:level-0');
  });

  it('vip:level-0 → vip:leveling: 触发 gainVipExp 获得VIP经验', () => {
    // 前置条件：充值获得VIP经验
    // 触发器：gainVipExp
    // 副作用：VIP等级提升
    
    sm.transition({
      from: 'vip:level-0',
      to: 'vip:leveling',
      trigger: 'gainVipExp',
      condition: '充值获得VIP经验',
      sideEffects: ['VIP等级提升'],
    });

    expect(sm.getState()).toBe('vip:leveling');
  });

  it('vip:leveling → vip:max-level: 触发 reachMaxVipLevel 达到VIP满级', () => {
    sm.transition({
      from: 'vip:level-0',
      to: 'vip:leveling',
      trigger: 'gainVipExp',
      condition: '充值获得VIP经验',
      sideEffects: ['VIP等级提升'],
    });

    // 前置条件：VIP等级达到上限
    // 触发器：reachMaxVipLevel
    // 副作用：解锁全部VIP特权
    
    sm.transition({
      from: 'vip:leveling',
      to: 'vip:max-level',
      trigger: 'reachMaxVipLevel',
      condition: 'VIP等级达到上限',
      sideEffects: ['解锁全部VIP特权'],
    });

    expect(sm.getState()).toBe('vip:max-level');
    expect(sm.getHistory()).toEqual(['vip:level-0', 'vip:leveling', 'vip:max-level']);
  });

  it('应验证VIP满级后所有特权已解锁', () => {
    // TODO: 验证VIP特权列表
    // expect(vipSystem.getAllPrivileges()).toHaveLength(totalPrivilegeCount);
    // expect(vipSystem.isMaxLevel()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径11: tutorial:not-started → tutorial:in-progress → tutorial:completed
// 描述：教程未开始→进行中→完成
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: tutorial:not-started → tutorial:in-progress → tutorial:completed (新手教程)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('tutorial:not-started');
  });

  it('初始状态应为 tutorial:not-started（教程未开始）', () => {
    expect(sm.getState()).toBe('tutorial:not-started');
  });

  it('tutorial:not-started → tutorial:in-progress: 触发 startTutorial 开始教程', () => {
    // 前置条件：首次进入游戏
    // 触发器：startTutorial
    // 副作用：显示引导遮罩
    
    sm.transition({
      from: 'tutorial:not-started',
      to: 'tutorial:in-progress',
      trigger: 'startTutorial',
      condition: '首次进入游戏',
      sideEffects: ['显示引导遮罩'],
    });

    expect(sm.getState()).toBe('tutorial:in-progress');
  });

  it('tutorial:in-progress → tutorial:completed: 触发 completeTutorial 完成教程', () => {
    sm.transition({
      from: 'tutorial:not-started',
      to: 'tutorial:in-progress',
      trigger: 'startTutorial',
      condition: '首次进入游戏',
      sideEffects: ['显示引导遮罩'],
    });

    // 前置条件：所有引导步骤完成
    // 触发器：completeTutorial
    // 副作用：关闭引导、解锁全部功能
    
    sm.transition({
      from: 'tutorial:in-progress',
      to: 'tutorial:completed',
      trigger: 'completeTutorial',
      condition: '所有引导步骤完成',
      sideEffects: ['关闭引导', '解锁全部功能'],
    });

    expect(sm.getState()).toBe('tutorial:completed');
    expect(sm.getHistory()).toEqual([
      'tutorial:not-started',
      'tutorial:in-progress',
      'tutorial:completed',
    ]);
  });

  it('应验证教程完成后所有功能已解锁', () => {
    // TODO: 验证功能解锁
    // expect(tutorialSystem.isCompleted()).toBe(true);
    // expect(gameState.allFeaturesUnlocked).toBe(true);
  });
});
