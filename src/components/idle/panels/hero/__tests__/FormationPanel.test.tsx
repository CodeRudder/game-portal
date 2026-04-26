/**
 * FormationPanel — 编队管理面板测试
 *
 * 覆盖场景：
 * 1. 渲染测试：编队列表、创建编队按钮、空编队状态
 * 2. 创建编队：点击创建按钮→新编队出现
 * 3. 删除编队：点击删除按钮→编队移除
 * 4. 激活编队：切换激活状态
 * 5. 编队编辑：添加/移除武将
 * 6. 羁绊预览：已激活羁绊显示
 * 7. 空编队状态：无编队时显示提示
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormationPanel from '../FormationPanel';
import type { FormationData } from '@/games/three-kingdoms/engine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';
import type { ActiveBond, BondPotentialTip, FormationBondPreview } from '@/games/three-kingdoms/core/bond';

// ── Mock CSS ──
vi.mock('../FormationPanel.css', () => ({}));

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────

const makeGeneral = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10,
  exp: 500,
  faction: 'shu',
  skills: [],
  ...overrides,
});

const makeFormation = (overrides: Partial<FormationData> = {}): FormationData => ({
  id: '1',
  name: '第一队',
  slots: ['', '', '', '', '', ''],
  ...overrides,
});

const makeActiveBond = (overrides: Partial<ActiveBond> = {}): ActiveBond => ({
  type: 'faction_2',
  faction: 'shu',
  heroCount: 2,
  effect: {
    type: 'faction_2',
    name: '同乡之谊',
    description: '2名同阵营武将上阵，攻击+5%',
    bonuses: { attack: 0.05 },
    condition: '2名同阵营',
    icon: '⚔️',
  },
  ...overrides,
});

const makeBondPreview = (overrides: Partial<FormationBondPreview> = {}): FormationBondPreview => ({
  formationId: '1',
  activeBonds: [],
  totalBonuses: {},
  factionDistribution: { shu: 0, wei: 0, wu: 0, qun: 0 },
  potentialBonds: [],
  ...overrides,
});

// ─────────────────────────────────────────────
// Mock 引擎工厂
// ─────────────────────────────────────────────

interface MockEngineOptions {
  formations?: FormationData[];
  activeFormationId?: string | null;
  generals?: GeneralData[];
  bondPreview?: FormationBondPreview | null;
}

const createMockEngine = (options: MockEngineOptions = {}) => {
  const {
    formations = [],
    activeFormationId = null,
    generals = [],
    bondPreview = null,
  } = options;

  const formationSystem = {
    getAllFormations: vi.fn().mockReturnValue(formations),
    getActiveFormationId: vi.fn().mockReturnValue(activeFormationId),
    createFormation: vi.fn().mockImplementation(() => {
      const newId = String(formations.length + 1);
      const newFormation = makeFormation({ id: newId, name: `第${newId}队` });
      formations.push(newFormation);
      return newFormation;
    }),
    deleteFormation: vi.fn().mockImplementation((id: string) => {
      const idx = formations.findIndex((f) => f.id === id);
      if (idx >= 0) formations.splice(idx, 1);
      return true;
    }),
    setActiveFormation: vi.fn(),
    renameFormation: vi.fn().mockImplementation((id: string, name: string) => {
      const f = formations.find((f) => f.id === id);
      if (f) f.name = name;
      return f ?? null;
    }),
    addToFormation: vi.fn().mockImplementation((formationId: string, generalId: string) => {
      const f = formations.find((f) => f.id === formationId);
      if (!f) return null;
      const emptyIdx = f.slots.indexOf('');
      if (emptyIdx === -1) return null;
      f.slots[emptyIdx] = generalId;
      return { ...f, slots: [...f.slots] };
    }),
    removeFromFormation: vi.fn().mockImplementation((formationId: string, generalId: string) => {
      const f = formations.find((f) => f.id === formationId);
      if (!f) return null;
      const idx = f.slots.indexOf(generalId);
      if (idx === -1) return null;
      f.slots[idx] = '';
      return { ...f, slots: [...f.slots] };
    }),
    getFormation: vi.fn().mockImplementation((id: string) => {
      return formations.find((f) => f.id === id) ?? null;
    }),
    calculateFormationPower: vi.fn().mockReturnValue(5000),
  };

  const heroSystem = {
    getGeneral: vi.fn().mockImplementation((id: string) => {
      return generals.find((g) => g.id === id) ?? undefined;
    }),
    calculatePower: vi.fn().mockReturnValue(2500),
  };

  const bondSystem = {
    getFormationPreview: vi.fn().mockReturnValue(bondPreview),
  };

  return {
    getFormationSystem: vi.fn().mockReturnValue(formationSystem),
    getHeroSystem: vi.fn().mockReturnValue(heroSystem),
    getBondSystem: vi.fn().mockReturnValue(bondSystem),
    getGenerals: vi.fn().mockReturnValue(generals),
    // ACC-06-38: 派遣系统mock
    getHeroDispatchSystem: vi.fn().mockReturnValue({
      getHeroDispatchBuilding: vi.fn().mockReturnValue(null),
    }),
    // 一键编队需要星级系统
    getHeroStarSystem: vi.fn().mockReturnValue({
      getStar: vi.fn().mockReturnValue(1),
    }),
  };
};

// ─────────────────────────────────────────────
// 渲染辅助
// ─────────────────────────────────────────────

const renderPanel = (engine: ReturnType<typeof createMockEngine>, snapshotVersion = 0) => {
  return render(<FormationPanel engine={engine as any} snapshotVersion={snapshotVersion} />);
};

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('FormationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  describe('渲染测试', () => {
    it('应正常渲染面板容器', () => {
      const engine = createMockEngine();
      renderPanel(engine);
      expect(screen.getByTestId('formation-panel')).toBeInTheDocument();
    });

    it('应显示标题和创建编队按钮', () => {
      const engine = createMockEngine();
      renderPanel(engine);
      expect(screen.getByText('⚔️ 编队管理')).toBeInTheDocument();
      expect(screen.getByTestId('formation-panel-create-btn')).toBeInTheDocument();
    });

    it('空编队时应显示提示信息', () => {
      const engine = createMockEngine({ formations: [] });
      renderPanel(engine);
      expect(screen.getByText(/尚无编队/)).toBeInTheDocument();
    });

    it('有编队时不应显示空提示', () => {
      const formations = [makeFormation()];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);
      expect(screen.queryByText(/尚无编队/)).not.toBeInTheDocument();
    });

    it('应渲染编队卡片列表', () => {
      const formations = [
        makeFormation({ id: '1', name: '第一队' }),
        makeFormation({ id: '2', name: '第二队' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);
      expect(screen.getByTestId('formation-panel-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('formation-panel-card-2')).toBeInTheDocument();
    });

    it('应显示编队战力', () => {
      const formations = [makeFormation({ id: '1' })];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);
      expect(screen.getByText(/战力:/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 创建编队
  // ═══════════════════════════════════════════

  describe('创建编队', () => {
    it('点击创建按钮应调用 createFormation', () => {
      const formations: FormationData[] = [];
      const engine = createMockEngine({ formations });
      renderPanel(engine);

      const btn = screen.getByTestId('formation-panel-create-btn');
      fireEvent.click(btn);

      expect(engine.getFormationSystem().createFormation).toHaveBeenCalledTimes(1);
    });

    it('编队数量达到上限时创建按钮应被禁用', () => {
      const formations = [
        makeFormation({ id: '1' }),
        makeFormation({ id: '2' }),
        makeFormation({ id: '3' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      const btn = screen.getByTestId('formation-panel-create-btn');
      expect(btn).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 删除编队
  // ═══════════════════════════════════════════

  describe('删除编队', () => {
    it('点击删除按钮应调用 deleteFormation', () => {
      const formations = [
        makeFormation({ id: '1', name: '第一队' }),
        makeFormation({ id: '2', name: '第二队' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      // 找到第一个编队的删除按钮
      const card = screen.getByTestId('formation-panel-card-1');
      const deleteBtn = card.querySelector('.tk-formation-delete-btn') as HTMLElement;
      expect(deleteBtn).toBeTruthy();
      fireEvent.click(deleteBtn);

      expect(engine.getFormationSystem().deleteFormation).toHaveBeenCalledWith('1');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 激活编队
  // ═══════════════════════════════════════════

  describe('激活编队', () => {
    it('非激活编队应显示激活按钮', () => {
      const formations = [
        makeFormation({ id: '1', name: '第一队' }),
        makeFormation({ id: '2', name: '第二队' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      // 第二队（非激活）应有激活按钮
      expect(screen.getByTestId('formation-panel-activate-btn-2')).toBeInTheDocument();
    });

    it('激活编队应显示当前标记', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      expect(screen.getByText('当前')).toBeInTheDocument();
    });

    it('点击激活按钮应调用 setActiveFormation', () => {
      const formations = [
        makeFormation({ id: '1', name: '第一队' }),
        makeFormation({ id: '2', name: '第二队' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      const activateBtn = screen.getByTestId('formation-panel-activate-btn-2');
      fireEvent.click(activateBtn);

      expect(engine.getFormationSystem().setActiveFormation).toHaveBeenCalledWith('2');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 编队编辑 — 添加/移除武将
  // ═══════════════════════════════════════════

  describe('编队编辑', () => {
    it('点击编辑按钮应展开编辑区域', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      expect(editBtn).toBeTruthy();

      // 点击编辑前，没有添加武将区域
      expect(screen.queryByText(/添加武将/)).not.toBeInTheDocument();

      // 点击编辑
      fireEvent.click(editBtn);

      // 编辑后应显示添加武将区域
      expect(screen.getByText(/添加武将/)).toBeInTheDocument();
    });

    it('编辑模式下应显示可用武将列表', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 应显示可用武将
      expect(screen.getByText('关羽')).toBeInTheDocument();
      expect(screen.getByText('张飞')).toBeInTheDocument();
    });

    it('点击武将名称应调用 addToFormation', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 点击添加关羽
      const addBtn = screen.getByText('关羽');
      fireEvent.click(addBtn);

      expect(engine.getFormationSystem().addToFormation).toHaveBeenCalledWith('1', 'guanyu');
    });

    it('编队中有武将时应显示槽位', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['guanyu', '', '', '', '', ''],
        }),
      ];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 应显示关羽在槽位中
      expect(screen.getByText('关羽')).toBeInTheDocument();
    });

    it('编辑模式下点击移除按钮应调用 removeFromFormation', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['guanyu', '', '', '', '', ''],
        }),
      ];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 找到移除按钮
      const removeBtn = card.querySelector('.tk-formation-slot-remove') as HTMLElement;
      expect(removeBtn).toBeTruthy();
      fireEvent.click(removeBtn);

      expect(engine.getFormationSystem().removeFromFormation).toHaveBeenCalledWith('1', 'guanyu');
    });

    it('所有武将已在其他编队中时应显示提示', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['', '', '', '', '', ''],
        }),
        makeFormation({
          id: '2',
          name: '第二队',
          slots: ['guanyu', 'zhangfei', '', '', '', ''],
        }),
      ];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 所有武将已在其他编队中
      expect(screen.getByText('所有武将已在编队中')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 羁绊预览
  // ═══════════════════════════════════════════

  describe('羁绊预览', () => {
    it('有激活羁绊时应显示羁绊标签', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['liubei', 'guanyu', '', '', '', ''],
        }),
      ];
      const generals = [
        makeGeneral({ id: 'liubei', name: '刘备', faction: 'shu' }),
        makeGeneral({ id: 'guanyu', name: '关羽', faction: 'shu' }),
      ];
      const bondPreview = makeBondPreview({
        formationId: '1',
        activeBonds: [
          makeActiveBond({
            type: 'faction_2',
            faction: 'shu',
            heroCount: 2,
            effect: {
              type: 'faction_2',
              name: '同乡之谊',
              description: '2名同阵营武将上阵，攻击+5%',
              bonuses: { attack: 0.05 },
              condition: '2名同阵营',
              icon: '⚔️',
            },
          }),
        ],
        totalBonuses: { attack: 0.05 },
      });
      const engine = createMockEngine({ formations, activeFormationId: '1', generals, bondPreview });
      renderPanel(engine);

      // 应显示羁绊名称（含icon前缀，用部分匹配）
      expect(screen.getByText(/同乡之谊/)).toBeInTheDocument();
    });

    it('有属性加成时应显示加成数值', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['liubei', 'guanyu', '', '', '', ''],
        }),
      ];
      const generals = [
        makeGeneral({ id: 'liubei', name: '刘备' }),
        makeGeneral({ id: 'guanyu', name: '关羽' }),
      ];
      const bondPreview = makeBondPreview({
        formationId: '1',
        activeBonds: [makeActiveBond()],
        totalBonuses: { attack: 0.05 },
      });
      const engine = createMockEngine({ formations, activeFormationId: '1', generals, bondPreview });
      renderPanel(engine);

      // 应显示攻击加成
      expect(screen.getByText('攻击+5%')).toBeInTheDocument();
    });

    it('无羁绊预览时不应显示羁绊区域', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['', '', '', '', '', ''],
        }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', bondPreview: null });
      renderPanel(engine);

      // 不应有羁绊标签
      expect(screen.queryByText('同乡之谊')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 空编队状态
  // ═══════════════════════════════════════════

  describe('空编队状态', () => {
    it('无编队时应显示空状态提示', () => {
      const engine = createMockEngine({ formations: [] });
      renderPanel(engine);
      expect(screen.getByText(/尚无编队，点击「创建编队」开始组建/)).toBeInTheDocument();
    });

    it('空编队时创建按钮应可用', () => {
      const engine = createMockEngine({ formations: [] });
      renderPanel(engine);
      const btn = screen.getByTestId('formation-panel-create-btn');
      expect(btn).not.toBeDisabled();
    });

    it('编队有空槽位时应显示序号占位', () => {
      const formations = [makeFormation({ id: '1', slots: ['', '', '', '', '', ''] })];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      // 空槽位应显示序号（1-6）
      const card = screen.getByTestId('formation-panel-card-1');
      const emptySlots = card.querySelectorAll('.tk-formation-slot--empty');
      expect(emptySlots.length).toBe(6);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 一键编队
  // ═══════════════════════════════════════════

  describe('一键编队', () => {
    it('编辑模式下应显示一键编队按钮', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 应显示一键编队按钮
      expect(screen.getByTestId('formation-panel-auto-btn-1')).toBeInTheDocument();
      expect(screen.getByText(/一键编队/)).toBeInTheDocument();
    });

    it('点击一键编队按钮应调用 addToFormation 填入武将', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 点击一键编队
      const autoBtn = screen.getByTestId('formation-panel-auto-btn-1');
      fireEvent.click(autoBtn);

      // 应调用 addToFormation 填入武将（关羽和张飞）
      expect(engine.getFormationSystem().addToFormation).toHaveBeenCalled();
    });

    it('无可用武将时一键编队按钮应禁用', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['', '', '', '', '', ''],
        }),
        makeFormation({
          id: '2',
          name: '第二队',
          slots: ['guanyu', 'zhangfei', '', '', '', ''],
        }),
      ];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 所有武将已在其他编队中，按钮应禁用
      const autoBtn = screen.getByTestId('formation-panel-auto-btn-1');
      expect(autoBtn).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════
  // 8. 重命名编队
  // ═══════════════════════════════════════════

  describe('重命名编队', () => {
    it('点击编队名称应进入重命名模式', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      // 点击编队名称
      const nameEl = screen.getByText('第一队');
      fireEvent.click(nameEl);

      // 应出现输入框
      const input = document.querySelector('.tk-formation-rename-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.value).toBe('第一队');
    });

    it('输入新名称后按回车应调用 renameFormation', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine({ formations, activeFormationId: '1' });
      renderPanel(engine);

      // 进入重命名
      const nameEl = screen.getByText('第一队');
      fireEvent.click(nameEl);

      const input = document.querySelector('.tk-formation-rename-input') as HTMLInputElement;
      expect(input).toBeTruthy();

      // 输入新名称
      fireEvent.change(input, { target: { value: '蜀国主力' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(engine.getFormationSystem().renameFormation).toHaveBeenCalledWith('1', '蜀国主力');
    });
  });

  // ═══════════════════════════════════════════
  // 10. ACC-06-38: 武将派遣状态标记
  // ═══════════════════════════════════════════

  describe('ACC-06-38: 武将派遣状态标记', () => {
    it('编队槽位中被派遣的武将应显示派遣标记', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['guanyu', '', '', '', '', ''],
        }),
      ];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      // 模拟关羽被派遣到农田
      (engine.getHeroDispatchSystem().getHeroDispatchBuilding as ReturnType<typeof vi.fn>)
        .mockImplementation((heroId: string) => heroId === 'guanyu' ? 'farmland' : null);

      renderPanel(engine);

      // 关羽槽位应有派遣标记
      const card = screen.getByTestId('formation-panel-card-1');
      const dispatchedSlot = card.querySelector('.tk-formation-slot--dispatched');
      expect(dispatchedSlot).toBeTruthy();

      // 应显示派遣徽章
      const badge = card.querySelector('.tk-formation-slot-dispatch-badge');
      expect(badge).toBeTruthy();
    });

    it('可添加武将列表中被派遣的武将应显示派遣标记', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const generals = [
        makeGeneral({ id: 'guanyu', name: '关羽' }),
        makeGeneral({ id: 'zhangfei', name: '张飞' }),
      ];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      // 模拟关羽被派遣到农田，张飞未派遣
      (engine.getHeroDispatchSystem().getHeroDispatchBuilding as ReturnType<typeof vi.fn>)
        .mockImplementation((heroId: string) => heroId === 'guanyu' ? 'farmland' : null);

      renderPanel(engine);

      // 进入编辑模式
      const card = screen.getByTestId('formation-panel-card-1');
      const editBtn = card.querySelector('.tk-formation-edit-btn') as HTMLElement;
      fireEvent.click(editBtn);

      // 关羽按钮应有派遣样式
      const dispatchedBtn = card.querySelector('.tk-formation-add-hero--dispatched');
      expect(dispatchedBtn).toBeTruthy();

      // 张飞按钮不应有派遣样式
      const allAddBtns = card.querySelectorAll('.tk-formation-add-hero');
      const zhangfeiBtn = Array.from(allAddBtns).find(
        (btn) => btn.textContent?.includes('张飞')
      );
      expect(zhangfeiBtn?.classList.contains('tk-formation-add-hero--dispatched')).toBe(false);
    });

    it('未被派遣的武将不应显示派遣标记', () => {
      const formations = [
        makeFormation({
          id: '1',
          name: '第一队',
          slots: ['guanyu', '', '', '', '', ''],
        }),
      ];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine({ formations, activeFormationId: '1', generals });
      // 默认 mock 返回 null（未派遣）

      renderPanel(engine);

      const card = screen.getByTestId('formation-panel-card-1');
      const dispatchedSlot = card.querySelector('.tk-formation-slot--dispatched');
      expect(dispatchedSlot).toBeFalsy();
    });
  });
});
