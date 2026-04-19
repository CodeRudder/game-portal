/**
 * DecorationSystem 装饰系统 — 单元测试
 *
 * 覆盖范围：
 * - 注册皮肤 / 称号 / 头像框 / 特效定义
 * - 解锁皮肤 / 称号 / 头像框 / 特效
 * - 装备与卸下皮肤 / 称号 / 头像框 / 特效
 * - 查询已拥有 / 已装备装饰
 * - 事件监听
 * - 序列化 / 反序列化
 * - 系统重置
 *
 * @module engines/idle/modules/__tests__/DecorationSystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DecorationSystem,
  type SkinDef,
  type TitleDef,
  type AvatarFrameDef,
  type EffectDef,
  type DecorationEvent,
} from '../DecorationSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建皮肤定义 */
function makeSkin(overrides?: Partial<SkinDef>): SkinDef {
  return {
    id: 'skin_castle_gold',
    name: '黄金城堡',
    type: 'building',
    rarity: 'legendary',
    icon: '🏰',
    description: '闪耀的黄金城堡皮肤',
    targetId: 'castle',
    ...overrides,
  };
}

/** 创建称号定义 */
function makeTitle(overrides?: Partial<TitleDef>): TitleDef {
  return {
    id: 'title_hero',
    name: '英雄',
    description: '证明你是一名真正的英雄',
    icon: '🏆',
    rarity: 'epic',
    ...overrides,
  };
}

/** 创建头像框定义 */
function makeAvatarFrame(overrides?: Partial<AvatarFrameDef>): AvatarFrameDef {
  return {
    id: 'frame_diamond',
    name: '钻石边框',
    icon: '💎',
    rarity: 'legendary',
    borderColor: '#00ffff',
    ...overrides,
  };
}

/** 创建特效定义 */
function makeEffect(overrides?: Partial<EffectDef>): EffectDef {
  return {
    id: 'effect_entrance_fire',
    name: '烈焰入场',
    type: 'entrance',
    icon: '🔥',
    description: '入场时燃烧特效',
    rarity: 'rare',
    ...overrides,
  };
}

/** 创建并注册所有定义的完整系统 */
function createFullSystem(): DecorationSystem {
  const sys = new DecorationSystem();
  sys.registerSkins([
    makeSkin(),
    makeSkin({ id: 'skin_char_fire', name: '火焰战士', type: 'character', rarity: 'epic', targetId: 'warrior' }),
    makeSkin({ id: 'skin_map_snow', name: '雪域地图', type: 'map', rarity: 'rare', targetId: 'map_01' }),
  ]);
  sys.registerTitles([makeTitle(), makeTitle({ id: 'title_king', name: '国王', rarity: 'legendary' })]);
  sys.registerAvatarFrames([makeAvatarFrame(), makeAvatarFrame({ id: 'frame_gold', name: '金边框', rarity: 'rare', borderColor: '#ffd700' })]);
  sys.registerEffects([
    makeEffect(),
    makeEffect({ id: 'effect_click_star', name: '星辰点击', type: 'click', rarity: 'common' }),
    makeEffect({ id: 'effect_battle_thunder', name: '雷霆战斗', type: 'battle', rarity: 'epic' }),
  ]);
  return sys;
}

// ============================================================
// 测试套件
// ============================================================

