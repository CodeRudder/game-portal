/**
 * 建筑状态辅助函数测试
 *
 * 覆盖：外观阶段计算、初始状态创建、全量状态映射
 */

import { describe, it, expect } from 'vitest';
import {
  getAppearanceStage,
  createInitialState,
  createAllStates,
} from '../BuildingStateHelpers';
import type { BuildingType, AppearanceStage } from '../../shared/types';
import { BUILDING_TYPES } from '../building.types';

// ── getAppearanceStage ──

describe('BuildingStateHelpers — getAppearanceStage', () => {
  it('等级 1 返回 humble', () => {
    expect(getAppearanceStage(1)).toBe('humble');
  });

  it('等级 5 返回 humble（边界值）', () => {
    expect(getAppearanceStage(5)).toBe('humble');
  });

  it('等级 6 返回 orderly', () => {
    expect(getAppearanceStage(6)).toBe('orderly');
  });

  it('等级 12 返回 orderly（边界值）', () => {
    expect(getAppearanceStage(12)).toBe('orderly');
  });

  it('等级 13 返回 refined', () => {
    expect(getAppearanceStage(13)).toBe('refined');
  });

  it('等级 20 返回 refined（边界值）', () => {
    expect(getAppearanceStage(20)).toBe('refined');
  });

  it('等级 21 返回 glorious', () => {
    expect(getAppearanceStage(21)).toBe('glorious');
  });

  it('等级 30 返回 glorious', () => {
    expect(getAppearanceStage(30)).toBe('glorious');
  });

  it('等级 0 返回 humble', () => {
    expect(getAppearanceStage(0)).toBe('humble');
  });

  it('负数等级返回 humble', () => {
    expect(getAppearanceStage(-1)).toBe('humble');
  });

  it('所有阶段值都是合法的 AppearanceStage', () => {
    const validStages: AppearanceStage[] = ['humble', 'orderly', 'refined', 'glorious'];
    for (let level = 0; level <= 30; level++) {
      const stage = getAppearanceStage(level);
      expect(validStages).toContain(stage);
    }
  });
});

// ── createInitialState ──

describe('BuildingStateHelpers — createInitialState', () => {
  it('初始解锁的建筑（主城）等级为1，状态为idle', () => {
    const state = createInitialState('castle');

    expect(state.type).toBe('castle');
    expect(state.level).toBe(1);
    expect(state.status).toBe('idle');
    expect(state.upgradeStartTime).toBeNull();
    expect(state.upgradeEndTime).toBeNull();
  });

  it('初始解锁的建筑（农田）等级为1，状态为idle', () => {
    const state = createInitialState('farmland');

    expect(state.type).toBe('farmland');
    expect(state.level).toBe(1);
    expect(state.status).toBe('idle');
  });

  it('需要主城等级解锁的建筑初始状态为locked', () => {
    // 市集需要主城 Lv2
    const market = createInitialState('market');
    expect(market.type).toBe('market');
    expect(market.level).toBe(0);
    expect(market.status).toBe('locked');

    // 铁匠铺需要主城 Lv3
    const smithy = createInitialState('smithy');
    expect(smithy.status).toBe('locked');

    // 城墙需要主城 Lv5
    const wall = createInitialState('wall');
    expect(wall.status).toBe('locked');
  });

  it('返回的状态包含正确的 type 字段', () => {
    const types: BuildingType[] = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];
    for (const t of types) {
      const state = createInitialState(t);
      expect(state.type).toBe(t);
    }
  });
});

// ── createAllStates ──

describe('BuildingStateHelpers — createAllStates', () => {
  it('返回所有8种建筑的状态', () => {
    const states = createAllStates();

    const allTypes = BUILDING_TYPES as readonly BuildingType[];
    expect(Object.keys(states)).toHaveLength(allTypes.length);
    for (const t of allTypes) {
      expect(states[t]).toBeDefined();
      expect(states[t].type).toBe(t);
    }
  });

  it('主城和农田初始解锁', () => {
    const states = createAllStates();

    expect(states.castle.status).toBe('idle');
    expect(states.castle.level).toBe(1);
    expect(states.farmland.status).toBe('idle');
    expect(states.farmland.level).toBe(1);
  });

  it('需要解锁条件的建筑初始为 locked', () => {
    const states = createAllStates();

    // 市集（主城Lv2）、兵营（主城Lv2）、铁匠铺（主城Lv3）、书院（主城Lv3）、医馆（主城Lv4）、城墙（主城Lv5）
    expect(states.market.status).toBe('locked');
    expect(states.barracks.status).toBe('locked');
    expect(states.smithy.status).toBe('locked');
    expect(states.academy.status).toBe('locked');
    expect(states.clinic.status).toBe('locked');
    expect(states.wall.status).toBe('locked');
  });

  it('所有建筑状态的 upgradeStartTime 和 upgradeEndTime 为 null', () => {
    const states = createAllStates();

    for (const t of BUILDING_TYPES as readonly BuildingType[]) {
      expect(states[t].upgradeStartTime).toBeNull();
      expect(states[t].upgradeEndTime).toBeNull();
    }
  });
});
