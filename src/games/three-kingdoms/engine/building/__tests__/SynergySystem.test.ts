/**
 * SynergySystem 单元测试
 * 覆盖：协同激活检测、加成计算、等级变化响应、多组协同
 */

import { describe, it, expect } from 'vitest';
import { SynergySystem } from '../SynergySystem';
import { SYNERGY_COMBOS } from '../SynergySystem';

describe('SynergySystem', () => {
  let system: SynergySystem;

  beforeEach(() => {
    system = new SynergySystem();
  });

  // ─────────────────────────────────────────
  // 协同激活检测
  // ─────────────────────────────────────────

  describe('checkAllSynergies', () => {
    it('矿场+工坊都Lv5 → 矿工协作激活', () => {
      const levels: Record<string, number> = { mine: 5, workshop: 5 };
      system.init((type: string) => levels[type] ?? 0);

      const statuses = system.checkAllSynergies();
      const mineWorkshop = statuses.find(s => s.comboId === 'mine_workshop');
      expect(mineWorkshop?.active).toBe(true);
    });

    it('矿场Lv4+工坊Lv5 → 矿工协作未激活', () => {
      const levels: Record<string, number> = { mine: 4, workshop: 5 };
      system.init((type: string) => levels[type] ?? 0);

      const statuses = system.checkAllSynergies();
      const mineWorkshop = statuses.find(s => s.comboId === 'mine_workshop');
      expect(mineWorkshop?.active).toBe(false);
    });

    it('所有协同都未满足 → 全部未激活', () => {
      const levels: Record<string, number> = {};
      system.init((type: string) => levels[type] ?? 0);

      const statuses = system.checkAllSynergies();
      expect(statuses.every(s => !s.active)).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 总加成
  // ─────────────────────────────────────────

  describe('getTotalSynergyBonus', () => {
    it('6组全部激活 → 总加成30%', () => {
      // 所有参与建筑都设为Lv5+
      const levels: Record<string, number> = {
        mine: 5, workshop: 5,
        market: 5, port: 5,
        tavern: 5, barracks: 5,
        academy: 5,
        farmland: 5,
        clinic: 5,
      };
      system.init((type: string) => levels[type] ?? 0);
      system.checkAllSynergies();

      expect(system.getTotalSynergyBonus()).toBeCloseTo(0.30);
    });

    it('无协同激活 → 总加成0%', () => {
      system.init(() => 0);
      system.checkAllSynergies();

      expect(system.getTotalSynergyBonus()).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 等级变化响应
  // ─────────────────────────────────────────

  describe('onLevelChange', () => {
    it('等级变化时重新检查', () => {
      const levels: Record<string, number> = { mine: 3, workshop: 5 };
      system.init((type: string) => levels[type] ?? 0);
      system.checkAllSynergies();

      expect(system.isSynergyActive('mine_workshop')).toBe(false);

      // 升级矿场到5级
      levels.mine = 5;
      const results = system.onLevelChange('mine', 5);
      const mineWorkshop = results.find(r => r.comboId === 'mine_workshop');
      expect(mineWorkshop?.active).toBe(true);
      expect(system.isSynergyActive('mine_workshop')).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 单建筑参与多组协同
  // ─────────────────────────────────────────

  describe('getSynergyBonus', () => {
    it('酒馆参与多组协同 → 累计加成', () => {
      const levels: Record<string, number> = {
        tavern: 5,
        barracks: 5,
        academy: 5,
      };
      system.init((type: string) => levels[type] ?? 0);
      system.checkAllSynergies();

      // 酒馆参与: tavern_barracks(军心凝聚) + academy_tavern(文武双全)
      const tavernBonus = system.getSynergyBonus('tavern');
      expect(tavernBonus).toBeCloseTo(0.10);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复激活状态', () => {
      const levels: Record<string, number> = { mine: 5, workshop: 5 };
      system.init((type: string) => levels[type] ?? 0);
      system.checkAllSynergies();

      const data = system.serialize();
      expect(data.activeSynergies).toContain('mine_workshop');

      const system2 = new SynergySystem();
      system2.deserialize(data);
      expect(system2.isSynergyActive('mine_workshop')).toBe(true);
    });

    it('reset 后清除所有状态', () => {
      const levels: Record<string, number> = { mine: 5, workshop: 5 };
      system.init((type: string) => levels[type] ?? 0);
      system.checkAllSynergies();

      system.reset();
      expect(system.isSynergyActive('mine_workshop')).toBe(false);
    });
  });
});