describe('DecorationSystem', () => {
  let system: DecorationSystem;

  beforeEach(() => {
    system = createFullSystem();
  });

  // ----------------------------------------------------------
  // 解锁皮肤
  // ----------------------------------------------------------
  describe('解锁皮肤', () => {
    it('应成功解锁已注册的皮肤', () => {
      expect(system.unlockSkin('skin_castle_gold')).toBe(true);
      expect(system.ownsSkin('skin_castle_gold')).toBe(true);
    });

    it('未注册的皮肤不可解锁', () => {
      expect(system.unlockSkin('skin_unknown')).toBe(false);
    });

    it('重复解锁同一皮肤返回 false', () => {
      system.unlockSkin('skin_castle_gold');
      expect(system.unlockSkin('skin_castle_gold')).toBe(false);
    });

    it('解锁时应触发 skin_unlocked 事件', () => {
      const events: DecorationEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.unlockSkin('skin_castle_gold');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'skin_unlocked', skinId: 'skin_castle_gold' });
    });
  });

  // ----------------------------------------------------------
  // 装备 / 卸下皮肤
  // ----------------------------------------------------------
  describe('装备与卸下皮肤', () => {
    beforeEach(() => {
      system.unlockSkin('skin_castle_gold');
    });

    it('应成功装备已拥有的皮肤', () => {
      expect(system.equipSkin('skin_castle_gold')).toBe(true);
      const equipped = system.getEquippedSkin('building');
      expect(equipped).not.toBeNull();
      expect(equipped!.id).toBe('skin_castle_gold');
    });

    it('未拥有的皮肤不可装备', () => {
      expect(system.equipSkin('skin_char_fire')).toBe(false);
    });

    it('卸下皮肤后查询返回 null', () => {
      system.equipSkin('skin_castle_gold');
      expect(system.unequipSkin('building')).toBe(true);
      expect(system.getEquippedSkin('building')).toBeNull();
    });

    it('卸下未装备的皮肤返回 false', () => {
      expect(system.unequipSkin('character')).toBe(false);
    });

    it('装备时应触发 skin_equipped 事件', () => {
      const events: DecorationEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.equipSkin('skin_castle_gold');

      expect(events[0].type).toBe('skin_equipped');
    });
  });

  // ----------------------------------------------------------
  // 称号系统
  // ----------------------------------------------------------
  describe('称号系统', () => {
    it('应成功解锁并装备称号', () => {
      system.unlockTitle('title_hero');
      expect(system.equipTitle('title_hero')).toBe(true);
      expect(system.getEquippedTitle()!.id).toBe('title_hero');
    });

    it('未拥有的称号不可装备', () => {
      expect(system.equipTitle('title_hero')).toBe(false);
    });

    it('卸下称号后查询返回 null', () => {
      system.unlockTitle('title_hero');
      system.equipTitle('title_hero');
      expect(system.unequipTitle()).toBe(true);
      expect(system.getEquippedTitle()).toBeNull();
    });

    it('重复解锁返回 false', () => {
      system.unlockTitle('title_hero');
      expect(system.unlockTitle('title_hero')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 头像框系统
  // ----------------------------------------------------------
  describe('头像框系统', () => {
    it('应成功解锁并装备头像框', () => {
      system.unlockAvatarFrame('frame_diamond');
      expect(system.equipAvatarFrame('frame_diamond')).toBe(true);
      expect(system.getEquippedAvatarFrame()!.id).toBe('frame_diamond');
    });

    it('卸下头像框后查询返回 null', () => {
      system.unlockAvatarFrame('frame_diamond');
      system.equipAvatarFrame('frame_diamond');
      expect(system.unequipAvatarFrame()).toBe(true);
      expect(system.getEquippedAvatarFrame()).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 特效系统
  // ----------------------------------------------------------
  describe('特效系统', () => {
    it('应成功解锁并装备特效', () => {
      system.unlockEffect('effect_entrance_fire');
      expect(system.equipEffect('effect_entrance_fire')).toBe(true);
    });

    it('最多装备 3 个特效', () => {
      system.unlockEffect('effect_entrance_fire');
      system.unlockEffect('effect_click_star');
      system.unlockEffect('effect_battle_thunder');

      expect(system.equipEffect('effect_entrance_fire')).toBe(true);
      expect(system.equipEffect('effect_click_star')).toBe(true);
      expect(system.equipEffect('effect_battle_thunder')).toBe(true);
    });

    it('重复装备同一特效返回 false', () => {
      system.unlockEffect('effect_entrance_fire');
      system.equipEffect('effect_entrance_fire');
      expect(system.equipEffect('effect_entrance_fire')).toBe(false);
    });

    it('应成功卸下特效', () => {
      system.unlockEffect('effect_entrance_fire');
      system.equipEffect('effect_entrance_fire');
      expect(system.unequipEffect('effect_entrance_fire')).toBe(true);
      expect(system.unequipEffect('effect_entrance_fire')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 查询已拥有装饰
  // ----------------------------------------------------------
  describe('查询已拥有装饰', () => {
    it('skins 应返回已拥有的皮肤列表', () => {
      system.unlockSkin('skin_castle_gold');
      system.unlockSkin('skin_char_fire');
      expect(system.skins).toHaveLength(2);
    });

    it('titles 应返回已拥有的称号列表', () => {
      system.unlockTitle('title_hero');
      expect(system.titles).toHaveLength(1);
    });

    it('avatars 应返回已拥有的头像框列表', () => {
      system.unlockAvatarFrame('frame_diamond');
      expect(system.avatars).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // 事件监听
  // ----------------------------------------------------------
  describe('事件监听', () => {
    it('offEvent 应移除监听器', () => {
      const events: DecorationEvent[] = [];
      const listener = (e: DecorationEvent) => events.push(e);
      system.onEvent(listener);

      system.unlockSkin('skin_castle_gold');
      expect(events).toHaveLength(1);

      system.offEvent(listener);
      system.unlockSkin('skin_char_fire');
      expect(events).toHaveLength(1); // 不再增加
    });
  });

  // ----------------------------------------------------------
  // 序列化 / 反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('saveState 应导出完整状态', () => {
      system.unlockSkin('skin_castle_gold');
      system.equipSkin('skin_castle_gold');
      system.unlockTitle('title_hero');
      system.equipTitle('title_hero');

      const saved = system.saveState();
      expect(saved.ownedSkins).toContain('skin_castle_gold');
      expect(saved.equippedSkins['building']).toBe('skin_castle_gold');
      expect(saved.equippedTitle).toBe('title_hero');
    });

    it('loadState 应恢复状态', () => {
      system.unlockSkin('skin_castle_gold');
      system.unlockTitle('title_hero');
      const saved = system.saveState();

      const fresh = createFullSystem();
      fresh.loadState(saved);

      expect(fresh.ownsSkin('skin_castle_gold')).toBe(true);
      expect(fresh.ownsTitle('title_hero')).toBe(true);
    });

    it('序列化结果为深拷贝', () => {
      system.unlockSkin('skin_castle_gold');
      const saved = system.saveState();
      saved.ownedSkins.push('fake_skin');

      expect(system.ownsSkin('fake_skin')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------
  describe('系统重置', () => {
    it('reset 应清空所有拥有和装备状态', () => {
      system.unlockSkin('skin_castle_gold');
      system.equipSkin('skin_castle_gold');
      system.unlockTitle('title_hero');
      system.equipTitle('title_hero');
      system.unlockAvatarFrame('frame_diamond');
      system.equipAvatarFrame('frame_diamond');

      system.reset();

      expect(system.skins).toHaveLength(0);
      expect(system.titles).toHaveLength(0);
      expect(system.avatars).toHaveLength(0);
      expect(system.getEquippedSkin('building')).toBeNull();
      expect(system.getEquippedTitle()).toBeNull();
      expect(system.getEquippedAvatarFrame()).toBeNull();
    });
  });
});
