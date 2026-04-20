/**
 * 引擎层 — 脏矩形管理器
 *
 * 跟踪画面变化区域，仅重绘脏区域以优化渲染性能。
 * 支持标记、合并、查询脏矩形，以及全量重绘模式。
 *
 * @module engine/unification/DirtyRectManager
 */

import type { DirtyRect } from '../../core/unification';

// ─────────────────────────────────────────────
// 脏矩形管理器
// ─────────────────────────────────────────────

/**
 * 脏矩形管理器
 *
 * 每帧标记发生变化的小区域，合并重叠矩形，
 * 渲染时仅重绘脏区域，避免全屏重绘。
 *
 * @example
 * ```ts
 * const drm = new DirtyRectManager();
 * drm.markDirty({ x: 10, y: 20, width: 100, height: 50 });
 * drm.markDirty({ x: 80, y: 30, width: 60, height: 40 });
 * const merged = drm.merge(); // 合并重叠区域
 * // 渲染后清除
 * drm.clear();
 * ```
 */
export class DirtyRectManager {
  private dirtyRects: DirtyRect[] = [];
  private fullRedrawNeeded = false;

  /** 标记一个区域为脏 */
  markDirty(rect: DirtyRect): void {
    this.dirtyRects.push(rect);
  }

  /** 标记整个画面需要重绘 */
  markFullRedraw(): void {
    this.fullRedrawNeeded = true;
    this.dirtyRects = [];
  }

  /** 获取当前脏矩形列表（全量重绘时返回空数组） */
  getDirtyRects(): DirtyRect[] {
    return this.fullRedrawNeeded ? [] : [...this.dirtyRects];
  }

  /** 是否需要全量重绘 */
  isFullRedraw(): boolean {
    return this.fullRedrawNeeded;
  }

  /** 检查对象区域是否与任何脏矩形重叠 */
  isObjectDirty(x: number, y: number, width: number, height: number): boolean {
    if (this.fullRedrawNeeded) return true;
    return this.dirtyRects.some(r =>
      r.x < x + width && r.x + r.width > x &&
      r.y < y + height && r.y + r.height > y,
    );
  }

  /** 合并重叠的脏矩形（原地合并并返回结果） */
  merge(): DirtyRect[] {
    if (this.fullRedrawNeeded || this.dirtyRects.length === 0) {
      return [];
    }

    const merged: DirtyRect[] = [];
    const sorted = [...this.dirtyRects].sort((a, b) => a.x - b.x || a.y - b.y);

    for (const rect of sorted) {
      const overlap = merged.find(m =>
        m.x < rect.x + rect.width && m.x + m.width > rect.x &&
        m.y < rect.y + rect.height && m.y + m.height > rect.y,
      );
      if (overlap) {
        const x = Math.min(overlap.x, rect.x);
        const y = Math.min(overlap.y, rect.y);
        overlap.x = x;
        overlap.y = y;
        overlap.width = Math.max(overlap.x + overlap.width, rect.x + rect.width) - x;
        overlap.height = Math.max(overlap.y + overlap.height, rect.y + rect.height) - y;
      } else {
        merged.push({ ...rect });
      }
    }

    this.dirtyRects = merged;
    return merged;
  }

  /** 清除所有脏矩形（每帧渲染后调用） */
  clear(): void {
    this.dirtyRects = [];
    this.fullRedrawNeeded = false;
  }
}
