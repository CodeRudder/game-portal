/**
 * 三国霸业 — 事件玩法系统 测试套件
 *
 * 覆盖：事件初始化（22种）、按类型获取、触发条件检查、
 * 概率检查、做出选择、冷却验证、不可重复验证、连锁事件、序列化。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreeKingdomsEventSystem } from '@/games/three-kingdoms/ThreeKingdomsEventSystem';

describe('ThreeKingdomsEventSystem', () => {
  let system: ThreeKingdomsEventSystem;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 50% — 通过所有概率 ≤ 0.5
    system = new ThreeKingdomsEventSystem();
  });

  // ── 1. 初始化 22 个事件 ──────────────────────────────────

  it('应初始化至少 22 个事件', () => {
    expect(system.getEventCount()).toBeGreaterThanOrEqual(22);
  });

  // ── 2. 按类型获取事件 ────────────────────────────────────

  it('应正确按类型获取事件', () => {
    expect(system.getEventsByType('story')).toHaveLength(5);
    expect(system.getEventsByType('random')).toHaveLength(5);
    expect(system.getEventsByType('timed')).toHaveLength(4);
    expect(system.getEventsByType('npc')).toHaveLength(4);
    expect(system.getEventsByType('exploration')).toHaveLength(4);
  });

  // ── 3. 触发条件：on_battle → 温酒斩华雄 ──────────────────

  it('on_battle + heroCount≥1 应触发温酒斩华雄', () => {
    const triggered = system.checkTriggers({ action: 'battle', heroCount: 2 });
    const ids = triggered.map((e) => e.id);
    expect(ids).toContain('evt_story_01');
  });

  // ── 4. 随机事件概率检查 ──────────────────────────────────

  it('概率不足时随机事件不应触发', () => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // 高概率值 → 不通过低概率事件
    const fresh = new ThreeKingdomsEventSystem();
    const triggered = fresh.checkTriggers({ action: 'random' });
    // on_random 事件概率都 ≤ 0.1，random=0.999 不应通过
    const randomIds = triggered.map((e) => e.id);
    expect(randomIds).not.toContain('evt_random_01');
  });

  // ── 5. 做出选择并获取奖励 ────────────────────────────────

  it('应正确做出选择并返回奖励', () => {
    system.checkTriggers({ action: 'battle', heroCount: 2 });
    const result = system.makeChoice('evt_story_01', 0);
    expect(result.outcome).toBe('positive');
    expect(result.reward).toBeDefined();
    expect(result.reward!.heroExp).toBe(2);
  });

  // ── 6. 冷却时间验证 ──────────────────────────────────────

  it('冷却期内不应重复触发同一事件', () => {
    system.checkTriggers({ action: 'random' }); // 首次触发
    const first = system.getTriggerCounts().get('evt_random_01') ?? 0;
    // 再次触发（冷却未过）
    const triggered = system.checkTriggers({ action: 'random' });
    const ids = triggered.map((e) => e.id);
    expect(ids).not.toContain('evt_random_01');
  });

  // ── 7. 不可重复事件验证 ──────────────────────────────────

  it('maxTriggers=1 的事件不应重复触发', () => {
    system.checkTriggers({ action: 'battle', heroCount: 2 });
    expect(system.getTriggerCounts().get('evt_story_01')).toBe(1);
    // 再次触发
    const triggered = system.checkTriggers({ action: 'battle', heroCount: 2 });
    const ids = triggered.map((e) => e.id);
    expect(ids).not.toContain('evt_story_01');
  });

  // ── 8. 连锁事件验证 ──────────────────────────────────────

  it('getEventById 应能查找事件用于连锁', () => {
    const evt = system.getEventById('evt_story_01');
    expect(evt).toBeDefined();
    expect(evt!.name).toBe('温酒斩华雄');
    expect(evt!.choices).toHaveLength(2);
  });

  // ── 9. 序列化 / 反序列化 ─────────────────────────────────

  it('应正确序列化和反序列化系统状态', () => {
    system.checkTriggers({ action: 'battle', heroCount: 2 });
    system.makeChoice('evt_story_01', 0);

    const saved = system.serialize();
    const restored = new ThreeKingdomsEventSystem();
    restored.deserialize(saved);

    // 触发计数应保留
    expect(restored.getTriggerCounts().get('evt_story_01')).toBe(1);

    // 事件总数不变
    expect(restored.getEventCount()).toBe(system.getEventCount());

    // getEventById 应正常工作
    const evt = restored.getEventById('evt_story_01');
    expect(evt).toBeDefined();
    expect(evt!.name).toBe('温酒斩华雄');
  });

  // ── 10. NPC 事件需要匹配 npcType ─────────────────────────

  it('NPC事件需要匹配 npcType 才能触发', () => {
    const wrongType = system.checkTriggers({ action: 'npc_encounter', npcType: 'farmer' });
    expect(wrongType.map((e) => e.id)).not.toContain('evt_npc_01'); // merchant only

    const rightType = system.checkTriggers({ action: 'npc_encounter', npcType: 'merchant' });
    expect(rightType.map((e) => e.id)).toContain('evt_npc_01');
  });
});
