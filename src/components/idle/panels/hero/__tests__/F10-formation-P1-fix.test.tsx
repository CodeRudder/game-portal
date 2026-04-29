/**
 * F10 编队系统 P1 修复测试
 *
 * 覆盖场景：
 * 1. P1-01: 删除编队需确认弹窗
 * 2. P1-02: 移除武将需确认弹窗
 * 3. P1-03: 编队槽位扩展机制
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormationPanel from '../FormationPanel';
import type { FormationData, GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ── Mock CSS & Modal ──
vi.mock('../FormationPanel.css', () => ({}));
vi.mock('../FormationSaveSlot', () => ({
  default: () => <div data-testid="formation-save-slot" />,
  __esModule: true,
}));
vi.mock('@/components/idle/common/Modal', () => ({
  default: ({ visible, title, onConfirm, onCancel, children, confirmText, cancelText, 'data-testid': dtid }: any) =>
    visible ? (
      <div data-testid={dtid ?? 'mock-modal'} role="dialog" aria-label={title}>
        <div>{children}</div>
        {confirmText && <button data-testid="modal-confirm" onClick={onConfirm}>{confirmText}</button>}
        {cancelText && <button data-testid="modal-cancel" onClick={onCancel}>{cancelText}</button>
        }</div>
    ) : null,
  __esModule: true,
}));

// ── Mock localStorage ──
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ── 测试数据工厂 ──
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

// ── Mock 引擎工厂 ──
const createMockEngine = (formations: FormationData[] = [], generals: GeneralData[] = []) => {
  const formationSystem = {
    getAllFormations: vi.fn().mockReturnValue(formations),
    getActiveFormationId: vi.fn().mockReturnValue(formations[0]?.id ?? null),
    createFormation: vi.fn(),
    deleteFormation: vi.fn().mockImplementation((id: string) => {
      const idx = formations.findIndex((f) => f.id === id);
      if (idx >= 0) formations.splice(idx, 1);
      return true;
    }),
    setActiveFormation: vi.fn(),
    renameFormation: vi.fn(),
    addToFormation: vi.fn(),
    removeFromFormation: vi.fn().mockImplementation((fid: string, gid: string) => {
      const f = formations.find((f) => f.id === fid);
      if (!f) return null;
      const idx = f.slots.indexOf(gid);
      if (idx >= 0) f.slots[idx] = '';
      return f;
    }),
    getFormation: vi.fn().mockImplementation((id: string) => formations.find((f) => f.id === id) ?? null),
    calculateFormationPower: vi.fn().mockReturnValue(5000),
    setMaxFormations: vi.fn(),
    getMaxFormations: vi.fn().mockReturnValue(3),
  };

  const heroSystem = {
    getGeneral: vi.fn().mockImplementation((id: string) => generals.find((g) => g.id === id) ?? undefined),
    calculatePower: vi.fn().mockReturnValue(2500),
  };

  return {
    getFormationSystem: vi.fn().mockReturnValue(formationSystem),
    getHeroSystem: vi.fn().mockReturnValue(heroSystem),
    getBondSystem: vi.fn().mockReturnValue({ getFormationPreview: vi.fn().mockReturnValue(null) }),
    getGenerals: vi.fn().mockReturnValue(generals),
    getHeroDispatchSystem: vi.fn().mockReturnValue({ getHeroDispatchBuilding: vi.fn().mockReturnValue(null) }),
    getHeroStarSystem: vi.fn().mockReturnValue({ getStar: vi.fn().mockReturnValue(1) }),
    getResourceAmount: vi.fn().mockReturnValue(99999),
    resource: { consumeBatch: vi.fn(), resources: { gold: 99999, jade: 99999 } },
  };
};

const renderPanel = (engine: ReturnType<typeof createMockEngine>, snapshotVersion = 0) => {
  return render(<FormationPanel engine={engine as any} snapshotVersion={snapshotVersion} />);
};

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('F10 编队系统 P1 修复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // ═══════════════════════════════════════════
  // P1-01: 删除编队确认弹窗
  // ═══════════════════════════════════════════

  describe('P1-01 删除编队确认弹窗', () => {
    it('点击删除按钮应弹出确认弹窗', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine(formations);
      renderPanel(engine);

      // 点击删除按钮
      const deleteBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-delete-btn');
      expect(deleteBtn).toBeTruthy();
      fireEvent.click(deleteBtn!);

      // 应出现确认弹窗
      expect(screen.getByTestId('formation-delete-confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/确定要删除编队「第一队」/)).toBeInTheDocument();
    });

    it('取消删除应关闭弹窗且不删除编队', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine(formations);
      renderPanel(engine);

      const deleteBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-delete-btn');
      fireEvent.click(deleteBtn!);

      // 点击取消
      fireEvent.click(screen.getByTestId('modal-cancel'));

      // 弹窗应消失
      expect(screen.queryByTestId('formation-delete-confirm-modal')).not.toBeInTheDocument();
      // 编队应仍在
      expect(screen.getByTestId('formation-panel-card-1')).toBeInTheDocument();
    });

    it('确认删除应删除编队并关闭弹窗', () => {
      const formations = [makeFormation({ id: '1', name: '第一队' })];
      const engine = createMockEngine(formations);
      renderPanel(engine);

      const deleteBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-delete-btn');
      fireEvent.click(deleteBtn!);

      // 确认删除
      fireEvent.click(screen.getByTestId('modal-confirm'));

      // deleteFormation 应被调用
      expect(engine.getFormationSystem().deleteFormation).toHaveBeenCalledWith('1');
    });
  });

  // ═══════════════════════════════════════════
  // P1-02: 移除武将确认弹窗
  // ═══════════════════════════════════════════

  describe('P1-02 移除武将确认弹窗', () => {
    it('编辑模式下点击移除武将应弹出确认弹窗', () => {
      const formations = [makeFormation({ id: '1', slots: ['guanyu', '', '', '', '', ''] })];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine(formations, generals);
      renderPanel(engine);

      // 先点击编辑按钮
      const editBtn = screen.getByText('编辑');
      fireEvent.click(editBtn);

      // 点击移除武将按钮
      const removeBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-slot-remove');
      expect(removeBtn).toBeTruthy();
      fireEvent.click(removeBtn!);

      // 应出现确认弹窗
      expect(screen.getByTestId('formation-remove-hero-confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/确定要将「关羽」从编队中移除/)).toBeInTheDocument();
    });

    it('取消移除应关闭弹窗且不移除武将', () => {
      const formations = [makeFormation({ id: '1', slots: ['guanyu', '', '', '', '', ''] })];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine(formations, generals);
      renderPanel(engine);

      // 编辑 + 移除
      fireEvent.click(screen.getByText('编辑'));
      const removeBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-slot-remove');
      fireEvent.click(removeBtn!);

      // 取消
      fireEvent.click(screen.getByTestId('modal-cancel'));

      // 弹窗消失，武将仍在
      expect(screen.queryByTestId('formation-remove-hero-confirm-modal')).not.toBeInTheDocument();
      expect(engine.getFormationSystem().removeFromFormation).not.toHaveBeenCalled();
    });

    it('确认移除应执行移除操作', () => {
      const formations = [makeFormation({ id: '1', slots: ['guanyu', '', '', '', '', ''] })];
      const generals = [makeGeneral({ id: 'guanyu', name: '关羽' })];
      const engine = createMockEngine(formations, generals);
      renderPanel(engine);

      // 编辑 + 移除
      fireEvent.click(screen.getByText('编辑'));
      const removeBtn = screen.getByTestId('formation-panel-card-1').querySelector('.tk-formation-slot-remove');
      fireEvent.click(removeBtn!);

      // 确认
      fireEvent.click(screen.getByTestId('modal-confirm'));

      expect(engine.getFormationSystem().removeFromFormation).toHaveBeenCalledWith('1', 'guanyu');
    });
  });

  // ═══════════════════════════════════════════
  // P1-03: 编队槽位扩展机制
  // ═══════════════════════════════════════════

  describe('P1-03 编队槽位扩展机制', () => {
    it('应显示编队扩展区域', () => {
      const engine = createMockEngine();
      renderPanel(engine);

      expect(screen.getByTestId('formation-expansion-section')).toBeInTheDocument();
      expect(screen.getByText('🔓 扩展编队位')).toBeInTheDocument();
    });

    it('应显示第4编队位解锁选项', () => {
      const engine = createMockEngine();
      renderPanel(engine);

      expect(screen.getByTestId('formation-expansion-slot-4')).toBeInTheDocument();
      expect(screen.getByText('第4编队位')).toBeInTheDocument();
    });

    it('资源充足时解锁按钮应可点击', () => {
      const engine = createMockEngine();
      engine.getResourceAmount = vi.fn().mockReturnValue(99999);
      renderPanel(engine);

      const btn = screen.getByTestId('formation-expansion-btn-4');
      expect(btn).not.toBeDisabled();
      expect(btn.textContent).toContain('解锁');
    });

    it('资源不足时解锁按钮应禁用', () => {
      const engine = createMockEngine();
      engine.getResourceAmount = vi.fn().mockReturnValue(0);
      renderPanel(engine);

      const btn = screen.getByTestId('formation-expansion-btn-4');
      expect(btn).toBeDisabled();
      expect(btn.textContent).toContain('资源不足');
    });

    it('点击解锁按钮应弹出确认弹窗', () => {
      const engine = createMockEngine();
      engine.getResourceAmount = vi.fn().mockReturnValue(99999);
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('formation-expansion-btn-4'));

      expect(screen.getByTestId('formation-expand-confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/解锁「第4编队位」/)).toBeInTheDocument();
    });

    it('确认解锁应扣除资源并更新编队上限', () => {
      const engine = createMockEngine();
      engine.getResourceAmount = vi.fn().mockReturnValue(99999);
      renderPanel(engine);

      // 点击解锁
      fireEvent.click(screen.getByTestId('formation-expansion-btn-4'));
      // 确认
      fireEvent.click(screen.getByTestId('modal-confirm'));

      // 应调用 consumeBatch
      expect(engine.resource.consumeBatch).toHaveBeenCalled();
      // localStorage 应更新
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tk-formation-unlocked-slots',
        '1',
      );
    });

    it('已解锁第4位后应显示第5位解锁选项', () => {
      // 模拟已解锁1个额外槽位
      localStorageMock.getItem = vi.fn((key: string) => {
        if (key === 'tk-formation-unlocked-slots') return '1';
        return null;
      });

      const engine = createMockEngine();
      renderPanel(engine);

      expect(screen.getByTestId('formation-expansion-slot-5')).toBeInTheDocument();
      expect(screen.getByText('第5编队位')).toBeInTheDocument();
    });

    it('编队上限应随解锁数量增加', () => {
      localStorageMock.getItem = vi.fn((key: string) => {
        if (key === 'tk-formation-unlocked-slots') return '2';
        return null;
      });

      const engine = createMockEngine();
      renderPanel(engine);

      // 5个编队都解锁后不应显示扩展区域
      expect(screen.queryByTestId('formation-expansion-section')).not.toBeInTheDocument();
    });
  });
});
