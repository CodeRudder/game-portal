import { describe, it, expect } from 'vitest';
import { StageSystem, type StageDef } from '../../../../src/engines/idle/modules/StageSystem';

// ============================================================
// 测试用阶段定义
// ============================================================

const stageDefs: StageDef[] = [
  {
    id: 'stage_1',
    name: '初始森林',
    description: '新手起步阶段',
    order: 1,
    prerequisiteStageId: null,
    requiredResources: {},
    requiredConditions: [],
    rewards: [],
    productionMultiplier: 1.0,
    combatMultiplier: 1.0,
    iconAsset: '/icons/forest.png',
    themeColor: '#4CAF50',
  },
  {
    id: 'stage_2',
    name: '黑暗洞穴',
    description: '深入地下的神秘洞穴',
    order: 2,
    prerequisiteStageId: 'stage_1',
    requiredResources: { gold: 500 },
    requiredConditions: [{ type: 'level', targetId: 'player', minValue: 5 }],
    rewards: [{ type: 'multiplier', targetId: 'production', value: 1.5 }],
    productionMultiplier: 1.5,
    combatMultiplier: 1.2,
    iconAsset: '/icons/cave.png',
    themeColor: '#607D8B',
  },
  {
    id: 'stage_3',
    name: '龙之山脉',
    description: '传说中的龙栖息之地',
    order: 3,
    prerequisiteStageId: 'stage_2',
    requiredResources: { gold: 5000 },
    requiredConditions: [{ type: 'level', targetId: 'player', minValue: 20 }],
    rewards: [],
    productionMultiplier: 2.0,
    combatMultiplier: 1.8,
    iconAsset: '/icons/mountain.png',
    themeColor: '#F44336',
  },
];

function createSystem(): StageSystem {
  return new StageSystem(stageDefs, 'stage_1');
}

// ============================================================
// loadState 数据校验测试
// ============================================================

describe('StageSystem — loadState 数据校验', () => {
  it('合法的 currentStageId 应正确恢复', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: 'stage_2' });
    expect(sys.getCurrentId()).toBe('stage_2');
  });

  it('恢复阶段时应自动解锁中间阶段', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: 'stage_3' });
    expect(sys.getCurrentId()).toBe('stage_3');
    const stages = sys.getAllStages();
    expect(stages.find((s) => s.id === 'stage_1')!.isUnlocked).toBe(true);
    expect(stages.find((s) => s.id === 'stage_2')!.isUnlocked).toBe(true);
    expect(stages.find((s) => s.id === 'stage_3')!.isUnlocked).toBe(true);
  });

  it('空字符串 currentStageId 应被忽略，保持当前阶段', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: '' });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('未注册的 currentStageId 应被忽略', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: 'non_existent_stage' });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('null 作为 currentStageId 应被忽略', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currentStageId: null });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('undefined 作为 currentStageId 应被忽略', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currentStageId: undefined });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('数字作为 currentStageId 应被忽略', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currentStageId: 123 });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('对象作为 currentStageId 应被忽略', () => {
    const sys = createSystem();
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currentStageId: { id: 'stage_2' } });
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('合法恢复后再加载非法值应保留之前合法状态', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: 'stage_2' });
    expect(sys.getCurrentId()).toBe('stage_2');
    // 加载非法值
    // @ts-expect-error 故意传入错误类型
    sys.loadState({ currentStageId: null });
    expect(sys.getCurrentId()).toBe('stage_2');
  });

  it('只有空白字符的 currentStageId 应被忽略', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: '   ' });
    expect(sys.getCurrentId()).toBe('stage_1');
  });
});

// ============================================================
// 基本功能回归测试
// ============================================================

describe('StageSystem — 基本功能回归', () => {
  it('初始阶段正确', () => {
    const sys = createSystem();
    expect(sys.getCurrentId()).toBe('stage_1');
    expect(sys.getCurrent().name).toBe('初始森林');
  });

  it('saveState 返回当前阶段 ID', () => {
    const sys = createSystem();
    expect(sys.saveState()).toEqual({ currentStageId: 'stage_1' });
  });

  it('reset 恢复初始阶段', () => {
    const sys = createSystem();
    sys.loadState({ currentStageId: 'stage_3' });
    sys.reset();
    expect(sys.getCurrentId()).toBe('stage_1');
  });

  it('advance 成功推进', () => {
    const sys = createSystem();
    const result = sys.advance(
      { gold: 600 },
      (type, targetId) => (type === 'level' && targetId === 'player' ? 10 : 0),
    );
    expect(result.ok).toBe(true);
    expect(result.value!.id).toBe('stage_2');
  });

  it('advance 资源不足时失败', () => {
    const sys = createSystem();
    const result = sys.advance(
      { gold: 100 },
      (type, targetId) => (type === 'level' && targetId === 'player' ? 10 : 0),
    );
    expect(result.ok).toBe(false);
  });

  it('getMultiplier 返回正确倍率', () => {
    const sys = createSystem();
    expect(sys.getMultiplier('production')).toBe(1.0);
    expect(sys.getMultiplier('combat')).toBe(1.0);
  });

  it('事件监听在 advance 时触发', () => {
    const sys = createSystem();
    let received: { oldStageId: string; newStageId: string } | null = null;
    sys.onEvent((e) => {
      received = { oldStageId: e.oldStageId, newStageId: e.newStageId };
    });
    sys.advance(
      { gold: 600 },
      (type, targetId) => (type === 'level' && targetId === 'player' ? 10 : 0),
    );
    expect(received).toEqual({ oldStageId: 'stage_1', newStageId: 'stage_2' });
  });
});
