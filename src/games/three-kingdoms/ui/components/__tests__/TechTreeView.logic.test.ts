/**
 * TechTreeView 逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 TechTreeLogic 的核心逻辑：
 * - 路线切换与节点分组
 * - 节点状态查询
 * - 路线进度计算
 * - 互斥分支检测
 * - 前置依赖描述
 * - 效果描述
 */

import { TechTreeLogic } from '../tech/TechTreeView';
import type {
  TechNodeDef,
  TechNodeState,
  TechEdge,
} from '../../../../engine/tech/tech.types';

// ─────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────

function createTestNodeDefs(): TechNodeDef[] {
  return [
    {
      id: 'mil_1', name: '铁甲', description: '增加防御', path: 'military',
      tier: 1, prerequisites: [], mutexGroup: '', costPoints: 10, researchTime: 30,
      effects: [{ type: 'troop_defense', target: 'all', value: 10 }], icon: '🛡️',
    },
    {
      id: 'mil_2a', name: '骑兵强化', description: '骑兵攻击+15%', path: 'military',
      tier: 2, prerequisites: ['mil_1'], mutexGroup: 'mil_t2', costPoints: 20, researchTime: 60,
      effects: [{ type: 'troop_attack', target: 'cavalry', value: 15 }], icon: '🐎',
    },
    {
      id: 'mil_2b', name: '步兵强化', description: '步兵攻击+15%', path: 'military',
      tier: 2, prerequisites: ['mil_1'], mutexGroup: 'mil_t2', costPoints: 20, researchTime: 60,
      effects: [{ type: 'troop_attack', target: 'infantry', value: 15 }], icon: '⚔️',
    },
    {
      id: 'eco_1', name: '丰收', description: '粮草产出+10%', path: 'economy',
      tier: 1, prerequisites: [], mutexGroup: '', costPoints: 10, researchTime: 30,
      effects: [{ type: 'resource_production', target: 'grain', value: 10 }], icon: '🌾',
    },
    {
      id: 'cul_1', name: '经学', description: '研究速度+10%', path: 'culture',
      tier: 1, prerequisites: [], mutexGroup: '', costPoints: 10, researchTime: 30,
      effects: [{ type: 'research_speed', target: 'all', value: 10 }], icon: '📜',
    },
  ];
}

function createTestNodeStates(): Record<string, TechNodeState> {
  return {
    mil_1: { id: 'mil_1', status: 'completed', researchStartTime: null, researchEndTime: null },
    mil_2a: { id: 'mil_2a', status: 'available', researchStartTime: null, researchEndTime: null },
    mil_2b: { id: 'mil_2b', status: 'locked', researchStartTime: null, researchEndTime: null },
    eco_1: { id: 'eco_1', status: 'available', researchStartTime: null, researchEndTime: null },
    cul_1: { id: 'cul_1', status: 'locked', researchStartTime: null, researchEndTime: null },
  };
}

function createTestEdges(): TechEdge[] {
  return [
    { from: 'mil_1', to: 'mil_2a', type: 'prerequisite' },
    { from: 'mil_1', to: 'mil_2b', type: 'prerequisite' },
    { from: 'mil_2a', to: 'mil_2b', type: 'mutex' },
  ];
}

