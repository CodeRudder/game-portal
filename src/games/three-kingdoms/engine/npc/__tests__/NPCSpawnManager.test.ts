/**
 * NPCSpawnManager 单元测试
 *
 * 覆盖：registerTemplate、getConfig/setConfig、updateTimer/trySpawn、
 *       forceSpawn、exportSaveData/importSaveData、fullReset
 */
import { describe, it, expect, vi } from 'vitest';
import { NPCSpawnManager } from '../NPCSpawnManager';
import type { SpawnManagerDeps, INPCSystemFacade } from '../NPCSpawnManager';
import type { NPCSpawnTemplate, NPCSpawnConfig, NPCData, GridPosition } from '../../../core/npc';

function makeTemplate(overrides: Partial<NPCSpawnTemplate> = {}): NPCSpawnTemplate {
  return {
    id: 'tmpl-1',
    name: '测试NPC',
    profession: 'merchant',
    region: 'region-1',
    patrolPathId: 'path-1',
    initialAffinity: 50,
    weight: 1,
    ...overrides,
  };
}

function makeNPCData(overrides: Partial<NPCData> = {}): NPCData {
  return {
    id: 'npc-1',
    name: '测试NPC',
    profession: 'merchant',
    affinity: 50,
    position: { x: 0, y: 0 },
    region: 'region-1',
    visible: true,
    ...overrides,
  };
}

function createMockFacade(npcCount = 0, regionCount = 0): INPCSystemFacade {
  return {
    getNPCCount: () => npcCount,
    getNPCsByRegion: () => Array(regionCount).fill(makeNPCData()),
    createNPC: () => makeNPCData(),
  };
}

function createMockDeps(facade: INPCSystemFacade): SpawnManagerDeps {
  return {
    getNPCSystem: () => facade,
    assignPatrol: vi.fn(),
    getPathStartPosition: () => ({ x: 10, y: 20 }),
    emitEvent: vi.fn(),
  };
}

