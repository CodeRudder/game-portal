/**
 * NPC 模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: NPCSystem（NPC创建/查询/好感度/位置/可见性/序列化）
 *   S2: NPCDialogSystem（对话树/会话管理/选项过滤/效果执行）
 *   S3: NPCFavorabilitySystem（好感度获取途径/等级效果/羁绊技能/进度可视化）
 *   S4: NPCGiftSystem（赠送物品/偏好计算/好感度加成/历史记录）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/npc-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCSystem } from '../../engine/npc/NPCSystem';
import { NPCDialogSystem } from '../../engine/npc/NPCDialogSystem';
import { NPCFavorabilitySystem } from '../../engine/npc/NPCFavorabilitySystem';
import { NPCGiftSystem } from '../../engine/npc/NPCGiftSystem';
import { NPCTrainingSystem } from '../../engine/npc/NPCTrainingSystem';
import {
  getAffinityLevel,
  AFFINITY_LEVEL_LABELS,
  NPC_PROFESSION_DEFS,
  DIALOG_TREES,
  BOND_SKILLS,
  AFFINITY_LEVEL_EFFECTS,
} from '../../core/npc';
import type { NPCProfession, NPCData, AffinityLevel, DialogSession } from '../../core/npc';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const createNPCEnv = () => {
  const deps = mockDeps();
  const npcSystem = new NPCSystem();
  npcSystem.init(deps);
  const dialogSystem = new NPCDialogSystem();
  dialogSystem.init(deps);
  const favSystem = new NPCFavorabilitySystem();
  favSystem.init(deps);
  const giftSystem = new NPCGiftSystem();
  giftSystem.init(deps);
  const trainingSystem = new NPCTrainingSystem();
  trainingSystem.init(deps);
  // 注入好感度依赖：让 FavorabilitySystem 能访问 NPCSystem
  (deps.registry.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
    if (name === 'npc') return npcSystem;
    return null;
  });
  return { deps, npcSystem, dialogSystem, favSystem, giftSystem, trainingSystem };
};

const VALID_POSITION = { x: 5, y: 5 };
const PROFESSIONS: NPCProfession[] = ['merchant', 'strategist', 'warrior', 'artisan', 'traveler'];

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('NPC对抗测试 — F-Normal', () => {

  describe('NPCSystem 基础操作', () => {
    it('初始化后加载默认NPC', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.getNPCCount()).toBeGreaterThan(0);
      expect(npcSystem.getAllNPCs().length).toBe(npcSystem.getNPCCount());
    });

    it('创建NPC并查询', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('张三', 'merchant', VALID_POSITION);
      expect(npc.id).toBeTruthy();
      expect(npc.name).toBe('张三');
      expect(npc.profession).toBe('merchant');
      expect(npcSystem.getNPCById(npc.id)).toBeDefined();
      expect(npcSystem.hasNPC(npc.id)).toBe(true);
    });

    it('按区域查询NPC', () => {
      const { npcSystem } = createNPCEnv();
      const allNPCs = npcSystem.getAllNPCs();
      if (allNPCs.length > 0) {
        const region = allNPCs[0].region;
        const regionNPCs = npcSystem.getNPCsByRegion(region);
        expect(regionNPCs.length).toBeGreaterThan(0);
        expect(regionNPCs.every(n => n.region === region)).toBe(true);
      }
    });

    it('按职业查询NPC', () => {
      const { npcSystem } = createNPCEnv();
      npcSystem.createNPC('商贩甲', 'merchant', VALID_POSITION);
      const merchants = npcSystem.getNPCsByProfession('merchant');
      expect(merchants.length).toBeGreaterThanOrEqual(1);
      expect(merchants.every(n => n.profession === 'merchant')).toBe(true);
    });

    it('移动NPC到新位置', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('李四', 'warrior', VALID_POSITION);
      const newPos = { x: 20, y: 30 };
      const result = npcSystem.moveNPC(npc.id, newPos);
      expect(result).toBe(true);
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.position.x).toBe(20);
      expect(updated?.position.y).toBe(30);
    });

    it('修改好感度', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('王五', 'strategist', VALID_POSITION);
      const newAffinity = npcSystem.changeAffinity(npc.id, 20);
      expect(newAffinity).not.toBeNull();
      expect(newAffinity!).toBeGreaterThan(npc.affinity);
    });

    it('设置NPC可见性', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('赵六', 'artisan', VALID_POSITION);
      expect(npcSystem.setVisible(npc.id, false)).toBe(true);
      expect(npcSystem.getVisibleNPCs().find(n => n.id === npc.id)).toBeUndefined();
    });
  });

  describe('NPCDialogSystem 对话流程', () => {
    it('获取默认对话树', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      expect(treeIds.length).toBeGreaterThan(0);
    });

    it('开始对话并获取当前节点', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      expect(session).not.toBeNull();
      expect(session!.ended).toBe(false);
      const node = dialogSystem.getCurrentNode(session!.id);
      expect(node).not.toBeNull();
    });

    it('结束对话会话', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      expect(dialogSystem.endDialog(session!.id)).toBe(true);
      // 通过getSession获取最新状态验证ended
      const updated = dialogSystem.getSession(session!.id);
      expect(updated?.ended).toBe(true);
    });
  });

  describe('NPCFavorabilitySystem 好感度获取', () => {
    it('对话获取好感度', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('好感测试', 'merchant', VALID_POSITION);
      npcSystem.updateLastInteracted(npc.id, 1);
      const delta = favSystem.addDialogAffinity(npc.id, 1);
      expect(delta).not.toBeNull();
    });

    it('赠送偏好物品获取好感度', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('礼物测试', 'merchant', VALID_POSITION);
      npcSystem.updateLastInteracted(npc.id, 1);
      const delta = favSystem.addGiftAffinity(npc.id, true, 10, 1);
      expect(delta).not.toBeNull();
    });

    it('完成任务获取好感度', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('任务测试', 'strategist', VALID_POSITION);
      npcSystem.updateLastInteracted(npc.id, 1);
      const delta = favSystem.addQuestCompleteAffinity(npc.id, 1);
      expect(delta).not.toBeNull();
    });
  });

  describe('好感度等级效果', () => {
    it('获取等级效果', () => {
      const { favSystem } = createNPCEnv();
      const effect = favSystem.getLevelEffect('friendly');
      expect(effect).toBeDefined();
      expect(effect.tradeDiscount).toBeGreaterThanOrEqual(0);
    });

    it('获取好感度可视化', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('可视测试', 'merchant', { ...VALID_POSITION }, { affinity: 50 });
      const viz = favSystem.getVisualization(npc.id);
      expect(viz).not.toBeNull();
      expect(viz!.currentLevel).toBe('friendly');
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('NPC对抗测试 — F-Error', () => {

  describe('NPCSystem 错误处理', () => {
    it('查询不存在的NPC返回undefined', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.getNPCById('nonexistent')).toBeUndefined();
      expect(npcSystem.hasNPC('nonexistent')).toBe(false);
    });

    it('对不存在的NPC修改好感度返回null', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.changeAffinity('nonexistent', 10)).toBeNull();
    });

    it('对不存在的NPC设置好感度返回false', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.setAffinity('nonexistent', 50)).toBe(false);
    });

    it('移动不存在的NPC返回false', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.moveNPC('nonexistent', { x: 0, y: 0 })).toBe(false);
    });

    it('设置不存在的NPC可见性返回false', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.setVisible('nonexistent', false)).toBe(false);
    });

    it('删除不存在的NPC返回false', () => {
      const { npcSystem } = createNPCEnv();
      expect(npcSystem.removeNPC('nonexistent')).toBe(false);
    });

    it('NaN好感度变更被防护', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('NaN测试', 'merchant', VALID_POSITION);
      const originalAffinity = npc.affinity;
      const result = npcSystem.changeAffinity(npc.id, NaN);
      expect(result).toBe(originalAffinity); // NaN被忽略，返回原值
    });

    it('NaN好感度设置被防护', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('NaN设置', 'merchant', VALID_POSITION);
      expect(npcSystem.setAffinity(npc.id, NaN)).toBe(false);
    });

    it('Infinity好感度设置被防护', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('Inf测试', 'merchant', VALID_POSITION);
      expect(npcSystem.setAffinity(npc.id, Infinity)).toBe(false);
    });
  });

  describe('NPCDialogSystem 错误处理', () => {
    it('使用不存在的对话树开始对话返回null', () => {
      const { dialogSystem } = createNPCEnv();
      expect(dialogSystem.startDialog('npc-test', 'nonexistent-tree')).toBeNull();
    });

    it('不存在的会话获取节点返回null', () => {
      const { dialogSystem } = createNPCEnv();
      expect(dialogSystem.getCurrentNode('nonexistent-session')).toBeNull();
    });

    it('不存在的会话获取选项返回空数组', () => {
      const { dialogSystem } = createNPCEnv();
      expect(dialogSystem.getAvailableOptions('nonexistent-session')).toEqual([]);
    });

    it('不存在的会话选择选项返回失败', () => {
      const { dialogSystem } = createNPCEnv();
      const result = dialogSystem.selectOption('nonexistent-session', 'opt-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });

    it('结束不存在的会话返回false', () => {
      const { dialogSystem } = createNPCEnv();
      expect(dialogSystem.endDialog('nonexistent-session')).toBe(false);
    });

    it('未初始化dialogDeps时获取选项返回空', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      // dialogDeps未设置
      expect(dialogSystem.getAvailableOptions(session!.id)).toEqual([]);
    });

    it('未初始化dialogDeps时选择选项返回失败', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      const node = dialogSystem.getCurrentNode(session!.id);
      if (node && node.options.length > 0) {
        const result = dialogSystem.selectOption(session!.id, node.options[0].id);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('NPCFavorabilitySystem 错误处理', () => {
    it('对不存在的NPC获取等级效果返回null', () => {
      const { favSystem } = createNPCEnv();
      expect(favSystem.getNPCLevelEffect('nonexistent')).toBeNull();
    });

    it('对不存在的NPC获取可视化返回null', () => {
      const { favSystem } = createNPCEnv();
      expect(favSystem.getVisualization('nonexistent')).toBeNull();
    });

    it('对不存在的NPC检查交互解锁返回false', () => {
      const { favSystem } = createNPCEnv();
      expect(favSystem.isInteractionUnlocked('nonexistent', 'trade')).toBe(false);
    });

    it('对不存在的NPC获取交易折扣返回0', () => {
      const { favSystem } = createNPCEnv();
      expect(favSystem.getTradeDiscount('nonexistent')).toBe(0);
    });

    it('未达羁绊等级时激活羁绊技能返回null', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('羁绊测试', 'merchant', VALID_POSITION, { affinity: 10 });
      expect(favSystem.activateBondSkill(npc.id, 1)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('NPC对抗测试 — F-Boundary', () => {

  describe('好感度边界', () => {
    it('好感度上限为100', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('上限测试', 'merchant', VALID_POSITION, { affinity: 95 });
      const result = npcSystem.changeAffinity(npc.id, 50);
      expect(result).toBe(100);
    });

    it('好感度下限为0', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('下限测试', 'merchant', VALID_POSITION, { affinity: 5 });
      const result = npcSystem.changeAffinity(npc.id, -50);
      expect(result).toBe(0);
    });

    it('好感度恰好为0时等级为hostile', () => {
      expect(getAffinityLevel(0)).toBe('hostile');
    });

    it('好感度恰好为100时等级为bonded', () => {
      expect(getAffinityLevel(100)).toBe('bonded');
    });

    it('好感度50时等级为friendly', () => {
      expect(getAffinityLevel(50)).toBe('friendly');
    });

    it('好感度-1被clamp到0', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('负值测试', 'merchant', VALID_POSITION, { affinity: 0 });
      expect(npcSystem.setAffinity(npc.id, -1)).toBe(true);
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.affinity).toBe(0);
    });

    it('好感度101被clamp到100', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('超值测试', 'merchant', VALID_POSITION);
      expect(npcSystem.setAffinity(npc.id, 101)).toBe(true);
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.affinity).toBe(100);
    });
  });

  describe('NPC数量边界', () => {
    it('位置范围查询', () => {
      const { npcSystem } = createNPCEnv();
      npcSystem.createNPC('范围内', 'merchant', { x: 5, y: 5 });
      npcSystem.createNPC('范围外', 'warrior', { x: 100, y: 100 });
      const inBounds = npcSystem.getNPCsInBounds(0, 0, 10, 10);
      expect(inBounds.some(n => n.name === '范围内')).toBe(true);
      expect(inBounds.some(n => n.name === '范围外')).toBe(false);
    });

    it('空区域查询返回空数组', () => {
      const { npcSystem } = createNPCEnv();
      const result = npcSystem.getNPCsByRegion('nonexistent' as any);
      expect(result).toEqual([]);
    });
  });

  describe('对话会话边界', () => {
    it('已结束的会话获取节点返回null', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      dialogSystem.endDialog(session!.id);
      expect(dialogSystem.getCurrentNode(session!.id)).toBeNull();
    });

    it('已结束的会话选择选项返回session_ended', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      dialogSystem.endDialog(session!.id);
      const result = dialogSystem.selectOption(session!.id, 'any-option');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('session_ended');
    });

    it('选择不存在的选项返回option_not_found', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-test', treeIds[0]);
      // 设置dialogDeps以便通过检查
      dialogSystem.setDialogDeps({
        getAffinity: () => 50,
        getProfession: () => 'merchant',
        changeAffinity: () => 60,
        getCurrentTurn: () => 1,
      });
      const result = dialogSystem.selectOption(session!.id, 'nonexistent-option');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('option_not_found');
    });
  });

  describe('好感度衰减边界', () => {
    it('10回合内不触发衰减', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('衰减测试', 'merchant', VALID_POSITION, { affinity: 50 });
      npcSystem.updateLastInteracted(npc.id, 5);
      favSystem.processDecay([npc.id], 10); // 10-5=5 <= 10, 不衰减
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.affinity).toBe(50);
    });

    it('超过10回合未交互触发衰减', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      // 默认decayPerTurn=0，需要设置为正数
      favSystem.setGainConfig({ decayPerTurn: 2 });
      const npc = npcSystem.createNPC('衰减测试2', 'merchant', VALID_POSITION, { affinity: 50 });
      npcSystem.updateLastInteracted(npc.id, 1);
      favSystem.processDecay([npc.id], 20); // 20-1=19 > 10, 衰减
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.affinity).toBeLessThan(50);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('NPC对抗测试 — F-Cross', () => {

  describe('NPCSystem + DialogSystem 交互', () => {
    it('对话中好感度变化影响后续选项过滤', () => {
      const { npcSystem, dialogSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('交互测试', 'merchant', VALID_POSITION, { affinity: 10 });
      dialogSystem.setDialogDeps({
        getAffinity: (id) => npcSystem.getNPCById(id)?.affinity ?? 0,
        getProfession: (id) => npcSystem.getNPCById(id)?.profession ?? null,
        changeAffinity: (id, delta) => npcSystem.changeAffinity(id, delta),
        getCurrentTurn: () => 1,
      });
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog(npc.id, treeIds[0]);
      // 低好感度时获取选项
      const lowAffOptions = dialogSystem.getAvailableOptions(session!.id);
      // 提升好感度
      npcSystem.changeAffinity(npc.id, 80);
      // 高好感度时获取选项（可能更多选项可用）
      const highAffOptions = dialogSystem.getAvailableOptions(session!.id);
      // 高好感度选项应 >= 低好感度选项
      expect(highAffOptions.length).toBeGreaterThanOrEqual(lowAffOptions.length);
    });
  });

  describe('NPCSystem + FavorabilitySystem 交互', () => {
    it('好感度变化触发等级变更事件', () => {
      const { deps, npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('等级事件', 'merchant', VALID_POSITION, { affinity: 5 });
      npcSystem.updateLastInteracted(npc.id, 1);
      // 大幅增加好感度触发等级变更
      favSystem.addGiftAffinity(npc.id, true, 100, 2);
      // 事件总线应有调用
      expect(deps.eventBus.emit).toHaveBeenCalled();
    });

    it('交易折扣随好感度等级变化', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('折扣测试', 'merchant', VALID_POSITION, { affinity: 10 });
      const discount1 = favSystem.getTradeDiscount(npc.id);
      npcSystem.setAffinity(npc.id, 80);
      const discount2 = favSystem.getTradeDiscount(npc.id);
      // 折扣为乘数（<1表示有折扣），高好感度折扣更大（值更小）
      expect(discount2).toBeLessThanOrEqual(discount1);
    });
  });

  describe('多NPC并发操作', () => {
    it('同时操作多个NPC互不影响', () => {
      const { npcSystem } = createNPCEnv();
      const npc1 = npcSystem.createNPC('NPC-A', 'merchant', { x: 1, y: 1 }, { affinity: 30 });
      const npc2 = npcSystem.createNPC('NPC-B', 'warrior', { x: 2, y: 2 }, { affinity: 60 });
      npcSystem.changeAffinity(npc1.id, 20);
      npcSystem.moveNPC(npc2.id, { x: 50, y: 50 });
      const a = npcSystem.getNPCById(npc1.id);
      const b = npcSystem.getNPCById(npc2.id);
      expect(a?.affinity).toBe(50);
      expect(b?.position.x).toBe(50);
    });
  });

  describe('DialogSystem + FavorabilitySystem 联动', () => {
    it('好感度来源记录在历史中', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('历史测试', 'merchant', VALID_POSITION, { affinity: 30 });
      npcSystem.updateLastInteracted(npc.id, 5);
      favSystem.addDialogAffinity(npc.id, 5);
      favSystem.addGiftAffinity(npc.id, true, 10, 6);
      const history = favSystem.getNPCChangeHistory(npc.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(h => h.source === 'dialog')).toBe(true);
      expect(history.some(h => h.source === 'gift')).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期
// ═══════════════════════════════════════════════

describe('NPC对抗测试 — F-Lifecycle', () => {

  describe('NPCSystem 生命周期', () => {
    it('reset后恢复默认NPC', () => {
      const { npcSystem } = createNPCEnv();
      const defaultCount = npcSystem.getNPCCount();
      npcSystem.createNPC('额外NPC', 'merchant', VALID_POSITION);
      expect(npcSystem.getNPCCount()).toBe(defaultCount + 1);
      npcSystem.reset();
      expect(npcSystem.getNPCCount()).toBe(defaultCount);
    });

    it('序列化与反序列化一致性', () => {
      const { npcSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('序列化测试', 'merchant', VALID_POSITION, { affinity: 75 });
      npcSystem.changeAffinity(npc.id, 10);
      const saveData = npcSystem.exportSaveData();
      const countBefore = saveData.npcs.length;
      npcSystem.reset();
      npcSystem.importSaveData(saveData);
      const restored = npcSystem.getNPCById(npc.id);
      expect(restored).toBeDefined();
      expect(restored?.affinity).toBe(85);
      expect(npcSystem.getAllNPCs().length).toBe(countBefore);
    });

    it('update调用不报错', () => {
      const { npcSystem } = createNPCEnv();
      expect(() => npcSystem.update(16)).not.toThrow();
    });
  });

  describe('NPCDialogSystem 生命周期', () => {
    it('reset后清空所有会话', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      dialogSystem.startDialog('npc-1', treeIds[0]);
      dialogSystem.startDialog('npc-2', treeIds[0]);
      expect(dialogSystem.getActiveSessions().length).toBeGreaterThanOrEqual(2);
      dialogSystem.reset();
      expect(dialogSystem.getActiveSessions()).toEqual([]);
    });

    it('销毁单个会话', () => {
      const { dialogSystem } = createNPCEnv();
      const treeIds = dialogSystem.getDialogTreeIds();
      const session = dialogSystem.startDialog('npc-1', treeIds[0]);
      dialogSystem.destroySession(session!.id);
      expect(dialogSystem.getSession(session!.id)).toBeUndefined();
    });
  });

  describe('NPCFavorabilitySystem 生命周期', () => {
    it('reset后清空历史和冷却', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('生命周期', 'merchant', VALID_POSITION, { affinity: 50 });
      npcSystem.updateLastInteracted(npc.id, 1);
      favSystem.addDialogAffinity(npc.id, 1);
      favSystem.reset();
      expect(favSystem.getChangeHistory()).toEqual([]);
    });

    it('序列化与反序列化一致性', () => {
      const { npcSystem, favSystem } = createNPCEnv();
      const npc = npcSystem.createNPC('序列化好感', 'merchant', VALID_POSITION, { affinity: 50 });
      npcSystem.updateLastInteracted(npc.id, 1);
      favSystem.addDialogAffinity(npc.id, 1);
      const data = favSystem.serialize();
      favSystem.reset();
      favSystem.deserialize(data);
      expect(favSystem.getChangeHistory().length).toBeGreaterThan(0);
    });

    it('反序列化null数据被防护', () => {
      const { favSystem } = createNPCEnv();
      expect(() => favSystem.deserialize(null as any)).not.toThrow();
      expect(favSystem.getChangeHistory()).toEqual([]);
    });

    it('反序列化undefined数据被防护', () => {
      const { favSystem } = createNPCEnv();
      expect(() => favSystem.deserialize(undefined as any)).not.toThrow();
    });
  });

  describe('NPCSystem 完整生命周期', () => {
    it('创建→交互→删除完整流程', () => {
      const { npcSystem } = createNPCEnv();
      // 创建
      const npc = npcSystem.createNPC('完整流程', 'merchant', VALID_POSITION);
      expect(npcSystem.hasNPC(npc.id)).toBe(true);
      // 交互
      npcSystem.changeAffinity(npc.id, 30);
      npcSystem.moveNPC(npc.id, { x: 10, y: 10 });
      npcSystem.updateLastInteracted(npc.id, 5);
      // 验证
      const updated = npcSystem.getNPCById(npc.id);
      expect(updated?.affinity).toBeGreaterThan(0);
      expect(updated?.lastInteractedAt).toBe(5);
      // 删除
      expect(npcSystem.removeNPC(npc.id)).toBe(true);
      expect(npcSystem.hasNPC(npc.id)).toBe(false);
    });

    it('NPC系统事件发射验证', () => {
      const { deps, npcSystem } = createNPCEnv();
      // 创建事件
      const npc = npcSystem.createNPC('事件测试', 'merchant', VALID_POSITION);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('npc:created', { npcId: npc.id });
      // 移动事件
      npcSystem.moveNPC(npc.id, { x: 20, y: 20 });
      expect(deps.eventBus.emit).toHaveBeenCalledWith('npc:moved', expect.objectContaining({ npcId: npc.id }));
      // 删除事件
      npcSystem.removeNPC(npc.id);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('npc:removed', { npcId: npc.id });
    });
  });
});
