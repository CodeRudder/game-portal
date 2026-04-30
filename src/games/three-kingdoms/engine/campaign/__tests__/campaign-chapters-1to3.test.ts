/**
 * 关卡数据完整性测试 — 第1~3章
 *
 * 验证 campaign-chapter1/2/3.ts 导出的关卡数据：
 *   - 数据结构完整（id/name/type/chapterId/order/enemyFormation/rewards/dropTable）
 *   - 关卡ID唯一不重复
 *   - 关卡类型分布正确（3普通 + 1精英 + 1BOSS）
 *   - 难度递增（recommendedPower/order）
 *   - 奖励配置合理（正数、首通 > 基础）
 *   - 掉落表概率范围 [0,1]
 *   - 敌方阵容单位数量 3~6
 *   - 敌方单位属性为正数
 */

import { CHAPTER1_STAGES } from '../campaign-chapter1';
import { CHAPTER2_STAGES } from '../campaign-chapter2';
import { CHAPTER3_STAGES } from '../campaign-chapter3';
import type { Stage, StageType, DropTableEntry, EnemyUnitDef } from '../campaign.types';

// ─────────────────────────────────────────────
// 通用验证函数
// ─────────────────────────────────────────────

/** 验证单个关卡数据结构完整性 */
function assertStageValid(stage: Stage, expectedChapterId: string): void {
  // 基础字段
  expect(stage.id).toBeTruthy();
  expect(stage.id).toMatch(/^chapter\d+_stage\d+$/);
  expect(stage.name).toBeTruthy();
  expect(stage.chapterId).toBe(expectedChapterId);
  expect(stage.order).toBeGreaterThanOrEqual(1);
  expect(stage.description).toBeTruthy();

  // 类型
  expect(['normal', 'elite', 'boss']).toContain(stage.type);

  // 敌方阵容
  expect(stage.enemyFormation).toBeDefined();
  expect(stage.enemyFormation.id).toBeTruthy();
  expect(stage.enemyFormation.name).toBeTruthy();
  expect(stage.enemyFormation.recommendedPower).toBeGreaterThan(0);
  expect(stage.enemyFormation.units.length).toBeGreaterThanOrEqual(3);
  expect(stage.enemyFormation.units.length).toBeLessThanOrEqual(6);

  // 敌方单位属性
  for (const unit of stage.enemyFormation.units) {
    assertEnemyUnitValid(unit);
  }

  // 奖励
  expect(stage.baseExp).toBeGreaterThan(0);
  expect(stage.baseRewards).toBeDefined();
  expect(stage.firstClearRewards).toBeDefined();
  expect(stage.firstClearExp).toBeGreaterThanOrEqual(stage.baseExp);

  // 三星倍率
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(1.0);

  // 掉落表
  expect(stage.dropTable.length).toBeGreaterThanOrEqual(1);
  for (const drop of stage.dropTable) {
    assertDropTableEntryValid(drop);
  }

  // 推荐战力
  expect(stage.recommendedPower).toBeGreaterThan(0);
}

/** 验证敌方单位属性 */
function assertEnemyUnitValid(unit: EnemyUnitDef): void {
  expect(unit.id).toBeTruthy();
  expect(unit.name).toBeTruthy();
  expect(unit.level).toBeGreaterThanOrEqual(1);
  expect(unit.attack).toBeGreaterThan(0);
  expect(unit.defense).toBeGreaterThan(0);
  expect(unit.intelligence).toBeGreaterThanOrEqual(0);
  expect(unit.speed).toBeGreaterThan(0);
  expect(unit.maxHp).toBeGreaterThan(0);
  expect(['front', 'back']).toContain(unit.position);
  expect(['CAVALRY', 'INFANTRY', 'SPEARMAN', 'ARCHER', 'STRATEGIST']).toContain(unit.troopType);
}

