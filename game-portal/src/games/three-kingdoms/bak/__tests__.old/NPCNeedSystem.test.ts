/**
 * NPC 需求驱动行为系统测试
 *
 * 验证需求初始化、衰减、决策逻辑、动作效果、中断判断及序列化。
 *
 * @module games/three-kingdoms/__tests__/NPCNeedSystem.test
 */

import { describe, it, expect } from 'vitest';
import { NPCNeedSystem } from '../NPCNeedSystem';

describe('NPCNeedSystem', () => {
  // ── 1. 初始化 5 种职业需求 ────────────────────────

  it('应初始化 5 种职业的需求和衰减速率', () => {
    const sys = new NPCNeedSystem();
    const professions = ['farmer', 'soldier', 'merchant', 'scholar', 'scout'];
    for (const prof of professions) {
      sys.initNeeds(`npc_${prof}`, prof);
      const needs = sys.getNeeds(`npc_${prof}`);
      expect(needs.hunger).toBe(30);
      expect(needs.fatigue).toBe(20);
      expect(needs.morale).toBe(70);
      expect(needs.social).toBe(30);
    }
  });

  // ── 2. 需求随时间衰减 ────────────────────────────

  it('需求应随时间正确衰减（模拟 60 秒 = 1 分钟）', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc1', 'farmer');
    const before = sys.getNeeds('npc1');
    const after = sys.updateNeeds('npc1', 60); // 60秒 = 1分钟
    // farmer 衰减: hunger+0.5, fatigue+0.3, morale-0.1, social+0.2
    expect(after.hunger).toBeCloseTo(before.hunger + 0.5, 4);
    expect(after.fatigue).toBeCloseTo(before.fatigue + 0.3, 4);
    expect(after.morale).toBeCloseTo(before.morale - 0.1, 4);
    expect(after.social).toBeCloseTo(before.social + 0.2, 4);
  });

  // ── 3. 饥饿高时决定吃饭 ──────────────────────────

  it('饥饿值 >80 时应决定吃饭', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc2', 'soldier');
    sys.setNeeds('npc2', { hunger: 85, fatigue: 20, morale: 70, social: 30 });
    const decision = sys.decideAction('npc2', 'soldier');
    expect(decision.action).toBe('eat');
    expect(decision.reason).toContain('饿');
  });

  // ── 4. 疲劳高时决定休息 ──────────────────────────

  it('疲劳值 >80 时应决定休息', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc3', 'farmer');
    sys.setNeeds('npc3', { hunger: 30, fatigue: 90, morale: 70, social: 30 });
    const decision = sys.decideAction('npc3', 'farmer');
    expect(decision.action).toBe('rest');
    expect(decision.reason).toContain('累');
  });

  // ── 5. 士气低时决定社交 ──────────────────────────

  it('士气 <20 时应决定社交', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc4', 'merchant');
    sys.setNeeds('npc4', { hunger: 30, fatigue: 20, morale: 15, social: 30 });
    const decision = sys.decideAction('npc4', 'merchant');
    expect(decision.action).toBe('socialize');
    expect(decision.reason).toContain('士气');
  });

  // ── 6. 执行动作后需求变化 ────────────────────────

  it('执行 eat 动作后饥饿应降低', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc5', 'farmer');
    sys.setNeeds('npc5', { hunger: 60, fatigue: 20, morale: 70, social: 30 });
    const after = sys.applyAction('npc5', 'eat');
    // eat: hunger -40
    expect(after.hunger).toBe(20);
  });

  it('执行 rest 动作后疲劳应降低', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc6', 'soldier');
    sys.setNeeds('npc6', { hunger: 30, fatigue: 70, morale: 70, social: 30 });
    const after = sys.applyAction('npc6', 'rest');
    // rest: fatigue -40
    expect(after.fatigue).toBe(30);
  });

  // ── 7. 中断判断 ──────────────────────────────────

  it('饥饿 >80 应触发中断', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc7', 'farmer');
    sys.setNeeds('npc7', { hunger: 85, fatigue: 20, morale: 70, social: 30 });
    const result = sys.shouldInterrupt('npc7');
    expect(result.interrupt).toBe(true);
    expect(result.reason).toContain('饿');
  });

  it('正常状态不应中断', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc7b', 'farmer');
    const result = sys.shouldInterrupt('npc7b');
    expect(result.interrupt).toBe(false);
  });

  // ── 8. 需求描述生成 ──────────────────────────────

  it('应生成正确的需求描述文本', () => {
    const sys = new NPCNeedSystem();
    sys.initNeeds('npc8', 'scholar');
    const desc = sys.getNeedsDescription('npc8');
    // 默认: hunger=30(饱腹), fatigue=20(精力充沛), morale=70(士气高昂)
    expect(desc).toContain('饱腹');
    expect(desc).toContain('精力充沛');
    expect(desc).toContain('士气高昂');
  });

  // ── 9. 序列化/反序列化 ───────────────────────────

  it('序列化后反序列化应恢复原始数据', () => {
    const sys1 = new NPCNeedSystem();
    sys1.initNeeds('npcA', 'farmer');
    sys1.updateNeeds('npcA', 120); // 2 分钟
    const original = sys1.getNeeds('npcA');

    const data = sys1.serialize();
    const sys2 = new NPCNeedSystem();
    sys2.deserialize(data as Record<string, unknown>);
    const restored = sys2.getNeeds('npcA');

    expect(restored.hunger).toBeCloseTo(original.hunger, 4);
    expect(restored.fatigue).toBeCloseTo(original.fatigue, 4);
    expect(restored.morale).toBeCloseTo(original.morale, 4);
    expect(restored.social).toBeCloseTo(original.social, 4);
  });
});
