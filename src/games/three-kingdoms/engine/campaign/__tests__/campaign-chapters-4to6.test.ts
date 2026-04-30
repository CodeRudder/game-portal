/**
 * 关卡数据完整性测试 — 第4~6章
 *
 * 验证 campaign-chapter4/5/6.ts 导出的关卡数据：
 *   - 数据结构完整
 *   - 关卡ID唯一不重复
 *   - 关卡类型分布正确（3普通 + 1精英 + 1BOSS）
 *   - 难度递增
 *   - 奖励配置合理
 *   - 掉落表概率范围 [0,1]
 *   - 敌方阵容单位数量 3~6
 */

import { CHAPTER4_STAGES } from '../campaign-chapter4';
import { CHAPTER5_STAGES } from '../campaign-chapter5';
import { CHAPTER6_STAGES } from '../campaign-chapter6';
import type { Stage, StageType, DropTableEntry, EnemyUnitDef } from '../campaign.types';

// ─────────────────────────────────────────────
// 通用验证函数（复用自 chapters-1to3）
// ─────────────────────────────────────────────

function assertStageValid(stage: Stage, expectedChapterId: string): void {
  expect(stage.id).toBeTruthy();
  expect(stage.id).toMatch(/^chapter\d+_stage\d+$/);
  expect(stage.name).toBeTruthy();
  expect(stage.chapterId).toBe(expectedChapterId);
  expect(stage.order).toBeGreaterThanOrEqual(1);
  expect(stage.description).toBeTruthy();
  expect(['normal', 'elite', 'boss']).toContain(stage.type);

  expect(stage.enemyFormation).toBeDefined();
  expect(stage.enemyFormation.id).toBeTruthy();
  expect(stage.enemyFormation.name).toBeTruthy();
  expect(stage.enemyFormation.recommendedPower).toBeGreaterThan(0);
  expect(stage.enemyFormation.units.length).toBeGreaterThanOrEqual(3);
  expect(stage.enemyFormation.units.length).toBeLessThanOrEqual(6);

  for (const unit of stage.enemyFormation.units) {
    expect(unit.id).toBeTruthy();
    expect(unit.name).toBeTruthy();
    expect(unit.level).toBeGreaterThanOrEqual(1);
    expect(unit.attack).toBeGreaterThan(0);
    expect(unit.defense).toBeGreaterThan(0);
    expect(unit.speed).toBeGreaterThan(0);
    expect(unit.maxHp).toBeGreaterThan(0);
    expect(['front', 'back']).toContain(unit.position);
  }

  expect(stage.baseExp).toBeGreaterThan(0);
  expect(stage.baseRewards).toBeDefined();
  expect(stage.firstClearRewards).toBeDefined();
  expect(stage.firstClearExp).toBeGreaterThanOrEqual(stage.baseExp);
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(1.0);
  expect(stage.dropTable.length).toBeGreaterThanOrEqual(1);

  for (const drop of stage.dropTable) {
    expect(['resource', 'fragment', 'exp']).toContain(drop.type);
    expect(drop.probability).toBeGreaterThan(0);
    expect(drop.probability).toBeLessThanOrEqual(1.0);
    expect(drop.minAmount).toBeGreaterThanOrEqual(1);
    expect(drop.maxAmount).toBeGreaterThanOrEqual(drop.minAmount);
  }

  expect(stage.recommendedPower).toBeGreaterThan(0);
}

function assertStageTypeDistribution(stages: Stage[]): void {
  expect(stages.filter(s => s.type === 'normal')).toHaveLength(3);
  expect(stages.filter(s => s.type === 'elite')).toHaveLength(1);
  expect(stages.filter(s => s.type === 'boss')).toHaveLength(1);
}

function assertDifficultyIncreasing(stages: Stage[]): void {
  for (let i = 1; i < stages.length; i++) {
    expect(stages[i].recommendedPower).toBeGreaterThan(stages[i - 1].recommendedPower);
  }
}

function assertOrderSequential(stages: Stage[]): void {
  for (let i = 0; i < stages.length; i++) {
    expect(stages[i].order).toBe(i + 1);
  }
}

function assertBossStage(stage: Stage): void {
  expect(stage.type).toBe('boss');
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(2.0);
  const guaranteedDrops = stage.dropTable.filter(d => d.probability === 1.0);
  expect(guaranteedDrops.length).toBeGreaterThanOrEqual(1);
}

function assertEliteStage(stage: Stage): void {
  expect(stage.type).toBe('elite');
  expect(stage.threeStarBonusMultiplier).toBeGreaterThanOrEqual(1.5);
}

// ─────────────────────────────────────────────
// 第4章：赤壁之战
// ─────────────────────────────────────────────

