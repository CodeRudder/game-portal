/**
 * StateDAG 测试骨架 — P1优先级
 * 
 * 覆盖范围：StateDAG中已覆盖但需要加强的复杂路径变体
 * 目标：补充边界条件和完整状态链测试
 * 
 * 包含19条已覆盖路径的深度测试用例
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// 辅助类型定义（与P0共享）
// ═══════════════════════════════════════════════════════════════

interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  condition: string;
  sideEffects: string[];
}

class StateMachineMock {
  private currentState: string;
  private history: string[] = [];
  private sideEffectsLog: string[][] = [];

  constructor(initialState: string) {
    this.currentState = initialState;
    this.history.push(initialState);
  }

  getState(): string { return this.currentState; }
  getHistory(): string[] { return [...this.history]; }
  getSideEffects(): string[][] { return [...this.sideEffectsLog]; }

  transition(t: StateTransition): void {
    if (this.currentState !== t.from) {
      throw new Error(`Invalid: expected '${t.from}' but was '${this.currentState}'`);
    }
    this.currentState = t.to;
    this.history.push(t.to);
    this.sideEffectsLog.push(t.sideEffects);
  }
}

// ═══════════════════════════════════════════════════════════════
// 路径12: equipment:unequipped → equipment:decomposed
// 描述：装备未装备→直接分解
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: equipment:unequipped → equipment:decomposed (装备分解)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('equipment:unequipped');
  });

  it('初始状态应为 equipment:unequipped（装备未穿戴）', () => {
    expect(sm.getState()).toBe('equipment:unequipped');
  });

  it('equipment:unequipped → equipment:decomposed: 触发 decompose 分解装备', () => {
    // 前置条件：玩家确认分解
    // 触发器：decompose
    // 副作用：返还分解材料、装备销毁
    
    sm.transition({
      from: 'equipment:unequipped',
      to: 'equipment:decomposed',
      trigger: 'decompose',
      condition: '玩家确认分解',
      sideEffects: ['返还分解材料', '装备销毁'],
    });

    expect(sm.getState()).toBe('equipment:decomposed');
    expect(sm.getHistory()).toEqual(['equipment:unequipped', 'equipment:decomposed']);
  });

  it('应验证分解后装备已销毁不可恢复', () => {
    // TODO: 验证装备从背包移除
    // expect(equipmentSystem.exists(equipmentId)).toBe(false);
  });

  it('应验证分解材料返还正确', () => {
    // TODO: 验证分解材料数量
    // const materials = equipmentSystem.getDecomposeMaterials(equipment);
    // expect(resourceSystem.getMaterialCount()).toBe(initialCount + materials.length);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径13: hero:locked → hero:available → hero:recruited → hero:dispatched
// 描述：武将解锁→可招募→已招募→派遣中
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: hero:locked → hero:available → hero:recruited → hero:dispatched (武将派遣)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('hero:locked');
  });

  it('初始状态应为 hero:locked（武将锁定）', () => {
    expect(sm.getState()).toBe('hero:locked');
  });

  it('hero:locked → hero:available: 触发 unlockHero 解锁武将', () => {
    sm.transition({
      from: 'hero:locked',
      to: 'hero:available',
      trigger: 'unlockHero',
      condition: '完成解锁条件(剧情/声望等级)',
      sideEffects: ['武将出现在招贤池'],
    });
    expect(sm.getState()).toBe('hero:available');
  });

  it('hero:available → hero:recruited: 触发 recruit 招募武将', () => {
    sm.transition({
      from: 'hero:locked', to: 'hero:available',
      trigger: 'unlockHero', condition: '完成解锁条件', sideEffects: ['武将出现在招贤池'],
    });

    sm.transition({
      from: 'hero:available',
      to: 'hero:recruited',
      trigger: 'recruit',
      condition: '招贤令/铜钱充足',
      sideEffects: ['扣除招贤令', '武将加入阵容'],
    });
    expect(sm.getState()).toBe('hero:recruited');
  });

  it('hero:recruited → hero:dispatched: 触发 dispatch 派遣武将', () => {
    sm.transition({ from: 'hero:locked', to: 'hero:available', trigger: 'unlockHero', condition: '', sideEffects: [] });
    sm.transition({ from: 'hero:available', to: 'hero:recruited', trigger: 'recruit', condition: '', sideEffects: [] });

    sm.transition({
      from: 'hero:recruited',
      to: 'hero:dispatched',
      trigger: 'dispatch',
      condition: '远征/派遣任务可用',
      sideEffects: ['武将进入派遣状态', '不可出战'],
    });
    expect(sm.getState()).toBe('hero:dispatched');
    expect(sm.getHistory()).toEqual([
      'hero:locked', 'hero:available', 'hero:recruited', 'hero:dispatched'
    ]);
  });

  it('应验证派遣中武将不可出战', () => {
    // TODO: 验证派遣状态限制
    // expect(hero.canBattle()).toBe(false);
    // expect(hero.status).toBe('dispatched');
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径14: quest:locked → quest:available → quest:active → quest:failed
// 描述：任务锁定→可用→激活→失败
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: quest:locked → quest:available → quest:active → quest:failed (任务失败)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('quest:locked');
  });

  it('quest:locked → quest:available → quest:active → quest:failed: 完整任务失败流程', () => {
    sm.transition({
      from: 'quest:locked', to: 'quest:available',
      trigger: 'unlockQuest', condition: '前置任务完成 && 等级达标',
      sideEffects: ['任务出现在列表', '红点提示'],
    });
    expect(sm.getState()).toBe('quest:available');

    sm.transition({
      from: 'quest:available', to: 'quest:active',
      trigger: 'acceptQuest', condition: '玩家接取任务',
      sideEffects: ['任务追踪开始'],
    });
    expect(sm.getState()).toBe('quest:active');

    sm.transition({
      from: 'quest:active', to: 'quest:failed',
      trigger: 'failQuest', condition: '任务失败条件触发',
      sideEffects: ['任务标记失败'],
    });
    expect(sm.getState()).toBe('quest:failed');
    expect(sm.getHistory()).toEqual([
      'quest:locked', 'quest:available', 'quest:active', 'quest:failed'
    ]);
  });

  it('应验证任务失败后无奖励发放', () => {
    // TODO: 验证失败任务无奖励
    // expect(questSystem.getRewards(questId)).toBeEmpty();
    // expect(questSystem.getStatus(questId)).toBe('failed');
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径15: quest:locked → quest:available → quest:active → quest:expired
// 描述：任务锁定→可用→激活→过期
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: quest:locked → quest:available → quest:active → quest:expired (任务过期)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('quest:locked');
  });

  it('quest:locked → quest:available → quest:active → quest:expired: 完整任务过期流程', () => {
    sm.transition({
      from: 'quest:locked', to: 'quest:available',
      trigger: 'unlockQuest', condition: '前置任务完成 && 等级达标',
      sideEffects: ['任务出现在列表'],
    });

    sm.transition({
      from: 'quest:available', to: 'quest:active',
      trigger: 'acceptQuest', condition: '玩家接取任务',
      sideEffects: ['任务追踪开始'],
    });

    sm.transition({
      from: 'quest:active', to: 'quest:expired',
      trigger: 'expireQuest', condition: '任务超时',
      sideEffects: ['任务标记过期'],
    });

    expect(sm.getState()).toBe('quest:expired');
    expect(sm.getHistory()).toEqual([
      'quest:locked', 'quest:available', 'quest:active', 'quest:expired'
    ]);
  });

  it('应验证任务超时时间检查正确', () => {
    // TODO: 验证任务超时逻辑
    // expect(questSystem.isExpired(questId)).toBe(true);
    // expect(questSystem.getRemainingTime(questId)).toBeLessThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径16: tech:locked → tech:available → tech:researching → tech:completed
// 描述：科技锁定→可用→研究中→完成
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: tech:locked → tech:available → tech:researching → tech:completed (科技研究)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('tech:locked');
  });

  it('tech:locked → tech:available → tech:researching → tech:completed: 完整科技研究流程', () => {
    sm.transition({
      from: 'tech:locked', to: 'tech:available',
      trigger: 'unlockTech', condition: '前置科技已研究完成 && 非互斥锁定',
      sideEffects: ['科技节点高亮'],
    });
    expect(sm.getState()).toBe('tech:available');

    sm.transition({
      from: 'tech:available', to: 'tech:researching',
      trigger: 'startResearch', condition: '科技点充足',
      sideEffects: ['扣除科技点', '开始研究倒计时'],
    });
    expect(sm.getState()).toBe('tech:researching');

    sm.transition({
      from: 'tech:researching', to: 'tech:completed',
      trigger: 'researchComplete', condition: '研究倒计时结束',
      sideEffects: ['科技效果生效', '解锁后续科技'],
    });
    expect(sm.getState()).toBe('tech:completed');
    expect(sm.getHistory()).toEqual([
      'tech:locked', 'tech:available', 'tech:researching', 'tech:completed'
    ]);
  });

  it('应验证科技完成后效果生效', () => {
    // TODO: 验证科技效果
    // expect(techSystem.isResearched(techId)).toBe(true);
    // expect(techSystem.getEffects(techId)).toBeApplied();
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径17: fusion-tech:locked → fusion-tech:available → fusion-tech:researching → fusion-tech:completed
// 描述：融合科技完整流程
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: fusion-tech:locked → ... → fusion-tech:completed (融合科技)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('fusion-tech:locked');
  });

  it('融合科技完整研究流程', () => {
    sm.transition({
      from: 'fusion-tech:locked', to: 'fusion-tech:available',
      trigger: 'unlockFusionTech', condition: '双路径科技均已完成',
      sideEffects: ['融合科技节点解锁'],
    });

    sm.transition({
      from: 'fusion-tech:available', to: 'fusion-tech:researching',
      trigger: 'startFusionResearch', condition: '科技点充足',
      sideEffects: ['扣除科技点'],
    });

    sm.transition({
      from: 'fusion-tech:researching', to: 'fusion-tech:completed',
      trigger: 'fusionResearchComplete', condition: '研究完成',
      sideEffects: ['融合科技效果生效'],
    });

    expect(sm.getState()).toBe('fusion-tech:completed');
    expect(sm.getHistory()).toEqual([
      'fusion-tech:locked', 'fusion-tech:available', 'fusion-tech:researching', 'fusion-tech:completed'
    ]);
  });

  it('应验证融合科技需要双路径科技完成', () => {
    // TODO: 验证融合科技解锁条件
    // expect(fusionTechSystem.canUnlock(fusionTechId)).toBe(true);
    // expect(techSystem.isResearched(pathA_Tech)).toBe(true);
    // expect(techSystem.isResearched(pathB_Tech)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径18: stage:locked → stage:available → stage:cleared → stage:threeStar
// 描述：关卡先普通通关再提升至三星
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: stage:locked → stage:available → stage:cleared → stage:threeStar (关卡提升)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('stage:locked');
  });

  it('先普通通关再提升至三星', () => {
    sm.transition({
      from: 'stage:locked', to: 'stage:available',
      trigger: 'unlockStage', condition: '前置关卡已通关',
      sideEffects: ['关卡解锁动画'],
    });

    sm.transition({
      from: 'stage:available', to: 'stage:cleared',
      trigger: 'clearStage', condition: '战斗胜利(1-2星)',
      sideEffects: ['发放通关奖励', '解锁下一关'],
    });

    sm.transition({
      from: 'stage:cleared', to: 'stage:threeStar',
      trigger: 'improveStars', condition: '重新挑战达到3星条件',
      sideEffects: ['补发三星奖励差值'],
    });

    expect(sm.getState()).toBe('stage:threeStar');
    expect(sm.getHistory()).toEqual([
      'stage:locked', 'stage:available', 'stage:cleared', 'stage:threeStar'
    ]);
  });

  it('应验证三星奖励差值补发正确', () => {
    // TODO: 验证补发奖励
    // expect(rewardSystem.getThreeStarBonus(stageId)).toBeGreaterThan(clearReward);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径19: equipment:unequipped → equipment:equipped → equipment:enhancing → equipment:enhanced
// 描述：装备穿戴→强化中→强化完成
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: equipment:unequipped → equipment:equipped → equipment:enhancing → equipment:enhanced (装备强化)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('equipment:unequipped');
  });

  it('装备穿戴→强化→强化完成', () => {
    sm.transition({
      from: 'equipment:unequipped', to: 'equipment:equipped',
      trigger: 'equip', condition: '武将有空槽位 && 装备部位匹配',
      sideEffects: ['装备属性加成生效'],
    });

    sm.transition({
      from: 'equipment:equipped', to: 'equipment:enhancing',
      trigger: 'startEnhance', condition: '强化材料充足',
      sideEffects: ['扣除强化材料'],
    });

    sm.transition({
      from: 'equipment:enhancing', to: 'equipment:enhanced',
      trigger: 'enhanceComplete', condition: '强化结果确定',
      sideEffects: ['装备属性提升/不变/降级'],
    });

    expect(sm.getState()).toBe('equipment:enhanced');
    expect(sm.getHistory()).toEqual([
      'equipment:unequipped', 'equipment:equipped', 'equipment:enhancing', 'equipment:enhanced'
    ]);
  });

  it('应验证强化后装备属性变化', () => {
    // TODO: 验证装备强化属性变化
    // expect(equipment.attack).toBeGreaterThanOrEqual(originalAttack);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径20: alliance:none → alliance:applied → alliance:member → alliance:dismissed
// 描述：申请联盟→被批准→被踢出
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: alliance:none → alliance:applied → alliance:member → alliance:dismissed (被踢出联盟)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('alliance:none');
  });

  it('申请加入→被批准→被踢出', () => {
    sm.transition({
      from: 'alliance:none', to: 'alliance:applied',
      trigger: 'applyToAlliance', condition: '未加入任何联盟',
      sideEffects: ['发送申请'],
    });

    sm.transition({
      from: 'alliance:applied', to: 'alliance:member',
      trigger: 'applicationApproved', condition: '联盟官员批准',
      sideEffects: ['加入联盟', '解锁联盟功能'],
    });

    sm.transition({
      from: 'alliance:member', to: 'alliance:dismissed',
      trigger: 'leaveOrKick', condition: '主动退出 或 被踢出',
      sideEffects: ['失去联盟权限'],
    });

    expect(sm.getState()).toBe('alliance:dismissed');
    expect(sm.getHistory()).toEqual([
      'alliance:none', 'alliance:applied', 'alliance:member', 'alliance:dismissed'
    ]);
  });

  it('应验证被踢出后失去联盟权限', () => {
    // TODO: 验证权限移除
    // expect(player.allianceId).toBeNull();
    // expect(player.canAccessAllianceFeatures()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径21: expedition:idle → expedition:dispatching → expedition:in-progress → expedition:returned
// 描述：远征完整流程
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: expedition:idle → ... → expedition:returned (远征完整流程)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('expedition:idle');
  });

  it('远征完整流程：选择队伍→出发→完成→返回', () => {
    sm.transition({
      from: 'expedition:idle', to: 'expedition:dispatching',
      trigger: 'selectTeam', condition: '选择远征队伍',
      sideEffects: ['进入编队选择'],
    });

    sm.transition({
      from: 'expedition:dispatching', to: 'expedition:in-progress',
      trigger: 'confirmDispatch', condition: '队伍战力满足要求',
      sideEffects: ['武将进入派遣状态', '开始远征倒计时'],
    });

    sm.transition({
      from: 'expedition:in-progress', to: 'expedition:returned',
      trigger: 'expeditionComplete', condition: '远征倒计时结束',
      sideEffects: ['计算远征奖励', '武将恢复空闲'],
    });

    expect(sm.getState()).toBe('expedition:returned');
    expect(sm.getHistory()).toEqual([
      'expedition:idle', 'expedition:dispatching', 'expedition:in-progress', 'expedition:returned'
    ]);
  });

  it('应验证远征奖励计算正确', () => {
    // TODO: 验证远征奖励
    // expect(expeditionSystem.getRewards(expeditionId).gold).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径22: arena:idle → arena:matching → arena:fighting → arena:cooldown
// 描述：竞技场完整战斗流程
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: arena:idle → arena:matching → arena:fighting → arena:cooldown (竞技场)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('arena:idle');
  });

  it('竞技场完整战斗流程', () => {
    sm.transition({
      from: 'arena:idle', to: 'arena:matching',
      trigger: 'selectOpponent', condition: '挑战次数 > 0',
      sideEffects: ['锁定挑战次数'],
    });

    sm.transition({
      from: 'arena:matching', to: 'arena:fighting',
      trigger: 'startArenaBattle', condition: '双方队伍就绪',
      sideEffects: ['进入战斗场景'],
    });

    sm.transition({
      from: 'arena:fighting', to: 'arena:cooldown',
      trigger: 'arenaBattleEnd', condition: '战斗结束',
      sideEffects: ['更新排名', '发放竞技币'],
    });

    expect(sm.getState()).toBe('arena:cooldown');
    expect(sm.getHistory()).toEqual([
      'arena:idle', 'arena:matching', 'arena:fighting', 'arena:cooldown'
    ]);
  });

  it('应验证竞技场战斗后排名更新', () => {
    // TODO: 验证排名变化
    // expect(arenaSystem.getCurrentRank()).not.toBe(initialRank);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径23: achievement:locked → achievement:in-progress → achievement:completed → achievement:claimed
// 描述：成就完整流程
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: achievement:locked → ... → achievement:claimed (成就领取)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('achievement:locked');
  });

  it('成就完整流程：解锁→进度→完成→领取', () => {
    sm.transition({
      from: 'achievement:locked', to: 'achievement:in-progress',
      trigger: 'unlockAchievement', condition: '成就条件开始追踪',
      sideEffects: ['成就出现在列表'],
    });

    sm.transition({
      from: 'achievement:in-progress', to: 'achievement:completed',
      trigger: 'completeAchievement', condition: '成就目标达成',
      sideEffects: ['成就标记完成', '红点提示'],
    });

    sm.transition({
      from: 'achievement:completed', to: 'achievement:claimed',
      trigger: 'claimAchievementReward', condition: '玩家领取奖励',
      sideEffects: ['发放成就奖励'],
    });

    expect(sm.getState()).toBe('achievement:claimed');
    expect(sm.getHistory()).toEqual([
      'achievement:locked', 'achievement:in-progress', 'achievement:completed', 'achievement:claimed'
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径24: map-city:neutral → map-city:contested → map-city:owned → map-city:lost
// 描述：城池争夺→占领→丢失
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: map-city:neutral → map-city:contested → map-city:owned → map-city:lost (城池丢失)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('map-city:neutral');
  });

  it('城池争夺→占领→丢失完整流程', () => {
    sm.transition({
      from: 'map-city:neutral', to: 'map-city:contested',
      trigger: 'attackCity', condition: '选择可攻击城池 && 编队就绪',
      sideEffects: ['进入攻城战斗'],
    });

    sm.transition({
      from: 'map-city:contested', to: 'map-city:owned',
      trigger: 'captureCity', condition: '攻城战斗胜利',
      sideEffects: ['城池归属变更', '驻军系统激活'],
    });

    sm.transition({
      from: 'map-city:owned', to: 'map-city:lost',
      trigger: 'cityLost', condition: '被敌方攻占',
      sideEffects: ['失去城池产出', '驻军撤退'],
    });

    expect(sm.getState()).toBe('map-city:lost');
    expect(sm.getHistory()).toEqual([
      'map-city:neutral', 'map-city:contested', 'map-city:owned', 'map-city:lost'
    ]);
  });

  it('应验证城池丢失后产出消失', () => {
    // TODO: 验证领土收益变化
    // expect(territorySystem.getIncome(cityId)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径25: season:preparation → season:active → season:settlement → season:ended
// 描述：赛季完整周期
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: season:preparation → season:active → season:settlement → season:ended (赛季周期)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('season:preparation');
  });

  it('赛季完整周期', () => {
    sm.transition({
      from: 'season:preparation', to: 'season:active',
      trigger: 'seasonStart', condition: '赛季开始时间到达',
      sideEffects: ['赛季任务刷新', '排行榜重置'],
    });

    sm.transition({
      from: 'season:active', to: 'season:settlement',
      trigger: 'seasonEnd', condition: '赛季结束时间到达',
      sideEffects: ['锁定排行榜', '计算赛季奖励'],
    });

    sm.transition({
      from: 'season:settlement', to: 'season:ended',
      trigger: 'distributeRewards', condition: '结算完成',
      sideEffects: ['发放赛季奖励'],
    });

    expect(sm.getState()).toBe('season:ended');
    expect(sm.getHistory()).toEqual([
      'season:preparation', 'season:active', 'season:settlement', 'season:ended'
    ]);
  });

  it('应验证赛季结算奖励发放正确', () => {
    // TODO: 验证赛季奖励
    // expect(seasonSystem.getSettlementRewards()).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径26: hero:locked → hero:available → hero:recruited → hero:awakening → hero:awakened
// 描述：武将觉醒完整流程（关键路径）
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: hero:locked → hero:awakened (武将觉醒完整流程 - 关键路径)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('hero:locked');
  });

  it('武将觉醒完整流程：解锁→招募→觉醒→觉醒完成', () => {
    sm.transition({
      from: 'hero:locked', to: 'hero:available',
      trigger: 'unlockHero', condition: '完成解锁条件',
      sideEffects: ['武将出现在招贤池'],
    });

    sm.transition({
      from: 'hero:available', to: 'hero:recruited',
      trigger: 'recruit', condition: '招贤令/铜钱充足',
      sideEffects: ['扣除招贤令', '武将加入阵容'],
    });

    sm.transition({
      from: 'hero:recruited', to: 'hero:awakening',
      trigger: 'startAwakening', condition: '武将突破满星 && 觉醒材料充足',
      sideEffects: ['扣除觉醒材料'],
    });

    sm.transition({
      from: 'hero:awakening', to: 'hero:awakened',
      trigger: 'awakeningComplete', condition: '觉醒流程完成',
      sideEffects: ['武将属性大幅提升', '解锁觉醒技能'],
    });

    expect(sm.getState()).toBe('hero:awakened');
    expect(sm.getHistory()).toEqual([
      'hero:locked', 'hero:available', 'hero:recruited', 'hero:awakening', 'hero:awakened'
    ]);
  });

  it('应验证觉醒后属性大幅提升', () => {
    // TODO: 验证觉醒属性提升
    // expect(hero.attack).toBeGreaterThan(preAwakeningAttack);
    // expect(hero.defense).toBeGreaterThan(preAwakeningDefense);
  });

  it('应验证觉醒技能已解锁', () => {
    // TODO: 验证觉醒技能
    // expect(hero.skills).toContainEqual(expect.objectContaining({ isAwakened: true }));
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径27: quest:locked → quest:available → quest:active → quest:completed → quest:claimed
// 描述：任务完整流程（关键路径）
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: quest:locked → quest:claimed (任务完整流程 - 关键路径)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('quest:locked');
  });

  it('任务完整流程：解锁→接取→完成→领取奖励', () => {
    sm.transition({
      from: 'quest:locked', to: 'quest:available',
      trigger: 'unlockQuest', condition: '前置任务完成 && 等级达标',
      sideEffects: ['任务出现在列表', '红点提示'],
    });

    sm.transition({
      from: 'quest:available', to: 'quest:active',
      trigger: 'acceptQuest', condition: '玩家接取任务',
      sideEffects: ['任务追踪开始'],
    });

    sm.transition({
      from: 'quest:active', to: 'quest:completed',
      trigger: 'completeObjective', condition: '任务目标达成',
      sideEffects: ['任务标记完成', '红点提示领奖'],
    });

    sm.transition({
      from: 'quest:completed', to: 'quest:claimed',
      trigger: 'claimReward', condition: '玩家领取奖励',
      sideEffects: ['发放奖励资源', '关闭任务'],
    });

    expect(sm.getState()).toBe('quest:claimed');
    expect(sm.getHistory()).toEqual([
      'quest:locked', 'quest:available', 'quest:active', 'quest:completed', 'quest:claimed'
    ]);
  });

  it('应验证任务奖励发放正确', () => {
    // TODO: 验证奖励资源到账
    // expect(resourceSystem.getGold()).toBe(initialGold + questReward.gold);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径28: alliance:none → alliance:applied → alliance:member → alliance:officer → alliance:leader
// 描述：联盟晋升完整流程（关键路径）
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: alliance:none → alliance:leader (联盟晋升 - 关键路径)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('alliance:none');
  });

  it('联盟晋升完整流程：申请→成员→官员→盟主', () => {
    sm.transition({
      from: 'alliance:none', to: 'alliance:applied',
      trigger: 'applyToAlliance', condition: '未加入任何联盟',
      sideEffects: ['发送申请'],
    });

    sm.transition({
      from: 'alliance:applied', to: 'alliance:member',
      trigger: 'applicationApproved', condition: '联盟官员批准',
      sideEffects: ['加入联盟', '解锁联盟功能'],
    });

    sm.transition({
      from: 'alliance:member', to: 'alliance:officer',
      trigger: 'promote', condition: '盟主/副盟主提拔',
      sideEffects: ['获得管理权限'],
    });

    sm.transition({
      from: 'alliance:officer', to: 'alliance:leader',
      trigger: 'transferLeadership', condition: '盟主转让',
      sideEffects: ['获得全部管理权限'],
    });

    expect(sm.getState()).toBe('alliance:leader');
    expect(sm.getHistory()).toEqual([
      'alliance:none', 'alliance:applied', 'alliance:member', 'alliance:officer', 'alliance:leader'
    ]);
  });

  it('应验证盟主拥有全部管理权限', () => {
    // TODO: 验证盟主权限
    // expect(player.alliancePermissions).toContain('kick');
    // expect(player.alliancePermissions).toContain('promote');
    // expect(player.alliancePermissions).toContain('disband');
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径29: alliance:none → alliance:applied → alliance:member → alliance:officer → alliance:dismissed
// 描述：联盟官员被踢出
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: alliance:none → alliance:officer → alliance:dismissed (官员被踢出)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('alliance:none');
  });

  it('联盟官员被踢出流程', () => {
    sm.transition({ from: 'alliance:none', to: 'alliance:applied', trigger: 'applyToAlliance', condition: '', sideEffects: [] });
    sm.transition({ from: 'alliance:applied', to: 'alliance:member', trigger: 'applicationApproved', condition: '', sideEffects: [] });
    sm.transition({ from: 'alliance:member', to: 'alliance:officer', trigger: 'promote', condition: '', sideEffects: [] });

    sm.transition({
      from: 'alliance:officer', to: 'alliance:dismissed',
      trigger: 'leaveOrKick', condition: '主动退出 或 被踢出',
      sideEffects: ['失去联盟权限'],
    });

    expect(sm.getState()).toBe('alliance:dismissed');
    expect(sm.getHistory()).toEqual([
      'alliance:none', 'alliance:applied', 'alliance:member', 'alliance:officer', 'alliance:dismissed'
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 路径30: activity:inactive → activity:active → activity:task-incomplete → activity:task-completed → activity:task-claimed
// 描述：活动任务完整流程
// ═══════════════════════════════════════════════════════════════

describe('StateDAG Path: activity:inactive → activity:task-claimed (活动任务完整流程)', () => {
  let sm: StateMachineMock;

  beforeEach(() => {
    sm = new StateMachineMock('activity:inactive');
  });

  it('活动任务完整流程：激活→查看任务→完成→领取', () => {
    sm.transition({
      from: 'activity:inactive', to: 'activity:active',
      trigger: 'activityStart', condition: '活动开启时间到达',
      sideEffects: ['活动面板解锁'],
    });

    sm.transition({
      from: 'activity:active', to: 'activity:task-incomplete',
      trigger: 'viewTask', condition: '查看活动任务',
      sideEffects: ['显示任务进度'],
    });

    sm.transition({
      from: 'activity:task-incomplete', to: 'activity:task-completed',
      trigger: 'completeActivityTask', condition: '任务目标达成',
      sideEffects: ['任务标记完成'],
    });

    sm.transition({
      from: 'activity:task-completed', to: 'activity:task-claimed',
      trigger: 'claimActivityReward', condition: '玩家领取奖励',
      sideEffects: ['发放活动奖励'],
    });

    expect(sm.getState()).toBe('activity:task-claimed');
    expect(sm.getHistory()).toEqual([
      'activity:inactive', 'activity:active', 'activity:task-incomplete',
      'activity:task-completed', 'activity:task-claimed'
    ]);
  });

  it('应验证活动任务奖励发放正确', () => {
    // TODO: 验证活动奖励
    // expect(resourceSystem.getGold()).toBe(initialGold + activityReward.gold);
  });
});
