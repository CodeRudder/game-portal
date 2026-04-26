/**
 * FactionBondSystem 单元测试
 *
 * 覆盖：
 *   - 阵营羁绊：0/2/3/4/5人激活、混合阵营、空编队
 *   - 搭档羁绊：桃园结义/魏武之威/赤壁之谋、部分组合不激活
 *   - 属性加成计算：百分比正确应用、多羁绊叠加、基础属性为0
 *   - ISubsystem 接口实现
 *   - 序列化/反序列化
 *   - 自定义阵营解析器
 *   - 边界条件
 */

import { FactionBondSystem } from '../faction-bond-system';
import type {
  ActiveFactionBond,
  HeroFactionResolver,
} from '../faction-bond-system';
import {
  EMPTY_BOND_EFFECT,
  SHU_TIERS,
  WEI_TIERS,
  WU_TIERS,
  NEUTRAL_TIERS,
  FACTION_TIER_MAP,
  PARTNER_BOND_CONFIGS,
  HERO_FACTION_MAP,
  ALL_FACTIONS,
  FACTION_NAMES,
} from '../faction-bond-config';
import type {
  BondEffect,
  BondConfig,
  FactionId,
} from '../faction-bond-config';

// ── 辅助函数 ──

/** 创建系统实例 */
function createSystem(resolver?: HeroFactionResolver): FactionBondSystem {
  const system = new FactionBondSystem();
  if (resolver) {
    system.setHeroFactionResolver(resolver);
  }
  return system;
}

/** 使用内置阵营映射的默认系统 */
let system: FactionBondSystem;

beforeEach(() => {
  system = createSystem();
});