describe('NPCSpawnManager', () => {
  describe('配置管理', () => {
    it('获取默认配置', () => {
      const mgr = new NPCSpawnManager();
      const config = mgr.getConfig();
      expect(config.spawnInterval).toBe(30);
      expect(config.maxNPCCount).toBe(20);
    });

    it('局部更新配置', () => {
      const mgr = new NPCSpawnManager();
      mgr.setConfig({ maxNPCCount: 50 });
      expect(mgr.getConfig().maxNPCCount).toBe(50);
      expect(mgr.getConfig().spawnInterval).toBe(30);
    });
  });

  describe('模板管理', () => {
    it('注册模板', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      expect(mgr.getTemplate('tmpl-1')).toBeDefined();
      expect(mgr.getTemplate('tmpl-1')!.name).toBe('测试NPC');
    });

    it('批量注册模板', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplates([
        makeTemplate({ id: 'tmpl-1' }),
        makeTemplate({ id: 'tmpl-2' }),
      ]);
      expect(mgr.getAllTemplates()).toHaveLength(2);
    });

    it('获取不存在的模板返回 undefined', () => {
      const mgr = new NPCSpawnManager();
      expect(mgr.getTemplate('not-exist')).toBeUndefined();
    });

    it('getAllTemplates 返回副本', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      const templates = mgr.getAllTemplates();
      const templates2 = mgr.getAllTemplates();
      expect(templates).not.toBe(templates2);
    });
  });

  describe('刷新逻辑', () => {
    it('依赖未设置时返回失败', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());

      const result = mgr.trySpawn();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('依赖未设置');
    });

    it('无模板时返回失败', () => {
      const mgr = new NPCSpawnManager();
      mgr.setDeps(createMockDeps(createMockFacade()));

      const result = mgr.trySpawn();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('没有可用的刷新模板');
    });

    it('全局NPC上限时返回失败', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setDeps(createMockDeps(createMockFacade(20)));

      const result = mgr.trySpawn();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('已达全局NPC上限');
    });

    it('区域NPC上限时返回失败', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setConfig({ maxNPCPerRegion: 5 });
      mgr.setDeps(createMockDeps(createMockFacade(0, 5)));

      const result = mgr.trySpawn();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('已达区域NPC上限');
    });

    it('NPC创建失败时返回失败', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      const facade: INPCSystemFacade = {
        getNPCCount: () => 0,
        getNPCsByRegion: () => [],
        createNPC: () => null,
      };
      mgr.setDeps(createMockDeps(facade));

      const result = mgr.trySpawn();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('NPC创建失败');
    });

    it('成功刷新 NPC', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      const facade = createMockFacade(0, 0);
      const deps = createMockDeps(facade);
      mgr.setDeps(deps);

      const result = mgr.trySpawn();

      expect(result.success).toBe(true);
      expect(result.npcId).toBe('npc-1');
      expect(deps.assignPatrol).toHaveBeenCalledWith('npc-1', 'path-1');
      expect(deps.emitEvent).toHaveBeenCalledWith('patrol:npc_spawned', expect.objectContaining({
        npcId: 'npc-1',
      }));
    });

    it('成功刷新后记录', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setDeps(createMockDeps(createMockFacade(0, 0)));

      mgr.trySpawn();
      expect(mgr.getRecords()).toHaveLength(1);
    });

    it('forceSpawn 等同 trySpawn', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setDeps(createMockDeps(createMockFacade(0, 0)));

      const result = mgr.forceSpawn();
      expect(result.success).toBe(true);
    });
  });

  describe('updateTimer', () => {
    it('自动刷新计时', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setDeps(createMockDeps(createMockFacade(0, 0)));
      mgr.setConfig({ spawnInterval: 10 });

      mgr.updateTimer(5);
      expect(mgr.getTimer()).toBeCloseTo(5, 5);

      mgr.updateTimer(5);
      expect(mgr.getTimer()).toBe(0); // 触发后重置
    });

    it('自动刷新禁用时不计时', () => {
      const mgr = new NPCSpawnManager();
      mgr.setConfig({ autoSpawnEnabled: false });

      mgr.updateTimer(100);
      expect(mgr.getTimer()).toBe(0);
    });

    it('间隔为0时不计时', () => {
      const mgr = new NPCSpawnManager();
      mgr.setConfig({ spawnInterval: 0 });

      mgr.updateTimer(100);
      expect(mgr.getTimer()).toBe(0);
    });
  });

  describe('序列化', () => {
    it('exportSaveData / importSaveData', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setDeps(createMockDeps(createMockFacade(0, 0)));
      mgr.trySpawn();

      const data = mgr.exportSaveData();
      expect(data.spawnRecords).toHaveLength(1);
      expect(data.spawnTimer).toBe(0);

      const mgr2 = new NPCSpawnManager();
      mgr2.importSaveData(data);
      expect(mgr2.getRecords()).toHaveLength(1);
    });

    it('importSaveData 处理空数据', () => {
      const mgr = new NPCSpawnManager();
      mgr.importSaveData({});
      expect(mgr.getRecords()).toHaveLength(0);
      expect(mgr.getTimer()).toBe(0);
    });
  });

  describe('fullReset', () => {
    it('完全重置', () => {
      const mgr = new NPCSpawnManager();
      mgr.registerTemplate(makeTemplate());
      mgr.setConfig({ maxNPCCount: 100 });
      mgr.setDeps(createMockDeps(createMockFacade(0, 0)));
      mgr.trySpawn();

      mgr.fullReset();

      expect(mgr.getAllTemplates()).toHaveLength(0);
      expect(mgr.getRecords()).toHaveLength(0);
      expect(mgr.getTimer()).toBe(0);
      expect(mgr.getConfig().maxNPCCount).toBe(20); // 默认值
    });
  });
});
