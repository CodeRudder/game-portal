/**
 * 武将名册/图鉴/红点/待办 — P1 缺口补充测试
 *
 * 验证：
 * 1. 武将名册/图鉴：图鉴列表展示、武将详情展示、已拥有/未拥有状态、碎片合成红点
 * 2. 红点/角标UI：新武将红点提示、可升级红点、碎片合成红点、状态聚合
 * 3. 今日待办聚合UI：武将相关待办项聚合展示、待办排序、待办去重
 *
 * 与已有 HeroCollection.test.ts 的区别：
 * - HeroCollection.test.ts 侧重静态数据完整性（定义、配置验证）
 * - 本文件侧重 UI 展示的数据支撑能力（状态切换、红点联动、待办聚合）
 *
 * 使用真实引擎实例：HeroSystem + HeroBadgeSystem
 *
 * @module engine/hero/__tests__/HeroCollectionUI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { HeroBadgeSystem } from '../HeroBadgeSystem';
import type { BadgeSystemDeps, TodayTodoItem, BadgeSystemState } from '../HeroBadgeSystem';
import { Quality, FACTIONS, FACTION_LABELS, QUALITY_LABELS } from '../hero.types';
import type { Faction, GeneralData } from '../hero.types';
import {
  GENERAL_DEFS,
  GENERAL_DEF_MAP,
  SYNTHESIZE_REQUIRED_FRAGMENTS,
  DUPLICATE_FRAGMENT_COUNT,
} from '../hero-config';

// ═══════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════

/** 创建 HeroSystem 并添加指定武将 */
function createHeroSystem(heroIds: string[]): HeroSystem {
  const system = new HeroSystem();
  for (const id of heroIds) {
    system.addGeneral(id);
  }
  return system;
}

/** 创建 BadgeSystemDeps */
function createDeps(overrides: {
  heroIds?: string[];
  canLevelUp?: (id: string) => boolean;
  canStarUp?: (id: string) => boolean;
  canEquip?: (id: string) => boolean;
}): BadgeSystemDeps {
  return {
    getGeneralIds: () => overrides.heroIds ?? [],
    canLevelUp: overrides.canLevelUp ?? (() => false),
    canStarUp: overrides.canStarUp ?? (() => false),
    canEquip: overrides.canEquip ?? (() => false),
  };
}

/** 获取指定品质的武将定义列表 */
function getDefsByQuality(quality: Quality) {
  return GENERAL_DEFS.filter(d => d.quality === quality);
}

