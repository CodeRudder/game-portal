import { vi } from 'vitest';
/**
 * NPCSystem 单元测试
 *
 * 覆盖 NPC 管理系统的所有功能：
 * - ISubsystem 接口
 * - NPC 创建和删除
 * - NPC 查询（ID/区域/职业/位置）
 * - 好感度管理
 * - 位置管理
 * - 存档序列化
 */

import { NPCSystem } from '../NPCSystem';
import type { ISystemDeps } from '../../../core/types';
import type { NPCProfession, NPCData } from '../../../core/npc';
import { DEFAULT_NPCS, NPC_PROFESSION_DEFS } from '../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createNPCSystem(): NPCSystem {
  const sys = new NPCSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('NPCSystem', () => {
  let npcSys: NPCSystem;

  beforeEach(() => {
    npcSys = createNPCSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npc', () => {
      expect(npcSys.name).toBe('npc');
    });

    it('init 后加载默认 NPC', () => {
      const state = npcSys.getState();
      expect(state.npcs.length).toBe(DEFAULT_NPCS.length);
    });

    it('reset 恢复初始状态', () => {
      npcSys.changeAffinity('npc-merchant-01', 50);
      npcSys.reset();
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(DEFAULT_NPCS[0].affinity);
    });

    it('getState 返回完整状态', () => {
      const state = npcSys.getState();
      expect(state.npcs).toBeDefined();
      expect(Array.isArray(state.npcs)).toBe(true);
    });

    it('update 不抛异常', () => {
      expect(() => npcSys.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. NPC 创建与删除
  // ═══════════════════════════════════════════
  describe('NPC 创建与删除', () => {
    it('createNPC 创建新 NPC', () => {
      const initialCount = npcSys.getNPCCount();
      const npc = npcSys.createNPC('测试商人', 'merchant', { x: 10, y: 10 });
      expect(npc.name).toBe('测试商人');
      expect(npc.profession).toBe('merchant');
      expect(npc.position).toEqual({ x: 10, y: 10 });
      expect(npc.affinity).toBe(NPC_PROFESSION_DEFS.merchant.defaultAffinity);
      expect(npc.visible).toBe(true);
      expect(npcSys.getNPCCount()).toBe(initialCount + 1);
    });

    it('createNPC 使用自定义参数', () => {
      const npc = npcSys.createNPC('测试', 'warrior', { x: 5, y: 5 }, {
        affinity: 80,
        visible: false,
        dialogId: 'custom-dialog',
      });
      expect(npc.affinity).toBe(80);
      expect(npc.visible).toBe(false);
      expect(npc.dialogId).toBe('custom-dialog');
    });

    it('createNPC 生成唯一 ID', () => {
      const npc1 = npcSys.createNPC('A', 'merchant', { x: 1, y: 1 });
      const npc2 = npcSys.createNPC('B', 'merchant', { x: 2, y: 2 });
      expect(npc1.id).not.toBe(npc2.id);
      expect(npc1.id).toContain('merchant');
    });

    it('createNPC 自动计算区域', () => {
      const npc = npcSys.createNPC('测试', 'merchant', { x: 30, y: 10 });
      expect(npc.region).toBe('central_plains');
    });

    it('createNPC 触发 npc:created 事件', () => {
      const deps = mockDeps();
      const sys = new NPCSystem();
      sys.init(deps);
      sys.createNPC('测试', 'merchant', { x: 10, y: 10 });
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:created',
        expect.objectContaining({ npcId: expect.any(String) }),
      );
    });

    it('removeNPC 删除存在的 NPC', () => {
      const npc = npcSys.createNPC('待删', 'merchant', { x: 10, y: 10 });
      const result = npcSys.removeNPC(npc.id);
      expect(result).toBe(true);
      expect(npcSys.hasNPC(npc.id)).toBe(false);
    });

    it('removeNPC 删除不存在的 NPC 返回 false', () => {
      const result = npcSys.removeNPC('non-existent');
      expect(result).toBe(false);
    });

    it('removeNPC 触发 npc:removed 事件', () => {
      const deps = mockDeps();
      const sys = new NPCSystem();
      sys.init(deps);
      const npc = sys.createNPC('待删', 'merchant', { x: 10, y: 10 });
      sys.removeNPC(npc.id);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:removed',
        expect.objectContaining({ npcId: npc.id }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 3. NPC 查询
  // ═══════════════════════════════════════════
  describe('NPC 查询', () => {
    it('getNPCById 返回正确的 NPC', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc).toBeDefined();
      expect(npc!.name).toBe('甄商');
    });

    it('getNPCById 返回副本（不影响原数据）', () => {
      const npc1 = npcSys.getNPCById('npc-merchant-01');
      npc1!.affinity = 999;
      const npc2 = npcSys.getNPCById('npc-merchant-01');
      expect(npc2!.affinity).not.toBe(999);
    });

    it('getNPCById 不存在返回 undefined', () => {
      const npc = npcSys.getNPCById('non-existent');
      expect(npc).toBeUndefined();
    });

    it('hasNPC 正确判断存在性', () => {
      expect(npcSys.hasNPC('npc-merchant-01')).toBe(true);
      expect(npcSys.hasNPC('non-existent')).toBe(false);
    });

    it('getNPCCount 返回正确数量', () => {
      expect(npcSys.getNPCCount()).toBe(DEFAULT_NPCS.length);
    });

    it('getAllNPCs 返回所有 NPC', () => {
      const all = npcSys.getAllNPCs();
      expect(all.length).toBe(DEFAULT_NPCS.length);
    });

    it('getNPCsByRegion 按区域过滤', () => {
      const central = npcSys.getNPCsByRegion('central_plains');
      const western = npcSys.getNPCsByRegion('western_shu');
      const jiangnan = npcSys.getNPCsByRegion('jiangnan');

      expect(central.length).toBeGreaterThan(0);
      expect(western.length).toBeGreaterThan(0);
      expect(jiangnan.length).toBeGreaterThan(0);
      expect(central.every((n) => n.region === 'central_plains')).toBe(true);
      expect(western.every((n) => n.region === 'western_shu')).toBe(true);
      expect(jiangnan.every((n) => n.region === 'jiangnan')).toBe(true);
    });

    it('getNPCsByProfession 按职业过滤', () => {
      const merchants = npcSys.getNPCsByProfession('merchant');
      const warriors = npcSys.getNPCsByProfession('warrior');
      expect(merchants.every((n) => n.profession === 'merchant')).toBe(true);
      expect(warriors.every((n) => n.profession === 'warrior')).toBe(true);
    });

    it('getVisibleNPCs 只返回可见 NPC', () => {
      npcSys.setVisible('npc-merchant-01', false);
      const visible = npcSys.getVisibleNPCs();
      expect(visible.every((n) => n.visible)).toBe(true);
      expect(visible.find((n) => n.id === 'npc-merchant-01')).toBeUndefined();
    });

    it('getNPCsInBounds 按坐标范围过滤', () => {
      const npcs = npcSys.getNPCsInBounds(30, 5, 42, 16);
      expect(npcs.length).toBeGreaterThan(0);
      expect(npcs.every(
        (n) => n.position.x >= 30 && n.position.x <= 42 && n.position.y >= 5 && n.position.y <= 16,
      )).toBe(true);
    });

    it('getNPCsInBounds 空范围返回空数组', () => {
      const npcs = npcSys.getNPCsInBounds(0, 0, 0, 0);
      expect(npcs).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 好感度管理
  // ═══════════════════════════════════════════
  describe('好感度管理', () => {
    it('changeAffinity 正确增加好感度', () => {
      const result = npcSys.changeAffinity('npc-merchant-01', 10);
      expect(result).toBe(DEFAULT_NPCS[0].affinity + 10);
    });

    it('changeAffinity 正确减少好感度', () => {
      const result = npcSys.changeAffinity('npc-merchant-01', -10);
      expect(result).toBe(DEFAULT_NPCS[0].affinity - 10);
    });

    it('changeAffinity 上限为 100', () => {
      const result = npcSys.changeAffinity('npc-merchant-01', 200);
      expect(result).toBe(100);
    });

    it('changeAffinity 下限为 0', () => {
      const result = npcSys.changeAffinity('npc-merchant-01', -200);
      expect(result).toBe(0);
    });

    it('changeAffinity 不存在的 NPC 返回 null', () => {
      const result = npcSys.changeAffinity('non-existent', 10);
      expect(result).toBeNull();
    });

    it('changeAffinity 触发 npc:affinity_changed 事件', () => {
      const deps = mockDeps();
      const sys = new NPCSystem();
      sys.init(deps);
      sys.changeAffinity('npc-merchant-01', 10);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:affinity_changed',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          delta: 10,
        }),
      );
    });

    it('changeAffinity 等级变化触发 npc:affinity_level_changed 事件', () => {
      const deps = mockDeps();
      const sys = new NPCSystem();
      sys.init(deps);
      // 从30提升到65（neutral→trusted）
      sys.changeAffinity('npc-merchant-01', 35);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:affinity_level_changed',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          oldLevel: 'neutral',
          newLevel: 'trusted',
        }),
      );
    });

    it('setAffinity 直接设置好感度', () => {
      const result = npcSys.setAffinity('npc-merchant-01', 75);
      expect(result).toBe(true);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(75);
    });

    it('setAffinity 钳制到 0-100', () => {
      npcSys.setAffinity('npc-merchant-01', 150);
      let npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(100);

      npcSys.setAffinity('npc-merchant-01', -50);
      npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(0);
    });

    it('setAffinity 不存在的 NPC 返回 false', () => {
      expect(npcSys.setAffinity('non-existent', 50)).toBe(false);
    });

    it('getAffinityLevel 返回正确等级', () => {
      npcSys.setAffinity('npc-merchant-01', 10);
      expect(npcSys.getAffinityLevel('npc-merchant-01')).toBe('hostile');

      npcSys.setAffinity('npc-merchant-01', 30);
      expect(npcSys.getAffinityLevel('npc-merchant-01')).toBe('neutral');

      npcSys.setAffinity('npc-merchant-01', 50);
      expect(npcSys.getAffinityLevel('npc-merchant-01')).toBe('friendly');

      npcSys.setAffinity('npc-merchant-01', 75);
      expect(npcSys.getAffinityLevel('npc-merchant-01')).toBe('trusted');

      npcSys.setAffinity('npc-merchant-01', 90);
      expect(npcSys.getAffinityLevel('npc-merchant-01')).toBe('bonded');
    });

    it('getAffinityLevel 不存在的 NPC 返回 null', () => {
      expect(npcSys.getAffinityLevel('non-existent')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 位置管理
  // ═══════════════════════════════════════════
  describe('位置管理', () => {
    it('moveNPC 移动到新位置', () => {
      const result = npcSys.moveNPC('npc-merchant-01', { x: 50, y: 30 });
      expect(result).toBe(true);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.position).toEqual({ x: 50, y: 30 });
    });

    it('moveNPC 自动更新区域', () => {
      npcSys.moveNPC('npc-merchant-01', { x: 50, y: 30 });
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.region).toBe('jiangnan');
    });

    it('moveNPC 不存在的 NPC 返回 false', () => {
      expect(npcSys.moveNPC('non-existent', { x: 0, y: 0 })).toBe(false);
    });

    it('moveNPC 触发 npc:moved 事件', () => {
      const deps = mockDeps();
      const sys = new NPCSystem();
      sys.init(deps);
      sys.moveNPC('npc-merchant-01', { x: 50, y: 30 });
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:moved',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          position: { x: 50, y: 30 },
        }),
      );
    });

    it('setVisible 设置可见性', () => {
      expect(npcSys.setVisible('npc-merchant-01', false)).toBe(true);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.visible).toBe(false);
    });

    it('setVisible 不存在的 NPC 返回 false', () => {
      expect(npcSys.setVisible('non-existent', false)).toBe(false);
    });

    it('updateLastInteracted 更新交互时间', () => {
      expect(npcSys.updateLastInteracted('npc-merchant-01', 42)).toBe(true);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.lastInteractedAt).toBe(42);
    });

    it('updateLastInteracted 不存在的 NPC 返回 false', () => {
      expect(npcSys.updateLastInteracted('non-existent', 42)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('exportSaveData 导出完整存档', () => {
      const save = npcSys.exportSaveData();
      expect(save.npcs.length).toBe(DEFAULT_NPCS.length);
      expect(save.version).toBe(1);
    });

    it('importSaveData 恢复存档', () => {
      npcSys.changeAffinity('npc-merchant-01', 50);
      const save = npcSys.exportSaveData();

      const newSys = createNPCSystem();
      newSys.importSaveData(save);
      const npc = newSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(80); // 30 + 50
    });

    it('importSaveData 覆盖现有数据', () => {
      const save = {
        npcs: [{
          id: 'npc-test',
          name: '测试',
          profession: 'merchant' as NPCProfession,
          affinity: 50,
          position: { x: 10, y: 10 },
          region: 'central_plains' as const,
          visible: true,
          dialogId: 'test-dialog',
          createdAt: 0,
          lastInteractedAt: 0,
        }],
        version: 1,
      };

      npcSys.importSaveData(save);
      expect(npcSys.getNPCCount()).toBe(1);
      expect(npcSys.hasNPC('npc-test')).toBe(true);
    });
  });
});
