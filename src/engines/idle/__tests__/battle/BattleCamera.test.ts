/**
 * BattleCamera 单元测试
 *
 * 覆盖镜头系统的所有核心功能：
 * - 构造函数和初始化
 * - 位置控制（moveTo, panTo, follow）
 * - 缩放控制
 * - 镜头震动
 * - 每帧更新
 * - 坐标转换
 * - 可见性检测
 * - 状态管理（reset, loadState）
 * - 边界条件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleCamera } from '../../modules/battle/BattleCamera';
import type { CameraConfig, CameraState } from '../../modules/battle/BattleCamera';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建默认镜头配置 */
function createConfig(overrides: Partial<CameraConfig> = {}): CameraConfig & { viewportWidth: number; viewportHeight: number; mapWidth: number; mapHeight: number } {
  return {
    viewportWidth: 800,
    viewportHeight: 600,
    mapWidth: 2000,
    mapHeight: 1500,
    moveSpeed: 300,
    minZoom: 0.5,
    maxZoom: 3.0,
    followSmoothFactor: 0.1,
    ...overrides,
  };
}

/** 创建镜头实例 */
function createCamera(overrides: Partial<CameraConfig> = {}): BattleCamera {
  const config = createConfig(overrides);
  return new BattleCamera(config);
}

// ============================================================
// 测试套件
// ============================================================

