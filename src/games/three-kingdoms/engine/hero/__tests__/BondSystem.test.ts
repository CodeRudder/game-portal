/**
 * BondSystem 单元测试
 *
 * 覆盖：阵营羁绊2/3/4人激活、搭档羁绊（桃园结义/五虎上将/卧龙凤雏）、
 * 羁绊等级基于最低星级、派驻减半、多羁绊叠加、无羁绊返回1.0、系数上限2.0
 */

import { BondSystem } from '../BondSystem';
import type { GeneralMeta } from '../BondSystem';
import { BondType, BOND_MULTIPLIER_CAP } from '../bond-config';

// ── 辅助 ──

function makeMeta(
  id: string,
  faction: 'shu' | 'wei' | 'wu' | 'qun',
  star = 1,
  isActive = true,
): GeneralMeta {
  return { id, faction, star, isActive };
}

function createSystem(metas: GeneralMeta[]): BondSystem {
  const system = new BondSystem();
  const metaMap = new Map(metas.map((m) => [m.id, m]));
  system.initBondDeps({ getGeneralMeta: (id) => metaMap.get(id) });
  return system;
}

describe('BondSystem', () => {
  let system: BondSystem;
  beforeEach(() => { system = new BondSystem(); });

  // ═══════════════════════════════════════════
  // 阵营羁绊
  // ═══════════════════════════════════════════
  describe('阵营羁绊', () => {
    it('2人激活蜀国阵营羁绊', () => {
      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu')]);
      const bonds = system.calculateBonds(['liubei', 'guanyu']);
      const shu = bonds.find((b) => b.bondId === 'faction_shu')!;
      expect(shu).toBeDefined();
      expect(shu.type).toBe(BondType.FACTION);
      expect(shu.level).toBe(1);
      expect(shu.effects).toHaveLength(1);
      expect(shu.effects[0]).toEqual({ stat: 'attack', value: 0.05 });
      expect(shu.dispatchFactor).toBeCloseTo(1.0);
    });

    it('3人激活蜀国阵营羁绊（攻击+10%，防御+5%）', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
      ]);
      const shu = system.calculateBonds(['liubei', 'guanyu', 'zhangfei'])
        .find((b) => b.bondId === 'faction_shu')!;
      expect(shu.effects).toHaveLength(2);
      expect(shu.effects[0]).toEqual({ stat: 'attack', value: 0.10 });
      expect(shu.effects[1]).toEqual({ stat: 'defense', value: 0.05 });
    });

    it('4人激活蜀国阵营羁绊（攻击+15%，防御+10%，生命+5%）', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'),
        makeMeta('zhangfei', 'shu'), makeMeta('zhaoyun', 'shu'),
      ]);
      const shu = system.calculateBonds(['liubei', 'guanyu', 'zhangfei', 'zhaoyun'])
        .find((b) => b.bondId === 'faction_shu')!;
      expect(shu.effects).toHaveLength(3);
      expect(shu.effects[0]).toEqual({ stat: 'attack', value: 0.15 });
      expect(shu.effects[1]).toEqual({ stat: 'defense', value: 0.10 });
      expect(shu.effects[2]).toEqual({ stat: 'hp', value: 0.05 });
    });

    it('1人同阵营不激活羁绊', () => {
      system = createSystem([makeMeta('liubei', 'shu')]);
      expect(system.calculateBonds(['liubei']).find((b) => b.bondId === 'faction_shu')).toBeUndefined();
    });

    it('不同阵营不互相影响', () => {
      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('caocao', 'wei')]);
      expect(system.calculateBonds(['liubei', 'caocao'])).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 搭档羁绊
  // ═══════════════════════════════════════════
  describe('搭档羁绊', () => {
    it('桃园结义（刘备+关羽+张飞）激活', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
      ]);
      const ty = system.calculateBonds(['liubei', 'guanyu', 'zhangfei'])
        .find((b) => b.bondId === 'partner_taoyuan')!;
      expect(ty.name).toBe('桃园结义');
      expect(ty.type).toBe(BondType.PARTNER);
      expect(ty.effects[0]).toEqual({ stat: 'attack', value: 0.15 });
    });

    it('桃园结义缺少一人不激活', () => {
      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu')]);
      expect(system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'partner_taoyuan')).toBeUndefined();
    });

    it('五虎上将3人激活（关羽+张飞+赵云）', () => {
      system = createSystem([
        makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'), makeMeta('zhaoyun', 'shu'),
      ]);
      const wh = system.calculateBonds(['guanyu', 'zhangfei', 'zhaoyun'])
        .find((b) => b.bondId === 'partner_wuhu')!;
      expect(wh.name).toBe('五虎上将');
      expect(wh.effects[0]).toEqual({ stat: 'critRate', value: 0.10 });
      expect(wh.participants).toHaveLength(3);
    });

    it('五虎上将2人不激活（需至少3人）', () => {
      system = createSystem([makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu')]);
      expect(system.calculateBonds(['guanyu', 'zhangfei']).find((b) => b.bondId === 'partner_wuhu')).toBeUndefined();
    });

    it('卧龙凤雏（诸葛亮+庞统）激活', () => {
      system = createSystem([makeMeta('zhugeliang', 'shu'), makeMeta('pangtong', 'shu')]);
      const wl = system.calculateBonds(['zhugeliang', 'pangtong'])
        .find((b) => b.bondId === 'partner_wolong_fengchu')!;
      expect(wl.name).toBe('卧龙凤雏');
      expect(wl.effects[0]).toEqual({ stat: 'skillDamage', value: 0.20 });
    });
  });

  // ═══════════════════════════════════════════
  // 羁绊等级（基于最低星级）
  // ═══════════════════════════════════════════
  describe('羁绊等级（基于最低星级）', () => {
    const ids = ['liubei', 'guanyu', 'zhangfei'];

    it('所有武将1星 → Lv1（倍率1.0）', () => {
      system = createSystem([
        makeMeta('liubei', 'shu', 1), makeMeta('guanyu', 'shu', 1), makeMeta('zhangfei', 'shu', 1),
      ]);
      const b = system.calculateBonds(ids).find((b) => b.bondId === 'partner_taoyuan')!;
      expect(b.level).toBe(1);
      expect(b.levelMultiplier).toBeCloseTo(1.0);
    });

    it('所有武将3星 → Lv2（倍率1.5）', () => {
      system = createSystem([
        makeMeta('liubei', 'shu', 3), makeMeta('guanyu', 'shu', 3), makeMeta('zhangfei', 'shu', 3),
      ]);
      const b = system.calculateBonds(ids).find((b) => b.bondId === 'partner_taoyuan')!;
      expect(b.level).toBe(2);
      expect(b.levelMultiplier).toBeCloseTo(1.5);
    });

    it('所有武将5星 → Lv3（倍率2.0）', () => {
      system = createSystem([
        makeMeta('liubei', 'shu', 5), makeMeta('guanyu', 'shu', 5), makeMeta('zhangfei', 'shu', 5),
      ]);
      const b = system.calculateBonds(ids).find((b) => b.bondId === 'partner_taoyuan')!;
      expect(b.level).toBe(3);
      expect(b.levelMultiplier).toBeCloseTo(2.0);
    });

    it('最低星级决定等级（2星+5星 → Lv1）', () => {
      system = createSystem([makeMeta('liubei', 'shu', 2), makeMeta('guanyu', 'shu', 5)]);
      const b = system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'faction_shu')!;
      expect(b.level).toBe(1);
    });

    it('最低星级4星 → Lv2（≥3星但<5星）', () => {
      system = createSystem([makeMeta('liubei', 'shu', 4), makeMeta('guanyu', 'shu', 4)]);
      const b = system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'faction_shu')!;
      expect(b.level).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 派驻减半效果
  // ═══════════════════════════════════════════
  describe('派驻减半效果', () => {
    it('全部上阵 → dispatchFactor = 1.0', () => {
      system = createSystem([makeMeta('liubei', 'shu', 1, true), makeMeta('guanyu', 'shu', 1, true)]);
      const b = system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'faction_shu')!;
      expect(b.dispatchFactor).toBeCloseTo(1.0);
    });

    it('1人上阵+1人派驻 → dispatchFactor = 0.75', () => {
      system = createSystem([makeMeta('liubei', 'shu', 1, true), makeMeta('guanyu', 'shu', 1, false)]);
      const b = system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'faction_shu')!;
      expect(b.dispatchFactor).toBeCloseTo(0.75);
    });

    it('全部派驻 → dispatchFactor = 0.5', () => {
      system = createSystem([makeMeta('liubei', 'shu', 1, false), makeMeta('guanyu', 'shu', 1, false)]);
      const b = system.calculateBonds(['liubei', 'guanyu']).find((b) => b.bondId === 'faction_shu')!;
      expect(b.dispatchFactor).toBeCloseTo(0.5);
    });

    it('3人上阵+1人派驻 → dispatchFactor = 0.875', () => {
      system = createSystem([
        makeMeta('liubei', 'shu', 1, true), makeMeta('guanyu', 'shu', 1, true),
        makeMeta('zhangfei', 'shu', 1, true), makeMeta('zhaoyun', 'shu', 1, false),
      ]);
      const b = system.calculateBonds(['liubei', 'guanyu', 'zhangfei', 'zhaoyun'])
        .find((b) => b.bondId === 'faction_shu')!;
      expect(b.dispatchFactor).toBeCloseTo(0.875);
    });

    it('派驻减半影响羁绊系数', () => {
      system = createSystem([makeMeta('liubei', 'shu', 1, true), makeMeta('guanyu', 'shu', 1, true)]);
      const mActive = system.getBondMultiplier(['liubei', 'guanyu']);

      system = createSystem([makeMeta('liubei', 'shu', 1, false), makeMeta('guanyu', 'shu', 1, false)]);
      const mDispatch = system.getBondMultiplier(['liubei', 'guanyu']);

      expect(mDispatch).toBeCloseTo(1 + (mActive - 1) * 0.5);
    });
  });

  // ═══════════════════════════════════════════
  // 多羁绊叠加
  // ═══════════════════════════════════════════
  describe('多羁绊叠加', () => {
    it('桃园结义 + 蜀国3人同时激活', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
      ]);
      const bonds = system.calculateBonds(['liubei', 'guanyu', 'zhangfei']);
      expect(bonds.length).toBeGreaterThanOrEqual(2);
      expect(bonds.find((b) => b.bondId === 'faction_shu')).toBeDefined();
      expect(bonds.find((b) => b.bondId === 'partner_taoyuan')).toBeDefined();
    });

    it('多羁绊叠加系数 > 单一羁绊', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
      ]);
      const multi = system.getBondMultiplier(['liubei', 'guanyu', 'zhangfei']);

      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu')]);
      const single = system.getBondMultiplier(['liubei', 'guanyu']);
      expect(multi).toBeGreaterThan(single);
    });

    it('五虎3人 + 蜀国4人同时激活', () => {
      system = createSystem([
        makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
        makeMeta('zhaoyun', 'shu'), makeMeta('liubei', 'shu'),
      ]);
      const bonds = system.calculateBonds(['guanyu', 'zhangfei', 'zhaoyun', 'liubei']);
      expect(bonds.find((b) => b.bondId === 'faction_shu')).toBeDefined();
      expect(bonds.find((b) => b.bondId === 'partner_wuhu')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('空编队返回系数1.0', () => {
      system = createSystem([]);
      expect(system.getBondMultiplier([])).toBe(1.0);
    });

    it('无羁绊组合返回系数1.0', () => {
      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('caocao', 'wei')]);
      expect(system.getBondMultiplier(['liubei', 'caocao'])).toBe(1.0);
    });

    it('未注入依赖时返回空羁绊', () => {
      expect(system.calculateBonds(['liubei'])).toHaveLength(0);
      expect(system.getBondMultiplier(['liubei'])).toBe(1.0);
    });

    it('羁绊系数上限为2.0', () => {
      // 蜀国4人Lv3 + 桃园结义Lv3 + 五虎上将Lv3
      // 总效果 = (0.15+0.10+0.05) + 0.15 + 0.10 = 0.55
      // Lv3 ×2.0 → 1.10, 系数 = 2.10 → cap 2.0
      system = createSystem([
        makeMeta('liubei', 'shu', 5), makeMeta('guanyu', 'shu', 5),
        makeMeta('zhangfei', 'shu', 5), makeMeta('zhaoyun', 'shu', 5),
      ]);
      const m = system.getBondMultiplier(['liubei', 'guanyu', 'zhangfei', 'zhaoyun']);
      expect(m).toBeLessThanOrEqual(BOND_MULTIPLIER_CAP);
      expect(m).toBeCloseTo(BOND_MULTIPLIER_CAP);
    });

    it('isBondActive 正确判断', () => {
      system = createSystem([makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu')]);
      const ids = ['liubei', 'guanyu'];
      expect(system.isBondActive('faction_shu', ids)).toBe(true);
      expect(system.isBondActive('faction_wei', ids)).toBe(false);
      expect(system.isBondActive('partner_taoyuan', ids)).toBe(false);
    });

    it('getActiveBonds 等同于 calculateBonds', () => {
      system = createSystem([
        makeMeta('liubei', 'shu'), makeMeta('guanyu', 'shu'), makeMeta('zhangfei', 'shu'),
      ]);
      const ids = ['liubei', 'guanyu', 'zhangfei'];
      const a = system.calculateBonds(ids).map((b) => b.bondId).sort();
      const b = system.getActiveBonds(ids).map((b) => b.bondId).sort();
      expect(a).toEqual(b);
    });

    it('reset 后清空依赖', () => {
      system = createSystem([makeMeta('liubei', 'shu')]);
      system.reset();
      expect(system.getBondMultiplier(['liubei'])).toBe(1.0);
    });
  });
});