/** 验证掉落表条目 */
function assertDropTableEntryValid(drop: DropTableEntry): void {
  expect(['resource', 'fragment', 'exp']).toContain(drop.type);
  expect(drop.probability).toBeGreaterThan(0);
  expect(drop.probability).toBeLessThanOrEqual(1.0);
  expect(drop.minAmount).toBeGreaterThanOrEqual(1);
  expect(drop.maxAmount).toBeGreaterThanOrEqual(drop.minAmount);

  if (drop.type === 'resource') {
    expect(drop.resourceType).toBeTruthy();
  }
  if (drop.type === 'fragment') {
    expect(drop.generalId).toBeTruthy();
  }
}

/** 验证章节关卡类型分布 */
function assertStageTypeDistribution(stages: Stage[]): void {
  const normals = stages.filter(s => s.type === 'normal');
  const elites = stages.filter(s => s.type === 'elite');
  const bosses = stages.filter(s => s.type === 'boss');

  expect(normals).toHaveLength(3);
  expect(elites).toHaveLength(1);
  expect(bosses).toHaveLength(1);
}

/** 验证难度递增 */
function assertDifficultyIncreasing(stages: Stage[]): void {
  for (let i = 1; i < stages.length; i++) {
    expect(stages[i].recommendedPower).toBeGreaterThan(stages[i - 1].recommendedPower);
  }
}

/** 验证 order 连续 */
function assertOrderSequential(stages: Stage[]): void {
  for (let i = 0; i < stages.length; i++) {
    expect(stages[i].order).toBe(i + 1);
  }
}

/** 验证 BOSS 关特殊属性 */
function assertBossStage(stage: Stage): void {
  expect(stage.type).toBe('boss');
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(2.0);
  // BOSS 关掉落表至少有一个 probability=1.0 的资源掉落
  const guaranteedDrops = stage.dropTable.filter(d => d.probability === 1.0);
  expect(guaranteedDrops.length).toBeGreaterThanOrEqual(1);
}

/** 验证精英关特殊属性 */
function assertEliteStage(stage: Stage): void {
  expect(stage.type).toBe('elite');
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(1.5);
}

// ─────────────────────────────────────────────
// 第1章：黄巾之乱
// ─────────────────────────────────────────────

describe('campaign-chapter1 第1章：黄巾之乱', () => {
  const stages = CHAPTER1_STAGES;

  it('应导出5个关卡', () => {
    expect(stages).toHaveLength(5);
  });

  it('关卡类型分布应为 3普通+1精英+1BOSS', () => {
    assertStageTypeDistribution(stages);
  });

  it('关卡 order 应为 1~5 连续', () => {
    assertOrderSequential(stages);
  });

  it('推荐战力应递增', () => {
    assertDifficultyIncreasing(stages);
  });

  it('所有关卡数据结构完整', () => {
    for (const stage of stages) {
      assertStageValid(stage, 'chapter1');
    }
  });

  it('BOSS关（张宝）三星倍率≥2.0且有保底掉落', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('张宝');
  });

  it('精英关（卜巳）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('卜巳');
  });

  it('关卡ID前缀为 chapter1_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter1_stage\d+$/);
    }
  });

  it('掉落表包含张角碎片（蓝）', () => {
    const hasZhangjiaoFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'zhangjiao'),
    );
    expect(hasZhangjiaoFragment).toBe(true);
  });

  it('掉落表包含关羽碎片（紫）', () => {
    const hasGuanyuFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'guanyu'),
    );
    expect(hasGuanyuFragment).toBe(true);
  });

  it('首通奖励应大于基础奖励（grain维度）', () => {
    for (const stage of stages) {
      const baseGrain = stage.baseRewards.grain ?? 0;
      const firstGrain = stage.firstClearRewards.grain ?? 0;
      expect(firstGrain).toBeGreaterThan(baseGrain);
    }
  });

  it('推荐战力范围 100~500', () => {
    expect(stages[0].recommendedPower).toBe(100);
    expect(stages[stages.length - 1].recommendedPower).toBe(500);
  });
});

// ─────────────────────────────────────────────
// 第2章：群雄割据
// ─────────────────────────────────────────────