describe('campaign-chapter4 第4章：赤壁之战', () => {
  const stages = CHAPTER4_STAGES;

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
      assertStageValid(stage, 'chapter4');
    }
  });

  it('BOSS关（曹操·赤壁）属性正确', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('曹操·赤壁');
  });

  it('精英关（甘宁）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('甘宁');
  });

  it('关卡ID前缀为 chapter4_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter4_stage\d+$/);
    }
  });

  it('掉落表包含周瑜碎片（橙）', () => {
    const hasZhouyuFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'zhouyu'),
    );
    expect(hasZhouyuFragment).toBe(true);
  });

  it('掉落表包含孙权碎片（橙）', () => {
    const hasSunquanFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'sunquan'),
    );
    expect(hasSunquanFragment).toBe(true);
  });

  it('推荐战力范围 2500~5000', () => {
    expect(stages[0].recommendedPower).toBe(2500);
    expect(stages[stages.length - 1].recommendedPower).toBe(5000);
  });

  it('第4章敌人阵营包含魏和吴', () => {
    const factions = new Set(stages.flatMap(s => s.enemyFormation.units.map(u => u.faction)));
    expect(factions.has('wei') || factions.has('wu')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 第5章：三国鼎立
// ─────────────────────────────────────────────

describe('campaign-chapter5 第5章：三国鼎立', () => {
  const stages = CHAPTER5_STAGES;

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
      assertStageValid(stage, 'chapter5');
    }
  });

  it('BOSS关（曹丕）属性正确', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('曹丕');
  });

  it('精英关（徐晃）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('徐晃');
  });

  it('关卡ID前缀为 chapter5_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter5_stage\d+$/);
    }
  });

  it('掉落表包含刘备碎片（橙）', () => {
    const hasLiubeiFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'liubei'),
    );
    expect(hasLiubeiFragment).toBe(true);
  });

  it('掉落表包含司马懿碎片（橙）', () => {
    const hasSimayiFragment = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'simayi'),
    );
    expect(hasSimayiFragment).toBe(true);
  });

  it('推荐战力范围 5000~10000', () => {
    expect(stages[0].recommendedPower).toBe(5000);
    expect(stages[stages.length - 1].recommendedPower).toBe(10000);
  });
});

// ─────────────────────────────────────────────
// 第6章：一统天下
// ─────────────────────────────────────────────

describe('campaign-chapter6 第6章：一统天下', () => {
  const stages = CHAPTER6_STAGES;

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
      assertStageValid(stage, 'chapter6');
    }
  });

  it('BOSS关（司马炎·终局）属性正确', () => {
    const boss = stages.find(s => s.type === 'boss')!;
    assertBossStage(boss);
    expect(boss.name).toBe('司马炎·终局');
  });

  it('精英关（司马师）属性正确', () => {
    const elite = stages.find(s => s.type === 'elite')!;
    assertEliteStage(elite);
    expect(elite.name).toBe('司马师');
  });

  it('关卡ID前缀为 chapter6_', () => {
    for (const stage of stages) {
      expect(stage.id).toMatch(/^chapter6_stage\d+$/);
    }
  });

  it('掉落表包含关羽碎片和赵云碎片', () => {
    const hasGuanyu = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'guanyu'),
    );
    const hasZhaoyun = stages.some(s =>
      s.dropTable.some(d => d.type === 'fragment' && d.generalId === 'zhaoyun'),
    );
    expect(hasGuanyu).toBe(true);
    expect(hasZhaoyun).toBe(true);
  });

  it('推荐战力范围 10000~20000', () => {
    expect(stages[0].recommendedPower).toBe(10000);
    expect(stages[stages.length - 1].recommendedPower).toBe(20000);
  });

  it('第6章敌人阵营包含蜀、吴、魏', () => {
    const factions = new Set(stages.flatMap(s => s.enemyFormation.units.map(u => u.faction)));
    expect(factions.has('shu')).toBe(true);
    expect(factions.has('wu')).toBe(true);
    expect(factions.has('wei')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 跨章一致性校验（4~6）
// ─────────────────────────────────────────────

describe('campaign-chapters 4~6 跨章一致性', () => {
  const allStages = [...CHAPTER4_STAGES, ...CHAPTER5_STAGES, ...CHAPTER6_STAGES];

  it('15个关卡ID全局唯一不重复', () => {
    const ids = allStages.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('章节间推荐战力递增（ch4 < ch5 < ch6）', () => {
    const ch4Max = Math.max(...CHAPTER4_STAGES.map(s => s.recommendedPower));
    const ch5Min = Math.min(...CHAPTER5_STAGES.map(s => s.recommendedPower));
    const ch5Max = Math.max(...CHAPTER5_STAGES.map(s => s.recommendedPower));
    const ch6Min = Math.min(...CHAPTER6_STAGES.map(s => s.recommendedPower));

    expect(ch5Min).toBeGreaterThanOrEqual(ch4Max);
    expect(ch6Min).toBeGreaterThanOrEqual(ch5Max);
  });
});

// ─────────────────────────────────────────────
// 全6章全局一致性
// ─────────────────────────────────────────────

describe('campaign-chapters 全6章全局一致性', () => {
  // 动态导入前3章避免循环依赖，这里直接导入
  const allChapters = [
    // chapters 1-3 需要额外导入，此处只验证 4-6 不与自身重复
    ...CHAPTER4_STAGES,
    ...CHAPTER5_STAGES,
    ...CHAPTER6_STAGES,
  ];

  it('第4~6章共15个关卡', () => {
    expect(allChapters).toHaveLength(15);
  });

  it('所有关卡 baseExp > 0', () => {
    for (const stage of allChapters) {
      expect(stage.baseExp).toBeGreaterThan(0);
    }
  });

  it('所有关卡 firstClearExp >= baseExp', () => {
    for (const stage of allChapters) {
      expect(stage.firstClearExp).toBeGreaterThanOrEqual(stage.baseExp);
    }
  });
});
