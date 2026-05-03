/**
 * CooldownManager 单元测试 (统一冷却管理器)
 *
 * 测试冷却设置/查询/清除/事件驱动/定时扫描
 */

import { CooldownManager } from '../CooldownManager';

describe('CooldownManager (统一冷却管理器)', () => {
  let manager: CooldownManager;

  beforeEach(() => {
    manager = new CooldownManager({ scanInterval: 100 });
  });

  afterEach(() => {
    manager.destroy();
  });

  // ── 初始状态 ─────────────────────────────────

  describe('初始状态', () => {
    it('无活跃冷却', () => {
      expect(manager.getAllActive()).toHaveLength(0);
    });

    it('不在冷却中', () => {
      expect(manager.isInCooldown('city-1', 'capture')).toBe(false);
    });
  });

  // ── 设置冷却 ─────────────────────────────────

  describe('设置冷却', () => {
    it('设置后进入冷却', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      expect(manager.isInCooldown('city-1', 'capture')).toBe(true);
    });

    it('剩余时间>0', () => {
      manager.setCooldown('city-1', 'capture', 10000);
      expect(manager.getRemaining('city-1', 'capture')).toBeGreaterThan(0);
    });

    it('不同类型独立管理', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      manager.setCooldown('city-1', 'insider', 2000);
      expect(manager.isInCooldown('city-1', 'capture')).toBe(true);
      expect(manager.isInCooldown('city-1', 'insider')).toBe(true);
    });

    it('同ID不同类型不冲突', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      expect(manager.isInCooldown('city-1', 'insider')).toBe(false);
    });
  });

  // ── 清除冷却 ─────────────────────────────────

  describe('清除冷却', () => {
    it('清除后退出冷却', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      manager.clearCooldown('city-1', 'capture');
      expect(manager.isInCooldown('city-1', 'capture')).toBe(false);
    });

    it('清除不存在的冷却不报错', () => {
      manager.clearCooldown('city-1', 'capture');
      expect(manager.isInCooldown('city-1', 'capture')).toBe(false);
    });
  });

  // ── 事件驱动 ─────────────────────────────────

  describe('事件驱动', () => {
    it('设置冷却时触发active事件', () => {
      const listener = jest.fn();
      manager.onStateChanged(listener);
      manager.setCooldown('city-1', 'capture', 1000);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        id: 'city-1',
        type: 'capture',
        status: 'active',
      }));
    });

    it('清除冷却时触发ended事件', () => {
      const listener = jest.fn();
      manager.onStateChanged(listener);
      manager.setCooldown('city-1', 'capture', 1000);
      manager.clearCooldown('city-1', 'capture');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        id: 'city-1',
        type: 'capture',
        status: 'ended',
      }));
    });

    it('移除监听器后不再触发', () => {
      const listener = jest.fn();
      manager.onStateChanged(listener);
      manager.offStateChanged(listener);
      manager.setCooldown('city-1', 'capture', 1000);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── 查询 ─────────────────────────────────────

  describe('查询', () => {
    it('getCooldown返回冷却条目', () => {
      manager.setCooldown('city-1', 'capture', 10000);
      const entry = manager.getCooldown('city-1', 'capture');
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe('city-1');
      expect(entry!.type).toBe('capture');
      expect(entry!.remaining).toBeGreaterThan(0);
    });

    it('getAllActive返回所有活跃冷却', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      manager.setCooldown('city-2', 'insider', 2000);
      expect(manager.getAllActive()).toHaveLength(2);
    });
  });

  // ── 自然结束 ─────────────────────────────────

  describe('自然结束', () => {
    it('冷却到期后自动清理', async () => {
      manager.setCooldown('city-1', 'capture', 50);
      expect(manager.isInCooldown('city-1', 'capture')).toBe(true);

      // 等待扫描触发
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(manager.isInCooldown('city-1', 'capture')).toBe(false);
    });

    it('冷却到期触发ended事件', async () => {
      const listener = jest.fn();
      manager.onStateChanged(listener);
      manager.setCooldown('city-1', 'capture', 50);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        id: 'city-1',
        type: 'capture',
        status: 'ended',
      }));
    });
  });

  // ── destroy ──────────────────────────────────

  describe('destroy', () => {
    it('销毁后清空数据', () => {
      manager.setCooldown('city-1', 'capture', 1000);
      manager.destroy();
      expect(manager.getAllActive()).toHaveLength(0);
    });

    it('销毁后设置冷却仍可用(惰性初始化)', () => {
      manager.destroy();
      manager.setCooldown('city-1', 'capture', 1000);
      expect(manager.isInCooldown('city-1', 'capture')).toBe(true);
    });
  });
});