function createLogic(): TechTreeLogic {
  return new TechTreeLogic(
    createTestNodeStates(),
    createTestNodeDefs(),
    createTestEdges(),
    { mil_t2: 'mil_2a' }, // 已选择 mil_2a
  );
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('TechTreeLogic — 路线切换', () => {
  it('默认选中军事路线', () => {
    const logic = createLogic();
    expect(logic.getViewState().selectedPath).toBe('military');
  });

  it('切换到经济路线', () => {
    const logic = createLogic();
    const result = logic.selectPath('economy');
    expect(result).toBe('economy');
    expect(logic.getViewState().selectedPath).toBe('economy');
  });

  it('切换路线后清空选中节点', () => {
    const logic = createLogic();
    logic.selectNode('mil_1');
    expect(logic.getViewState().selectedNodeId).toBe('mil_1');
    logic.selectPath('economy');
    expect(logic.getViewState().selectedNodeId).toBeNull();
  });
});

describe('TechTreeLogic — 节点分组', () => {
  it('军事路线按层级分组', () => {
    const logic = createLogic();
    const grouped = logic.getPathNodesGrouped('military');
    expect(grouped.size).toBe(2);
    expect(grouped.get(1)?.length).toBe(1); // mil_1
    expect(grouped.get(2)?.length).toBe(2); // mil_2a, mil_2b
  });

  it('经济路线有1个节点', () => {
    const logic = createLogic();
    const grouped = logic.getPathNodesGrouped('economy');
    expect(grouped.size).toBe(1);
    expect(grouped.get(1)?.length).toBe(1);
  });

  it('文化路线有1个节点', () => {
    const logic = createLogic();
    const grouped = logic.getPathNodesGrouped('culture');
    expect(grouped.size).toBe(1);
  });
});

describe('TechTreeLogic — 节点状态', () => {
  it('获取已完成节点状态', () => {
    const logic = createLogic();
    expect(logic.getNodeStatus('mil_1')).toBe('completed');
  });

  it('获取可研究节点状态', () => {
    const logic = createLogic();
    expect(logic.getNodeStatus('mil_2a')).toBe('available');
  });

  it('获取锁定节点状态', () => {
    const logic = createLogic();
    expect(logic.getNodeStatus('cul_1')).toBe('locked');
  });

  it('不存在节点返回 locked', () => {
    const logic = createLogic();
    expect(logic.getNodeStatus('nonexistent')).toBe('locked');
  });
});

describe('TechTreeLogic — 路线进度', () => {
  it('军事路线进度: 1完成/3总数', () => {
    const logic = createLogic();
    const progress = logic.getPathProgress('military');
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.percent).toBe(33);
  });

  it('经济路线进度: 0完成/1总数', () => {
    const logic = createLogic();
    const progress = logic.getPathProgress('economy');
    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(1);
    expect(progress.percent).toBe(0);
  });

  it('获取所有路线进度', () => {
    const logic = createLogic();
    const all = logic.getAllPathProgress();
    expect(all.military).toBeDefined();
    expect(all.economy).toBeDefined();
    expect(all.culture).toBeDefined();
  });
});

describe('TechTreeLogic — 互斥分支', () => {
  it('mil_2a 未被互斥锁定（已选择）', () => {
    const logic = createLogic();
    expect(logic.isMutexLocked('mil_2a')).toBe(false);
  });

  it('mil_2b 被互斥锁定', () => {
    const logic = createLogic();
    expect(logic.isMutexLocked('mil_2b')).toBe(true);
  });

  it('无互斥组的节点不被锁定', () => {
    const logic = createLogic();
    expect(logic.isMutexLocked('mil_1')).toBe(false);
  });

  it('获取互斥替代节点', () => {
    const logic = createLogic();
    const alternatives = logic.getMutexAlternatives('mil_2a');
    expect(alternatives).toContain('mil_2b');
    expect(alternatives.length).toBe(1);
  });
});

describe('TechTreeLogic — 节点选择', () => {
  it('选择节点后可以获取信息', () => {
    const logic = createLogic();
    logic.selectNode('mil_1');
    const info = logic.getSelectedNodeInfo();
    expect(info).not.toBeNull();
    expect(info!.def.id).toBe('mil_1');
    expect(info!.state.status).toBe('completed');
  });

  it('关闭详情后信息为空', () => {
    const logic = createLogic();
    logic.selectNode('mil_1');
    logic.closeDetail();
    expect(logic.getSelectedNodeInfo()).toBeNull();
  });
});

describe('TechTreeLogic — 前置依赖描述', () => {
  it('mil_2a 依赖 mil_1（已完成）', () => {
    const logic = createLogic();
    const desc = logic.getPrerequisiteDesc('mil_2a');
    expect(desc.length).toBe(1);
    expect(desc[0]).toContain('✅');
    expect(desc[0]).toContain('铁甲');
  });

  it('无前置依赖的节点返回空数组', () => {
    const logic = createLogic();
    const desc = logic.getPrerequisiteDesc('mil_1');
    expect(desc).toEqual([]);
  });
});

describe('TechTreeLogic — 效果描述', () => {
  it('获取节点效果描述', () => {
    const logic = createLogic();
    const desc = logic.getEffectDesc('mil_1');
    expect(desc.length).toBe(1);
    expect(desc[0]).toContain('troop_defense');
    expect(desc[0]).toContain('+10%');
  });

  it('不存在节点返回空数组', () => {
    const logic = createLogic();
    const desc = logic.getEffectDesc('nonexistent');
    expect(desc).toEqual([]);
  });
});

describe('TechTreeLogic — 研究检查', () => {
  it('可研究 available 节点', () => {
    const logic = createLogic();
    expect(logic.canResearchNode('mil_2a')).toBe(true);
  });

  it('不可研究 completed 节点', () => {
    const logic = createLogic();
    expect(logic.canResearchNode('mil_1')).toBe(false);
  });

  it('不可研究 locked 节点', () => {
    const logic = createLogic();
    expect(logic.canResearchNode('cul_1')).toBe(false);
  });
});
