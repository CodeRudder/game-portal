/**
 * ForgePityManager 单元测试
 *
 * 覆盖：保底计数器管理、保底触发判定、保底品质确定、序列化
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgePityManager } from '../ForgePityManager';
import type { ForgeType, EquipmentRarity } from '../../../core/equipment';
import { FORGE_PITY_THRESHOLDS } from '../../../core/equipment';

// ═══════════════════════════════════════════════════
// 初始状态
// ═══════════════════════════════════════════════════

describe('ForgePityManager — 初始状态', () => {
  let pm: ForgePityManager;

  beforeEach(() => {
    pm = new ForgePityManager();
  });

  it('初始状态所有计数器应为 0', () => {
    const state = pm.getState();
    expect(state.basicBluePity).toBe(0);
    expect(state.advancedPurplePity).toBe(0);
    expect(state.targetedGoldPity).toBe(0);
  });

  it('getState 应返回快照（非引用）', () => {
    const state1 = pm.getState();
    const state2 = pm.getState();
    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2);
  });
});

// ═══════════════════════════════════════════════════
// 保底判定
// ═══════════════════════════════════════════════════

describe('ForgePityManager — shouldTrigger', () => {
  let pm: ForgePityManager;

  beforeEach(() => {
    pm = new ForgePityManager();
  });

  it('basic 未达阈值不应触发', () => {
    expect(pm.shouldTrigger('basic')).toBe(false);
  });

  it('basic 达到阈值时 update 应返回 true', () => {
    const threshold = FORGE_PITY_THRESHOLDS.basicBluePity;
    let triggered = false;
    for (let i = 0; i < threshold; i++) {
      triggered = pm.update('basic', 'white');
    }
    expect(triggered).toBe(true);
    // 触发后计数器被重置
    expect(pm.getState().basicBluePity).toBe(0);
  });

  it('advanced 未达阈值不应触发', () => {
    expect(pm.shouldTrigger('advanced')).toBe(false);
  });

  it('advanced 达到阈值时 update 应返回 true', () => {
    const threshold = FORGE_PITY_THRESHOLDS.advancedPurplePity;
    let triggered = false;
    for (let i = 0; i < threshold; i++) {
      triggered = pm.update('advanced', 'blue');
    }
    expect(triggered).toBe(true);
  });

  it('targeted 未达阈值不应触发', () => {
    expect(pm.shouldTrigger('targeted')).toBe(false);
  });

  it('targeted 达到阈值时 update 应返回 true', () => {
    const threshold = FORGE_PITY_THRESHOLDS.targetedGoldPity;
    let triggered = false;
    for (let i = 0; i < threshold; i++) {
      triggered = pm.update('targeted', 'purple');
    }
    expect(triggered).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 保底品质
// ═══════════════════════════════════════════════════

describe('ForgePityManager — getPityRarity', () => {
  let pm: ForgePityManager;

  beforeEach(() => {
    pm = new ForgePityManager();
  });

  it('basic 保底应出紫色', () => {
    expect(pm.getPityRarity('basic')).toBe('purple');
  });

  it('advanced 保底应出紫色', () => {
    expect(pm.getPityRarity('advanced')).toBe('purple');
  });

  it('targeted 保底应出金色', () => {
    expect(pm.getPityRarity('targeted')).toBe('gold');
  });
});

// ═══════════════════════════════════════════════════
// 更新逻辑
// ═══════════════════════════════════════════════════

describe('ForgePityManager — update', () => {
  let pm: ForgePityManager;

  beforeEach(() => {
    pm = new ForgePityManager();
  });

  it('低品质输出应递增计数器', () => {
    pm.update('basic', 'white');
    expect(pm.getState().basicBluePity).toBe(1);

    pm.update('basic', 'green');
    expect(pm.getState().basicBluePity).toBe(2);
  });

  it('高品质输出（>=紫色）应重置计数器', () => {
    pm.update('basic', 'white');
    pm.update('basic', 'white');
    expect(pm.getState().basicBluePity).toBe(2);

    pm.update('basic', 'purple');
    expect(pm.getState().basicBluePity).toBe(0);
  });

  it('达到阈值触发保底时应重置计数器并返回 true', () => {
    const threshold = FORGE_PITY_THRESHOLDS.basicBluePity;
    // 推进到阈值-1
    for (let i = 0; i < threshold - 1; i++) {
      const triggered = pm.update('basic', 'white');
      expect(triggered).toBe(false);
    }
    // 最后一次触发
    const triggered = pm.update('basic', 'white');
    expect(triggered).toBe(true);
    expect(pm.getState().basicBluePity).toBe(0);
  });

  it('targeted 保底达到金色应重置', () => {
    pm.update('targeted', 'gold');
    expect(pm.getState().targetedGoldPity).toBe(0);
  });

  it('各类型计数器应互不影响', () => {
    pm.update('basic', 'white');
    pm.update('advanced', 'blue');
    pm.update('targeted', 'green');
    const state = pm.getState();
    expect(state.basicBluePity).toBe(1);
    expect(state.advancedPurplePity).toBe(1);
    expect(state.targetedGoldPity).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// 阈值查询
// ═══════════════════════════════════════════════════

describe('ForgePityManager — getThreshold / getProgress', () => {
  let pm: ForgePityManager;

  beforeEach(() => {
    pm = new ForgePityManager();
  });

  it('basic/advanced 阈值应相同', () => {
    expect(pm.getThreshold('basic')).toBe(FORGE_PITY_THRESHOLDS.basicBluePity);
    expect(pm.getThreshold('advanced')).toBe(FORGE_PITY_THRESHOLDS.advancedPurplePity);
  });

  it('targeted 阈值应不同', () => {
    expect(pm.getThreshold('targeted')).toBe(FORGE_PITY_THRESHOLDS.targetedGoldPity);
  });

  it('getProgress 应返回当前进度', () => {
    pm.update('basic', 'white');
    pm.update('basic', 'green');
    const progress = pm.getProgress('basic');
    expect(progress.current).toBe(2);
    expect(progress.threshold).toBe(FORGE_PITY_THRESHOLDS.basicBluePity);
  });

  it('初始进度应为 0', () => {
    expect(pm.getProgress('basic').current).toBe(0);
    expect(pm.getProgress('advanced').current).toBe(0);
    expect(pm.getProgress('targeted').current).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 序列化
// ═══════════════════════════════════════════════════

describe('ForgePityManager — 序列化', () => {
  it('restore 应恢复状态', () => {
    const pm = new ForgePityManager();
    pm.update('basic', 'white');
    pm.update('basic', 'white');
    pm.update('targeted', 'blue');

    const state = pm.getState();
    const pm2 = new ForgePityManager();
    pm2.restore(state);

    expect(pm2.getState()).toEqual(state);
  });

  it('restore null 应重置为默认值', () => {
    const pm = new ForgePityManager();
    pm.update('basic', 'white');
    pm.restore({ basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 });
    expect(pm.getState().basicBluePity).toBe(0);
  });

  it('reset 应清零所有计数器', () => {
    const pm = new ForgePityManager();
    pm.update('basic', 'white');
    pm.update('advanced', 'blue');
    pm.update('targeted', 'green');
    pm.reset();
    const state = pm.getState();
    expect(state.basicBluePity).toBe(0);
    expect(state.advancedPurplePity).toBe(0);
    expect(state.targetedGoldPity).toBe(0);
  });
});