// ═══════════════════════════════════════════════════════════════
// 1. 阵营羁绊
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 阵营羁绊', () => {
  // ── 0人同阵营无加成 ──
  it('0人同阵营无加成', () => {
    const bonds = system.calculateBonds([]);
    expect(bonds.size).toBe(0);
  });

  it('1人同阵营无羁绊', () => {
    const bonds = system.calculateBonds(['liubei']);
    const effect = bonds.get('liubei')!;
    expect(effect).toBeDefined();
    expect(effect.attackBonus).toBe(0);
    expect(effect.defenseBonus).toBe(0);
  });

  // ── 2人同阵营触发初级羁绊 ──
  it('2人蜀触发初级羁绊（攻击+5%）', () => {
    const bonds = system.calculateBonds(['liubei', 'guanyu']);
    const effect = bonds.get('liubei')!;
    expect(effect.attackBonus).toBeCloseTo(0.05);
    expect(effect.defenseBonus).toBe(0);
    expect(effect.hpBonus).toBe(0);
    expect(effect.critBonus).toBe(0);
    expect(effect.strategyBonus).toBe(0);
  });

  it('2人魏触发初级羁绊（攻击+5%）', () => {
    const bonds = system.calculateBonds(['caocao', 'xiahoudun']);
    const effect = bonds.get('caocao')!;
    expect(effect.attackBonus).toBeCloseTo(0.05);
  });

  it('2人吴触发初级羁绊（攻击+5%）', () => {
    const bonds = system.calculateBonds(['sunquan', 'zhouyu']);
    const effect = bonds.get('sunquan')!;
    expect(effect.attackBonus).toBeCloseTo(0.05);
  });

  it('2人群雄触发初级羁绊（攻击+5%）', () => {
    const bonds = system.calculateBonds(['lvbu', 'diaochan']);
    const effect = bonds.get('lvbu')!;
    expect(effect.attackBonus).toBeCloseTo(0.05);
  });

  // ── 3人同阵营触发中级羁绊 ──
  it('3人蜀触发中级羁绊（攻击+10%，防御+5%）+ 桃园结义叠加', () => {
    const bonds = system.calculateBonds(['liubei', 'guanyu', 'zhangfei']);
    const effect = bonds.get('liubei')!;
    // 3蜀中级：攻击+10%，防御+5% + 桃园结义：全属性+10%
    expect(effect.attackBonus).toBeCloseTo(0.10 + 0.10); // 阵营+搭档
    expect(effect.defenseBonus).toBeCloseTo(0.05 + 0.10);
    expect(effect.hpBonus).toBeCloseTo(0.10); // 桃园结义加成
  });

  it('3人魏触发中级羁绊 + 虎痴双雄叠加', () => {
    const bonds = system.calculateBonds(['caocao', 'xuchu', 'dianwei']);
    const xuchuEffect = bonds.get('xuchu')!;
    // 3魏中级：攻击+10%，防御+5% + 虎痴双雄：攻击+12%，防御+8%
    expect(xuchuEffect.attackBonus).toBeCloseTo(0.10 + 0.12);
    expect(xuchuEffect.defenseBonus).toBeCloseTo(0.05 + 0.08);
    // caocao 不是虎痴双雄的参与者，只有阵营加成
    const caocaoEffect = bonds.get('caocao')!;
    expect(caocaoEffect.attackBonus).toBeCloseTo(0.10);
    expect(caocaoEffect.defenseBonus).toBeCloseTo(0.05);
  });

  // ── 4人同阵营触发高级羁绊 ──
  it('4人吴触发高级羁绊（攻击+15%，防御+10%，生命+5%）', () => {
    const bonds = system.calculateBonds(['sunquan', 'zhouyu', 'lvmeng', 'luxun']);
    const effect = bonds.get('sunquan')!;
    expect(effect.attackBonus).toBeCloseTo(0.15);
    expect(effect.defenseBonus).toBeCloseTo(0.10);
    expect(effect.hpBonus).toBeCloseTo(0.05);
    expect(effect.critBonus).toBe(0);
  });

  it('4人蜀触发高级羁绊', () => {
    // 使用不含五虎上将成员的蜀国武将来单独测试阵营羁绊
    // 注意：liubei+guanyu+zhangfei 会触发桃园结义，所以用其他组合
    const bonds = system.calculateBonds(['liubei', 'zhugeliang', 'pangtong', 'zhaoyun']);
    const effect = bonds.get('liubei')!;
    // 4蜀高级：攻击+15%，防御+10%，生命+5%
    // 注意：zhaoyun 是五虎上将之一，但只有1个不满足3人要求
    expect(effect.attackBonus).toBeCloseTo(0.15);
    expect(effect.defenseBonus).toBeCloseTo(0.10);
    expect(effect.hpBonus).toBeCloseTo(0.05);
  });

  // ── 5人同阵营触发终极羁绊 ──
  it('5人群雄触发终极羁绊（攻击+20%，防御+15%，生命+10%，暴击+5%）', () => {
    const bonds = system.calculateBonds([
      'lvbu', 'diaochan', 'yuanzhao', 'jiaxu', 'zhangjiao',
    ]);
    const effect = bonds.get('lvbu')!;
    expect(effect.attackBonus).toBeCloseTo(0.20);
    expect(effect.defenseBonus).toBeCloseTo(0.15);
    expect(effect.hpBonus).toBeCloseTo(0.10);
    expect(effect.critBonus).toBeCloseTo(0.05);
    expect(effect.strategyBonus).toBe(0);
  });

  it('5人蜀触发终极羁绊', () => {
    // 使用包含五虎上将成员的蜀国武将
    const bonds = system.calculateBonds([
      'liubei', 'zhaoyun', 'machao', 'huangzhong', 'zhugeliang',
    ]);
    // liubei 不是五虎上将的参与者，只有阵营羁绊
    const liubeiEffect = bonds.get('liubei')!;
    expect(liubeiEffect.attackBonus).toBeCloseTo(0.20);
    expect(liubeiEffect.defenseBonus).toBeCloseTo(0.15);
    expect(liubeiEffect.hpBonus).toBeCloseTo(0.10);
    expect(liubeiEffect.critBonus).toBeCloseTo(0.05);
    // zhaoyun 是五虎上将的参与者，额外获得搭档羁绊
    const zhaoyunEffect = bonds.get('zhaoyun')!;
    expect(zhaoyunEffect.critBonus).toBeCloseTo(0.05 + 0.10);
  });

  // ── 混合阵营无羁绊 ──
  it('混合阵营（各1人）无羁绊', () => {
    const bonds = system.calculateBonds(['liubei', 'caocao', 'sunquan', 'lvbu']);
    for (const [, effect] of bonds) {
      expect(effect.attackBonus).toBe(0);
      expect(effect.defenseBonus).toBe(0);
    }
  });

  // ── 空编队无羁绊 ──
  it('空编队返回空Map', () => {
    const bonds = system.calculateBonds([]);
    expect(bonds.size).toBe(0);
  });

  // ── 超过5人仍只触发终极 ──
  it('6人蜀仍只触发终极（不会超过最高等级）', () => {
    // 使用包含多个搭档羁绊的蜀国武将
    const bonds = system.calculateBonds([
      'liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'pangtong',
    ]);
    const zhaoyunEffect = bonds.get('zhaoyun')!;
    // 终极阵营效果：攻击+20%，防御+15%，生命+10%，暴击+5%
    // 五虎上将(guanyu+zhangfei+zhaoyun=3人)：攻击+8%，暴击+10%
    // zhaoyun 不是桃园结义/卧龙凤雏的参与者
    expect(zhaoyunEffect.attackBonus).toBeCloseTo(0.20 + 0.08);
    expect(zhaoyunEffect.defenseBonus).toBeCloseTo(0.15);
    expect(zhaoyunEffect.hpBonus).toBeCloseTo(0.10);
    expect(zhaoyunEffect.critBonus).toBeCloseTo(0.05 + 0.10);
    expect(zhaoyunEffect.strategyBonus).toBeCloseTo(0);

    // liubei 是桃园结义参与者，但不是五虎上将参与者
    const liubeiEffect = bonds.get('liubei')!;
    expect(liubeiEffect.attackBonus).toBeCloseTo(0.20 + 0.10);
    expect(liubeiEffect.defenseBonus).toBeCloseTo(0.15 + 0.10);
    expect(liubeiEffect.hpBonus).toBeCloseTo(0.10 + 0.10);
    expect(liubeiEffect.critBonus).toBeCloseTo(0.05 + 0.10);
    expect(liubeiEffect.strategyBonus).toBeCloseTo(0.10);

    // zhugeliang 是卧龙凤雏参与者
    const zhugeliangEffect = bonds.get('zhugeliang')!;
    expect(zhugeliangEffect.strategyBonus).toBeCloseTo(0.20);
  });

  // ── 不同阵营不互相影响 ──
  it('2蜀+2魏各自触发初级羁绊', () => {
    const bonds = system.calculateBonds(['liubei', 'guanyu', 'caocao', 'xiahoudun']);
    const shuEffect = bonds.get('liubei')!;
    const weiEffect = bonds.get('caocao')!;
    expect(shuEffect.attackBonus).toBeCloseTo(0.05);
    expect(weiEffect.attackBonus).toBeCloseTo(0.05);
  });

  // ── 未知武将（不在映射中） ──
  it('未知武将不参与阵营计算', () => {
    const bonds = system.calculateBonds(['unknown_hero']);
    const effect = bonds.get('unknown_hero')!;
    expect(effect).toBeDefined();
    expect(effect.attackBonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 搭档羁绊
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 搭档羁绊', () => {
  // ── 桃园结义 ──
  it('桃园结义（刘备+关羽+张飞）激活', () => {
    const bonds = system.calculateBonds(['liubei', 'guanyu', 'zhangfei']);
    const effect = bonds.get('liubei')!;
    // 桃园结义：全属性+10%，加上3蜀阵营：攻击+10%，防御+5%
    expect(effect.attackBonus).toBeCloseTo(0.10 + 0.10); // 阵营+搭档
    expect(effect.defenseBonus).toBeCloseTo(0.05 + 0.10);
    expect(effect.hpBonus).toBeCloseTo(0.10);
    expect(effect.critBonus).toBeCloseTo(0.10);
    expect(effect.strategyBonus).toBeCloseTo(0.10);
  });

  it('桃园结义缺少张飞不激活搭档羁绊', () => {
    const bonds = system.calculateBonds(['liubei', 'guanyu']);
    const effect = bonds.get('liubei')!;
    // 只有2蜀阵营初级羁绊
    expect(effect.attackBonus).toBeCloseTo(0.05);
    expect(effect.defenseBonus).toBe(0);
    expect(effect.hpBonus).toBe(0);
    expect(effect.critBonus).toBe(0);
    expect(effect.strategyBonus).toBe(0);
  });

  it('桃园结义缺少关羽不激活', () => {
    const bonds = system.calculateBonds(['liubei', 'zhangfei']);
    const effect = bonds.get('liubei')!;
    expect(effect.attackBonus).toBeCloseTo(0.05); // 只有阵营
    expect(effect.critBonus).toBe(0);
  });

  // ── 虎痴双雄 ──
  it('虎痴双雄（许褚+典韦）激活', () => {
    const bonds = system.calculateBonds(['xuchu', 'dianwei']);
    const effect = bonds.get('xuchu')!;
    // 虎痴双雄：攻击+12%，防御+8%，加上2魏阵营：攻击+5%
    expect(effect.attackBonus).toBeCloseTo(0.05 + 0.12);
    expect(effect.defenseBonus).toBeCloseTo(0.08);
  });

  it('虎痴双雄缺少典韦不激活', () => {
    const bonds = system.calculateBonds(['xuchu', 'xiahoudun']);
    const effect = bonds.get('xuchu')!;
    // 只有2魏阵营初级
    expect(effect.attackBonus).toBeCloseTo(0.05);
  });

  it('虎痴双雄缺少许褚不激活', () => {
    const bonds = system.calculateBonds(['dianwei', 'xiahoudun']);
    const effect = bonds.get('dianwei')!;
    expect(effect.attackBonus).toBeCloseTo(0.05); // 只有阵营
  });

  // ── 江东双璧 ──
  it('江东双璧（孙策+周瑜）激活', () => {
    const bonds = system.calculateBonds(['sunce', 'zhouyu']);
    const effect = bonds.get('sunce')!;
    // 江东双璧：策略+20%，加上2吴阵营：攻击+5%
    expect(effect.attackBonus).toBeCloseTo(0.05);
    expect(effect.strategyBonus).toBeCloseTo(0.20);
  });

  it('江东双璧缺少周瑜不激活', () => {
    const bonds = system.calculateBonds(['sunce']);
    const effect = bonds.get('sunce')!;
    expect(effect.strategyBonus).toBe(0);
  });

  it('江东双璧缺少孙策不激活', () => {
    const bonds = system.calculateBonds(['zhouyu']);
    const effect = bonds.get('zhouyu')!;
    expect(effect.strategyBonus).toBe(0);
  });

  // ── 部分组合不激活 ──
  it('刘备+曹操+孙权无搭档羁绊', () => {
    const bonds = system.calculateBonds(['liubei', 'caocao', 'sunquan']);
    for (const [, effect] of bonds) {
      // 只有各自1人，无阵营也无搭档
      expect(effect.attackBonus).toBe(0);
      expect(effect.strategyBonus).toBe(0);
    }
  });

  it('关羽+张飞（无刘备）不触发桃园结义', () => {
    const bonds = system.calculateBonds(['guanyu', 'zhangfei']);
    const effect = bonds.get('guanyu')!;
    // 2蜀阵营初级
    expect(effect.attackBonus).toBeCloseTo(0.05);
    expect(effect.critBonus).toBe(0);
    expect(effect.hpBonus).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 属性加成计算
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 属性加成计算', () => {
  // ── 百分比正确应用 ──
  it('百分比加成正确应用到属性', () => {
    const baseStats = { attack: 100, defense: 80, intelligence: 60, speed: 50 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['liubei', 'guanyu']);
    // 2蜀初级：攻击+5%
    expect(result.attack).toBe(105); // 100 * 1.05 = 105
    expect(result.defense).toBe(80);  // 无防御加成
    expect(result.intelligence).toBe(60); // 无策略加成
    expect(result.speed).toBe(50);  // 速度不受羁绊影响
  });

  it('中级羁绊加成正确应用', () => {
    const baseStats = { attack: 200, defense: 100, intelligence: 50, speed: 40 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['liubei', 'guanyu', 'zhangfei']);
    // 3蜀中级：攻击+10%，防御+5%（加桃园结义全属性+10%）
    // attack: 200 * (1 + 0.10 + 0.10) = 240
    expect(result.attack).toBe(240);
    // defense: 100 * (1 + 0.05 + 0.10) = 115
    expect(result.defense).toBe(115);
  });

  it('策略加成正确应用', () => {
    const baseStats = { attack: 100, defense: 50, intelligence: 80, speed: 30 };
    const result = system.applyBondBonus(baseStats, 'sunce', ['sunce', 'zhouyu']);
    // 2吴初级：攻击+5% + 江东双璧：策略+20%
    // intelligence: 80 * (1 + 0.20) = 96
    expect(result.intelligence).toBe(96);
  });

  // ── 多羁绊叠加 ──
  it('阵营羁绊+搭档羁绊叠加', () => {
    const baseStats = { attack: 1000, defense: 500, intelligence: 200, speed: 100 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['liubei', 'guanyu', 'zhangfei']);
    // 3蜀中级：攻击+10%，防御+5%
    // 桃园结义：全属性+10%
    // attack: 1000 * (1 + 0.10 + 0.10) = 1200
    expect(result.attack).toBe(1200);
    // defense: 500 * (1 + 0.05 + 0.10) = 575
    expect(result.defense).toBe(575);
  });

  it('多个搭档羁绊不叠加（同一搭档只激活一次）', () => {
    // 刘备+关羽+张飞 桃园结义只激活一次
    const bonds = system.calculateBonds(['liubei', 'guanyu', 'zhangfei']);
    const effect = bonds.get('liubei')!;
    // 桃园结义效果只加一次
    expect(effect.hpBonus).toBeCloseTo(0.10); // 不是 0.20
  });

  // ── 基础属性为0时不崩溃 ──
  it('基础属性为0时不崩溃', () => {
    const baseStats = { attack: 0, defense: 0, intelligence: 0, speed: 0 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['liubei', 'guanyu']);
    expect(result.attack).toBe(0);
    expect(result.defense).toBe(0);
    expect(result.intelligence).toBe(0);
    expect(result.speed).toBe(0);
  });

  it('空编队applyBondBonus返回原始属性', () => {
    const baseStats = { attack: 100, defense: 50, intelligence: 30, speed: 20 };
    const result = system.applyBondBonus(baseStats, 'liubei', []);
    expect(result).toEqual(baseStats);
  });

  it('不在编队中的武将无加成', () => {
    const baseStats = { attack: 100, defense: 50, intelligence: 30, speed: 20 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['caocao', 'xiahoudun']);
    expect(result).toEqual(baseStats);
  });

  // ── 结果向下取整（Math.round） ──
  it('属性加成结果四舍五入', () => {
    const baseStats = { attack: 33, defense: 7, intelligence: 3, speed: 1 };
    const result = system.applyBondBonus(baseStats, 'liubei', ['liubei', 'guanyu']);
    // 33 * 1.05 = 34.65 → 35
    expect(result.attack).toBe(35);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. getActiveBonds
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — getActiveBonds', () => {
  it('获取刘备在桃园队伍中的激活羁绊', () => {
    const bonds = system.getActiveBonds('liubei', ['liubei', 'guanyu', 'zhangfei']);
    expect(bonds.length).toBeGreaterThanOrEqual(1);
    const taoyuan = bonds.find(b => b.id === 'partner_taoyuan');
    expect(taoyuan).toBeDefined();
    expect(taoyuan!.effect.attackBonus).toBeCloseTo(0.10);
  });

  it('获取曹操在虎痴双雄队伍中的激活羁绊', () => {
    const bonds = system.getActiveBonds('xuchu', ['xuchu', 'dianwei']);
    const huchi = bonds.find(b => b.id === 'partner_huchi');
    expect(huchi).toBeDefined();
    expect(huchi!.effect.attackBonus).toBeCloseTo(0.12);
    expect(huchi!.effect.defenseBonus).toBeCloseTo(0.08);
  });

  it('获取孙权在孙氏父子队伍中的激活羁绊', () => {
    const bonds = system.getActiveBonds('sunquan', ['sunjian', 'sunce', 'sunquan']);
    const sunFamily = bonds.find(b => b.id === 'partner_sun_family');
    expect(sunFamily).toBeDefined();
    expect(sunFamily!.effect.attackBonus).toBeCloseTo(0.10);
  });

  it('不在编队中的武将返回空列表', () => {
    const bonds = system.getActiveBonds('liubei', ['caocao', 'xiahoudun']);
    expect(bonds).toHaveLength(0);
  });

  it('无羁绊的编队返回空列表', () => {
    const bonds = system.getActiveBonds('liubei', ['liubei']);
    expect(bonds).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. getAllBondConfigs
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — getAllBondConfigs', () => {
  it('返回所有羁绊配置（4阵营×4等级+14搭档=30）', () => {
    const configs = system.getAllBondConfigs();
    // 4 factions × 4 tiers = 16 + 14 partner bonds = 30
    expect(configs).toHaveLength(30);
  });

  it('包含阵营羁绊配置', () => {
    const configs = system.getAllBondConfigs();
    const shuConfigs = configs.filter(c => c.type === 'faction' && c.faction === 'shu');
    expect(shuConfigs).toHaveLength(4); // 4 tiers
  });

  it('包含搭档羁绊配置', () => {
    const configs = system.getAllBondConfigs();
    const partnerConfigs = configs.filter(c => c.type === 'partner');
    expect(partnerConfigs).toHaveLength(14);
  });

  it('每个配置都有有效的效果', () => {
    const configs = system.getAllBondConfigs();
    for (const config of configs) {
      expect(config.effect).toBeDefined();
      expect(config.id).toBeTruthy();
      expect(config.name).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. isBondActive
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — isBondActive', () => {
  it('桃园结义搭档羁绊激活', () => {
    expect(system.isBondActive('partner_taoyuan', ['liubei', 'guanyu', 'zhangfei'])).toBe(true);
  });

  it('桃园结义搭档羁绊未激活', () => {
    expect(system.isBondActive('partner_taoyuan', ['liubei', 'guanyu'])).toBe(false);
  });

  it('魏国虎痴双雄搭档羁绊激活', () => {
    expect(system.isBondActive('partner_huchi', ['xuchu', 'dianwei'])).toBe(true);
  });

  it('吴国江东双璧搭档羁绊激活', () => {
    expect(system.isBondActive('partner_jiangdong', ['sunce', 'zhouyu'])).toBe(true);
  });

  it('阵营羁绊（faction_shu_2）2人激活', () => {
    expect(system.isBondActive('faction_shu_2', ['liubei', 'guanyu'])).toBe(true);
  });

  it('阵营羁绊（faction_shu_3）2人不激活', () => {
    expect(system.isBondActive('faction_shu_3', ['liubei', 'guanyu'])).toBe(false);
  });

  it('阵营羁绊（faction_wei_3）3人激活', () => {
    expect(system.isBondActive('faction_wei_3', ['caocao', 'xiahoudun', 'xuchu'])).toBe(true);
  });

  it('不存在的羁绊ID返回false', () => {
    expect(system.isBondActive('nonexistent_bond', ['liubei'])).toBe(false);
  });

  it('空编队所有羁绊不激活', () => {
    expect(system.isBondActive('partner_taoyuan', [])).toBe(false);
    expect(system.isBondActive('faction_shu_2', [])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. ISubsystem 接口实现
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — ISubsystem 接口', () => {
  it('name 属性为 faction-bond', () => {
    expect(system.name).toBe('faction-bond');
  });

  it('init 不抛异常', () => {
    expect(() => {
      system.init({
        eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as any,
        config: { get: vi.fn() } as any,
        registry: { get: vi.fn() } as any,
      });
    }).not.toThrow();
  });

  it('update 不抛异常', () => {
    expect(() => system.update(0.016)).not.toThrow();
  });

  it('getState 返回有效对象', () => {
    const state = system.getState();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('reset 恢复初始状态', () => {
    system.reset();
    // reset 后仍可正常使用
    const bonds = system.calculateBonds(['liubei', 'guanyu']);
    expect(bonds.size).toBe(2);
  });

  it('implements ISubsystem 接口（duck typing）', () => {
    expect(typeof system.init).toBe('function');
    expect(typeof system.update).toBe('function');
    expect(typeof system.getState).toBe('function');
    expect(typeof system.reset).toBe('function');
    expect(typeof system.name).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 序列化/反序列化
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 序列化/反序列化', () => {
  it('serialize 返回有效对象', () => {
    const data = system.serialize();
    expect(data).toBeDefined();
    expect(data.name).toBe('faction-bond');
    expect(typeof data.configCount).toBe('number');
  });

  it('deserialize 不抛异常', () => {
    expect(() => system.deserialize({})).not.toThrow();
  });

  it('deserialize null 不抛异常', () => {
    expect(() => system.deserialize(null)).not.toThrow();
  });

  it('序列化后反序列化系统仍可用', () => {
    const data = system.serialize();
    const newSystem = new FactionBondSystem();
    newSystem.deserialize(data);
    const bonds = newSystem.calculateBonds(['liubei', 'guanyu']);
    expect(bonds.size).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 自定义阵营解析器
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 自定义阵营解析器', () => {
  it('自定义解析器覆盖默认映射', () => {
    const customResolver = (heroId: string): FactionId | undefined => {
      if (heroId.startsWith('custom_')) return 'shu';
      return HERO_FACTION_MAP[heroId];
    };
    const sys = createSystem(customResolver);
    const bonds = sys.calculateBonds(['custom_a', 'custom_b']);
    expect(bonds.get('custom_a')!.attackBonus).toBeCloseTo(0.05);
  });

  it('解析器返回undefined时武将不参与阵营计算', () => {
    const customResolver = (_heroId: string): FactionId | undefined => undefined;
    const sys = createSystem(customResolver);
    const bonds = sys.calculateBonds(['liubei', 'guanyu']);
    expect(bonds.get('liubei')!.attackBonus).toBe(0);
  });

  it('reset 后恢复默认解析器', () => {
    const customResolver = (_heroId: string): FactionId | undefined => undefined;
    const sys = createSystem(customResolver);
    sys.reset();
    const bonds = sys.calculateBonds(['liubei', 'guanyu']);
    expect(bonds.get('liubei')!.attackBonus).toBeCloseTo(0.05);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 配置常量验证
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 配置常量', () => {
  it('EMPTY_BOND_EFFECT 所有字段为0', () => {
    expect(EMPTY_BOND_EFFECT.attackBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.defenseBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.hpBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.critBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.strategyBonus).toBe(0);
  });

  it('4个阵营都有4个等级', () => {
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      expect(tiers).toHaveLength(4);
    }
  });

  it('等级按 requiredCount 升序排列', () => {
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].requiredCount).toBeGreaterThan(tiers[i - 1].requiredCount);
      }
    }
  });

  it('初级羁绊都是攻击+5%', () => {
    for (const faction of ALL_FACTIONS) {
      const tier = FACTION_TIER_MAP[faction][0];
      expect(tier.requiredCount).toBe(2);
      expect(tier.effect.attackBonus).toBeCloseTo(0.05);
    }
  });

  it('终极羁绊包含4项加成', () => {
    for (const faction of ALL_FACTIONS) {
      const tier = FACTION_TIER_MAP[faction][3];
      expect(tier.requiredCount).toBe(5);
      expect(tier.effect.attackBonus).toBeCloseTo(0.20);
      expect(tier.effect.defenseBonus).toBeCloseTo(0.15);
      expect(tier.effect.hpBonus).toBeCloseTo(0.10);
      expect(tier.effect.critBonus).toBeCloseTo(0.05);
    }
  });

  it('搭档羁绊配置有14个', () => {
    expect(PARTNER_BOND_CONFIGS).toHaveLength(14);
  });

  it('桃园结义全属性+10%', () => {
    const taoyuan = PARTNER_BOND_CONFIGS.find(b => b.id === 'partner_taoyuan')!;
    expect(taoyuan.effect.attackBonus).toBeCloseTo(0.10);
    expect(taoyuan.effect.defenseBonus).toBeCloseTo(0.10);
    expect(taoyuan.effect.hpBonus).toBeCloseTo(0.10);
    expect(taoyuan.effect.critBonus).toBeCloseTo(0.10);
    expect(taoyuan.effect.strategyBonus).toBeCloseTo(0.10);
  });

  it('虎痴双雄攻击+12%防御+8%', () => {
    const huchi = PARTNER_BOND_CONFIGS.find(b => b.id === 'partner_huchi')!;
    expect(huchi.effect.attackBonus).toBeCloseTo(0.12);
    expect(huchi.effect.defenseBonus).toBeCloseTo(0.08);
  });

  it('江东双璧策略+20%', () => {
    const jiangdong = PARTNER_BOND_CONFIGS.find(b => b.id === 'partner_jiangdong')!;
    expect(jiangdong.effect.strategyBonus).toBeCloseTo(0.20);
    expect(jiangdong.effect.attackBonus).toBe(0);
  });

  it('三英战吕布攻击+18%', () => {
    const sanying = PARTNER_BOND_CONFIGS.find(b => b.id === 'partner_sanying_lvbu')!;
    expect(sanying.effect.attackBonus).toBeCloseTo(0.18);
    expect(sanying.minCount).toBe(4);
  });

  it('袁绍谋士策略+12%', () => {
    const moushi = PARTNER_BOND_CONFIGS.find(b => b.id === 'partner_yuanshao_moushi')!;
    expect(moushi.effect.strategyBonus).toBeCloseTo(0.12);
  });

  it('阵营中文名映射完整', () => {
    expect(FACTION_NAMES.wei).toBe('魏');
    expect(FACTION_NAMES.shu).toBe('蜀');
    expect(FACTION_NAMES.wu).toBe('吴');
    expect(FACTION_NAMES.neutral).toBe('群雄');
  });

  it('内置武将阵营映射包含关键武将', () => {
    expect(HERO_FACTION_MAP.liubei).toBe('shu');
    expect(HERO_FACTION_MAP.caocao).toBe('wei');
    expect(HERO_FACTION_MAP.sunquan).toBe('wu');
    expect(HERO_FACTION_MAP.lvbu).toBe('neutral');
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 边界条件
// ═══════════════════════════════════════════════════════════════
describe('FactionBondSystem — 边界条件', () => {
  it('重复武将ID不影响计算', () => {
    const bonds = system.calculateBonds(['liubei', 'liubei', 'guanyu']);
    // liubei 出现两次，但阵营分组只看ID数量
    const effect = bonds.get('liubei')!;
    // 3个ID中有2个蜀（liubei, liubei, guanyu），实际3个蜀ID
    // 但 Map 中 liubei 只有一个 entry
    expect(effect).toBeDefined();
  });

  it('大量武将（10人）不崩溃', () => {
    const heroes = [
      'liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao',
      'caocao', 'xiahoudun', 'xuchu', 'sunquan', 'zhouyu',
    ];
    const bonds = system.calculateBonds(heroes);
    expect(bonds.size).toBe(10);
  });

  it('calculateBonds 返回的 Map 包含所有输入武将', () => {
    const heroes = ['liubei', 'guanyu', 'caocao'];
    const bonds = system.calculateBonds(heroes);
    expect(bonds.has('liubei')).toBe(true);
    expect(bonds.has('guanyu')).toBe(true);
    expect(bonds.has('caocao')).toBe(true);
  });

  it('applyBondBonus 不修改原始属性对象', () => {
    const original = { attack: 100, defense: 50, intelligence: 30, speed: 20 };
    const copy = { ...original };
    system.applyBondBonus(original, 'liubei', ['liubei', 'guanyu']);
    expect(original).toEqual(copy);
  });
});
