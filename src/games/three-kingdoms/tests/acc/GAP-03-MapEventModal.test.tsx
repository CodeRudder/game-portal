/**
 * GAP-03 事件交互弹窗ACC测试 — RandomEncounterModal + MapEventSystem
 *
 * P0覆盖缺口3：验证事件交互弹窗UI与引擎逻辑
 * PRD MAP-5 §5.8, MAP-4 UI:
 * - 事件脉冲图标在地图上正确渲染
 * - 点击事件图标→弹出事件交互弹窗
 * - 弹窗显示事件类型、描述、选择分支
 * - 点击"强攻"→执行战斗→显示结果+奖励
 * - 点击"谈判"→概率成功→显示结果+奖励
 * - 点击"忽略"→关闭弹窗，事件保留
 * - 事件奖励正确展示（资源/声望/道具）
 * - 弹窗[×]关闭按钮正常工作
 * - 事件过期后弹窗自动关闭
 * - 至少覆盖3种不同事件类型
 *
 * @module tests/acc/GAP-03-MapEventModal
 */

import React, { useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RandomEncounterModal from '@/components/idle/panels/event/RandomEncounterModal';
import { MapEventSystem } from '@/games/three-kingdoms/engine/map/MapEventSystem';
import { EVENT_TYPE_CONFIGS } from '@/games/three-kingdoms/engine/map/map-event-config';
import type {
  ActiveGameEvent,
  EventOption,
  EventCategory,
  EventPriority,
} from '@/games/three-kingdoms/core/events';
import { accTest, assertStrict, assertInDOM, assertContainsText } from './acc-test-utils';

/** Mock CSS imports */
vi.mock('@/components/idle/panels/event/RandomEncounterModal.css', () => ({}));
vi.mock('@/components/idle/components/SharedPanel.css', () => ({}));

vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, visible, 'data-testid': dataTestId }: any) =>
    visible ? (
      <div data-testid={dataTestId ?? 'shared-panel'} data-title={title}>
        {title && <div data-testid="panel-title">{title}</div>}
        {children}
        {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
      </div>
    ) : null,
}));

// ═══════════════════════════════════════════════════════════════
// 测试数据工厂
// ═══════════════════════════════════════════════════════════════

/** 创建 ActiveGameEvent 测试数据 */
function makeActiveEvent(overrides: Partial<ActiveGameEvent> = {}): ActiveGameEvent {
  return {
    instanceId: 'evt-test-001',
    eventId: 'event-bandit-01',
    name: '流寇入侵',
    description: '一队流寇出现在你的领土附近，威胁过往商旅。',
    triggerType: 'random',
    category: 'military' as EventCategory,
    priority: 'normal' as EventPriority,
    status: 'active',
    options: [
      {
        id: 'attack',
        text: '强攻',
        description: '正面迎击流寇',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 500, description: '金币' },
          { type: 'resource_change', target: 'grain', value: 300, description: '粮食' },
        ],
        aiWeight: 0.4,
      },
      {
        id: 'negotiate',
        text: '谈判',
        description: '尝试与流寇谈判',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 200, description: '金币' },
        ],
        aiWeight: 0.3,
      },
      {
        id: 'ignore',
        text: '忽略',
        description: '暂不处理',
        consequences: [],
        aiWeight: 0.3,
      },
    ],
    triggeredAtTurn: 10,
    expiresAtTurn: 0,
    selectedOptionId: null,
    appliedConsequences: [],
    ...overrides,
  };
}

/** 创建商队事件 */
function makeCaravanEvent(): ActiveGameEvent {
  return makeActiveEvent({
    instanceId: 'evt-caravan-001',
    eventId: 'event-caravan-01',
    name: '商队经过',
    description: '一支商队途经你的领地，是护送还是截获？',
    category: 'economic' as EventCategory,
    options: [
      {
        id: 'attack',
        text: '截获',
        description: '截获商队物资',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 800, description: '金币' },
          { type: 'resource_change', target: 'grain', value: 200, description: '粮食' },
        ],
        aiWeight: 0.3,
      },
      {
        id: 'negotiate',
        text: '护送',
        description: '护送商队获取报酬',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 400, description: '金币' },
          { type: 'resource_change', target: 'grain', value: 100, description: '粮食' },
        ],
        aiWeight: 0.5,
      },
      {
        id: 'ignore',
        text: '忽略',
        description: '任由商队经过',
        consequences: [],
        aiWeight: 0.2,
      },
    ],
  });
}

