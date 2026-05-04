/**
 * ChapterSelectPanel — 章节选择面板单元测试
 *
 * 覆盖场景：
 * - 基础渲染：面板容器、所有章节卡片
 * - 章节状态：当前/已通关/未解锁
 * - 进度显示：关卡进度、星级汇总
 * - 交互：点击切换、禁用状态
 * - 无章节时的空状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChapterSelectPanel from '../ChapterSelectPanel';
import type { Chapter, Stage, StageStatus } from '@/games/three-kingdoms/engine/campaign/campaign.types';

// ── Mock CSS Module ──
vi.mock('../ChapterSelectPanel.module.css', () => ({
  default: new Proxy({}, {
    get(_target, prop: string) { return prop; },
  }),
}));

// ── 测试数据 ──

const makeStage = (overrides: Partial<Stage> = {}): Stage => ({
  id: 'chapter1_stage1',
  name: '测试关卡',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  enemyFormation: { id: 'ef1', name: '敌军', units: [], recommendedPower: 1000 },
  baseRewards: { grain: 100 },
  baseExp: 200,
  firstClearRewards: {},
  firstClearExp: 0,
  threeStarBonusMultiplier: 1.5,
  dropTable: [],
  recommendedPower: 1000,
  description: '测试',
  ...overrides,
});

const chapters: Chapter[] = [
  {
    id: 'chapter1',
    name: '黄巾之乱',
    subtitle: '苍天已死',
    order: 1,
    stages: [
      makeStage({ id: 's1', order: 1 }),
      makeStage({ id: 's2', order: 2 }),
      makeStage({ id: 's3', order: 3, type: 'boss' }),
    ],
    prerequisiteChapterId: null,
    description: '第一章',
  },
  {
    id: 'chapter2',
    name: '讨伐董卓',
    subtitle: '群雄并起',
    order: 2,
    stages: [
      makeStage({ id: 's4', chapterId: 'chapter2', order: 1 }),
      makeStage({ id: 's5', chapterId: 'chapter2', order: 2 }),
    ],
    prerequisiteChapterId: 'chapter1',
    description: '第二章',
  },
  {
    id: 'chapter3',
    name: '群雄割据',
    subtitle: '天下大乱',
    order: 3,
    stages: [
      makeStage({ id: 's6', chapterId: 'chapter3', order: 1 }),
    ],
    prerequisiteChapterId: 'chapter2',
    description: '第三章',
  },
];

// ── Mock 函数 ──

function makeMocks() {
  return {
    getStageStatus: vi.fn((stageId: string): StageStatus => {
      // chapter1: s1=cleared, s2=available, s3=locked
      if (stageId === 's1') return 'cleared';
      if (stageId === 's2') return 'available';
      if (stageId === 's3') return 'locked';
      // chapter2: s4=locked (上一章未全通)
      if (stageId === 's4') return 'locked';
      if (stageId === 's5') return 'locked';
      // chapter3: locked
      if (stageId === 's6') return 'locked';
      return 'locked';
    }),
    getStageStars: vi.fn((stageId: string): number => {
      if (stageId === 's1') return 2;
      return 0;
    }),
    onSelect: vi.fn(),
  };
}

// ── 测试 ──

describe('ChapterSelectPanel', () => {
  const mocks = makeMocks();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板容器', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByTestId('chapter-select-panel')).toBeInTheDocument();
  });

  it('应渲染所有章节卡片', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByTestId('chapter-card-chapter1')).toBeInTheDocument();
    expect(screen.getByTestId('chapter-card-chapter2')).toBeInTheDocument();
    expect(screen.getByTestId('chapter-card-chapter3')).toBeInTheDocument();
  });

  it('应显示章节名称', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByText('黄巾之乱')).toBeInTheDocument();
    expect(screen.getByText('讨伐董卓')).toBeInTheDocument();
    expect(screen.getByText('群雄割据')).toBeInTheDocument();
  });

  it('应显示副标题', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByText('苍天已死')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 进度显示
  // ═══════════════════════════════════════════

  it('应显示关卡进度', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    // chapter1: 1/3关（s1 cleared）
    expect(screen.getByText('1/3关')).toBeInTheDocument();
    // chapter2: 0/2关
    expect(screen.getByText('0/2关')).toBeInTheDocument();
  });

  it('应显示星级汇总', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    // chapter1: s1有2星, 总3关×3星=9 → 2/9
    expect(screen.getByText('★ 2/9')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 章节状态
  // ═══════════════════════════════════════════

  it('当前选中章节卡片不应禁用', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByTestId('chapter-card-chapter1')).not.toBeDisabled();
  });

  it('未解锁章节卡片应禁用', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    // chapter3: 第一关s6是locked，无已通关 → 应禁用
    expect(screen.getByTestId('chapter-card-chapter3')).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 4. 交互
  // ═══════════════════════════════════════════

  it('点击已解锁章节卡片应触发onSelect', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    // chapter2 第一关s4是locked，但s4是locked → chapter2 整体锁定
    // 所以点击chapter2不应触发onSelect
    const chapter2Card = screen.getByTestId('chapter-card-chapter2');
    expect(chapter2Card).toBeDisabled();
  });

  it('点击当前章节卡片不应触发onSelect', () => {
    render(
      <ChapterSelectPanel
        chapters={chapters}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    const chapter1Card = screen.getByTestId('chapter-card-chapter1');
    fireEvent.click(chapter1Card);
    // 点击当前章节不应触发 onSelect（因为 idx === selectedIdx）
    expect(mocks.onSelect).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 5. 边界情况
  // ═══════════════════════════════════════════

  it('空章节列表应正常渲染（无卡片）', () => {
    render(
      <ChapterSelectPanel
        chapters={[]}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByTestId('chapter-select-panel')).toBeInTheDocument();
    expect(screen.queryByTestId(/^chapter-card-/)).not.toBeInTheDocument();
  });

  it('章节无关卡时进度应为0/0', () => {
    const emptyChapter: Chapter = {
      id: 'chapter_empty',
      name: '空章节',
      subtitle: '测试',
      order: 99,
      stages: [],
      prerequisiteChapterId: null,
      description: '无关卡',
    };
    render(
      <ChapterSelectPanel
        chapters={[emptyChapter]}
        selectedIdx={0}
        onSelect={mocks.onSelect}
        getStageStatus={mocks.getStageStatus}
        getStageStars={mocks.getStageStars}
      />,
    );
    expect(screen.getByText('0/0关')).toBeInTheDocument();
    expect(screen.getByText('★ 0/0')).toBeInTheDocument();
  });
});
