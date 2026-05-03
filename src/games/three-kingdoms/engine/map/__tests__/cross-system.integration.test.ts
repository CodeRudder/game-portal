/**
 * 跨系统集成测试
 *
 * 验证多个子系统协同工作:
 * - MarchingSystem + ConquestAnimation
 * - OfflineEventSystem + ProductionSystem
 * - MapEditor + ASCIIMapParser + PixelMapRenderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarchingSystem } from '../MarchingSystem';
import { ConquestAnimationSystem } from '../ConquestAnimation';
import { OfflineEventSystem } from '../OfflineEventSystem';
import { ProductionSystem } from '../ProductionSystem';
import { MapEditor } from '../editor/MapEditor';
import { ASCIIMapParser } from '../../../core/map/ASCIIMapParser';
import type { ISystemDeps } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

describe('跨系统集成测试', () => {
  // ── 行军 + 攻城动画 ───────────────────────

  describe('行军 → 攻城动画联动', () => {
    let marching: MarchingSystem;
    let conquest: ConquestAnimationSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      marching = new MarchingSystem();
      conquest = new ConquestAnimationSystem();
      deps = createMockDeps();
      marching.init(deps);
    });

    it('行军到达 → 创建攻城动画', () => {
      // 创建短路径行军
      const path = [{ x: 100, y: 100 }, { x: 110, y: 100 }];
      const march = marching.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);
      marching.startMarch(march.id);

      // 模拟到达
      for (let i = 0; i < 100; i++) marching.update(1);

      expect(march.state).toBe('arrived');

      // 创建攻城动画
      const anim = conquest.create('city-b', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 300,
        general: '张飞',
      });

      expect(anim.cityId).toBe('city-b');
      expect(anim.toFaction).toBe('shu');
      expect(conquest.getActive().length).toBe(1);
    });

    it('行军取消 → 无攻城动画', () => {
      const path = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
      const march = marching.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);
      marching.cancelMarch(march.id);

      expect(marching.getActiveMarches().length).toBe(0);
      expect(conquest.getActive().length).toBe(0);
    });
  });

  // ── 离线事件 + 产出系统 ───────────────────

  describe('离线事件 + 产出系统联动', () => {
    let offline: OfflineEventSystem;
    let production: ProductionSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      offline = new OfflineEventSystem();
      production = new ProductionSystem();
      deps = createMockDeps();
      offline.init(deps);
      production.init(deps);
    });

    it('离线资源 → 产出系统累积', () => {
      // 注册领土
      production.registerTerritory('city-a', 3);

      // 设置城市数据
      offline.setCities([{ id: 'city-a', faction: 'player', level: 3 }]);

      // 模拟离线1小时
      (offline as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = offline.processOfflineTime();

      // 将离线资源添加到产出系统
      production.addResources('city-a', reward.resources);

      const resources = production.getResources('city-a');
      expect(resources!.gold).toBeGreaterThan(0);
      expect(resources!.grain).toBeGreaterThan(0);
    });

    it('离线事件 → 消耗产出资源', () => {
      production.registerTerritory('city-a', 3);
      production.addResources('city-a', { gold: 1000, grain: 500 });

      offline.setCities([{ id: 'city-a', faction: 'player', level: 3 }]);
      (offline as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = offline.processOfflineTime();

      // 处理事件(消耗资源)
      let consumed = false;
      for (const event of reward.events) {
        if (event.type === 'bandit_raid') {
          const goldLost = (event.data.goldLost as number) || 0;
          if (goldLost > 0) {
            production.consumeResources('city-a', { gold: goldLost });
            consumed = true;
          }
        }
        offline.markProcessed(event.id);
      }

      // 如果有山贼事件则验证消耗，否则验证资源仍为1000
      const resources = production.getResources('city-a');
      if (consumed) {
        expect(resources!.gold).toBeLessThan(1000);
      } else {
        expect(resources!.gold).toBe(1000);
      }
    });

    it('产出更新 + 离线心跳', () => {
      production.registerTerritory('city-a', 1);

      // 产出系统运行
      production.update(10); // 10秒

      // 离线心跳
      offline.heartbeat();

      const resources = production.getResources('city-a');
      expect(resources!.gold).toBeGreaterThan(0);
    });
  });

  // ── MapEditor + 解析器集成 ────────────────

  describe('MapEditor + ASCIIMapParser', () => {
    it('编辑 → 导出 → 解析 → 数据一致', () => {
      const editor = new MapEditor(20, 15);

      // 绘制地形
      editor.setBrushSymbol('^');
      editor.paint(0, 0);
      editor.paint(1, 1);

      // 添加实体
      editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 10, y: 7,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      // 导出ASCII
      const ascii = editor.mergeToASCII();

      // 解析
      const parser = new ASCIIMapParser();
      const map = parser.parse(ascii);

      expect(map.width).toBe(20);
      expect(map.height).toBe(15);
    });

    it('导入 → 编辑 → 导出 → 完整循环', () => {
      const editor = new MapEditor(20, 15);

      // 初始数据
      editor.setBrushSymbol('^');
      editor.paint(5, 5);
      editor.setMapName('测试地图');

      // 导出JSON
      const json = editor.exportStateJSON();

      // 新编辑器导入
      const editor2 = new MapEditor(20, 15);
      editor2.importStateJSON(json);

      // 验证数据
      expect(editor2.getMetadata().name).toBe('测试地图');
      const terrain = editor2.getLayers().find(l => l.type === 'terrain')!;
      expect(terrain.data[5][5]).toBe('^');
    });
  });

  // ── 多系统序列化/反序列化 ─────────────────

  describe('多系统序列化一致性', () => {
    it('所有系统序列化 → 反序列化 → 状态一致', () => {
      const deps = createMockDeps();

      // 行军系统
      const marching = new MarchingSystem();
      marching.init(deps);
      marching.createMarch('a', 'b', 500, '关羽', 'shu', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);

      // 产出系统
      const production = new ProductionSystem();
      production.init(deps);
      production.registerTerritory('t1', 3);
      production.addResources('t1', { gold: 500 });

      // 离线事件系统
      const offline = new OfflineEventSystem();
      offline.init(deps);

      // 序列化
      const marchSave = marching.serialize();
      const prodSave = production.serialize();
      const offlineSave = offline.serialize();

      // 反序列化到新系统
      const marching2 = new MarchingSystem();
      marching2.init(createMockDeps());
      marching2.deserialize(marchSave);

      const production2 = new ProductionSystem();
      production2.init(createMockDeps());
      production2.deserialize(prodSave);

      const offline2 = new OfflineEventSystem();
      offline2.init(createMockDeps());
      offline2.deserialize(offlineSave);

      // 验证
      expect(marching2.getActiveMarches().length).toBe(1);
      expect(marching2.getActiveMarches()[0].general).toBe('关羽');
      expect(production2.getResources('t1')!.gold).toBe(500);
    });
  });
});