describe('campaign-chapter2 第2章：群雄割据', () => {
  const stages = CHAPTER2_STAGES;

  it('应导出5个关卡', () => {
    expect(stages).toHaveLength(5);
  });

  it('关卡类型分布应为 3普通+1精英+1BOSS', () => {
    assertStageTypeDistribution(stages);
  });

  it('关卡 order 应为 1~5 连续', () => {
    assertOrderSequential(stages);
  });

  it('推荐战力应递增', () => {
    assertDifficultyIncreasing(stages);
  });

  it('所有关卡数据结构完整', () => {
    for (const stage of stages) {
      assertStageValid(stage, 'chapter2');
    }
  });

  it('BOSS关（吕布）属性正确', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('吕布');
  });

  it('精英关（郭汜）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('郭汜');
  });

  it('关卡ID前缀为 chapter2_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter2_stage\d+$/);
    }
  });

  it('掉落表包含吕布碎片（橙）', () => {
    const hasLvbuFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'lvbu'),
    );
    expect(hasLvbuFragment).toBe(true);
  });

  it('掉落表包含赵云碎片（紫）', () => {
    const hasZhaoyunFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'zhaoyun'),
    );
    expect(hasZhaoyunFragment).toBe(true);
  });

  it('推荐战力范围 500~1200', () => {
    expect(stages[0].recommendedPower).toBe(500);
    expect(stages[stages.length - 1].recommendedPower).toBe(1200);
  });
});

// ─────────────────────────────────────────────
// 第3章：官渡之战
// ─────────────────────────────────────────────

describe('campaign-chapter3 第3章：官渡之战', () => {
  const stages = CHAPTER3_STAGES;

  it('应导出5个关卡', () => {
    expect(stages).toHaveLength(5);
  });

  it('关卡类型分布应为 3普通+1精英+1BOSS', () => {
    assertStageTypeDistribution(stages);
  });

  it('关卡 order 应为 1~5 连续', () => {
    assertOrderSequential(stages);
  });

  it('推荐战力应递增', () => {
    assertDifficultyIncreasing(stages);
  });

  it('所有关卡数据结构完整', () => {
    for (const stage of stages) {
      assertStageValid(stage, 'chapter3');
    }
  });

  it('BOSS关（袁绍）属性正确', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('袁绍');
  });

  it('精英关（高览）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('高览');
  });

  it('关卡ID前缀为 chapter3_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter3_stage\d+$/);
    }
  });

  it('掉落表包含曹操碎片（紫）', () => {
    const hasCaocaoFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'caocao'),
    );
    expect(hasCaocaoFragment).toBe(true);
  });

  it('掉落表包含诸葛亮碎片（橙）', () => {
    const hasZhugeliangFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'zhugeliang'),
    );
    expect(hasZhugeliangFragment).toBe(true);
  });

  it('推荐战力范围 1200~2500', () => {
    expect(stages[0].recommendedPower).toBe(1200);
    expect(stages[stages.length - 1].recommendedPower).toBe(2500);
  });
});

// ─────────────────────────────────────────────
// 跨章一致性校验
// ─────────────────────────────────────────────

describe('campaign-chapters 1~3 跨章一致性', () => {
  const allStages = [...CHAPTER1_STAGES, ...CHAPTER2_STAGES, ...CHAPTER3_STAGES];

  it('15个关卡ID全局唯一不重复', () => {
    const ids = allStages.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('章节间推荐战力递增（ch1 < ch2 < ch3）', () => {
    const ch1Max = Math.max(...CHAPTER1_STAGES.map(s => s.recommendedPower));
    const ch2Min = Math.min(...CHAPTER2_STAGES.map(s => s.recommendedPower));
    const ch2Max = Math.max(...CHAPTER2_STAGES.map(s => s.recommendedPower));
    const ch3Min = Math.min(...CHAPTER3_STAGES.map(s => s.recommendedPower));

    expect(ch2Min).toBeGreaterThanOrEqual(ch1Max);
    expect(ch3Min).toBeGreaterThanOrEqual(ch2Max);
  });
});
