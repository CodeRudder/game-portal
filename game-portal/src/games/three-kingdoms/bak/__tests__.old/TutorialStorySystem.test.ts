/**
 * 三国霸业 — 新手引导与剧情触发系统 测试套件
 *
 * 覆盖：引导步骤初始化、剧情事件初始化、步骤推进、
 * 触发条件检查、引导完成判断、序列化/反序列化。
 */
import { describe, it, expect } from 'vitest';
import { TutorialStorySystem } from '@/games/three-kingdoms/TutorialStorySystem';

describe('TutorialStorySystem', () => {
  let system: TutorialStorySystem;

  beforeEach(() => {
    system = new TutorialStorySystem();
  });

  // ── 引导步骤 ─────────────────────────────────────────────

  it('应初始化 6 个引导步骤', () => {
    const steps = system.getTutorialSteps();
    expect(steps).toHaveLength(6);
    expect(steps[0].id).toBe('t01');
    expect(steps[5].id).toBe('t06');
    expect(steps.every((s) => !s.isCompleted)).toBe(true);
  });

  // ── 剧情事件 ─────────────────────────────────────────────

  it('应初始化 8 个剧情事件', () => {
    const events = system.getStoryEvents();
    expect(events).toHaveLength(8);
    expect(events[0].id).toBe('s01');
    expect(events[7].id).toBe('s08');
    expect(events.every((e) => !e.isTriggered)).toBe(true);
  });

  // ── 当前步骤 ─────────────────────────────────────────────

  it('应返回当前未完成的第一个步骤', () => {
    const step = system.getCurrentStep();
    expect(step).not.toBeNull();
    expect(step!.id).toBe('t01');
    expect(step!.title).toBe('欢迎来到三国');
  });

  // ── 完成步骤并推进 ───────────────────────────────────────

  it('应正确完成步骤并推进到下一步', () => {
    const completed = system.completeStep('t01');
    expect(completed).not.toBeNull();
    expect(completed!.isCompleted).toBe(true);

    const next = system.getCurrentStep();
    expect(next!.id).toBe('t02');
  });

  // ── 触发：首次招募 → 桃园结义 ───────────────────────────

  it('首次招募应触发桃园结义剧情', () => {
    const event = system.checkTrigger('first_recruit', 1);
    expect(event).not.toBeNull();
    expect(event!.id).toBe('s01');
    expect(event!.title).toBe('桃园结义');
    expect(event!.reward!.heroId).toBe('guanyu');
  });

  // ── 触发：武将数 3 → 三顾茅庐 ───────────────────────────

  it('武将数量达到 3 应触发三顾茅庐剧情', () => {
    const event = system.checkTrigger('hero_count', 3);
    expect(event).not.toBeNull();
    expect(event!.id).toBe('s03');
    expect(event!.title).toBe('三顾茅庐');
    expect(event!.triggerValue).toBe(3);
  });

  // ── 引导完成判断 ─────────────────────────────────────────

  it('全部步骤完成后引导应标记为已完成', () => {
    expect(system.isTutorialComplete()).toBe(false);

    ['t01', 't02', 't03', 't04', 't05', 't06'].forEach((id) => {
      system.completeStep(id);
    });

    expect(system.isTutorialComplete()).toBe(true);
    expect(system.getCurrentStep()).toBeNull();
  });

  // ── 序列化 / 反序列化 ────────────────────────────────────

  it('应正确序列化和反序列化系统状态', () => {
    system.completeStep('t01');
    system.checkTrigger('first_recruit', 1);

    const saved = system.serialize();
    const restored = new TutorialStorySystem();
    restored.deserialize(saved);

    // 引导步骤状态应保留
    expect(restored.getTutorialSteps()[0].isCompleted).toBe(true);
    expect(restored.getTutorialSteps()[1].isCompleted).toBe(false);

    // 剧情触发状态应保留
    expect(restored.getStoryEvents()[0].isTriggered).toBe(true);
    expect(restored.getStoryEvents()[1].isTriggered).toBe(false);

    // 未触发列表应正确
    expect(restored.getUntriggeredStories()).toHaveLength(7);
  });
});
