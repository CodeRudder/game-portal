#!/usr/bin/env python3
"""Split 3 oversized p2 test files into p2 + p3."""
import os

os.chdir('/mnt/user-data/workspace/game-portal')
BASE = 'src/games/three-kingdoms/engine'

def split_file(rel_path, split_line, p3_header):
    filepath = os.path.join(BASE, rel_path)
    dirpath = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    p3_filename = filename.replace('-p2.test.ts', '-p3.test.ts')
    p3_path = os.path.join(dirpath, p3_filename)

    with open(filepath, 'r') as f:
        lines = f.readlines()

    total = len(lines)
    print(f'=== {filename} (total {total} lines) ===')

    # p2: lines 1 to (split_line-1), then closing });
    p2_lines = lines[:split_line - 1]
    p2_lines.append('});\n')

    # p3: header + lines from split_line to end
    p3_test_lines = lines[split_line - 1:]
    p3_content = p3_header + ''.join(p3_test_lines)

    with open(filepath, 'w') as f:
        f.writelines(p2_lines)

    with open(p3_path, 'w') as f:
        f.write(p3_content)

    p3_line_count = p3_content.count('\n') + (0 if p3_content.endswith('\n') else 0)
    print(f'  p2: {len(p2_lines)} lines')
    print(f'  p3: {p3_line_count} lines')


# ─────────────────────────────────────────────
# 1. EventTriggerSystem-p2 (599 lines -> split at 425)
# ─────────────────────────────────────────────
event_header = r"""/**
 * EventTriggerSystem 单元测试 — p3
 *
 * 覆盖：
 * - 条件评估
 * - 概率公式集成触发
 */

import { EventTriggerSystem } from '../EventTriggerSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
} from '../../../core/event';
import type { ProbabilityCondition } from '../../../core/event/event-v15-event.types';
import {
  PREDEFINED_EVENTS,
  DEFAULT_EVENT_TRIGGER_CONFIG,
} from '../../../core/event';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): EventTriggerSystem {
  const sys = new EventTriggerSystem();
  sys.init(mockDeps());
  return sys;
}

function createRandomEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-random-01',
    title: '测试随机事件',
    description: '这是一个测试用的随机事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.5,
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        description: '选择A',
        consequences: {
          description: '获得金币',
          resourceChanges: { gold: 100 },
        },
      },
      {
        id: 'opt-b',
        text: '选项B',
        isDefault: true,
        consequences: {
          description: '获得粮草',
          resourceChanges: { grain: 50 },
        },
      },
    ],
    ...overrides,
  };
}

function createFixedEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-fixed-01',
    title: '测试固定事件',
    description: '这是一个测试用的固定事件',
    triggerType: 'fixed',
    urgency: 'high',
    scope: 'global',
    triggerConditions: [],
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: {
          description: '固定事件结果',
        },
      },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('EventTriggerSystem p3', () => {
  let sys: EventTriggerSystem;

  beforeEach(() => {
    sys = createSystem();
  });

"""

split_file(
    'event/__tests__/EventTriggerSystem-p2.test.ts',
    split_line=425,
    p3_header=event_header,
)


# ─────────────────────────────────────────────
# 2. ShopSystem-p2 (530 lines -> split at 414)
# ─────────────────────────────────────────────
shop_header = r"""/**
 * ShopSystem 单元测试 (p3)
 *
 * 覆盖：
 * - 商店等级
 * - 序列化/反序列化
 * - ISubsystem 接口
 * - 确认等级阈值
 */

import { ShopSystem } from '../ShopSystem';
import type {
  BuyRequest,
  DiscountConfig,
  GoodsFilter,
  ShopSaveData,
} from '../../../core/shop/shop.types';
import type { ISystemDeps } from '../../../core/types/subsystem';
import { SHOP_TYPES } from '../../../core/shop/shop.types';
import {
  DAILY_MANUAL_REFRESH_LIMIT,
  SHOP_SAVE_VERSION,
  CONFIRM_THRESHOLDS,
} from '../../../core/shop/shop-config';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS, ALL_GOODS_DEFS } from '../../../core/shop/goods-data';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ─── 辅助 ────────────────────────────────────

/** 创建带 mock deps 的 ShopSystem */
function createShop(): ShopSystem {
  const shop = new ShopSystem();
  const mockEventBus = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  const mockConfig = { get: jest.fn() };
  const mockRegistry = { get: jest.fn() };
  shop.init({
    eventBus: mockEventBus as unknown as ISystemDeps['eventBus'],
    config: mockConfig as unknown as ISystemDeps['config'],
    registry: mockRegistry as unknown as ISystemDeps['registry'],
  });
  return shop;
}

/** 创建 mock CurrencySystem */
function createMockCurrencySystem(): CurrencySystem & {
  _checkResult: { canAfford: boolean; shortages: { currency: string; required: number; gap: number }[] };
  _setAffordable: (v: boolean) => void;
} {
  let affordable = true;
  const shortages = () => affordable
    ? []
    : [{ currency: 'copper', required: 1000, gap: 500 }];

  return {
    name: 'currency',
    init: jest.fn(),
    update: jest.fn(),
    getState: jest.fn().mockReturnValue({}),
    reset: jest.fn(),
    checkAffordability: jest.fn().mockImplementation(() => ({
      canAfford: affordable,
      shortages: shortages(),
    })),
    spendByPriority: jest.fn().mockImplementation(() => {
      if (!affordable) throw new Error('货币不足');
      return {};
    }),
    _checkResult: { canAfford: true, shortages: [] },
    _setAffordable: (v: boolean) => { affordable = v; },
  } as unknown as CurrencySystem & {
    _checkResult: { canAfford: boolean; shortages: { currency: string; required: number; gap: number }[] };
    _setAffordable: (v: boolean) => void;
  };
}

/** 获取一个存在于 normal 商店的商品ID */
function getNormalGoodsId(): string {
  const ids = SHOP_GOODS_IDS['normal'];
  return ids.length > 0 ? ids[0] : 'res_copper_small';
}

/** 获取一个可收藏的商品ID */
function getFavoritableGoodsId(): string | undefined {
  for (const def of ALL_GOODS_DEFS) {
    if (def.favoritable) return def.id;
  }
  return undefined;
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('ShopSystem p3', () => {
  let shop: ShopSystem;
  beforeEach(() => {
    jest.restoreAllMocks();
    shop = createShop();
  });

"""

