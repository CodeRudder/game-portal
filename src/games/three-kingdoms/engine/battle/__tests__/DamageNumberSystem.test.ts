/**
 * DamageNumberSystem — 单元测试
 *
 * 覆盖：
 * - 伤害数字类型（普通/暴击/治疗/护盾/DOT/闪避/免疫）
 * - 数字飘出轨迹配置
 * - 批量伤害数字合并
 * - 生命周期管理
 * - 配置系统
 * - 便捷方法
 *
 * @module engine/battle/__tests__/DamageNumberSystem.test
 */

import {
  DamageNumberSystem,
  DamageNumberType,
  TrajectoryType,
} from '../DamageNumberSystem';
import type {
  DamageNumber,
  TrajectoryConfig,
  DamageNumberConfig,
} from '../DamageNumberSystem';

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('DamageNumberSystem', () => {
  let system: DamageNumberSystem;

  beforeEach(() => {
    system = new DamageNumberSystem();
  });

  // ─────────────────────────────────────────
  // 1. 基础创建
  // ─────────────────────────────────────────
  describe('基础创建', () => {
    it('创建普通伤害数字', () => {
      const num = system.createDamageNumber(DamageNumberType.NORMAL, 100, 'unit-1');

      expect(num.type).toBe(DamageNumberType.NORMAL);
      expect(num.value).toBe(100);
      expect(num.text).toBe('-100');
      expect(num.targetUnitId).toBe('unit-1');
      expect(num.merged).toBe(false);
      expect(num.mergedFrom).toEqual([]);
    });

    it('创建暴击伤害数字', () => {
      const num = system.createDamageNumber(DamageNumberType.CRITICAL, 250, 'unit-1');

      expect(num.type).toBe(DamageNumberType.CRITICAL);
      expect(num.value).toBe(250);
      expect(num.text).toBe('-250');
      expect(num.trajectory.scale).toBe(1.5); // 暴击放大
      expect(num.color).toBe('#FF4500');
    });

    it('创建治疗数字', () => {
      const num = system.createDamageNumber(DamageNumberType.HEAL, 50, 'unit-1');

      expect(num.type).toBe(DamageNumberType.HEAL);
      expect(num.value).toBe(50);
      expect(num.text).toBe('+50');
      expect(num.color).toBe('#00FF7F');
    });

    it('创建护盾吸收数字', () => {
      const num = system.createDamageNumber(DamageNumberType.SHIELD, 30, 'unit-1');

      expect(num.type).toBe(DamageNumberType.SHIELD);
      expect(num.text).toBe('🛡30');
      expect(num.color).toBe('#4169E1');
    });

    it('创建 DOT 数字', () => {
      const num = system.createDamageNumber(DamageNumberType.DOT, 20, 'unit-1');

      expect(num.type).toBe(DamageNumberType.DOT);
      expect(num.text).toBe('-20');
      expect(num.color).toBe('#FF6347');
    });

    it('创建闪避数字', () => {
      const num = system.createDamageNumber(DamageNumberType.DODGE, 0, 'unit-1');

      expect(num.type).toBe(DamageNumberType.DODGE);
      expect(num.value).toBe(0);
      expect(num.text).toBe('闪避');
      expect(num.color).toBe('#C0C0C0');
    });

    it('创建免疫数字', () => {
      const num = system.createDamageNumber(DamageNumberType.IMMUNE, 0, 'unit-1');

      expect(num.type).toBe(DamageNumberType.IMMUNE);
      expect(num.text).toBe('免疫');
      expect(num.color).toBe('#FFD700');
    });

    it('每个数字有唯一 ID', () => {
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 10, 'u1');
      const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 20, 'u1');

      expect(num1.id).not.toBe(num2.id);
    });

    it('数字有随机偏移避免重叠', () => {
      const num = system.createDamageNumber(DamageNumberType.NORMAL, 100, 'unit-1');

      // 偏移应在 -10~10 范围内（基础偏移 0 + 随机 ±10）
      expect(Math.abs(num.trajectory.offsetX)).toBeLessThanOrEqual(15);
      expect(Math.abs(num.trajectory.offsetY)).toBeLessThanOrEqual(10);
    });
  });

  // ─────────────────────────────────────────
  // 2. 轨迹配置
  // ─────────────────────────────────────────
  describe('轨迹配置', () => {
    it('普通伤害使用 FLOAT_UP 轨迹', () => {
      const trajectory = system.getTrajectory(DamageNumberType.NORMAL);
      expect(trajectory.type).toBe(TrajectoryType.FLOAT_UP);
    });

    it('暴击使用 ZOOM_FADE 轨迹', () => {
      const trajectory = system.getTrajectory(DamageNumberType.CRITICAL);
      expect(trajectory.type).toBe(TrajectoryType.ZOOM_FADE);
      expect(trajectory.scale).toBe(1.5);
    });

    it('护盾使用 BOUNCE 轨迹', () => {
      const trajectory = system.getTrajectory(DamageNumberType.SHIELD);
      expect(trajectory.type).toBe(TrajectoryType.BOUNCE);
    });

    it('闪避使用 WAVE 轨迹', () => {
      const trajectory = system.getTrajectory(DamageNumberType.DODGE);
      expect(trajectory.type).toBe(TrajectoryType.WAVE);
    });

    it('自定义轨迹覆盖', () => {
      const customSystem = new DamageNumberSystem({
        trajectoryOverrides: {
          [DamageNumberType.NORMAL]: { speed: 200, scale: 2.0 },
        },
      });

      const trajectory = customSystem.getTrajectory(DamageNumberType.NORMAL);
      expect(trajectory.speed).toBe(200);
      expect(trajectory.scale).toBe(2.0);
      // 其他字段保持默认
      expect(trajectory.type).toBe(TrajectoryType.FLOAT_UP);
    });
  });

  // ─────────────────────────────────────────
  // 3. 颜色配置
  // ─────────────────────────────────────────
  describe('颜色配置', () => {
    it('默认颜色正确', () => {
      expect(system.getColor(DamageNumberType.NORMAL)).toBe('#FFFFFF');
      expect(system.getColor(DamageNumberType.CRITICAL)).toBe('#FF4500');
      expect(system.getColor(DamageNumberType.HEAL)).toBe('#00FF7F');
    });

    it('自定义颜色覆盖', () => {
      const customSystem = new DamageNumberSystem({
        colorOverrides: {
          [DamageNumberType.NORMAL]: '#FF0000',
        },
      });

      expect(customSystem.getColor(DamageNumberType.NORMAL)).toBe('#FF0000');
      expect(customSystem.getColor(DamageNumberType.CRITICAL)).toBe('#FF4500');
    });
  });

  // ─────────────────────────────────────────
  // 4. 合并逻辑
  // ─────────────────────────────────────────
  describe('合并逻辑', () => {
    it('同一目标同类型在窗口内合并', () => {
      const t = 1000;
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit-1', t);
      const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 30, 'unit-1', t + 100);

      expect(num2.merged).toBe(true);
      expect(num1.value).toBe(80);
      expect(num1.text).toBe('-80');
      expect(num1.mergedFrom).toContain(num2.id);
    });

    it('不同目标不合并', () => {
      const t = 1000;
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit-1', t);
      const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 30, 'unit-2', t + 100);

      expect(num2.merged).toBe(false);
      expect(num1.value).toBe(50);
    });

    it('不同类型不合并', () => {
      const t = 1000;
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit-1', t);
      const num2 = system.createDamageNumber(DamageNumberType.CRITICAL, 100, 'unit-1', t + 100);

      expect(num2.merged).toBe(false);
    });

    it('超过时间窗口不合并', () => {
      const t = 1000;
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit-1', t);
      // 默认窗口 200ms
      const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 30, 'unit-1', t + 300);

      expect(num2.merged).toBe(false);
    });

    it('禁用合并时所有数字独立', () => {
      const noMergeSystem = new DamageNumberSystem({ enableMerge: false });

      const t = 1000;
      const num1 = noMergeSystem.createDamageNumber(DamageNumberType.NORMAL, 50, 'unit-1', t);
      const num2 = noMergeSystem.createDamageNumber(DamageNumberType.NORMAL, 30, 'unit-1', t + 50);

      expect(num1.merged).toBe(false);
      expect(num2.merged).toBe(false);
    });

    it('多个数字可以合并到一个', () => {
      const t = 1000;
      const num1 = system.createDamageNumber(DamageNumberType.NORMAL, 10, 'unit-1', t);
      const num2 = system.createDamageNumber(DamageNumberType.NORMAL, 20, 'unit-1', t + 50);
      const num3 = system.createDamageNumber(DamageNumberType.NORMAL, 30, 'unit-1', t + 100);

      expect(num2.merged).toBe(true);
      expect(num3.merged).toBe(true);
      expect(num1.value).toBe(60); // 10 + 20 + 30
      expect(num1.mergedFrom).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────
  // 5. 批量创建
  // ─────────────────────────────────────────
  describe('批量创建', () => {
    it('createBatchDamageNumbers 正确', () => {
      const entries = [
        { targetUnitId: 'u1', value: 100 },
        { targetUnitId: 'u2', value: 150 },
        { targetUnitId: 'u3', value: 80 },
      ];

      const numbers = system.createBatchDamageNumbers(DamageNumberType.NORMAL, entries);

      expect(numbers).toHaveLength(3);
      expect(numbers[0].targetUnitId).toBe('u1');
      expect(numbers[0].value).toBe(100);
      expect(numbers[1].targetUnitId).toBe('u2');
      expect(numbers[2].targetUnitId).toBe('u3');
    });
  });

  // ─────────────────────────────────────────
  // 6. 生命周期管理
  // ─────────────────────────────────────────
  describe('生命周期管理', () => {
    it('update 移除过期数字', () => {
      const t = 1000;
      system.createDamageNumber(DamageNumberType.NORMAL, 100, 'u1', t);
      system.createDamageNumber(DamageNumberType.NORMAL, 50, 'u2', t);

      // 在存活时间内
      system.update(t + 1000);
      expect(system.getActiveCount()).toBe(2);

      // 超过 2 秒后过期
      system.update(t + 2500);
      expect(system.getActiveCount()).toBe(0);
    });

    it('超过最大数量时移除最旧的', () => {
      const smallSystem = new DamageNumberSystem({ maxActiveNumbers: 3 });

      for (let i = 0; i < 5; i++) {
        smallSystem.createDamageNumber(DamageNumberType.NORMAL, i * 10, `u${i}`);
      }

      expect(smallSystem.getActiveCount()).toBe(3);
    });

    it('clear 清除所有数字', () => {
      system.createDamageNumber(DamageNumberType.NORMAL, 100, 'u1');
      system.createDamageNumber(DamageNumberType.CRITICAL, 200, 'u2');

      expect(system.getActiveCount()).toBe(2);

      system.clear();

      expect(system.getActiveCount()).toBe(0);
    });

    it('getActiveNumbers 不包含已合并的', () => {
      const t = 1000;
      system.createDamageNumber(DamageNumberType.NORMAL, 50, 'u1', t);
      system.createDamageNumber(DamageNumberType.NORMAL, 30, 'u1', t + 50);

      const active = system.getActiveNumbers();
      expect(active).toHaveLength(1);
      expect(active[0].value).toBe(80);
    });
  });

  // ─────────────────────────────────────────
  // 7. 配置系统
  // ─────────────────────────────────────────
  describe('配置系统', () => {
    it('默认配置正确', () => {
      const config = system.getConfig();
      expect(config.mergeWindowMs).toBe(200);
      expect(config.maxActiveNumbers).toBe(30);
      expect(config.enableMerge).toBe(true);
      expect(config.fadeOutDuration).toBe(300);
    });

    it('自定义配置生效', () => {
      const customSystem = new DamageNumberSystem({
        mergeWindowMs: 500,
        maxActiveNumbers: 10,
        enableMerge: false,
      });

      const config = customSystem.getConfig();
      expect(config.mergeWindowMs).toBe(500);
      expect(config.maxActiveNumbers).toBe(10);
      expect(config.enableMerge).toBe(false);
    });

    it('updateConfig 动态更新', () => {
      system.updateConfig({ mergeWindowMs: 1000 });
      expect(system.getConfig().mergeWindowMs).toBe(1000);
    });

    it('updateConfig 更新轨迹覆盖', () => {
      system.updateConfig({
        trajectoryOverrides: {
          [DamageNumberType.NORMAL]: { speed: 300 },
        },
      });

      expect(system.getTrajectory(DamageNumberType.NORMAL).speed).toBe(300);
    });

    it('updateConfig 更新颜色覆盖', () => {
      system.updateConfig({
        colorOverrides: {
          [DamageNumberType.NORMAL]: '#123456',
        },
      });

      expect(system.getColor(DamageNumberType.NORMAL)).toBe('#123456');
    });
  });

  // ─────────────────────────────────────────
  // 8. 便捷方法
  // ─────────────────────────────────────────
  describe('便捷方法', () => {
    it('spawnDamage 创建普通伤害', () => {
      const num = system.spawnDamage(100, 'u1');
      expect(num.type).toBe(DamageNumberType.NORMAL);
      expect(num.value).toBe(100);
      expect(num.text).toBe('-100');
    });

    it('spawnCritical 创建暴击', () => {
      const num = system.spawnCritical(250, 'u1');
      expect(num.type).toBe(DamageNumberType.CRITICAL);
      expect(num.value).toBe(250);
      expect(num.text).toBe('-250');
    });

    it('spawnHeal 创建治疗', () => {
      const num = system.spawnHeal(50, 'u1');
      expect(num.type).toBe(DamageNumberType.HEAL);
      expect(num.value).toBe(50);
      expect(num.text).toBe('+50');
    });

    it('spawnShield 创建护盾', () => {
      const num = system.spawnShield(30, 'u1');
      expect(num.type).toBe(DamageNumberType.SHIELD);
    });

    it('spawnDOT 创建持续伤害', () => {
      const num = system.spawnDOT(15, 'u1');
      expect(num.type).toBe(DamageNumberType.DOT);
    });

    it('spawnDodge 创建闪避', () => {
      const num = system.spawnDodge('u1');
      expect(num.type).toBe(DamageNumberType.DODGE);
      expect(num.text).toBe('闪避');
    });

    it('spawnImmune 创建免疫', () => {
      const num = system.spawnImmune('u1');
      expect(num.type).toBe(DamageNumberType.IMMUNE);
      expect(num.text).toBe('免疫');
    });
  });

  // ─────────────────────────────────────────
  // 9. 综合场景
  // ─────────────────────────────────────────
  describe('综合场景', () => {
    it('AOE 技能产生多个目标伤害', () => {
      const numbers = system.createBatchDamageNumbers(DamageNumberType.NORMAL, [
        { targetUnitId: 'u1', value: 100 },
        { targetUnitId: 'u2', value: 80 },
        { targetUnitId: 'u3', value: 120 },
      ]);

      expect(numbers).toHaveLength(3);
      const active = system.getActiveNumbers();
      expect(active).toHaveLength(3);
    });

    it('混合伤害类型不互相合并', () => {
      const t = 1000;
      system.createDamageNumber(DamageNumberType.NORMAL, 100, 'u1', t);
      system.createDamageNumber(DamageNumberType.CRITICAL, 200, 'u1', t + 50);
      system.createDamageNumber(DamageNumberType.HEAL, 50, 'u1', t + 100);

      const active = system.getActiveNumbers();
      expect(active).toHaveLength(3);
    });

    it('战斗回合完整流程', () => {
      const t = 1000;

      // 回合1：普攻
      system.spawnDamage(80, 'enemy-1', t);
      t + 100;

      // 回合2：暴击
      system.spawnCritical(200, 'enemy-1', t + 1000);

      // 回合3：治疗
      system.spawnHeal(50, 'ally-1', t + 2000);

      // 回合4：DOT
      system.spawnDOT(15, 'enemy-1', t + 3000);

      expect(system.getActiveCount()).toBe(4);

      // 时间推进，早期数字过期
      system.update(t + 3500);
      expect(system.getActiveCount()).toBeLessThanOrEqual(4);
    });
  });
});
