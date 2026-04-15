/**
 * NPC 活动系统 & 交互系统测试
 *
 * 验证职业活动循环、资源生产/消耗、NPC 交互和对话生成。
 *
 * @module games/three-kingdoms/__tests__/NPCActivitySystem.test
 */

import { describe, it, expect } from 'vitest';
import { NPCActivitySystem } from '../NPCActivitySystem';
import { NPCInteractionSystem } from '../NPCInteractionSystem';

// ===========================================================================
// NPC 职业活动系统测试
// ===========================================================================

describe('NPCActivitySystem', () => {
  // ── 1. 职业循环初始化 ──────────────────────────────

  it('应初始化 5 种职业循环', () => {
    const system = new NPCActivitySystem();
    const professions = system.getProfessions();
    expect(professions).toContain('farmer');
    expect(professions).toContain('soldier');
    expect(professions).toContain('merchant');
    expect(professions).toContain('scholar');
    expect(professions).toContain('scout');
    expect(professions.length).toBe(5);
  });

  it('每种职业循环应有 5 个步骤', () => {
    const system = new NPCActivitySystem();
    for (const prof of system.getProfessions()) {
      const cycle = system.getCycle(prof);
      expect(cycle).toBeDefined();
      expect(cycle!.steps.length).toBe(5);
    }
  });

  // ── 2. 农民活动循环（5步完整循环） ────────────────

  it('农民应完成完整的 5 步活动循环', () => {
    const system = new NPCActivitySystem();
    const npcId = 'farmer_wang';
    const steps = [
      { name: '起床准备农具', duration: 30 },
      { name: '耕种田地', duration: 60 },
      { name: '吃午饭', duration: 30 },
      { name: '收割庄稼', duration: 60 },
      { name: '回家休息', duration: 30 },
    ];

    for (let i = 0; i < steps.length; i++) {
      const result = system.updateNPC(npcId, 'farmer', steps[i].duration);
      expect(result.activity).toBe(steps[(i + 1) % steps.length].name);
    }

    // 应该已经循环回第一步
    const state = system.getNPCState(npcId);
    expect(state).toBeDefined();
    expect(state!.totalCycles).toBe(1);
  });

  // ── 3. 士兵巡逻循环 ───────────────────────────────

  it('士兵应按顺序执行巡逻循环', () => {
    const system = new NPCActivitySystem();
    const npcId = 'soldier_zhao';

    // 步骤 0: 集合点名 (15分钟)
    let result = system.updateNPC(npcId, 'soldier', 15);
    expect(result.activity).toBe('巡逻路线A — 检查城门');
    expect(result.stateChanged).toBe(true);

    // 步骤 1: 巡逻路线A (30分钟)
    result = system.updateNPC(npcId, 'soldier', 30);
    expect(result.activity).toBe('操练演武');

    // 步骤 2: 操练演武 (45分钟)
    result = system.updateNPC(npcId, 'soldier', 45);
    expect(result.activity).toBe('换岗休息');

    // 步骤 3: 换岗休息 (30分钟)
    result = system.updateNPC(npcId, 'soldier', 30);
    expect(result.activity).toBe('巡逻路线B — 检查城墙');

    // 步骤 4: 巡逻路线B (30分钟) — 完成后循环
    result = system.updateNPC(npcId, 'soldier', 30);
    expect(result.activity).toBe('集合点名'); // 循环回第一步
  });

  // ── 4. 商人交易循环 ───────────────────────────────

  it('商人应执行交易循环并产出铜钱', () => {
    const system = new NPCActivitySystem();
    const npcId = 'merchant_chen';

    // 步骤 0: 开店摆摊 (15分钟) — 无产出
    let result = system.updateNPC(npcId, 'merchant', 15);
    expect(result.produced).toBeUndefined();

    // 步骤 1: 叫卖等待顾客 (45分钟) — 产出铜钱+10
    result = system.updateNPC(npcId, 'merchant', 45);
    expect(result.produced).toEqual({ type: 'coins', amount: 10 });

    // 步骤 2: 与顾客交易 (30分钟) — 产出铜钱+15
    result = system.updateNPC(npcId, 'merchant', 30);
    expect(result.produced).toEqual({ type: 'coins', amount: 15 });

    // 步骤 3: 收摊盘点 (15分钟) — 无产出
    result = system.updateNPC(npcId, 'merchant', 15);
    expect(result.produced).toBeUndefined();

    // 步骤 4: 休息吃饭 (30分钟) — 消耗铜钱-5
    result = system.updateNPC(npcId, 'merchant', 30);
    expect(result.consumed).toEqual({ type: 'coins', amount: 5 });
  });

  // ── 5. 资源生产验证 ───────────────────────────────

  it('农民耕种和收割应产出粮草', () => {
    const system = new NPCActivitySystem();
    const npcId = 'farmer_test';

    // 步骤 0: 起床 (30分钟) → 进入耕种
    system.updateNPC(npcId, 'farmer', 30);

    // 步骤 1: 耕种 (60分钟) → 产出粮草+5
    const result1 = system.updateNPC(npcId, 'farmer', 60);
    expect(result1.produced).toEqual({ type: 'grain', amount: 5 });

    // 步骤 2: 吃饭 (30分钟) → 消耗粮草-1
    const result2 = system.updateNPC(npcId, 'farmer', 30);
    expect(result2.consumed).toEqual({ type: 'grain', amount: 1 });

    // 步骤 3: 收割 (60分钟) → 产出粮草+8
    const result3 = system.updateNPC(npcId, 'farmer', 60);
    expect(result3.produced).toEqual({ type: 'grain', amount: 8 });
  });

  // ── 6. 资源消耗验证 ───────────────────────────────

  it('学者循环不应消耗资源', () => {
    const system = new NPCActivitySystem();
    const npcId = 'scholar_test';

    // 完成一整轮学者循环
    const durations = [45, 30, 45, 30, 30];
    for (const dur of durations) {
      const result = system.updateNPC(npcId, 'scholar', dur);
      // 学者不消耗资源
      expect(result.consumed).toBeUndefined();
    }
  });

  // ── 9. 序列化/反序列化 ────────────────────────────

  it('应能序列化和反序列化系统状态', () => {
    const system = new NPCActivitySystem();

    // 推进一些 NPC 状态
    system.updateNPC('npc_a', 'farmer', 30);
    system.updateNPC('npc_b', 'soldier', 15);

    const serialized = system.serialize();
    expect(serialized).toBeDefined();

    // 创建新系统并恢复
    const system2 = new NPCActivitySystem();
    system2.deserialize(serialized as Record<string, unknown>);

    // 验证恢复后的状态
    const stateA = system2.getNPCState('npc_a');
    expect(stateA).toBeDefined();
    expect(stateA!.currentStep).toBe(1); // 农民从步骤0进入步骤1

    const stateB = system2.getNPCState('npc_b');
    expect(stateB).toBeDefined();
    expect(stateB!.currentStep).toBe(1); // 士兵从步骤0进入步骤1
  });
});

