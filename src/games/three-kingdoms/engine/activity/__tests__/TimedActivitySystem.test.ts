/**
 * TimedActivitySystem 单元测试
 *
 * 覆盖：
 * 1. 限时活动4阶段流程（preview→active→settlement→closed）
 * 2. 排行榜管理
 * 3. 节日活动框架
 * 4. 离线进度计算
 * 5. 序列化/反序列化
 */

import {
  TimedActivitySystem,
  DEFAULT_LEADERBOARD_CONFIG,
  FESTIVAL_TEMPLATES,
} from '../TimedActivitySystem';

import type { ActivityRankEntry } from '../../../core/event/event-engine.types';

describe('TimedActivitySystem', () => {
  let system: TimedActivitySystem;

  beforeEach(() => {
    system = new TimedActivitySystem();
  });

  // ─── 生命周期 ─────────────────────────────

  describe('ISubsystem 接口', () => {
    it('应正确实现 name 属性', () => {
      expect(system.name).toBe('timedActivity');
    });

    it('init 不应抛错', () => {
      const mockDeps = {
        eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
        registry: { get: vi.fn() },
      };
      expect(() => system.init(mockDeps)).not.toThrow();
    });

    it('getState 应返回系统状态', () => {
      const state = system.getState();
      expect(state.name).toBe('timedActivity');
      expect(state.flowsCount).toBe(0);
    });

    it('reset 应清除所有状态', () => {
      const now = Date.now();
      system.createTimedActivityFlow('test', now, now + 86400000);
      system.reset();
      expect(system.getAllFlows()).toEqual([]);
    });
  });

  // ─── 限时活动流程 ─────────────────────────

  describe('限时活动4阶段流程', () => {
    it('应创建限时活动流程', () => {
      const now = Date.now();
      const activeStart = now + 86400000; // 1天后开始
      const activeEnd = activeStart + 86400000; // 持续1天
      const flow = system.createTimedActivityFlow('act_1', activeStart, activeEnd);

      expect(flow.activityId).toBe('act_1');
      expect(flow.phase).toBe('preview');
      expect(flow.activeStart).toBe(activeStart);
      expect(flow.activeEnd).toBe(activeEnd);
    });

    it('预览阶段应在 activeStart 之前', () => {
      const now = Date.now();
      const activeStart = now + 86400000;
      system.createTimedActivityFlow('act_1', activeStart, activeStart + 86400000);
      const phase = system.updatePhase('act_1', now);
      expect(phase).toBe('preview');
    });

    it('活跃阶段应在 activeStart 和 activeEnd 之间', () => {
      const now = Date.now();
      system.createTimedActivityFlow('act_1', now - 1000, now + 86400000);
      const phase = system.updatePhase('act_1', now);
      expect(phase).toBe('active');
    });

    it('结算阶段应在 activeEnd 之后 closedTime 之前', () => {
      const now = Date.now();
      const activeEnd = now - 1000;
      system.createTimedActivityFlow('act_1', now - 86400000, activeEnd);
      const phase = system.updatePhase('act_1', now);
      expect(phase).toBe('settlement');
    });

    it('关闭阶段应在 closedTime 之后', () => {
      const now = Date.now();
      const activeEnd = now - 100000000;
      system.createTimedActivityFlow('act_1', now - 200000000, activeEnd);
      const phase = system.updatePhase('act_1', now);
      expect(phase).toBe('closed');
    });

    it('canParticipate 仅在 active 阶段返回 true', () => {
      const now = Date.now();
      system.createTimedActivityFlow('act_1', now - 1000, now + 86400000);
      expect(system.canParticipate('act_1', now)).toBe(true);

      system.createTimedActivityFlow('act_2', now + 86400000, now + 172800000);
      expect(system.canParticipate('act_2', now)).toBe(false);
    });

    it('getRemainingTime 应返回剩余时间', () => {
      const now = Date.now();
      const activeEnd = now + 3600000; // 1小时后
      system.createTimedActivityFlow('act_1', now - 1000, activeEnd);
      const remaining = system.getRemainingTime('act_1', now);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(3600000);
    });

    it('不存在的事件应返回 0 剩余时间', () => {
      expect(system.getRemainingTime('nonexistent', Date.now())).toBe(0);
    });
  });

  // ─── 排行榜 ───────────────────────────────

  describe('排行榜', () => {
    const entries: ActivityRankEntry[] = [
      { playerId: 'p1', playerName: 'A', points: 100, tokens: 10, rank: 0 },
      { playerId: 'p2', playerName: 'B', points: 200, tokens: 20, rank: 0 },
      { playerId: 'p3', playerName: 'C', points: 200, tokens: 15, rank: 0 },
    ];

    it('应按积分降序排序并重新排名', () => {
      const result = system.updateLeaderboard('act_1', entries);
      expect(result[0].playerId).toBe('p2'); // 200分,20代币
      expect(result[1].playerId).toBe('p3'); // 200分,15代币
      expect(result[2].playerId).toBe('p1'); // 100分
      expect(result[0].rank).toBe(1);
    });

    it('getPlayerRank 应返回玩家排名', () => {
      system.updateLeaderboard('act_1', entries);
      expect(system.getPlayerRank('act_1', 'p2')).toBe(1);
      expect(system.getPlayerRank('act_1', 'p1')).toBe(3);
    });

    it('未上榜玩家应返回 0', () => {
      expect(system.getPlayerRank('act_1', 'unknown')).toBe(0);
    });

    it('calculateRankRewards 应根据排名返回奖励', () => {
      const rewards = system.calculateRankRewards(1);
      expect(rewards.gold).toBe(500);
    });

    it('第2-3名应获得300金', () => {
      const rewards = system.calculateRankRewards(3);
      expect(rewards.gold).toBe(300);
    });

    it('未匹配的排名应返回空奖励', () => {
      const rewards = system.calculateRankRewards(999);
      expect(Object.keys(rewards)).toEqual([]);
    });
  });

  // ─── 节日活动 ─────────────────────────────

  describe('节日活动框架', () => {
    it('应获取指定类型的节日模板', () => {
      const tpl = system.getFestivalTemplate('spring');
      expect(tpl).toBeDefined();
      expect(tpl!.name).toBe('春节庆典');
    });

    it('不存在的类型应返回 undefined', () => {
      expect(system.getFestivalTemplate('nonexistent')).toBeUndefined();
    });

    it('getAllFestivalTemplates 应返回所有模板', () => {
      const templates = system.getAllFestivalTemplates();
      expect(templates.length).toBe(FESTIVAL_TEMPLATES.length);
    });

    it('应创建节日活动', () => {
      const result = system.createFestivalActivity('spring', Date.now());
      expect(result).not.toBeNull();
      expect(result!.template.festivalType).toBe('spring');
      expect(result!.flow).toBeDefined();
    });
  });

  // ─── 离线进度 ─────────────────────────────

  describe('离线进度', () => {
    it('应计算单个活动离线进度', () => {
      const result = system.calculateOfflineProgress('act_1', 'daily', 3600000);
      expect(result.activityId).toBe('act_1');
      expect(result.pointsEarned).toBeGreaterThan(0);
    });

    it('应批量计算离线进度', () => {
      const activities = [
        { id: 'a1', type: 'daily' },
        { id: 'a2', type: 'season' },
      ];
      const summary = system.calculateAllOfflineProgress(activities, 3600000);
      expect(summary.activityResults.length).toBe(2);
      expect(summary.totalPoints).toBeGreaterThan(0);
    });

    it('离线0秒应获得0积分', () => {
      const result = system.calculateOfflineProgress('act_1', 'daily', 0);
      expect(result.pointsEarned).toBe(0);
    });
  });

  // ─── 序列化 ───────────────────────────────

  describe('序列化', () => {
    it('应正确序列化和反序列化', () => {
      const now = Date.now();
      system.createTimedActivityFlow('act_1', now, now + 86400000);
      system.updateLeaderboard('act_1', [
        { playerId: 'p1', playerName: 'A', points: 100, tokens: 10, rank: 0 },
      ]);

      const data = system.serialize();
      const system2 = new TimedActivitySystem();
      system2.deserialize(data);

      expect(system2.getFlow('act_1')).toBeDefined();
      expect(system2.getLeaderboard('act_1').length).toBe(1);
    });

    it('反序列化应清除旧数据', () => {
      const now = Date.now();
      system.createTimedActivityFlow('old', now, now + 86400000);

      const system2 = new TimedActivitySystem();
      system2.deserialize({ flows: [], leaderboards: [] });
      expect(system2.getAllFlows()).toEqual([]);
    });
  });
});