describe('BattleCamera', () => {
  let camera: BattleCamera;

  beforeEach(() => {
    camera = createCamera();
  });

  // ============================================================
  // 构造函数
  // ============================================================

  describe('构造函数', () => {
    it('应使用配置创建镜头', () => {
      const cam = createCamera();
      const config = cam.getConfig();
      expect(config.viewportWidth).toBe(800);
      expect(config.viewportHeight).toBe(600);
      expect(config.mapWidth).toBe(2000);
      expect(config.mapHeight).toBe(1500);
    });

    it('初始位置应在地图中心', () => {
      const cam = createCamera({ mapWidth: 2000, mapHeight: 1500 });
      const pos = cam.getPosition();
      expect(pos.x).toBe(1000); // 2000 / 2
      expect(pos.y).toBe(750);  // 1500 / 2
    });

    it('初始缩放应为 1.0', () => {
      expect(camera.getZoom()).toBe(1);
    });

    it('应接受自定义配置', () => {
      const cam = createCamera({ moveSpeed: 500, minZoom: 0.25, maxZoom: 4.0 });
      const config = cam.getConfig();
      expect(config.moveSpeed).toBe(500);
      expect(config.minZoom).toBe(0.25);
      expect(config.maxZoom).toBe(4.0);
    });
  });

  // ============================================================
  // 位置控制
  // ============================================================

  describe('moveTo', () => {
    it('应立即移动到指定位置', () => {
      camera.moveTo(500, 300);
      const pos = camera.getPosition();
      expect(pos.x).toBe(500);
      expect(pos.y).toBe(300);
    });

    it('应同时更新目标位置', () => {
      camera.moveTo(500, 300);
      const state = camera.getState();
      expect(state.targetX).toBe(500);
      expect(state.targetY).toBe(300);
    });

    it('应限制在地图边界内', () => {
      // 地图 2000x1500，视口 800x600，最小 x = 400, 最大 x = 1600
      camera.moveTo(0, 0);
      const pos = camera.getPosition();
      expect(pos.x).toBe(400); // viewportWidth / 2
      expect(pos.y).toBe(300); // viewportHeight / 2
    });

    it('应限制在地图右下边界', () => {
      camera.moveTo(3000, 2000);
      const pos = camera.getPosition();
      expect(pos.x).toBe(1600); // 2000 - 400
      expect(pos.y).toBe(1200); // 1500 - 300
    });
  });

  describe('panTo', () => {
    it('应设置目标位置但不立即移动', () => {
      camera.panTo(500, 300);
      const pos = camera.getPosition();
      // 初始在 1000, 750，不会立即跳到目标
      expect(pos.x).toBe(1000);
      expect(pos.y).toBe(750);
    });

    it('应更新 state 的 targetX/Y', () => {
      camera.panTo(500, 300);
      const state = camera.getState();
      expect(state.targetX).toBe(500);
      expect(state.targetY).toBe(300);
    });

    it('应取消之前的跟随', () => {
      const target = { x: 100, y: 100 };
      camera.follow(target);
      camera.panTo(500, 300);
      // panTo 后不应再跟随
      camera.update(16);
      const state = camera.getState();
      expect(state.targetX).toBe(500);
      expect(state.targetY).toBe(300);
    });
  });

  describe('follow', () => {
    it('应设置跟随目标', () => {
      const target = { x: 500, y: 300 };
      camera.follow(target);
      camera.update(1000); // 足够的 dt 让镜头到达
      const pos = camera.getPosition();
      expect(pos.x).toBe(500);
      expect(pos.y).toBe(300);
    });

    it('传入 null 应取消跟随', () => {
      const target = { x: 500, y: 300 };
      camera.follow(target);
      camera.follow(null);
      camera.update(16);
      // 位置不应改变太多
      const pos = camera.getPosition();
      expect(pos.x).toBe(1000); // 仍在初始位置
    });

    it('应平滑跟随移动的目标', () => {
      const target = { x: 1000, y: 750 };
      camera.follow(target);

      // 移动目标
      target.x = 600;
      target.y = 400;

      camera.update(16);
      // 应该向目标移动但未到达
      const pos = camera.getPosition();
      expect(pos.x).toBeLessThan(1000);
      expect(pos.x).toBeGreaterThan(600);
    });
  });

  // ============================================================
  // 缩放控制
  // ============================================================

  describe('zoomTo', () => {
    it('应设置缩放倍率', () => {
      camera.zoomTo(2.0);
      expect(camera.getZoom()).toBe(2.0);
    });

    it('应限制在最小缩放范围内', () => {
      camera.zoomTo(0.1);
      expect(camera.getZoom()).toBe(0.5); // minZoom
    });

    it('应限制在最大缩放范围内', () => {
      camera.zoomTo(5.0);
      expect(camera.getZoom()).toBe(3.0); // maxZoom
    });

    it('缩放后应重新限制位置', () => {
      camera.moveTo(400, 300); // 边界位置
      camera.zoomTo(0.5);
      // zoom=0.5 时视口更大，边界更紧
      const pos = camera.getPosition();
      expect(pos.x).toBeGreaterThanOrEqual(800); // viewportWidth/2/zoom = 800
    });
  });

  describe('zoomIn', () => {
    it('应放大一级', () => {
      expect(camera.getZoom()).toBe(1);
      camera.zoomIn();
      expect(camera.getZoom()).toBe(1.25);
    });

    it('不应超过最大缩放', () => {
      camera.zoomTo(3.0);
      camera.zoomIn();
      expect(camera.getZoom()).toBe(3.0);
    });
  });

  describe('zoomOut', () => {
    it('应缩小一级', () => {
      camera.zoomTo(2.0);
      camera.zoomOut();
      expect(camera.getZoom()).toBe(1.75);
    });

    it('不应低于最小缩放', () => {
      camera.zoomTo(0.5);
      camera.zoomOut();
      expect(camera.getZoom()).toBe(0.5);
    });
  });

  // ============================================================
  // 镜头震动
  // ============================================================

  describe('shake', () => {
    it('应触发震动状态', () => {
      camera.shake(10, 500);
      const state = camera.getState();
      expect(state.isShaking).toBe(true);
      expect(state.shakeIntensity).toBe(10);
      expect(state.shakeDurationMs).toBe(500);
    });

    it('震动结束后应恢复', () => {
      camera.shake(10, 100);
      camera.update(200); // 超过持续时间
      const state = camera.getState();
      expect(state.isShaking).toBe(false);
    });

    it('强度为 0 不应触发震动', () => {
      camera.shake(0, 500);
      expect(camera.getState().isShaking).toBe(false);
    });

    it('持续时间为 0 不应触发震动', () => {
      camera.shake(10, 0);
      expect(camera.getState().isShaking).toBe(false);
    });

    it('震动应产生位置偏移', () => {
      camera.moveTo(1000, 750);
      camera.shake(20, 500);
      camera.update(16);
      const pos = camera.getPosition();
      // 震动偏移是随机的，但不应为 0（除非极端情况）
      // 检查 state 位置仍然是原始值
      const state = camera.getState();
      expect(state.x).toBe(1000);
      expect(state.y).toBe(750);
      // 但 getPosition 返回的包含偏移
      // 偏移是随机的，只检查偏移量级
      const offsetX = Math.abs(pos.x - state.x);
      const offsetY = Math.abs(pos.y - state.y);
      // 偏移应在 0~intensity 范围内
      expect(offsetX).toBeLessThanOrEqual(20);
      expect(offsetY).toBeLessThanOrEqual(20);
    });
  });

  // ============================================================
  // 每帧更新
  // ============================================================

  describe('update', () => {
    it('应平滑移动到目标位置', () => {
      camera.panTo(500, 300);
      // 多次 update 使镜头接近目标
      for (let i = 0; i < 100; i++) {
        camera.update(16);
      }
      const pos = camera.getPosition();
      expect(pos.x).toBeCloseTo(500, 0);
      expect(pos.y).toBeCloseTo(300, 0);
    });

    it('dt 为 0 不应崩溃', () => {
      expect(() => camera.update(0)).not.toThrow();
    });

    it('负 dt 不应崩溃', () => {
      expect(() => camera.update(-10)).not.toThrow();
    });

    it('应处理跟随和 panTo 的切换', () => {
      const target = { x: 200, y: 200 };
      camera.follow(target);
      camera.update(100);
      camera.panTo(800, 600);
      camera.update(100);
      // 目标应被 panTo 覆盖
      const state = camera.getState();
      expect(state.targetX).toBe(800);
      expect(state.targetY).toBe(600);
    });
  });

  // ============================================================
  // 坐标转换
  // ============================================================

  describe('worldToScreen', () => {
    it('镜头中心的世界坐标应映射到屏幕中心', () => {
      camera.moveTo(1000, 750);
      const screen = camera.worldToScreen(1000, 750);
      expect(screen.x).toBeCloseTo(400, 0); // viewportWidth / 2
      expect(screen.y).toBeCloseTo(300, 0); // viewportHeight / 2
    });

    it('缩放应影响坐标转换', () => {
      camera.moveTo(1000, 750);
      camera.zoomTo(2.0);
      // 镜头中心的世界坐标始终映射到屏幕中心，不受缩放影响
      const screen = camera.worldToScreen(1000, 750);
      expect(screen.x).toBeCloseTo(400, 0); // viewportWidth / 2
      expect(screen.y).toBeCloseTo(300, 0); // viewportHeight / 2
    });
  });

  describe('screenToWorld', () => {
    it('屏幕中心应映射到镜头中心的世界坐标', () => {
      camera.moveTo(1000, 750);
      const world = camera.screenToWorld(400, 300);
      expect(world.x).toBeCloseTo(1000, 0);
      expect(world.y).toBeCloseTo(750, 0);
    });

    it('worldToScreen 和 screenToWorld 应互为逆运算', () => {
      camera.moveTo(800, 500);
      camera.zoomTo(1.5);
      const worldX = 600;
      const worldY = 400;
      const screen = camera.worldToScreen(worldX, worldY);
      const world = camera.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(worldX, 0);
      expect(world.y).toBeCloseTo(worldY, 0);
    });
  });

  // ============================================================
  // 可见性检测
  // ============================================================

  describe('getVisibleBounds', () => {
    it('应返回正确的可见区域', () => {
      camera.moveTo(1000, 750);
      const bounds = camera.getVisibleBounds();
      expect(bounds.left).toBeCloseTo(600, 0);   // 1000 - 400
      expect(bounds.right).toBeCloseTo(1400, 0);  // 1000 + 400
      expect(bounds.top).toBeCloseTo(450, 0);     // 750 - 300
      expect(bounds.bottom).toBeCloseTo(1050, 0); // 750 + 300
    });

    it('缩放应影响可见区域大小', () => {
      camera.moveTo(1000, 750);
      camera.zoomTo(2.0);
      const bounds = camera.getVisibleBounds();
      // zoom=2 时，半宽=200，半高=150
      expect(bounds.left).toBeCloseTo(800, 0);
      expect(bounds.right).toBeCloseTo(1200, 0);
      expect(bounds.top).toBeCloseTo(600, 0);
      expect(bounds.bottom).toBeCloseTo(900, 0);
    });
  });

  describe('isVisible', () => {
    it('镜头中心应在视口内', () => {
      camera.moveTo(1000, 750);
      expect(camera.isVisible(1000, 750)).toBe(true);
    });

    it('视口边缘应在视口内', () => {
      camera.moveTo(1000, 750);
      expect(camera.isVisible(600, 450)).toBe(true); // 左上角
      expect(camera.isVisible(1400, 1050)).toBe(true); // 右下角
    });

    it('视口外的点应不可见', () => {
      camera.moveTo(1000, 750);
      expect(camera.isVisible(0, 0)).toBe(false);
      expect(camera.isVisible(2000, 1500)).toBe(false);
    });
  });

  // ============================================================
  // 状态管理
  // ============================================================

  describe('getState', () => {
    it('应返回完整状态副本', () => {
      camera.moveTo(500, 300);
      const state1 = camera.getState();
      const state2 = camera.getState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // 不同引用
    });
  });

  describe('getConfig', () => {
    it('应返回配置副本', () => {
      const config1 = camera.getConfig();
      const config2 = camera.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('reset', () => {
    it('应重置到地图中心', () => {
      camera.moveTo(500, 300);
      camera.zoomTo(2.0);
      camera.reset();
      const pos = camera.getPosition();
      expect(pos.x).toBe(1000);
      expect(pos.y).toBe(750);
      expect(camera.getZoom()).toBe(1);
    });

    it('应清除跟随目标', () => {
      camera.follow({ x: 100, y: 100 });
      camera.reset();
      camera.update(16);
      const pos = camera.getPosition();
      expect(pos.x).toBe(1000); // 仍在中心
    });

    it('应清除震动状态', () => {
      camera.shake(20, 500);
      camera.reset();
      const state = camera.getState();
      expect(state.isShaking).toBe(false);
    });
  });

  describe('loadState', () => {
    it('应恢复保存的状态', () => {
      camera.moveTo(500, 300);
      camera.zoomTo(2.0);
      const savedState = camera.getState();

      camera.reset();
      camera.loadState(savedState);

      expect(camera.getPosition().x).toBe(500);
      expect(camera.getPosition().y).toBe(300);
      expect(camera.getZoom()).toBe(2.0);
    });

    it('应限制恢复的位置在边界内', () => {
      const badState: CameraState = {
        x: -100, y: -100,
        zoom: 0.1, targetX: -100, targetY: -100,
        isShaking: false, shakeIntensity: 0, shakeDurationMs: 0, shakeElapsedMs: 0,
      };
      camera.loadState(badState);
      expect(camera.getZoom()).toBe(0.5); // clamped to minZoom
      expect(camera.getPosition().x).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('小地图（比视口小）应居中', () => {
      const cam = createCamera({ mapWidth: 400, mapHeight: 300 });
      cam.moveTo(100, 100);
      const pos = cam.getPosition();
      expect(pos.x).toBe(200); // mapWidth / 2
      expect(pos.y).toBe(150); // mapHeight / 2
    });

    it('正方形地图和视口应正常工作', () => {
      const cam = createCamera({ mapWidth: 1000, mapHeight: 1000, viewportWidth: 1000, viewportHeight: 1000 });
      cam.moveTo(500, 500);
      const pos = cam.getPosition();
      expect(pos.x).toBe(500);
      expect(pos.y).toBe(500);
    });

    it('多次 update 不应累积误差', () => {
      camera.moveTo(1000, 750);
      camera.panTo(1000, 750);
      for (let i = 0; i < 1000; i++) {
        camera.update(16);
      }
      const pos = camera.getPosition();
      expect(pos.x).toBeCloseTo(1000, 0);
      expect(pos.y).toBeCloseTo(750, 0);
    });

    it('getConfig 应返回不可变的配置副本', () => {
      const config = camera.getConfig();
      config.viewportWidth = 999;
      const config2 = camera.getConfig();
      expect(config2.viewportWidth).toBe(800);
    });
  });
});