split_file(
    'shop/__tests__/ShopSystem-p2.test.ts',
    split_line=414,
    p3_header=shop_header,
)


# ─────────────────────────────────────────────
# 3. ActivitySystem-p2 (528 lines -> split at 324)
# ─────────────────────────────────────────────
activity_header = r"""/**
 * ActivitySystem 单元测试 (p3)
 *
 * 覆盖：
 * - 赛季深化
 * - 配置
 * - 序列化/反序列化
 */

import {
  ActivitySystem,
  createDefaultActivityState,
  createMilestone,
  ACTIVITY_SAVE_VERSION,
} from '../ActivitySystem';

import type {
  ActivityDef,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../../core/activity/activity.types';

import {
  ActivityType,
  ActivityTaskType,
  MilestoneStatus,
} from '../../../core/activity/activity.types';

// ─── 辅助 ────────────────────────────────────

function createActivityDef(
  id: string,
  type: ActivityType,
  overrides?: Partial<ActivityDef>,
): ActivityDef {
  return {
    id,
    name: `活动_${id}`,
    description: `测试活动 ${id}`,
    type,
    startTime: Date.now() - 1000,
    endTime: Date.now() + 86400000,
    icon: `icon_${id}`,
    ...overrides,
  };
}

function createTaskDef(
  id: string,
  taskType: ActivityTaskType,
  overrides?: Partial<ActivityTaskDef>,
): ActivityTaskDef {
  return {
    id,
    name: `任务_${id}`,
    description: `测试任务 ${id}`,
    taskType,
    targetCount: 10,
    tokenReward: 5,
    pointReward: 20,
    resourceReward: { copper: 100 },
    ...overrides,
  };
}

function createStandardTaskDefs(): ActivityTaskDef[] {
  const daily = Array.from({ length: 5 }, (_, i) =>
    createTaskDef(`daily_${i + 1}`, ActivityTaskType.DAILY, {
      targetCount: 5 + i,
      pointReward: 10,
      tokenReward: 2,
    }),
  );
  const challenge = Array.from({ length: 3 }, (_, i) =>
    createTaskDef(`challenge_${i + 1}`, ActivityTaskType.CHALLENGE, {
      targetCount: 20 + i * 10,
      pointReward: 50,
      tokenReward: 10,
    }),
  );
  const cumulative = [
    createTaskDef('cumulative_1', ActivityTaskType.CUMULATIVE, {
      targetCount: 100,
      pointReward: 100,
      tokenReward: 30,
    }),
  ];
  return [...daily, ...challenge, ...cumulative];
}

function createStandardMilestones(): ActivityMilestone[] {
  return [
    createMilestone('ms_1', 50, { copper: 500 }),
    createMilestone('ms_2', 150, { gold: 10 }),
    createMilestone('ms_3', 300, { heroFragment: 3 }),
    createMilestone('ms_final', 500, { legendaryChest: 1 }, true),
  ];
}

function createStartedState(
  activityId: string,
  type: ActivityType,
  now: number,
  taskDefs?: ActivityTaskDef[],
  milestones?: ActivityMilestone[],
): ActivityState {
  const sys = new ActivitySystem();
  const state = createDefaultActivityState();
  const def = createActivityDef(activityId, type);
  const tasks = taskDefs ?? createStandardTaskDefs();
  const ms = milestones ?? createStandardMilestones();
  return sys.startActivity(state, def, tasks, ms, now);
}

const NOW = Date.now();

// 模块级 system 实例，供所有 describe 块共享
let system: ActivitySystem;
beforeEach(() => {
  system = new ActivitySystem();
});

"""

split_file(
    'activity/__tests__/ActivitySystem-p2.test.ts',
    split_line=324,
    p3_header=activity_header,
)

print('\n✅ All 3 files split successfully!')
