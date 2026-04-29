/**
 * engine-tick.ts 单元测试
 *
 * 覆盖：
 * - executeTick: 完整 tick 流程（日历→建筑→资源→武将→事件→变化检测）
 * - syncBuildingToResource: 建筑产出同步到资源系统
 * - 变化检测: 资源/速率变化时发出事件
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { executeTick, syncBuildingToResource } from '../engine-tick';
import type { TickContext } from '../engine-tick';
import type { ResourceSystem } from '../resource/ResourceSystem';
import type { BuildingSystem } from '../building/BuildingSystem';
import type { CalendarSystem } from '../calendar/CalendarSystem';
import type { HeroSystem } from '../hero/HeroSystem';
import type { CampaignProgressSystem } from '../campaign/CampaignProgressSystem';
import type { TechTreeSystem } from '../tech/TechTreeSystem';
import type { TechPointSystem } from '../tech/TechPointSystem';
import type { TechResearchSystem } from '../tech/TechResearchSystem';
import type { EventBus } from '../../../core/events/EventBus';

// ── Mock factories ──────────────────────────────────

function createMockTickContext(): TickContext {
  return {
    resource: {
      tick: vi.fn(),
      getResources: vi.fn(() => ({ grain: 100, gold: 200, troops: 50 })),
      getProductionRates: vi.fn(() => ({ grain: 1.0, gold: 0.5, troops: 0.2 })),
      recalculateProduction: vi.fn(),
      updateCaps: vi.fn(),
    } as unknown as ResourceSystem,
    building: {
      tick: vi.fn(() => []),
      getLevel: vi.fn(() => 1),
      getCastleBonusMultiplier: vi.fn(() => 1.0),
      calculateTotalProduction: vi.fn(() => ({})),
      getProductionBuildingLevels: vi.fn(() => ({ farmland: 1, barracks: 1 })),
    } as unknown as BuildingSystem,
    calendar: {
      update: vi.fn(),
    } as unknown as CalendarSystem,
    hero: {
      update: vi.fn(),
    } as unknown as HeroSystem,
    campaign: {
      update: vi.fn(),
    } as unknown as CampaignProgressSystem,
    techTree: {
      getTechBonusMultiplier: vi.fn(() => 0),
      getEffectValue: vi.fn(() => 0),
    } as unknown as TechTreeSystem,
    techPoint: {
      syncAcademyLevel: vi.fn(),
      update: vi.fn(),
      syncResearchSpeedBonus: vi.fn(),
    } as unknown as TechPointSystem,
    techResearch: {
      update: vi.fn(),
    } as unknown as TechResearchSystem,
    bus: {
      emit: vi.fn(),
    } as unknown as EventBus,
    prevResourcesJson: '',
    prevRatesJson: '',
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-tick', () => {
  let ctx: TickContext;

  beforeEach(() => {
    ctx = createMockTickContext();
  });

  // ── executeTick 基础流程 ───────────────────────────

  describe('executeTick()', () => {
    it('按顺序调用日历推进', () => {
      executeTick(ctx, 1.0);
      expect(ctx.calendar.update).toHaveBeenCalledWith(1.0);
    });

    it('调用建筑升级计时', () => {
      executeTick(ctx, 1.0);
      expect(ctx.building.tick).toHaveBeenCalled();
    });

    it('调用资源产出（含加成）', () => {
      executeTick(ctx, 1.0);
      expect(ctx.resource.tick).toHaveBeenCalledWith(1000, expect.objectContaining({
        castle: expect.any(Number),
        tech: expect.any(Number),
      }));
    });

    it('调用武将系统更新', () => {
      executeTick(ctx, 1.0);
      expect(ctx.hero.update).toHaveBeenCalledWith(1.0);
    });

    it('调用关卡进度系统更新', () => {
      executeTick(ctx, 1.0);
      expect(ctx.campaign.update).toHaveBeenCalledWith(1.0);
    });

    it('同步书院等级到科技点系统', () => {
      executeTick(ctx, 1.0);
      expect(ctx.techPoint.syncAcademyLevel).toHaveBeenCalled();
      expect(ctx.techPoint.update).toHaveBeenCalledWith(1.0);
    });

    it('同步研究速度加成', () => {
      executeTick(ctx, 1.0);
      expect(ctx.techPoint.syncResearchSpeedBonus).toHaveBeenCalled();
    });

    it('调用科技研究系统更新', () => {
      executeTick(ctx, 1.0);
      expect(ctx.techResearch.update).toHaveBeenCalledWith(1.0);
    });
  });

  // ── 建筑升级完成 ──────────────────────────────────

  describe('建筑升级完成', () => {
    it('有建筑完成时发出 building:upgraded 事件', () => {
      (ctx.building.tick as ReturnType<typeof vi.fn>).mockReturnValue(['farmland']);
      (ctx.building.getLevel as ReturnType<typeof vi.fn>).mockReturnValue(2);

      executeTick(ctx, 1.0);

      expect(ctx.bus.emit).toHaveBeenCalledWith('building:upgraded', {
        type: 'farmland',
        level: 2,
      });
    });

    it('多个建筑完成时发出多个事件', () => {
      (ctx.building.tick as ReturnType<typeof vi.fn>).mockReturnValue(['farmland', 'barracks']);

      executeTick(ctx, 1.0);

      const upgradedCalls = (ctx.bus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call as [string])[0] === 'building:upgraded',
      );
      expect(upgradedCalls.length).toBe(2);
    });

    it('建筑完成时同步产出和上限到资源系统', () => {
      (ctx.building.tick as ReturnType<typeof vi.fn>).mockReturnValue(['farmland']);

      executeTick(ctx, 1.0);

      expect(ctx.resource.recalculateProduction).toHaveBeenCalled();
      expect(ctx.resource.updateCaps).toHaveBeenCalled();
    });

    it('无建筑完成时不发出 building:upgraded 事件', () => {
      (ctx.building.tick as ReturnType<typeof vi.fn>).mockReturnValue([]);

      executeTick(ctx, 1.0);

      const upgradedCalls = (ctx.bus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call as [string])[0] === 'building:upgraded',
      );
      expect(upgradedCalls.length).toBe(0);
    });
  });

  // ── 事件系统更新 ──────────────────────────────────

  describe('事件系统更新', () => {
    it('调用可选事件子系统的 update', () => {
      const eventTrigger = { update: vi.fn() };
      const eventNotification = { update: vi.fn() };
      const eventUI = { update: vi.fn() };
      const eventChain = { update: vi.fn() };
      const eventLog = { update: vi.fn() };
      const offlineEvent = { update: vi.fn() };

      ctx = { ...ctx, eventTrigger, eventNotification, eventUI, eventChain, eventLog, offlineEvent };

      executeTick(ctx, 1.0);

      expect(eventTrigger.update).toHaveBeenCalledWith(1.0);
      expect(eventNotification.update).toHaveBeenCalledWith(1.0);
      expect(eventUI.update).toHaveBeenCalledWith(1.0);
      expect(eventChain.update).toHaveBeenCalledWith(1.0);
      expect(eventLog.update).toHaveBeenCalledWith(1.0);
      expect(offlineEvent.update).toHaveBeenCalledWith(1.0);
    });

    it('无事件系统时不报错', () => {
      // ctx 默认没有 eventTrigger 等属性
      expect(() => executeTick(ctx, 1.0)).not.toThrow();
    });
  });

  // ── 变化检测 ──────────────────────────────────────

  describe('变化检测', () => {
    it('资源变化时发出 resource:changed 事件', () => {
      ctx.prevResourcesJson = '{"grain":50}';
      // getResources 返回不同的值
      (ctx.resource.getResources as ReturnType<typeof vi.fn>).mockReturnValue({
        grain: 100,
        gold: 200,
        troops: 50,
      });

      executeTick(ctx, 1.0);

      expect(ctx.bus.emit).toHaveBeenCalledWith(
        'resource:changed',
        expect.objectContaining({ resources: expect.any(Object) }),
      );
    });

    it('资源未变化时不发出 resource:changed 事件', () => {
      const resources = { grain: 100, gold: 200, troops: 50 };
      (ctx.resource.getResources as ReturnType<typeof vi.fn>).mockReturnValue(resources);
      ctx.prevResourcesJson = JSON.stringify(resources);

      executeTick(ctx, 1.0);

      const changedCalls = (ctx.bus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call as [string])[0] === 'resource:changed',
      );
      expect(changedCalls.length).toBe(0);
    });

    it('速率变化时发出 resource:rate-changed 事件', () => {
      ctx.prevRatesJson = '{"grain":0.5}';
      (ctx.resource.getProductionRates as ReturnType<typeof vi.fn>).mockReturnValue({
        grain: 1.0,
        gold: 0.5,
      });

      executeTick(ctx, 1.0);

      expect(ctx.bus.emit).toHaveBeenCalledWith(
        'resource:rate-changed',
        expect.objectContaining({ rates: expect.any(Object) }),
      );
    });

    it('速率未变化时不发出 resource:rate-changed 事件', () => {
      const rates = { grain: 1.0, gold: 0.5 };
      (ctx.resource.getProductionRates as ReturnType<typeof vi.fn>).mockReturnValue(rates);
      ctx.prevRatesJson = JSON.stringify(rates);

      executeTick(ctx, 1.0);

      const rateCalls = (ctx.bus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call as [string])[0] === 'resource:rate-changed',
      );
      expect(rateCalls.length).toBe(0);
    });

    it('更新 prevResourcesJson 缓存', () => {
      ctx.prevResourcesJson = '';
      const resources = { grain: 100, gold: 200, troops: 50 };
      (ctx.resource.getResources as ReturnType<typeof vi.fn>).mockReturnValue(resources);

      executeTick(ctx, 1.0);

      expect(ctx.prevResourcesJson).toBe(JSON.stringify(resources));
    });

    it('更新 prevRatesJson 缓存', () => {
      ctx.prevRatesJson = '';
      const rates = { grain: 1.0, gold: 0.5 };
      (ctx.resource.getProductionRates as ReturnType<typeof vi.fn>).mockReturnValue(rates);

      executeTick(ctx, 1.0);

      expect(ctx.prevRatesJson).toBe(JSON.stringify(rates));
    });
  });

  // ── syncBuildingToResource ─────────────────────────

  describe('syncBuildingToResource()', () => {
    it('同步建筑产出和上限到资源系统', () => {
      syncBuildingToResource(ctx);

      expect(ctx.building.calculateTotalProduction).toHaveBeenCalled();
      expect(ctx.resource.recalculateProduction).toHaveBeenCalled();
      expect(ctx.building.getProductionBuildingLevels).toHaveBeenCalled();
      expect(ctx.resource.updateCaps).toHaveBeenCalled();
    });

    it('传入正确的农田和兵营等级', () => {
      (ctx.building.getProductionBuildingLevels as ReturnType<typeof vi.fn>).mockReturnValue({
        farmland: 3,
        barracks: 2,
      });

      syncBuildingToResource(ctx);

      expect(ctx.resource.updateCaps).toHaveBeenCalledWith(3, 2);
    });

    it('缺少建筑等级时使用默认值 0', () => {
      (ctx.building.getProductionBuildingLevels as ReturnType<typeof vi.fn>).mockReturnValue({});

      syncBuildingToResource(ctx);

      expect(ctx.resource.updateCaps).toHaveBeenCalledWith(0, 0);
    });
  });

  // ── 加成体系 ──────────────────────────────────────

  describe('加成体系', () => {
    it('主城加成为 castleMultiplier - 1', () => {
      (ctx.building.getCastleBonusMultiplier as ReturnType<typeof vi.fn>).mockReturnValue(1.2);

      executeTick(ctx, 1.0);

      const tickCall = (ctx.resource.tick as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(tickCall[1].castle).toBeCloseTo(0.2);
    });

    it('科技加成传入正确值', () => {
      (ctx.techTree.getTechBonusMultiplier as ReturnType<typeof vi.fn>).mockReturnValue(0.15);

      executeTick(ctx, 1.0);

      const tickCall = (ctx.resource.tick as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(tickCall[1].tech).toBeCloseTo(0.15);
    });

    it('dtSec=0 时不产出资源', () => {
      executeTick(ctx, 0);

      expect(ctx.resource.tick).toHaveBeenCalledWith(0, expect.any(Object));
    });
  });
});
