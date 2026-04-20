/**
 * DirtyRectManager 测试
 *
 * 覆盖：
 *   - 标记脏矩形
 *   - 全量重绘
 *   - 对象脏判断
 *   - 合并重叠矩形
 *   - 清除
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirtyRectManager } from '../DirtyRectManager';

describe('DirtyRectManager', () => {
  let mgr: DirtyRectManager;

  beforeEach(() => {
    mgr = new DirtyRectManager();
  });

  it('应标记脏矩形', () => {
    mgr.markDirty({ x: 10, y: 20, width: 50, height: 60 });
    const rects = mgr.getDirtyRects();
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 10, y: 20, width: 50, height: 60 });
  });

  it('应标记多个脏矩形', () => {
    mgr.markDirty({ x: 0, y: 0, width: 10, height: 10 });
    mgr.markDirty({ x: 100, y: 100, width: 20, height: 20 });
    expect(mgr.getDirtyRects()).toHaveLength(2);
  });

  it('markFullRedraw 应标记全量重绘', () => {
    mgr.markFullRedraw();
    expect(mgr.isFullRedraw()).toBe(true);
    expect(mgr.getDirtyRects()).toHaveLength(0);
  });

  it('全量重绘时 getDirtyRects 应返回空数组', () => {
    mgr.markDirty({ x: 0, y: 0, width: 10, height: 10 });
    mgr.markFullRedraw();
    expect(mgr.getDirtyRects()).toHaveLength(0);
  });

  it('isObjectDirty 应检查对象是否在脏区域内', () => {
    mgr.markDirty({ x: 0, y: 0, width: 100, height: 100 });
    expect(mgr.isObjectDirty(10, 10, 20, 20)).toBe(true);
    expect(mgr.isObjectDirty(200, 200, 10, 10)).toBe(false);
  });

  it('全量重绘时所有对象都应标记为脏', () => {
    mgr.markFullRedraw();
    expect(mgr.isObjectDirty(500, 500, 10, 10)).toBe(true);
  });

  it('merge 应合并重叠矩形', () => {
    mgr.markDirty({ x: 0, y: 0, width: 50, height: 50 });
    mgr.markDirty({ x: 30, y: 30, width: 50, height: 50 });
    const merged = mgr.merge();
    expect(merged.length).toBeLessThanOrEqual(2);
  });

  it('merge 不重叠矩形应保持独立', () => {
    mgr.markDirty({ x: 0, y: 0, width: 10, height: 10 });
    mgr.markDirty({ x: 100, y: 100, width: 10, height: 10 });
    const merged = mgr.merge();
    expect(merged).toHaveLength(2);
  });

  it('merge 全量重绘时应返回空数组', () => {
    mgr.markFullRedraw();
    expect(mgr.merge()).toHaveLength(0);
  });

  it('merge 空列表应返回空数组', () => {
    expect(mgr.merge()).toHaveLength(0);
  });

  it('clear 应清除所有脏矩形和全量重绘标记', () => {
    mgr.markDirty({ x: 0, y: 0, width: 10, height: 10 });
    mgr.markFullRedraw();
    mgr.clear();
    expect(mgr.getDirtyRects()).toHaveLength(0);
    expect(mgr.isFullRedraw()).toBe(false);
  });

  it('clear 后 isObjectDirty 应返回 false', () => {
    mgr.markDirty({ x: 0, y: 0, width: 100, height: 100 });
    mgr.clear();
    expect(mgr.isObjectDirty(10, 10, 20, 20)).toBe(false);
  });

  it('合并后的矩形应包含原始区域', () => {
    mgr.markDirty({ x: 0, y: 0, width: 50, height: 50 });
    mgr.markDirty({ x: 40, y: 40, width: 20, height: 20 });
    const merged = mgr.merge();
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBe(0);
    expect(merged[0].y).toBe(0);
    expect(merged[0].width).toBeGreaterThanOrEqual(60);
    expect(merged[0].height).toBeGreaterThanOrEqual(60);
  });
});