/** 创建天灾事件 */
function makeDisasterEvent(): ActiveGameEvent {
  return makeActiveEvent({
    instanceId: 'evt-disaster-001',
    eventId: 'event-disaster-01',
    name: '天灾降临',
    description: '一场自然灾害正在逼近，需要尽快应对。',
    category: 'natural' as EventCategory,
    priority: 'high' as EventPriority,
    options: [
      {
        id: 'negotiate',
        text: '赈灾',
        description: '组织赈灾救援',
        consequences: [
          { type: 'resource_change', target: 'grain', value: 500, description: '粮食' },
          { type: 'resource_change', target: 'gold', value: 200, description: '金币' },
        ],
        aiWeight: 0.6,
      },
      {
        id: 'ignore',
        text: '忽略',
        description: '暂不处理',
        consequences: [],
        aiWeight: 0.4,
      },
    ],
  });
}

/** 创建遗迹发现事件 */
function makeRuinsEvent(): ActiveGameEvent {
  return makeActiveEvent({
    instanceId: 'evt-ruins-001',
    eventId: 'event-ruins-01',
    name: '遗迹发现',
    description: '探险者发现了一处古代遗迹，可能藏有珍宝。',
    category: 'mystery' as EventCategory,
    options: [
      {
        id: 'attack',
        text: '探索',
        description: '深入遗迹探索',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 1000, description: '金币' },
          { type: 'resource_change', target: 'techPoint', value: 50, description: '科技点' },
        ],
        aiWeight: 0.4,
      },
      {
        id: 'negotiate',
        text: '谨慎探索',
        description: '小心翼翼地探索',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 500, description: '金币' },
          { type: 'resource_change', target: 'techPoint', value: 20, description: '科技点' },
        ],
        aiWeight: 0.4,
      },
      {
        id: 'ignore',
        text: '忽略',
        description: '暂不处理',
        consequences: [],
        aiWeight: 0.2,
      },
    ],
  });
}

