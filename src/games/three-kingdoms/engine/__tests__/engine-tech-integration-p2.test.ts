import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import type { TechPath, TechState } from '../tech/tech.types';
import { TECH_PATHS } from '../tech/tech.types';

describe('前置依赖', () => {
  it('完成前置后后续节点解锁', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();

    // Tier 2 初始为 locked
    expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('locked');

    // 完成前置
    treeSys.completeNode('mil_t1_attack');

    // Tier 2 解锁
    expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');

  it('部分前置完成时节点仍为 locked', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();

    // mil_t4_dominance 需要 mil_t3_blitz
    expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(false);

    // 只完成一部分前置
    treeSys.completeNode('mil_t1_attack');
    treeSys.completeNode('mil_t2_charge');

    // 仍然不满足（需要 mil_t3_blitz）
    expect(treeSys.arePrerequisitesMet('mil_t4_dominance')).toBe(false);
  });
});

// ═══════════════════════════════════════════
// 7. 效果汇总
// ═══════════════════════════════════════════
describe('效果汇总', () => {
  it('完成节点后效果正确汇总', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();

    treeSys.completeNode('mil_t1_attack');
    const attackBonus = treeSys.getEffectValue('troop_attack', 'all');
    expect(attackBonus).toBe(10);
  });

  it('科技加成影响资源系统', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();

    // 完成有 resource_production + all 的节点
    treeSys.completeNode('eco_t1_trade');
    treeSys.completeNode('eco_t2_minting');
    treeSys.completeNode('eco_t3_marketplace');

    // 获取科技加成
    const techBonus = treeSys.getTechBonusMultiplier();
    expect(techBonus).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// 8. 序列化 / 反序列化
// ═══════════════════════════════════════════
describe('序列化/反序列化', () => {
  it('serialize 包含科技数据', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();
    treeSys.completeNode('mil_t1_attack');

    const json = engine.serialize();
    const data = JSON.parse(json);
    expect(data.tech).toBeDefined();
    expect(data.tech.completedTechIds).toContain('mil_t1_attack');
  });

  it('deserialize 恢复科技状态', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();
    treeSys.completeNode('mil_t1_attack');
    treeSys.completeNode('eco_t1_farming');

    const json = engine.serialize();

    const newEngine = new ThreeKingdomsEngine();
    newEngine.deserialize(json);

    const newTreeSys = newEngine.getTechTreeSystem();
    expect(newTreeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    expect(newTreeSys.getNodeState('eco_t1_farming')?.status).toBe('completed');
    expect(newTreeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');

    newEngine.destroy();
  });

  it('旧存档兼容（无科技数据）', () => {
    engine.init();

    // 模拟旧存档（无 tech 字段）
    const oldSaveData = {
      version: 4,
      saveTime: Date.now(),
      resource: engine.resource.serialize(),
      building: engine.building.serialize(),
    };

    const json = JSON.stringify(oldSaveData);

    const newEngine = new ThreeKingdomsEngine();
    expect(() => newEngine.deserialize(json)).not.toThrow();

    // 科技系统应为空初始状态
    const treeSys = newEngine.getTechTreeSystem();
    for (const path of TECH_PATHS) {
      const progress = treeSys.getPathProgress(path);
      expect(progress.completed).toBe(0);
    }

    newEngine.destroy();
  });

  it('科技点序列化/反序列化', () => {
    engine.init();
    const pointSys = engine.getTechPointSystem();
    pointSys.syncAcademyLevel(10);
    pointSys.update(100);

    const pointsBefore = pointSys.getCurrentPoints();
    const json = engine.serialize();

    const newEngine = new ThreeKingdomsEngine();
    newEngine.deserialize(json);

    const newPointSys = newEngine.getTechPointSystem();
    expect(newPointSys.getCurrentPoints()).toBeCloseTo(pointsBefore);

    newEngine.destroy();
  });
});

// ═══════════════════════════════════════════
// 9. reset
// ═══════════════════════════════════════════
describe('reset', () => {
  it('reset 清理科技系统', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();
    const pointSys = engine.getTechPointSystem();

    treeSys.completeNode('mil_t1_attack');
    pointSys.syncAcademyLevel(10);
    pointSys.update(100);

    engine.reset();

    // 重新初始化
    engine.init();

    const newTreeSys = engine.getTechTreeSystem();
    const newPointSys = engine.getTechPointSystem();

    // 科技树重置
    expect(newTreeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
    expect(newTreeSys.getPathProgress('military').completed).toBe(0);

    // 科技点重置
    expect(newPointSys.getCurrentPoints()).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 10. 加速机制
// ═══════════════════════════════════════════
describe('加速机制', () => {
  it('speedUpTechResearch API 可用', () => {
    engine.init();
    const pointSys = engine.getTechPointSystem();
    pointSys.syncAcademyLevel(20);
    for (let i = 0; i < 100; i++) {
      pointSys.update(10);
    }

    engine.startTechResearch('mil_t1_attack');

    // 加速（天命不足会失败，但 API 可调用）
    const result = engine.speedUpTechResearch('mil_t1_attack', 'mandate', 1);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });
});

// ═══════════════════════════════════════════
// 11. 研究队列规则
// ═══════════════════════════════════════════
describe('研究队列规则', () => {
  it('初始队列大小为 1', () => {
    engine.init();
    const researchSys = engine.getTechResearchSystem();
    // 书院等级 0 → 队列大小 1
    expect(researchSys.getMaxQueueSize()).toBe(1);
  });

  it('队列满时无法开始新研究', () => {
    engine.init();
    const pointSys = engine.getTechPointSystem();
    pointSys.syncAcademyLevel(20);
    for (let i = 0; i < 200; i++) {
      pointSys.update(10);
    }

    // 开始第一个研究
    const result1 = engine.startTechResearch('mil_t1_attack');
    expect(result1.success).toBe(true);

    // 队列已满，第二个应失败
    const result2 = engine.startTechResearch('eco_t1_farming');
    expect(result2.success).toBe(false);
    expect(result2.reason).toContain('已满');
  });
});

// ═══════════════════════════════════════════
// 12. 路线进度
// ═══════════════════════════════════════════
describe('路线进度', () => {
  it('初始进度全为 0', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();
    const allProgress = treeSys.getAllPathProgress();
    for (const path of TECH_PATHS) {
      expect(allProgress[path].completed).toBe(0);
      expect(allProgress[path].total).toBe(8);
    }
  });

  it('完成节点后进度增加', () => {
    engine.init();
    const treeSys = engine.getTechTreeSystem();
    treeSys.completeNode('mil_t1_attack');
    const progress = treeSys.getPathProgress('military');
    expect(progress.completed).toBe(1);
  });
});
});
