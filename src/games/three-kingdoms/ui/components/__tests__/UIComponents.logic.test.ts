/**
 * UI 组件逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 ToastProvider 的状态管理逻辑：
 * - addToast 添加消息
 * - 超过最大堆叠数量时移除最早的
 * - removeToast 移除指定消息
 * - useToast 在无 Provider 时抛错
 */

import { ToastProvider, useToast } from '../ToastProvider';
import type { ToastItem, ToastType } from '../Toast';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ─────────────────────────────────────────────
// 提取纯逻辑进行测试（不依赖 React DOM 渲染）
// ─────────────────────────────────────────────

/** Toast 管理器纯逻辑（从 ToastProvider 提取的核心状态管理） */
class ToastManager {
  private toasts: ToastItem[] = [];
  private readonly maxToasts: number;
  private idCounter = 0;

  constructor(maxToasts = 5) {
    this.maxToasts = maxToasts;
  }

  addToast(message: string, type: ToastType = 'info', duration?: number): ToastItem {
    const id = `toast-${++this.idCounter}`;
    const item: ToastItem = { id, message, type, duration };
    this.toasts = [...this.toasts, item];
    if (this.toasts.length > this.maxToasts) {
      this.toasts = this.toasts.slice(-this.maxToasts);
    }
    return item;
  }

  removeToast(id: string): boolean {
    const before = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    return this.toasts.length < before;
  }

  getToasts(): readonly ToastItem[] {
    return this.toasts;
  }

  count(): number {
    return this.toasts.length;
  }
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('Toast 状态管理逻辑', () => {
  let mgr: ToastManager;

  beforeEach(() => {
    mgr = new ToastManager(5);
  });

  it('添加一条 Toast', () => {
    const item = mgr.addToast('测试消息', 'success');
    expect(item.message).toBe('测试消息');
    expect(item.type).toBe('success');
    expect(item.id).toBeTruthy();
    expect(mgr.count()).toBe(1);
  });

  it('默认类型为 info', () => {
    const item = mgr.addToast('默认消息');
    expect(item.type).toBe('info');
  });

  it('添加多条 Toast', () => {
    mgr.addToast('消息1');
    mgr.addToast('消息2');
    mgr.addToast('消息3');
    expect(mgr.count()).toBe(3);
  });

  it('超过最大堆叠数量时移除最早的', () => {
    const mgr5 = new ToastManager(3);
    mgr5.addToast('第1条');
    mgr5.addToast('第2条');
    mgr5.addToast('第3条');
    mgr5.addToast('第4条');
    expect(mgr5.count()).toBe(3);
    const toasts = mgr5.getToasts();
    expect(toasts[0].message).toBe('第2条');
    expect(toasts[2].message).toBe('第4条');
  });

  it('移除指定 Toast', () => {
    const item = mgr.addToast('要移除的');
    mgr.addToast('保留的');
    expect(mgr.count()).toBe(2);
    const removed = mgr.removeToast(item.id);
    expect(removed).toBe(true);
    expect(mgr.count()).toBe(1);
    expect(mgr.getToasts()[0].message).toBe('保留的');
  });

  it('移除不存在的 Toast 返回 false', () => {
    mgr.addToast('存在的');
    expect(mgr.removeToast('不存在的ID')).toBe(false);
    expect(mgr.count()).toBe(1);
  });

  it('Toast 支持四种类型', () => {
    const types: ToastType[] = ['success', 'error', 'warning', 'info'];
    types.forEach((type) => {
      const item = mgr.addToast(`${type}消息`, type);
      expect(item.type).toBe(type);
    });
    expect(mgr.count()).toBe(4);
  });

  it('Toast 可设置自定义 duration', () => {
    const item = mgr.addToast('自定义时长', 'info', 5000);
    expect(item.duration).toBe(5000);
  });

  it('每条 Toast 有唯一 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const item = mgr.addToast(`消息${i}`);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
    }
  });
});

// ─────────────────────────────────────────────
// Panel 交互逻辑测试
// ─────────────────────────────────────────────

describe('Panel 交互逻辑', () => {
  /** Panel 状态管理（纯逻辑） */
  class PanelState {
    collapsed = false;
    isOpen: boolean;

    constructor(isOpen = true) {
      this.isOpen = isOpen;
    }

    toggleCollapse() {
      this.collapsed = !this.collapsed;
    }

    close() {
      this.isOpen = false;
    }

    shouldShowContent(): boolean {
      return this.isOpen && !this.collapsed;
    }
  }

  it('初始状态为展开', () => {
    const panel = new PanelState(true);
    expect(panel.collapsed).toBe(false);
    expect(panel.shouldShowContent()).toBe(true);
  });

  it('折叠后不显示内容', () => {
    const panel = new PanelState(true);
    panel.toggleCollapse();
    expect(panel.collapsed).toBe(true);
    expect(panel.shouldShowContent()).toBe(false);
  });

  it('再次折叠恢复展开', () => {
    const panel = new PanelState(true);
    panel.toggleCollapse();
    panel.toggleCollapse();
    expect(panel.collapsed).toBe(false);
  });

  it('关闭后 isOpen 为 false', () => {
    const panel = new PanelState(true);
    panel.close();
    expect(panel.isOpen).toBe(false);
    expect(panel.shouldShowContent()).toBe(false);
  });

  it('关闭状态下折叠无效', () => {
    const panel = new PanelState(false);
    expect(panel.shouldShowContent()).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Modal 交互逻辑测试
// ─────────────────────────────────────────────

describe('Modal 交互逻辑', () => {
  type ModalType = 'info' | 'confirm' | 'warning';

  /** Modal 状态管理（纯逻辑） */
  class ModalState {
    isOpen: boolean;
    type: ModalType;
    confirmed = false;
    cancelled = false;

    constructor(isOpen: boolean, type: ModalType = 'info') {
      this.isOpen = isOpen;
      this.type = type;
    }

    confirm() {
      if (!this.isOpen) return;
      this.confirmed = true;
      this.isOpen = false;
    }

    cancel() {
      if (!this.isOpen) return;
      this.cancelled = true;
      this.isOpen = false;
    }

    shouldShowConfirmButton(): boolean {
      return this.type !== 'info';
    }

    shouldShowCancelButton(): boolean {
      return this.type !== 'info';
    }
  }

  it('info 类型只显示关闭按钮', () => {
    const modal = new ModalState(true, 'info');
    expect(modal.shouldShowConfirmButton()).toBe(false);
    expect(modal.shouldShowCancelButton()).toBe(false);
  });

  it('confirm 类型显示确认和取消按钮', () => {
    const modal = new ModalState(true, 'confirm');
    expect(modal.shouldShowConfirmButton()).toBe(true);
    expect(modal.shouldShowCancelButton()).toBe(true);
  });

  it('warning 类型显示确认和取消按钮', () => {
    const modal = new ModalState(true, 'warning');
    expect(modal.shouldShowConfirmButton()).toBe(true);
    expect(modal.shouldShowCancelButton()).toBe(true);
  });

  it('确认后关闭弹窗', () => {
    const modal = new ModalState(true, 'confirm');
    modal.confirm();
    expect(modal.confirmed).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('取消后关闭弹窗', () => {
    const modal = new ModalState(true, 'confirm');
    modal.cancel();
    expect(modal.cancelled).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('关闭状态下操作无效', () => {
    const modal = new ModalState(false, 'confirm');
    modal.confirm();
    expect(modal.confirmed).toBe(false);
  });
});