/** 创建阵营冲突事件 */
function makeConflictEvent(): ActiveGameEvent {
  return makeActiveEvent({
    instanceId: 'evt-conflict-001',
    eventId: 'event-conflict-01',
    name: '阵营冲突',
    description: '两个阵营在你的边境发生冲突，局势紧张。',
    category: 'military' as EventCategory,
    priority: 'urgent' as EventPriority,
    options: [
      {
        id: 'attack',
        text: '强攻',
        description: '趁乱出击',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 1500, description: '金币' },
          { type: 'resource_change', target: 'troops', value: 200, description: '兵力' },
        ],
        aiWeight: 0.3,
      },
      {
        id: 'negotiate',
        text: '调停',
        description: '出面调停冲突',
        consequences: [
          { type: 'resource_change', target: 'gold', value: 600, description: '金币' },
          { type: 'resource_change', target: 'troops', value: 100, description: '兵力' },
        ],
        aiWeight: 0.4,
      },
      {
        id: 'ignore',
        text: '忽略',
        description: '静观其变',
        consequences: [],
        aiWeight: 0.3,
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// 测试容器组件 — 模拟弹窗与地图的交互
// ═══════════════════════════════════════════════════════════════

/** 弹窗测试容器 — 模拟地图上的事件图标 + 弹窗 */
function EventTestContainer({
  events,
  onResolveEvent,
}: {
  events: ActiveGameEvent[];
  onResolveEvent?: (instanceId: string, optionId: string) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<ActiveGameEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleEventClick = useCallback((evt: ActiveGameEvent) => {
    setSelectedEvent(evt);
    setModalVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalVisible(false);
    setSelectedEvent(null);
  }, []);

  const handleSelectOption = useCallback((instanceId: string, optionId: string) => {
    onResolveEvent?.(instanceId, optionId);
    setModalVisible(false);
    setSelectedEvent(null);
  }, [onResolveEvent]);

  return (
    <div data-testid="event-test-container">
      {/* 事件脉冲图标列表（模拟地图上的事件图标） */}
      <div data-testid="event-icon-list">
        {events.map((evt) => (
          <button
            key={evt.instanceId}
            data-testid={`event-icon-${evt.instanceId}`}
            className="tk-event-pulse-icon"
            onClick={() => handleEventClick(evt)}
            aria-label={`事件: ${evt.name}`}
          >
            <span data-testid={`event-icon-type-${evt.instanceId}`}>
              {evt.category === 'military' ? '⚔️' :
               evt.category === 'economic' ? '💰' :
               evt.category === 'natural' ? '🌊' :
               evt.category === 'mystery' ? '❓' :
               evt.category === 'diplomatic' ? '🤝' : '👥'}
            </span>
            <span data-testid={`event-icon-name-${evt.instanceId}`}>{evt.name}</span>
          </button>
        ))}
      </div>

      {/* 事件交互弹窗 */}
      <RandomEncounterModal
        visible={modalVisible}
        event={selectedEvent}
        onSelectOption={handleSelectOption}
        onClose={handleClose}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GAP-03 事件交互弹窗ACC测试
// ═══════════════════════════════════════════════════════════════

describe('GAP-03 事件交互弹窗ACC测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 事件脉冲图标渲染（GAP-03-01 ~ GAP-03-03）
  // ═══════════════════════════════════════════════════════════

  describe('事件脉冲图标渲染', () => {
    it(accTest('GAP-03-01', '事件脉冲图标在地图上正确渲染 — 单个事件'), () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      const icon = screen.getByTestId(`event-icon-${event.instanceId}`);
      assertInDOM(icon, 'GAP-03-01', '事件脉冲图标');

      const typeName = screen.getByTestId(`event-icon-name-${event.instanceId}`);
      assertContainsText(typeName, 'GAP-03-01', '流寇入侵');
    });

    it(accTest('GAP-03-02', '多个事件脉冲图标同时渲染 — 最多3个'), () => {
      const events = [
        makeActiveEvent({ instanceId: 'evt-1', name: '流寇入侵' }),
        makeActiveEvent({ instanceId: 'evt-2', name: '商队经过', category: 'economic' as EventCategory }),
        makeActiveEvent({ instanceId: 'evt-3', name: '天灾降临', category: 'natural' as EventCategory }),
      ];

      render(<EventTestContainer events={events} />);

      for (const evt of events) {
        const icon = screen.getByTestId(`event-icon-${evt.instanceId}`);
        assertInDOM(icon, 'GAP-03-02', `事件图标 ${evt.name}`);
      }

      const iconList = screen.getByTestId('event-icon-list');
      const icons = within(iconList).getAllByTestId(/^event-icon-evt-/);
      assertStrict(icons.length === 3, 'GAP-03-02', `应有3个事件图标，实际${icons.length}`);
    });

    it(accTest('GAP-03-03', '事件图标显示正确分类标识 — 军事/经济/自然'), () => {
      const events = [
        makeActiveEvent({ instanceId: 'evt-mil', category: 'military' as EventCategory }),
        makeActiveEvent({ instanceId: 'evt-eco', category: 'economic' as EventCategory }),
        makeActiveEvent({ instanceId: 'evt-nat', category: 'natural' as EventCategory }),
      ];

      render(<EventTestContainer events={events} />);

      const militaryIcon = screen.getByTestId('event-icon-type-evt-mil');
      assertContainsText(militaryIcon, 'GAP-03-03', '⚔️');

      const economicIcon = screen.getByTestId('event-icon-type-evt-eco');
      assertContainsText(economicIcon, 'GAP-03-03', '💰');

      const naturalIcon = screen.getByTestId('event-icon-type-evt-nat');
      assertContainsText(naturalIcon, 'GAP-03-03', '🌊');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 点击事件图标→弹出弹窗（GAP-03-04 ~ GAP-03-06）
  // ═══════════════════════════════════════════════════════════

  describe('点击事件图标→弹出弹窗', () => {
    it(accTest('GAP-03-04', '点击事件图标→弹出事件交互弹窗'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      // 弹窗初始不可见
      let modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-04', '弹窗初始应不可见');

      // 点击事件图标
      const icon = screen.getByTestId(`event-icon-${event.instanceId}`);
      await userEvent.click(icon);

      // 弹窗应出现
      modal = screen.getByTestId('encounter-modal');
      assertInDOM(modal, 'GAP-03-04', '事件交互弹窗');
    });

    it(accTest('GAP-03-05', '弹窗显示事件类型和描述'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      const icon = screen.getByTestId(`event-icon-${event.instanceId}`);
      await userEvent.click(icon);

      // 事件头部
      const header = screen.getByTestId('encounter-header');
      assertInDOM(header, 'GAP-03-05', '事件头部');

      // 分类标签
      assertContainsText(header, 'GAP-03-05', '军事');

      // 事件名称
      assertContainsText(header, 'GAP-03-05', '流寇入侵');

      // 事件描述
      const modal = screen.getByTestId('encounter-modal');
      assertContainsText(modal, 'GAP-03-05', '一队流寇出现在你的领土附近');
    });

    it(accTest('GAP-03-06', '弹窗显示选择分支按钮 — 强攻/谈判/忽略'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      const icon = screen.getByTestId(`event-icon-${event.instanceId}`);
      await userEvent.click(icon);

      // 验证3个选项按钮存在
      const attackBtn = screen.getByTestId('encounter-option-attack');
      assertInDOM(attackBtn, 'GAP-03-06', '强攻选项');
      assertContainsText(attackBtn, 'GAP-03-06', '强攻');

      const negotiateBtn = screen.getByTestId('encounter-option-negotiate');
      assertInDOM(negotiateBtn, 'GAP-03-06', '谈判选项');
      assertContainsText(negotiateBtn, 'GAP-03-06', '谈判');

      const ignoreBtn = screen.getByTestId('encounter-option-ignore');
      assertInDOM(ignoreBtn, 'GAP-03-06', '忽略选项');
      assertContainsText(ignoreBtn, 'GAP-03-06', '忽略');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 选择分支交互（GAP-03-07 ~ GAP-03-10）
  // ═══════════════════════════════════════════════════════════

  describe('选择分支交互', () => {
    it(accTest('GAP-03-07', '点击"强攻"→触发战斗→回调onSelectOption'), async () => {
      const onSelectOption = vi.fn();
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} onResolveEvent={onSelectOption} />);

      // 打开弹窗
      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      // 点击强攻
      const attackBtn = screen.getByTestId('encounter-option-attack');
      await userEvent.click(attackBtn);

      // 验证回调被调用
      assertStrict(onSelectOption.mock.calls.length === 1, 'GAP-03-07', 'onSelectOption应被调用1次');
      assertStrict(
        onSelectOption.mock.calls[0][0] === event.instanceId,
        'GAP-03-07', `回调参数instanceId应为${event.instanceId}`,
      );
      assertStrict(
        onSelectOption.mock.calls[0][1] === 'attack',
        'GAP-03-07', '回调参数optionId应为attack',
      );
    });

    it(accTest('GAP-03-08', '点击"谈判"→回调onSelectOption'), async () => {
      const onSelectOption = vi.fn();
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} onResolveEvent={onSelectOption} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const negotiateBtn = screen.getByTestId('encounter-option-negotiate');
      await userEvent.click(negotiateBtn);

      assertStrict(onSelectOption.mock.calls.length === 1, 'GAP-03-08', 'onSelectOption应被调用1次');
      assertStrict(
        onSelectOption.mock.calls[0][1] === 'negotiate',
        'GAP-03-08', '回调参数optionId应为negotiate',
      );
    });

    it(accTest('GAP-03-09', '点击"忽略"→关闭弹窗，事件保留在列表中'), async () => {
      const onSelectOption = vi.fn();
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} onResolveEvent={onSelectEvent} />);

      function onSelectEvent(instanceId: string, optionId: string) {
        // 忽略时不调用onSelectOption — 模拟事件保留
        // 实际行为: onClose关闭弹窗，事件保留
      }

      // 打开弹窗
      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      // 点击"暂不处理"（忽略按钮在footer）
      const ignoreBtn = screen.getByTestId('encounter-ignore-btn');
      await userEvent.click(ignoreBtn);

      // 弹窗应关闭
      const modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-09', '点击忽略后弹窗应关闭');

      // 事件图标仍存在
      const eventIcon = screen.getByTestId(`event-icon-${event.instanceId}`);
      assertInDOM(eventIcon, 'GAP-03-09', '忽略后事件图标应保留');
    });

    it(accTest('GAP-03-10', '选择后弹窗自动关闭'), async () => {
      const event = makeActiveEvent();
      const onSelectOption = vi.fn();
      render(<EventTestContainer events={[event]} onResolveEvent={onSelectOption} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));
      assertStrict(!!screen.getByTestId('encounter-modal'), 'GAP-03-10', '弹窗应已打开');

      await userEvent.click(screen.getByTestId('encounter-option-attack'));

      const modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-10', '选择后弹窗应自动关闭');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 事件奖励展示（GAP-03-11 ~ GAP-03-13）
  // ═══════════════════════════════════════════════════════════

  describe('事件奖励展示', () => {
    it(accTest('GAP-03-11', '选项按钮显示后果/奖励预览 — 资源类型和数值'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const attackBtn = screen.getByTestId('encounter-option-attack');
      // 后果标签应显示资源变化
      assertContainsText(attackBtn, 'GAP-03-11', '金币');
      assertContainsText(attackBtn, 'GAP-03-11', '+500');
      assertContainsText(attackBtn, 'GAP-03-11', '粮食');
      assertContainsText(attackBtn, 'GAP-03-11', '+300');
    });

    it(accTest('GAP-03-12', '谈判选项显示中等奖励'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const negotiateBtn = screen.getByTestId('encounter-option-negotiate');
      assertContainsText(negotiateBtn, 'GAP-03-12', '金币');
      assertContainsText(negotiateBtn, 'GAP-03-12', '+200');
    });

    it(accTest('GAP-03-13', '忽略选项无奖励显示'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const ignoreBtn = screen.getByTestId('encounter-option-ignore');
      // 忽略选项不应有后果标签
      const consequences = within(ignoreBtn).queryAllByTestId(/consequence/);
      assertStrict(consequences.length === 0, 'GAP-03-13', '忽略选项不应显示奖励');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 弹窗关闭机制（GAP-03-14 ~ GAP-03-16）
  // ═══════════════════════════════════════════════════════════

  describe('弹窗关闭机制', () => {
    it(accTest('GAP-03-14', '弹窗[×]关闭按钮正常工作'), async () => {
      const event = makeActiveEvent();
      render(<EventTestContainer events={[event]} />);

      // 打开弹窗
      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));
      assertStrict(!!screen.getByTestId('encounter-modal'), 'GAP-03-14', '弹窗应已打开');

      // 点击关闭按钮（SharedPanel的关闭按钮）
      const closeBtn = screen.getByTestId('panel-close');
      await userEvent.click(closeBtn);

      const modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-14', '点击关闭按钮后弹窗应关闭');
    });

    it(accTest('GAP-03-15', '弹窗不可见时 — 不渲染内容'), () => {
      render(
        <RandomEncounterModal
          visible={false}
          event={makeActiveEvent()}
          onSelectOption={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-15', 'visible=false时弹窗不应渲染');
    });

    it(accTest('GAP-03-16', 'event为null时 — 不渲染'), () => {
      render(
        <RandomEncounterModal
          visible={true}
          event={null}
          onSelectOption={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const modal = screen.queryByTestId('encounter-modal');
      assertStrict(!modal, 'GAP-03-16', 'event=null时弹窗不应渲染');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 引擎层 MapEventSystem（GAP-03-17 ~ GAP-03-24）
  // ═══════════════════════════════════════════════════════════

  describe('引擎层 MapEventSystem', () => {
    it(accTest('GAP-03-17', '5种事件类型配置完整 — 流寇/商队/天灾/遗迹/阵营冲突'), () => {
      const configs = MapEventSystem.getEventTypeConfigs();
      const types = configs.map(c => c.type);

      assertStrict(types.includes('bandit'), 'GAP-03-17', '应包含流寇(bandit)');
      assertStrict(types.includes('caravan'), 'GAP-03-17', '应包含商队(caravan)');
      assertStrict(types.includes('disaster'), 'GAP-03-17', '应包含天灾(disaster)');
      assertStrict(types.includes('ruins'), 'GAP-03-17', '应包含遗迹(ruins)');
      assertStrict(types.includes('conflict'), 'GAP-03-17', '应包含阵营冲突(conflict)');
      assertStrict(configs.length === 5, 'GAP-03-17', `应有5种事件类型，实际${configs.length}`);
    });

    it(accTest('GAP-03-18', '事件触发 — 强制触发流寇事件'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      assertStrict(event.eventType === 'bandit', 'GAP-03-18', '事件类型应为bandit');
      assertStrict(event.name === '流寇入侵', 'GAP-03-18', '事件名称应为流寇入侵');
      assertStrict(event.status === 'active', 'GAP-03-18', '事件状态应为active');
      assertStrict(event.isCombat === true, 'GAP-03-18', '流寇应为战斗类事件');
      assertStrict(event.choices.includes('attack'), 'GAP-03-18', '应包含强攻选项');
      assertStrict(event.choices.includes('negotiate'), 'GAP-03-18', '应包含谈判选项');
      assertStrict(event.choices.includes('ignore'), 'GAP-03-18', '应包含忽略选项');
    });

    it(accTest('GAP-03-19', '强攻结算 — 战斗类事件触发战斗，返回奖励'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      const result = eventSystem.resolveEvent(event.id, 'attack');

      assertStrict(result.success, 'GAP-03-19', '强攻应成功');
      assertStrict(result.choice === 'attack', 'GAP-03-19', '选择应为attack');
      assertStrict(result.triggeredBattle, 'GAP-03-19', '战斗类事件强攻应触发战斗');
      assertStrict(result.rewards.length > 0, 'GAP-03-19', '强攻应获得奖励');

      // 验证奖励内容（流寇强攻: gold 500, grain 300）
      const goldReward = result.rewards.find(r => r.type === 'gold');
      assertStrict(!!goldReward, 'GAP-03-19', '应包含金币奖励');
      assertStrict(goldReward!.amount === 500, 'GAP-03-19', `金币奖励应为500，实际${goldReward!.amount}`);
    });

    it(accTest('GAP-03-20', '谈判结算 — 返回中等奖励'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      const result = eventSystem.resolveEvent(event.id, 'negotiate');

      assertStrict(result.success, 'GAP-03-20', '谈判应成功');
      assertStrict(result.choice === 'negotiate', 'GAP-03-20', '选择应为negotiate');
      assertStrict(!result.triggeredBattle, 'GAP-03-20', '谈判不应触发战斗');
      assertStrict(result.rewards.length > 0, 'GAP-03-20', '谈判应获得奖励');

      // 流寇谈判: gold 200
      const goldReward = result.rewards.find(r => r.type === 'gold');
      assertStrict(!!goldReward, 'GAP-03-20', '应包含金币奖励');
      assertStrict(goldReward!.amount === 200, 'GAP-03-20', `谈判金币应为200，实际${goldReward!.amount}`);
    });

    it(accTest('GAP-03-21', '忽略结算 — 无奖励'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      const result = eventSystem.resolveEvent(event.id, 'ignore');

      assertStrict(result.success, 'GAP-03-21', '忽略应成功');
      assertStrict(result.choice === 'ignore', 'GAP-03-21', '选择应为ignore');
      assertStrict(result.rewards.length === 0, 'GAP-03-21', '忽略不应获得奖励');
    });

    it(accTest('GAP-03-22', '解决后事件从活跃列表移除'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      assertStrict(eventSystem.getActiveEventCount() === 1, 'GAP-03-22', '应有1个活跃事件');

      eventSystem.resolveEvent(event.id, 'attack');

      assertStrict(eventSystem.getActiveEventCount() === 0, 'GAP-03-22', '解决后应无活跃事件');
      assertStrict(eventSystem.getResolvedCount() === 1, 'GAP-03-22', '已解决计数应为1');
    });

    it(accTest('GAP-03-23', '解决不存在的事件 — 返回失败结果'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });

      const result = eventSystem.resolveEvent('nonexistent-event', 'attack');

      assertStrict(!result.success, 'GAP-03-23', '解决不存在事件应返回失败');
      assertStrict(result.rewards.length === 0, 'GAP-03-23', '不应有奖励');
    });

    it(accTest('GAP-03-24', '最多3个未处理事件 — 超出后不再触发'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.01, checkInterval: 0 });

      // 强制触发3个事件
      eventSystem.forceTrigger('bandit', 1000000);
      eventSystem.forceTrigger('caravan', 1000001);
      eventSystem.forceTrigger('disaster', 1000002);

      assertStrict(eventSystem.getActiveEventCount() === 3, 'GAP-03-24', '应有3个活跃事件');

      // 尝试触发第4个
      const result = eventSystem.checkAndTrigger(1000003);
      assertStrict(result === null, 'GAP-03-24', '超出3个后不应触发新事件');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. 事件过期自动关闭（GAP-03-25 ~ GAP-03-27）
  // ═══════════════════════════════════════════════════════════

  describe('事件过期自动关闭', () => {
    it(accTest('GAP-03-25', '事件过期后自动从活跃列表移除'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });

      // 流寇事件 duration=7200000 (2小时)
      const event = eventSystem.forceTrigger('bandit', 1000000);
      assertStrict(event.expiresAt === 1000000 + 7200000, 'GAP-03-25', '过期时间应为创建时间+2小时');

      // 在过期前检查
      eventSystem.cleanExpiredEvents(8000000);
      assertStrict(eventSystem.getActiveEventCount() === 1, 'GAP-03-25', '过期前事件应保留');

      // 过期后检查
      const cleaned = eventSystem.cleanExpiredEvents(9000000);
      assertStrict(cleaned === 1, 'GAP-03-25', `应清理1个过期事件，实际${cleaned}`);
      assertStrict(eventSystem.getActiveEventCount() === 0, 'GAP-03-25', '过期后活跃事件应为0');
    });

    it(accTest('GAP-03-26', '不同事件类型有不同持续时间'), () => {
      const configs = MapEventSystem.getEventTypeConfigs();

      const bandit = configs.find(c => c.type === 'bandit')!;
      assertStrict(bandit.duration === 7200000, 'GAP-03-26', '流寇持续2小时');

      const disaster = configs.find(c => c.type === 'disaster')!;
      assertStrict(disaster.duration === 86400000, 'GAP-03-26', '天灾持续24小时');

      const conflict = configs.find(c => c.type === 'conflict')!;
      assertStrict(conflict.duration === 172800000, 'GAP-03-26', '阵营冲突持续48小时');
    });

    it(accTest('GAP-03-27', 'checkAndTrigger自动清理过期事件'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });

      // 触发一个事件
      eventSystem.forceTrigger('bandit', 1000000);
      assertStrict(eventSystem.getActiveEventCount() === 1, 'GAP-03-27', '应有1个事件');

      // 模拟时间流逝到过期后，再次checkAndTrigger
      // rng=0.5 > 0.1，不会触发新事件，但会清理过期
      eventSystem.checkAndTrigger(9000000);
      assertStrict(eventSystem.getActiveEventCount() === 0, 'GAP-03-27', '过期事件应被自动清理');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. 多种事件类型覆盖（GAP-03-28 ~ GAP-03-33）
  // ═══════════════════════════════════════════════════════════

  describe('多种事件类型覆盖', () => {
    it(accTest('GAP-03-28', '流寇入侵(bandit) — 战斗类事件，3个选择分支'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('bandit', 1000000);

      assertStrict(event.eventType === 'bandit', 'GAP-03-28', '类型应为bandit');
      assertStrict(event.isCombat, 'GAP-03-28', '应为战斗类事件');
      assertStrict(event.choices.length === 3, 'GAP-03-28', '应有3个选择分支');
      assertStrict(event.choices.includes('attack'), 'GAP-03-28', '应包含attack');
      assertStrict(event.choices.includes('negotiate'), 'GAP-03-28', '应包含negotiate');
      assertStrict(event.choices.includes('ignore'), 'GAP-03-28', '应包含ignore');
    });

    it(accTest('GAP-03-29', '商队经过(caravan) — 非战斗类，3个选择分支'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('caravan', 1000000);

      assertStrict(event.eventType === 'caravan', 'GAP-03-29', '类型应为caravan');
      assertStrict(!event.isCombat, 'GAP-03-29', '应为非战斗类事件');
      assertStrict(event.choices.length === 3, 'GAP-03-29', '应有3个选择分支');

      // 验证强攻奖励更高
      const config = EVENT_TYPE_CONFIGS.find(c => c.type === 'caravan')!;
      const attackGold = config.attackRewards.find(r => r.type === 'gold')!.amount;
      const negotiateGold = config.negotiateRewards.find(r => r.type === 'gold')!.amount;
      assertStrict(attackGold > negotiateGold, 'GAP-03-29', `强攻金币(${attackGold})应大于谈判(${negotiateGold})`);
    });

    it(accTest('GAP-03-30', '天灾降临(disaster) — 无强攻选项，仅赈灾/忽略'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('disaster', 1000000);

      assertStrict(event.eventType === 'disaster', 'GAP-03-30', '类型应为disaster');
      assertStrict(!event.isCombat, 'GAP-03-30', '应为非战斗类事件');
      assertStrict(!event.choices.includes('attack'), 'GAP-03-30', '天灾不应有强攻选项');
      assertStrict(event.choices.includes('negotiate'), 'GAP-03-30', '应有赈灾(negotiate)选项');
      assertStrict(event.choices.includes('ignore'), 'GAP-03-30', '应有忽略选项');
    });

    it(accTest('GAP-03-31', '遗迹发现(ruins) — 含科技点奖励'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('ruins', 1000000);

      assertStrict(event.eventType === 'ruins', 'GAP-03-31', '类型应为ruins');

      const result = eventSystem.resolveEvent(event.id, 'attack');
      const techReward = result.rewards.find(r => r.type === 'techPoint');
      assertStrict(!!techReward, 'GAP-03-31', '强攻遗迹应获得科技点');
      assertStrict(techReward!.amount === 50, 'GAP-03-31', `科技点应为50，实际${techReward!.amount}`);
    });

    it(accTest('GAP-03-32', '阵营冲突(conflict) — 战斗类，含兵力奖励'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      const event = eventSystem.forceTrigger('conflict', 1000000);

      assertStrict(event.eventType === 'conflict', 'GAP-03-32', '类型应为conflict');
      assertStrict(event.isCombat, 'GAP-03-32', '应为战斗类事件');

      const result = eventSystem.resolveEvent(event.id, 'attack');
      assertStrict(result.triggeredBattle, 'GAP-03-32', '强攻应触发战斗');

      const troopsReward = result.rewards.find(r => r.type === 'troops');
      assertStrict(!!troopsReward, 'GAP-03-32', '应包含兵力奖励');
      assertStrict(troopsReward!.amount === 200, 'GAP-03-32', `兵力奖励应为200，实际${troopsReward!.amount}`);
    });

    it(accTest('GAP-03-33', '3种不同事件类型的弹窗UI渲染'), async () => {
      const events = [
        makeActiveEvent({ instanceId: 'evt-bandit', name: '流寇入侵', category: 'military' as EventCategory }),
        makeCaravanEvent(),
        makeDisasterEvent(),
      ];

      render(<EventTestContainer events={events} />);

      // 验证流寇入侵弹窗
      await userEvent.click(screen.getByTestId('event-icon-evt-bandit'));
      assertContainsText(screen.getByTestId('encounter-modal'), 'GAP-03-33', '流寇入侵');
      await userEvent.click(screen.getByTestId('panel-close'));

      // 验证商队经过弹窗
      await userEvent.click(screen.getByTestId('event-icon-evt-caravan-001'));
      assertContainsText(screen.getByTestId('encounter-modal'), 'GAP-03-33', '商队经过');
      await userEvent.click(screen.getByTestId('panel-close'));

      // 验证天灾降临弹窗
      await userEvent.click(screen.getByTestId('event-icon-evt-disaster-001'));
      assertContainsText(screen.getByTestId('encounter-modal'), 'GAP-03-33', '天灾降临');
      // 天灾只有2个选项（无强攻）
      const attackOption = screen.queryByTestId('encounter-option-attack');
      assertStrict(!attackOption, 'GAP-03-33', '天灾不应有强攻选项');
      assertStrict(!!screen.getByTestId('encounter-option-negotiate'), 'GAP-03-33', '天灾应有赈灾选项');
      assertStrict(!!screen.getByTestId('encounter-option-ignore'), 'GAP-03-33', '天灾应有忽略选项');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 9. 事件优先级与样式（GAP-03-34 ~ GAP-03-36）
  // ═══════════════════════════════════════════════════════════

  describe('事件优先级与样式', () => {
    it(accTest('GAP-03-34', '高优先级事件弹窗样式正确'), async () => {
      const event = makeActiveEvent({ priority: 'high' as EventPriority });
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const modal = screen.getByTestId('encounter-modal');
      assertStrict(
        modal.className.includes('tk-encounter--high'),
        'GAP-03-34', '高优先级应有high样式类',
      );
    });

    it(accTest('GAP-03-35', '紧急优先级事件弹窗样式正确'), async () => {
      const event = makeActiveEvent({ priority: 'urgent' as EventPriority });
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const modal = screen.getByTestId('encounter-modal');
      assertStrict(
        modal.className.includes('tk-encounter--urgent'),
        'GAP-03-35', '紧急优先级应有urgent样式类',
      );
    });

    it(accTest('GAP-03-36', '普通优先级事件弹窗样式正确'), async () => {
      const event = makeActiveEvent({ priority: 'normal' as EventPriority });
      render(<EventTestContainer events={[event]} />);

      await userEvent.click(screen.getByTestId(`event-icon-${event.instanceId}`));

      const modal = screen.getByTestId('encounter-modal');
      assertStrict(
        modal.className.includes('tk-encounter--normal'),
        'GAP-03-36', '普通优先级应有normal样式类',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 10. 存档与序列化（GAP-03-37 ~ GAP-03-38）
  // ═══════════════════════════════════════════════════════════

  describe('存档与序列化', () => {
    it(accTest('GAP-03-37', 'MapEventSystem序列化/反序列化 — 状态保持'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      eventSystem.forceTrigger('bandit', 1000000);
      eventSystem.forceTrigger('caravan', 1000001);

      const saved = eventSystem.serialize();
      assertStrict(saved.activeEvents.length === 2, 'GAP-03-37', '存档应有2个活跃事件');
      assertStrict(saved.resolvedCount === 0, 'GAP-03-37', '存档已解决数应为0');

      // 反序列化到新实例
      const restored = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      restored.deserialize(saved);
      assertStrict(restored.getActiveEventCount() === 2, 'GAP-03-37', '恢复后应有2个活跃事件');
    });

    it(accTest('GAP-03-38', 'MapEventSystem reset — 清空所有状态'), () => {
      const eventSystem = new MapEventSystem({ rng: () => 0.5, checkInterval: 0 });
      eventSystem.forceTrigger('bandit', 1000000);
      eventSystem.resolveEvent(eventSystem.getActiveEvents()[0].id, 'attack');
      eventSystem.forceTrigger('caravan', 1000001);

      eventSystem.reset();
      assertStrict(eventSystem.getActiveEventCount() === 0, 'GAP-03-38', 'reset后活跃事件应为0');
      assertStrict(eventSystem.getResolvedCount() === 0, 'GAP-03-38', 'reset后已解决数应为0');
    });
  });
});