// ===========================================================================
// NPC 交互系统测试
// ===========================================================================

describe('NPCInteractionSystem', () => {
  // ── 7. NPC交互系统（农民购买粮草） ────────────────

  it('农民应提供购买粮草交互', () => {
    const system = new NPCInteractionSystem();
    const interactions = system.getInteractions('farmer_wang', 'farmer', 'farming', { coins: 100 });

    // 应至少有 3 种交互
    expect(interactions.length).toBeGreaterThanOrEqual(3);

    // 找到购买粮草交互
    const tradeInteraction = interactions.find(i => i.title === '购买粮草');
    expect(tradeInteraction).toBeDefined();
    expect(tradeInteraction!.type).toBe('trade');
    expect(tradeInteraction!.options.length).toBeGreaterThanOrEqual(1);
  });

  it('执行农民购买粮草交互应返回正确结果', () => {
    const system = new NPCInteractionSystem();
    system.getInteractions('farmer_wang', 'farmer', 'farming', { coins: 100 });

    const result = system.executeInteraction('farmer_wang', 0, 0);
    expect(result.result).toBeTruthy();
    expect(result.reward).toBeDefined();
    expect(result.reward!.grain).toBeGreaterThan(0);
    expect(result.penalty).toBeDefined();
    expect(result.penalty!.coins).toBeGreaterThan(0);
    expect(result.dialogueResponse).toBeTruthy();
  });

  // ── 8. NPC间对话生成 ─────────────────────────────

  it('应能生成农民与士兵的对话', () => {
    const system = new NPCInteractionSystem();
    const chat = system.generateNPCChat(
      { name: '农夫老王', profession: 'farmer' },
      { name: '士兵赵勇', profession: 'soldier' },
    );

    expect(chat.topic).toBeTruthy();
    expect(chat.dialogue.length).toBe(4);
    expect(chat.dialogue[0].speaker).toBe('农夫老王');
    expect(chat.dialogue[1].speaker).toBe('士兵赵勇');
    expect(chat.dialogue[0].text).toBeTruthy();
  });

  it('应能生成同职业NPC之间的对话', () => {
    const system = new NPCInteractionSystem();

    // 两个农民
    const farmerChat = system.generateNPCChat(
      { name: '农夫老王', profession: 'farmer' },
      { name: '农夫老李', profession: 'farmer' },
    );
    expect(farmerChat.topic).toBeTruthy();
    expect(farmerChat.dialogue.length).toBe(4);

    // 两个学者
    const scholarChat = system.generateNPCChat(
      { name: '书生孔明远', profession: 'scholar' },
      { name: '书生刘博学', profession: 'scholar' },
    );
    expect(scholarChat.dialogue.length).toBe(4);
  });

  it('无匹配模板时应返回通用对话', () => {
    const system = new NPCInteractionSystem();
    const chat = system.generateNPCChat(
      { name: '村民甲', profession: 'villager' },
      { name: '工匠乙', profession: 'craftsman' },
    );

    expect(chat.topic).toBe('日常闲聊');
    expect(chat.dialogue.length).toBe(4);
  });

  it('每种职业都应生成交互选项', () => {
    const system = new NPCInteractionSystem();
    const professions = ['farmer', 'soldier', 'merchant', 'scholar', 'scout'];

    for (const prof of professions) {
      const interactions = system.getInteractions(`${prof}_test`, prof, 'idle', { coins: 200 });
      expect(interactions.length).toBeGreaterThanOrEqual(2);
    }
  });
});
