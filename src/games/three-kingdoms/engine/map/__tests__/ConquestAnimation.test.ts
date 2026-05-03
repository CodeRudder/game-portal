/**
 * ConquestAnimationSystem 攻城动画测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConquestAnimationSystem } from '../ConquestAnimation';

describe('ConquestAnimationSystem', () => {
  let system: ConquestAnimationSystem;

  beforeEach(() => {
    system = new ConquestAnimationSystem();
  });

  it('创建攻城动画', () => {
    const anim = system.create('city-a', 10, 10, 'neutral', 'shu');

    expect(anim.id).toBeTruthy();
    expect(anim.cityId).toBe('city-a');
    expect(anim.fromFaction).toBe('neutral');
    expect(anim.toFaction).toBe('shu');
    expect(anim.state).toBe('capturing');
    expect(anim.progress).toBe(0);
  });

  it('创建后加入活跃列表', () => {
    system.create('city-a', 10, 10, 'neutral', 'shu');
    expect(system.getActive().length).toBe(1);
  });

  it('update推进动画进度', () => {
    const anim = system.create('city-a', 10, 10, 'neutral', 'shu');
    const origProgress = anim.progress;

    // 手动推进时间
    (anim as any).startTime = Date.now() - 500;
    system.update();

    expect(anim.progress).toBeGreaterThan(origProgress);
  });

  it('动画完成3秒后自动移除', () => {
    const anim = system.create('city-a', 10, 10, 'neutral', 'shu');

    // 模拟3秒后
    (anim as any).startTime = Date.now() - 4000;
    system.update();

    expect(system.getActive().length).toBe(0);
  });

  it('带战斗结果创建', () => {
    const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
      success: true,
      troopsLost: 500,
      general: '张飞',
    });

    expect(anim.result?.success).toBe(true);
    expect(anim.result?.troopsLost).toBe(500);
    expect(anim.result?.general).toBe('张飞');
  });

  it('onChange监听器触发', () => {
    let count = 0;
    system.onChange(() => count++);

    system.create('city-a', 10, 10, 'neutral', 'shu');
    expect(count).toBe(1);
  });

  it('取消监听器', () => {
    let count = 0;
    const unsub = system.onChange(() => count++);

    system.create('city-a', 10, 10, 'neutral', 'shu');
    expect(count).toBe(1);

    unsub();
    system.create('city-b', 20, 20, 'neutral', 'wei');
    expect(count).toBe(1); // 不再增加
  });
});