/** 获取指定阵营的武将定义列表 */
function getDefsByFaction(faction: Faction) {
  return GENERAL_DEFS.filter(d => d.faction === faction);
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('HeroCollectionUI — 武将名册/图鉴/红点/待办 P1', () => {
  let heroSystem: HeroSystem;
  let badgeSystem: HeroBadgeSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    badgeSystem = new HeroBadgeSystem();
  });

  // ═══════════════════════════════════════════
  // Part 1: 图鉴列表展示
  // ═══════════════════════════════════════════

  describe('Part 1: 图鉴列表展示', () => {
    it('图鉴列表应包含所有武将定义（含未拥有）', () => {
      // 图鉴展示所有武将，包括未拥有的
      const allDefs = GENERAL_DEFS;
      expect(allDefs.length).toBeGreaterThan(0);

      // 已拥有数量
      const owned = heroSystem.getGeneralCount();
      expect(owned).toBe(0);

      // 图鉴总数 = 定义总数
      expect(allDefs.length).toBe(GENERAL_DEF_MAP.size);
    });

    it('图鉴按阵营分组应正确', () => {
      const factions: Faction[] = ['shu', 'wei', 'wu', 'qun'];
      const grouped = new Map<Faction, typeof GENERAL_DEFS>();

      for (const f of factions) {
        grouped.set(f, getDefsByFaction(f));
      }

      // 每个阵营都有武将
      for (const f of factions) {
        expect(grouped.get(f)!.length).toBeGreaterThan(0);
      }

      // 分组总数 = 全部武将数
      const total = Array.from(grouped.values()).reduce((s, g) => s + g.length, 0);
      expect(total).toBe(GENERAL_DEFS.length);
    });

    it('图鉴按品质筛选应正确', () => {
      for (const q of Object.values(Quality)) {
        const defs = getDefsByQuality(q);
        for (const def of defs) {
          expect(def.quality).toBe(q);
        }
      }
    });

    it('图鉴列表每个条目应包含UI展示所需字段', () => {
      for (const def of GENERAL_DEFS) {
        // UI展示需要的字段
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(def.quality).toBeTruthy();
        expect(def.faction).toBeTruthy();
        expect(def.baseStats).toBeDefined();
        expect(def.skills).toBeDefined();
        expect(def.skills.length).toBeGreaterThan(0);
      }
    });

    it('图鉴列表支持按阵营+品质联合筛选', () => {
      const shuLegendary = GENERAL_DEFS.filter(
        d => d.faction === 'shu' && d.quality === Quality.LEGENDARY,
      );
      // 验证筛选结果都是蜀国传说
      for (const def of shuLegendary) {
        expect(def.faction).toBe('shu');
        expect(def.quality).toBe(Quality.LEGENDARY);
      }
    });
  });

  // ═══════════════════════════════════════════
  // Part 2: 武将详情展示
  // ═══════════════════════════════════════════

  describe('Part 2: 武将详情展示', () => {
    it('已拥有武将详情应包含完整数据', () => {
      heroSystem.addGeneral('guanyu');
      const general = heroSystem.getGeneral('guanyu');

      expect(general).toBeDefined();
      expect(general!.id).toBe('guanyu');
      expect(general!.name).toBe('关羽');
      expect(general!.quality).toBe(Quality.LEGENDARY);
      expect(general!.faction).toBe('shu');
      expect(general!.level).toBe(1);
      expect(general!.baseStats.attack).toBeGreaterThan(0);
      expect(general!.baseStats.defense).toBeGreaterThan(0);
      expect(general!.baseStats.intelligence).toBeGreaterThan(0);
      expect(general!.baseStats.speed).toBeGreaterThan(0);
      expect(general!.skills.length).toBeGreaterThan(0);
    });

    it('未拥有武将详情应从定义中获取（只读展示）', () => {
      const def = GENERAL_DEF_MAP.get('guanyu');
      expect(def).toBeDefined();
      expect(def!.name).toBe('关羽');
      expect(def!.quality).toBe(Quality.LEGENDARY);
      // 未拥有时通过定义展示基础信息
    });

    it('武将详情应展示品质标签和颜色', () => {
      heroSystem.addGeneral('guanyu');
      const general = heroSystem.getGeneral('guanyu');
      const qualityLabel = QUALITY_LABELS[general!.quality];
      expect(qualityLabel).toBe('传说');
    });

    it('武将详情应展示阵营标签', () => {
      heroSystem.addGeneral('guanyu');
      const general = heroSystem.getGeneral('guanyu');
      const factionLabel = FACTION_LABELS[general!.faction];
      expect(factionLabel).toBe('蜀');
    });

    it('武将详情应展示战力计算结果', () => {
      heroSystem.addGeneral('guanyu');
      const general = heroSystem.getGeneral('guanyu');
      const power = heroSystem.calculatePower(general!);
      expect(power).toBeGreaterThan(0);
      expect(Number.isFinite(power)).toBe(true);
    });

    it('武将详情应展示碎片合成进度', () => {
      // 未拥有武将的碎片合成进度
      const progress = heroSystem.getSynthesizeProgress('guanyu');
      expect(progress).toBeDefined();
      expect(progress.required).toBe(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY]);
      expect(progress.current).toBe(0);

      // 添加碎片后进度更新
      heroSystem.addFragment('guanyu', 100);
      const progress2 = heroSystem.getSynthesizeProgress('guanyu');
      expect(progress2.current).toBe(100);
    });

    it('不同品质武将的合成进度应不同', () => {
      const legendaryProgress = heroSystem.getSynthesizeProgress('guanyu');
      const commonProgress = heroSystem.getSynthesizeProgress('minbingduizhang');

      // 传说品质需要更多碎片
      expect(legendaryProgress.required).toBeGreaterThan(commonProgress.required);
    });
  });

  // ═══════════════════════════════════════════
  // Part 3: 已拥有/未拥有状态
  // ═══════════════════════════════════════════

  describe('Part 3: 已拥有/未拥有状态', () => {
    it('初始状态所有武将为未拥有', () => {
      for (const def of GENERAL_DEFS) {
        expect(heroSystem.hasGeneral(def.id)).toBe(false);
      }
    });

    it('添加武将后状态变为已拥有', () => {
      heroSystem.addGeneral('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(true);
    });

    it('移除武将后状态变为未拥有', () => {
      heroSystem.addGeneral('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(true);
      heroSystem.removeGeneral('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
    });

    it('碎片合成武将后状态变为已拥有', () => {
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY]);
      heroSystem.fragmentSynthesize('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(true);
    });

    it('已拥有武将不能通过碎片再次合成', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 999);
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).toBeNull();
    });

    it('图鉴收集率计算应正确', () => {
      // 添加部分武将
      const half = Math.floor(GENERAL_DEFS.length / 2);
      for (let i = 0; i < half; i++) {
        heroSystem.addGeneral(GENERAL_DEFS[i].id);
      }

      const ownedCount = heroSystem.getGeneralCount();
      const totalCount = GENERAL_DEFS.length;
      const collectionRate = ownedCount / totalCount;

      expect(collectionRate).toBeCloseTo(half / GENERAL_DEFS.length, 2);
      expect(collectionRate).toBeGreaterThan(0);
      expect(collectionRate).toBeLessThan(1);
    });

    it('全收集时收集率为100%', () => {
      for (const def of GENERAL_DEFS) {
        heroSystem.addGeneral(def.id);
      }
      const collectionRate = heroSystem.getGeneralCount() / GENERAL_DEFS.length;
      expect(collectionRate).toBe(1);
    });

    it('按阵营统计已拥有/未拥有', () => {
      // 只添加蜀国武将
      const shuDefs = getDefsByFaction('shu');
      for (const def of shuDefs) {
        heroSystem.addGeneral(def.id);
      }

      const all = heroSystem.getAllGenerals();
      const shuOwned = all.filter(g => g.faction === 'shu');
      const weiOwned = all.filter(g => g.faction === 'wei');

      expect(shuOwned.length).toBe(shuDefs.length);
      expect(weiOwned.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // Part 4: 新武将红点提示
  // ═══════════════════════════════════════════

  describe('Part 4: 新武将红点提示', () => {
    it('新获得武将时应有红点提示（通过碎片合成）', () => {
      // 合成前：碎片足够但未拥有 → 红点
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);

      // 添加碎片到刚好够
      heroSystem.addFragment('guanyu', SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY]);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);

      // 合成后获得武将
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).not.toBeNull();
      expect(heroSystem.hasGeneral('guanyu')).toBe(true);
    });

    it('碎片接近合成数量时应显示进度红点', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      // 添加80%碎片
      heroSystem.addFragment('guanyu', Math.floor(required * 0.8));
      const progress = heroSystem.getSynthesizeProgress('guanyu');
      const progressRatio = progress.current / progress.required;
      expect(progressRatio).toBeCloseTo(0.8, 1);
      // UI层可基于进度比例显示红点（如 >= 80%）
    });

    it('canSynthesize 碎片不足时返回 false', () => {
      heroSystem.addFragment('guanyu', 10);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('canSynthesize 已拥有武将返回 false', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 999);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('canSynthesize 碎片刚好够时返回 true', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      heroSystem.addFragment('guanyu', required);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
    });

    it('canSynthesize 碎片超过需求时返回 true', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      heroSystem.addFragment('guanyu', required + 100);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // Part 5: 可升级红点
  // ═══════════════════════════════════════════

  describe('Part 5: 可升级红点', () => {
    it('有武将可升级时Tab角标数量 > 0', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao'],
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(2);
    });

    it('部分武将可升级时角标数量正确', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao', 'liubei'],
        canLevelUp: id => id === 'guanyu' || id === 'liubei',
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(2);
    });

    it('无武将可升级时角标为 0', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => false,
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(0);
    });

    it('升级红点与升星红点独立计算', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao'],
        canLevelUp: id => id === 'guanyu',
        canStarUp: id => id === 'caocao',
      }));
      expect(badgeSystem.getLevelBadgeCount()).toBe(1);
      expect(badgeSystem.getStarBadgeCount()).toBe(1);
    });

    it('主界面红点聚合升级+升星+装备', () => {
      // 只有升级
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);

      // 只有升星
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canStarUp: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);

      // 只有装备
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canEquip: () => true,
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(true);

      // 都没有
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
      }));
      expect(badgeSystem.hasMainEntryRedDot()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // Part 6: 碎片合成红点
  // ═══════════════════════════════════════════

  describe('Part 6: 碎片合成红点', () => {
    it('碎片达到合成数量时可合成红点亮起', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      heroSystem.addFragment('guanyu', required);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
    });

    it('碎片不足时合成红点不亮', () => {
      heroSystem.addFragment('guanyu', 10);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('已拥有武将不显示合成红点', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 999);
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
    });

    it('合成后碎片被消耗，红点熄灭', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      heroSystem.addFragment('guanyu', required + 50);
      expect(heroSystem.canSynthesize('guanyu')).toBe(true);

      heroSystem.fragmentSynthesize('guanyu');
      // 已拥有，不可再合成
      expect(heroSystem.canSynthesize('guanyu')).toBe(false);
      // 剩余碎片
      expect(heroSystem.getFragments('guanyu')).toBe(50);
    });

    it('多个武将的合成红点独立判断', () => {
      const legendaryRequired = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      const commonRequired = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];

      heroSystem.addFragment('guanyu', legendaryRequired);
      heroSystem.addFragment('minbingduizhang', commonRequired - 1);

      expect(heroSystem.canSynthesize('guanyu')).toBe(true);
      expect(heroSystem.canSynthesize('minbingduizhang')).toBe(false);
    });

    it('重复武将碎片转化后可能触发合成红点', () => {
      // 模拟获得重复武将
      const fragments = heroSystem.handleDuplicate('minbingduizhang', Quality.COMMON);
      expect(fragments).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.COMMON]);

      // 检查碎片是否足够合成
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      if (fragments >= required) {
        expect(heroSystem.canSynthesize('minbingduizhang')).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════
  // Part 7: 今日待办聚合展示
  // ═══════════════════════════════════════════

  describe('Part 7: 今日待办聚合展示', () => {
    it('无待办时显示默认招募提示', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(1);
      expect(todos[0].type).toBe('recruit');
      expect(todos[0].label).toContain('招募');
    });

    it('有待办时不显示默认招募提示', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      const recruitTodos = todos.filter(t => t.type === 'recruit');
      expect(recruitTodos).toHaveLength(0);
    });

    it('每个待办条目包含完整的UI展示字段', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      for (const todo of todos) {
        expect(todo).toHaveProperty('type');
        expect(todo).toHaveProperty('label');
        expect(todo).toHaveProperty('action');
        expect(typeof todo.type).toBe('string');
        expect(typeof todo.label).toBe('string');
        expect(typeof todo.action).toBe('string');
      }
    });

    it('一个武将同时有多种待办时全部聚合', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
        canStarUp: () => true,
        canEquip: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(3);
      const types = todos.map(t => t.type);
      expect(types).toContain('levelUp');
      expect(types).toContain('starUp');
      expect(types).toContain('equip');
    });

    it('多个武将各有待办时正确聚合', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao', 'liubei'],
        canLevelUp: id => id === 'guanyu',
        canStarUp: id => id === 'caocao',
        canEquip: id => id === 'liubei',
      }));
      const todos = badgeSystem.getTodayTodoList();
      expect(todos).toHaveLength(3);

      const guanyuTodos = todos.filter(t => t.heroId === 'guanyu');
      expect(guanyuTodos).toHaveLength(1);
      expect(guanyuTodos[0].type).toBe('levelUp');

      const caocaoTodos = todos.filter(t => t.heroId === 'caocao');
      expect(caocaoTodos).toHaveLength(1);
      expect(caocaoTodos[0].type).toBe('starUp');

      const liubeiTodos = todos.filter(t => t.heroId === 'liubei');
      expect(liubeiTodos).toHaveLength(1);
      expect(liubeiTodos[0].type).toBe('equip');
    });

    it('待办聚合顺序：升级 → 升星 → 装备', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
        canStarUp: () => true,
        canEquip: () => true,
      }));
      const todos = badgeSystem.getTodayTodoList();
      // 按代码逻辑顺序：先遍历升级，再升星，再装备
      expect(todos[0].type).toBe('levelUp');
      expect(todos[1].type).toBe('starUp');
      expect(todos[2].type).toBe('equip');
    });

    it('快捷操作 levelUp 返回可升级武将列表', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao'],
        canLevelUp: id => id === 'guanyu',
      }));
      const result = badgeSystem.executeQuickAction('levelUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['guanyu']);
      expect(result.message).toContain('1');
    });

    it('快捷操作 starUp 返回可升星武将列表', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu', 'caocao', 'liubei'],
        canStarUp: id => id === 'guanyu' || id === 'liubei',
      }));
      const result = badgeSystem.executeQuickAction('starUp');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toContain('guanyu');
      expect(result.affectedHeroes).toContain('liubei');
    });

    it('快捷操作 equip 返回有新装备的武将列表', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canEquip: () => true,
      }));
      const result = badgeSystem.executeQuickAction('equip');
      expect(result.success).toBe(true);
      expect(result.affectedHeroes).toEqual(['guanyu']);
    });

    it('快捷操作无匹配武将时返回失败', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
      }));
      const result = badgeSystem.executeQuickAction('levelUp');
      expect(result.success).toBe(false);
      expect(result.affectedHeroes).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // Part 6: 碎片合成红点
  // ═══════════════════════════════════════════

  describe('Part 6: 碎片合成红点', () => {
    it('碎片达到合成数量时 canSynthesize 返回 true', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      heroSystem.addFragment('minbingduizhang', required);
      expect(heroSystem.canSynthesize('minbingduizhang')).toBe(true);
    });

    it('碎片未达到合成数量时 canSynthesize 返回 false', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      heroSystem.addFragment('minbingduizhang', required - 1);
      expect(heroSystem.canSynthesize('minbingduizhang')).toBe(false);
    });

    it('不同品质武将合成所需碎片数量不同', () => {
      const commonCost = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      const legendaryCost = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      expect(legendaryCost).toBeGreaterThan(commonCost);
    });

    it('合成后碎片被正确消耗', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      heroSystem.addFragment('minbingduizhang', required + 50);
      heroSystem.fragmentSynthesize('minbingduizhang');
      expect(heroSystem.getFragments('minbingduizhang')).toBe(50);
    });

    it('合成后武将出现在名册中', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      heroSystem.addFragment('minbingduizhang', required);
      expect(heroSystem.hasGeneral('minbingduizhang')).toBe(false);

      heroSystem.fragmentSynthesize('minbingduizhang');
      expect(heroSystem.hasGeneral('minbingduizhang')).toBe(true);
    });

    it('重复武将碎片转化后增加碎片数量', () => {
      heroSystem.addGeneral('guanyu');
      const fragments = heroSystem.handleDuplicate('guanyu', Quality.LEGENDARY);
      expect(fragments).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.LEGENDARY]);
      expect(heroSystem.getFragments('guanyu')).toBe(fragments);
    });
  });

  // ═══════════════════════════════════════════
  // Part 7: BadgeSystemState 聚合状态
  // ═══════════════════════════════════════════

  describe('Part 7: BadgeSystemState 聚合状态', () => {
    it('getState 应返回完整状态对象', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
        canStarUp: () => true,
      }));
      const state: BadgeSystemState = badgeSystem.getState();

      expect(state.mainEntryRedDot).toBe(true);
      expect(state.tabLevelBadge).toBe(1);
      expect(state.tabStarBadge).toBe(1);
      expect(state.todayTodos.length).toBeGreaterThan(0);
    });

    it('状态变化后 getState 反映最新值', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
      }));
      expect(badgeSystem.getState().mainEntryRedDot).toBe(false);

      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getState().mainEntryRedDot).toBe(true);
    });

    it('reset 后状态清零', () => {
      badgeSystem.setBadgeSystemDeps(createDeps({
        heroIds: ['guanyu'],
        canLevelUp: () => true,
      }));
      expect(badgeSystem.getState().mainEntryRedDot).toBe(true);

      badgeSystem.reset();
      expect(badgeSystem.getState().mainEntryRedDot).toBe(false);
      expect(badgeSystem.getState().tabLevelBadge).toBe(0);
      expect(badgeSystem.getState().tabStarBadge).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // Part 8: 战力展示支撑
  // ═══════════════════════════════════════════

  describe('Part 8: 战力展示支撑', () => {
    it('全体武将总战力应正确计算', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('caocao');
      const totalPower = heroSystem.calculateTotalPower();
      expect(totalPower).toBeGreaterThan(0);
      expect(Number.isFinite(totalPower)).toBe(true);
    });

    it('编队战力含羁绊系数应高于不含羁绊', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('caocao');

      const normalPower = heroSystem.calculateTotalPower();
      const formationPower = heroSystem.calculateFormationPower(
        ['guanyu', 'caocao'],
        () => 1,
        1.5, // 50% 羁绊加成
      );
      expect(formationPower).toBeGreaterThan(normalPower);
    });

    it('空编队战力为 0', () => {
      const power = heroSystem.calculateFormationPower([]);
      expect(power).toBe(0);
    });
  });
});
